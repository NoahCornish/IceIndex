# IceIndex Image Library — v0.13.0
# Run from the IceIndex repository root: source('scripts/collect_images.R')
# Base R only. Team logos only; review rights before public redistribution.

CONFIG <- list(
  season = '2026-27',
  download_enabled = identical(tolower(Sys.getenv('ICEINDEX_IMAGE_DOWNLOADS', 'true')), 'true'), # Team logos only
  download_players = FALSE,
  download_teams = TRUE,
  overwrite = FALSE,
  protected_team_codes = c('BRAM', 'NIAG'), # Preserve custom transparent logos; never fetch these teams
  max_file_mb = 5,
  delay_seconds = 0.3,
  missing_retry_days = 30, # Cache missing/invalid image responses for 30 days
  cache_file = 'data/images/image_fetch_cache.csv',
  player_directory = 'data/processed/ohl/player_directory.csv',
  goalie_directory = 'data/processed/ohl/goalie_directory.csv',
  game_logs = 'data/games/2026-27/player_game_logs_enriched.csv',
  output_root = 'assets',
  manifest_directory = 'data/images'
)

# Official filename mapping as present in IceIndex's ohl-branding.js.
TEAMS <- data.frame(
  name = c('Barrie Colts','Brampton Steelheads','Brantford Bulldogs','Erie Otters',
           'Flint Firebirds','Guelph Storm','Kingston Frontenacs','Kitchener Rangers',
           'London Knights','Niagara IceDogs','North Bay Battalion','Oshawa Generals',
           "Ottawa 67's",'Owen Sound Attack','Peterborough Petes','Saginaw Spirit',
           'Sarnia Sting','Soo Greyhounds','Sudbury Wolves','Windsor Spitfires'),
  code = c('BAR','BRAM','BFD','ER','FLNT','GUE','KGN','KIT','LDN','NIAG',
           'NB','OSH','OTT','OS','PBO','SAG','SAR','SOO','SBY','WSR'),
  filename = c('7.png','18.jpg','1.png','8.png','13.png','9.png','2.png',
               '10.png','14.png','20.jpg','19.png','4.png','5_88.png','11.png',
               '6.png','34.png','15.png','16.png','12.png','17.png'),
  stringsAsFactors = FALSE
)

# Ensure script is launched from repository root, not from scripts/.
if (!file.exists('js/ohl-branding.js') && file.exists('../js/ohl-branding.js')) {
  stop('Run from the IceIndex repository root. Example: source("scripts/collect_images.R")')
}
if (!file.exists('js/ohl-branding.js')) {
  stop('Cannot locate js/ohl-branding.js. Set RStudio working directory to IceIndex repository root.')
}

norm_key <- function(x) tolower(gsub('[^a-z0-9]', '', x))
read_optional <- function(path) {
  if (!file.exists(path)) { message('Not found (skipping): ', path); return(NULL) }
  tryCatch(read.csv(path, colClasses = 'character', check.names = FALSE,
                    fileEncoding = 'UTF-8-BOM', stringsAsFactors = FALSE),
           error = function(e) {warning('Could not read ', path, ': ', conditionMessage(e)); NULL})
}
column <- function(df, aliases) {
  if (is.null(df) || !nrow(df)) return(character())
  names_key <- norm_key(names(df))
  for (alias in aliases) {
    pos <- match(norm_key(alias), names_key)
    if (!is.na(pos)) return(as.character(df[[pos]]))
  }
  rep('', nrow(df))
}

collect_ids <- function() {
  inputs <- list(
    list(path=CONFIG$player_directory, ids=c('PlayerID','player_id','ID')),
    list(path=CONFIG$goalie_directory, ids=c('GoalieID','PlayerID','goalie_id','player_id','ID')),
    list(path=CONFIG$game_logs, ids=c('PlayerID','player_id','ID'))
  )
  out <- list()
  for (input in inputs) {
    df <- read_optional(input$path)
    if (is.null(df)) next
    ids <- trimws(column(df,input$ids))
    names <- column(df,c('PlayerName','GoalieName','player_name','goalie_name','FullName','Name'))
    good <- grepl('^[0-9]+$', ids)
    if (any(good)) out[[length(out)+1L]] <- data.frame(
      player_id=ids[good], player_name=names[good], stringsAsFactors=FALSE)
  }
  if (!length(out)) return(data.frame(player_id=character(),player_name=character()))
  all <- do.call(rbind,out)
  all <- all[order(all$player_id, !nzchar(all$player_name)),,drop=FALSE]
  all[!duplicated(all$player_id),,drop=FALSE]
}

# Avoid downloading error pages as images: validate magic bytes and image size.
valid_image <- function(path, ext) {
  if (!file.exists(path) || file.info(path)$size < 100) return(FALSE)
  con <- file(path,'rb'); on.exit(close(con))
  bytes <- readBin(con,'raw',n=12)
  if (length(bytes)<8) return(FALSE)
  b <- as.integer(bytes)
  if (ext=='jpg') return(all(b[1:3]==c(255,216,255)))
  if (ext=='png') return(all(b[1:8]==c(137,80,78,71,13,10,26,10)))
  FALSE
}

read_cache <- function() {
  path <- CONFIG$cache_file
  if (!file.exists(path)) return(data.frame(url=character(), status=character(), checked_at=character(), stringsAsFactors=FALSE))
  tryCatch(read.csv(path, stringsAsFactors=FALSE, colClasses='character'), error=function(e) {
    warning('Could not read image cache: ', conditionMessage(e))
    data.frame(url=character(), status=character(), checked_at=character(), stringsAsFactors=FALSE)
  })
}
image_cache <- read_cache()
cache_result <- function(url, status) {
  image_cache <<- image_cache[image_cache$url != url, , drop=FALSE]
  image_cache <<- rbind(image_cache, data.frame(url=url,status=status,checked_at=format(Sys.time(),'%Y-%m-%dT%H:%M:%SZ',tz='UTC'),stringsAsFactors=FALSE))
}
cache_recent_failure <- function(url) {
  if (!nrow(image_cache)) return(FALSE)
  match_row <- image_cache[image_cache$url == url, , drop=FALSE]
  if (!nrow(match_row) || !match_row$status[1] %in% c('invalid_or_missing_image','exceeds_size_limit')) return(FALSE)
  age <- as.numeric(difftime(Sys.time(), as.POSIXct(match_row$checked_at[1], format='%Y-%m-%dT%H:%M:%SZ', tz='UTC'),units='days'))
  is.finite(age) && age < CONFIG$missing_retry_days
}
fetch_image <- function(url, dest, ext) {
  if (file.exists(dest) && valid_image(dest,ext) && !CONFIG$overwrite) return('existing')
  if (!CONFIG$download_enabled) return('not_downloaded_permission_required')
  if (!CONFIG$overwrite && cache_recent_failure(url)) return('cached_missing_skip')
  dir.create(dirname(dest),recursive=TRUE,showWarnings=FALSE)
  tmp <- tempfile(fileext=paste0('.',ext))
  on.exit(unlink(tmp),add=TRUE)
  result <- tryCatch({
    suppressWarnings(download.file(url,tmp,mode='wb',quiet=TRUE,method='libcurl'))
    if (!valid_image(tmp,ext)) return('invalid_or_missing_image')
    if (file.info(tmp)$size > CONFIG$max_file_mb*1024^2) return('exceeds_size_limit')
    if (file.exists(dest)) unlink(dest)
    if (!file.copy(tmp,dest,overwrite=TRUE)) return('write_failed')
    'downloaded'
  },error=function(e) paste0('error: ',conditionMessage(e)))
  if (result %in% c('downloaded','invalid_or_missing_image','exceeds_size_limit')) cache_result(url,result)
  Sys.sleep(CONFIG$delay_seconds)
  result
}

run_collection <- function() {
  player_dir <- file.path(CONFIG$output_root,'players','ohl',CONFIG$season)
  team_dir <- file.path(CONFIG$output_root,'teams','ohl')
  dir.create(CONFIG$manifest_directory,recursive=TRUE,showWarnings=FALSE)
  players <- data.frame(player_id=character(),player_name=character())
  message('Team logos only: no player headshots will be downloaded.')
  results <- list()
  if (CONFIG$download_players && nrow(players)) {
    for (i in seq_len(nrow(players))) {
      id <- players$player_id[i]
      url <- sprintf('https://assets.leaguestat.com/ohl/240x240/%s.jpg',id)
      dest <- file.path(player_dir,paste0(id,'.jpg'))
      state <- fetch_image(url,dest,'jpg')
      results[[length(results)+1L]] <- data.frame(type='player',id=id,
                                                  name=players$player_name[i],url=url,path=dest,status=state)
      if (i %% 100 == 0) message('Players: ',i,' / ',nrow(players))
    }
  }
  if (CONFIG$download_teams) {
    for (i in seq_len(nrow(TEAMS))) {
      if (TEAMS$code[i] %in% CONFIG$protected_team_codes) {
        message('Protected custom team logo (download skipped): ', TEAMS$name[i])
        next
      }
      name <- TEAMS$filename[i]
      ext <- tolower(tools::file_ext(name))
      url <- paste0('https://assets.leaguestat.com/ohl/logos/',name)
      dest <- file.path(team_dir,name)
      state <- fetch_image(url,dest,ext)
      results[[length(results)+1L]] <- data.frame(type='team',id=TEAMS$code[i],
                                                  name=TEAMS$name[i],url=url,path=dest,status=state)
    }
  }
  manifest <- if (length(results)) do.call(rbind,results) else
    data.frame(type=character(),id=character(),name=character(),url=character(),path=character(),status=character())
  path <- file.path(CONFIG$manifest_directory,'image_manifest.csv')
  write.csv(manifest,path,row.names=FALSE,na='')
  write.csv(image_cache, CONFIG$cache_file, row.names=FALSE, na='')
  message('Manifest: ',path)
  print(table(manifest$status,useNA='ifany'))
  message('Individual images stay below ',CONFIG$max_file_mb,' MB each.')
  if (!CONFIG$download_enabled) message('Inventory only. Logo downloads disabled by ICEINDEX_IMAGE_DOWNLOADS=false.')
  invisible(manifest)
}

run_collection()
