# IceIndex v0.10.0 - incremental official OHL game-summary collector
# Run from IceIndex repository root. Does NOT edit refresh.R.
# Required: jsonlite. Optional: curl (recommended for HTTP timeout/retries).
# Controls: ICEINDEX_GAME_IDS, ICEINDEX_GAME_SEASON, ICEINDEX_FORCE_SUMMARIES,
# ICEINDEX_MAX_GAMES_PER_RUN (0=unlimited), ICEINDEX_SUMMARY_MAX_AGE_HOURS.
local({
  if (!requireNamespace('jsonlite', quietly=TRUE)) stop('Install jsonlite: install.packages("jsonlite")')
  season <- Sys.getenv('ICEINDEX_GAME_SEASON','2026-27')
  base <- file.path('data','games',season)
  raw_dir <- file.path(base,'summaries_raw')
  dir.create(raw_dir,recursive=TRUE,showWarnings=FALSE)
  manual <- trimws(strsplit(Sys.getenv('ICEINDEX_GAME_IDS',''),',',fixed=TRUE)[[1]])
  manual <- unique(manual[nzchar(manual)])
  ids <- manual
  if (!length(ids)) {
    schedule <- file.path(base,'schedule.csv')
    if (!file.exists(schedule)) stop('Missing ',schedule)
    tab <- read.csv(schedule,colClasses='character',check.names=FALSE,stringsAsFactors=FALSE)
    col <- intersect(c('ID','game_id','GameID','id'),names(tab))
    if (!length(col)) stop('No game ID column in ',schedule)
    ids <- trimws(tab[[col[1]]])
    if ('Date' %in% names(tab)) {
      dates <- suppressWarnings(as.Date(tab$Date))
      if (any(!is.na(dates))) ids <- ids[!is.na(dates) & dates <= Sys.Date()]
      else warning('Could not parse schedule dates: including all game IDs')
    }
    ids <- unique(ids)
  }
  ids <- ids[grepl('^[0-9]+$',ids)]
  if (!length(ids)) stop('No eligible game IDs')
  force <- tolower(Sys.getenv('ICEINDEX_FORCE_SUMMARIES','false')) %in% c('true','yes','1')
  max_age <- suppressWarnings(as.numeric(Sys.getenv('ICEINDEX_SUMMARY_MAX_AGE_HOURS','24')))
  if (!is.finite(max_age) || max_age < 0) max_age <- 24
  limit <- suppressWarnings(as.integer(Sys.getenv('ICEINDEX_MAX_GAMES_PER_RUN','0')))
  if (is.na(limit) || limit < 0) limit <- 0L
  key <- Sys.getenv('ICEINDEX_HOCKEYTECH_KEY','f1aa699db3d81487')
  if (!nzchar(key)) stop('Missing ICEINDEX_HOCKEYTECH_KEY')
  valid_cache <- function(path) {
    if (!file.exists(path)) return(NULL)
    tryCatch(jsonlite::fromJSON(path,simplifyVector=FALSE)$GC$Gamesummary$meta,error=function(e) NULL)
  }
  todo <- character(); reused <- 0L
  for (id in ids) {
    path <- file.path(raw_dir,paste0(id,'.json'))
    meta <- valid_cache(path)
    age <- if (file.exists(path)) as.numeric(difftime(Sys.time(),file.info(path)$mtime,units='hours')) else Inf
    final_old <- !is.null(meta) && identical(as.character(meta$final),'1') && age >= 168
    if (!force && !is.null(meta) && (age < max_age || final_old)) reused <- reused+1L
    else todo <- c(todo,id)
  }
  if (limit > 0L && length(todo) > limit) {
    message('Batch mode: processing first ',limit,' of ',length(todo),' games needing download. Run again for next batch.')
    todo <- head(todo,limit)
  }
  cat(sprintf('IceIndex summaries: %d scheduled IDs | %d cached | %d to download now\n',length(ids),reused,length(todo)))
  downloaded <- 0L; failed <- character(); empty <- character()
  for (i in seq_along(todo)) {
    id <- todo[[i]]
    cat(sprintf('[%d/%d] Game %s ... ',i,length(todo),id)); flush.console()
    url <- paste0('https://lscluster.hockeytech.com/feed/?feed=gc&key=',utils::URLencode(key,reserved=TRUE),
                  '&game_id=',id,'&client_code=ohl&tab=gamesummary&lang_code=en&fmt=json')
    response <- NULL
    for (attempt in 1:3) {
      response <- tryCatch({
        if (requireNamespace('curl',quietly=TRUE)) {
          handle <- curl::new_handle(timeout=25,connecttimeout=10,useragent='IceIndex/0.10.0')
          result <- curl::curl_fetch_memory(url,handle=handle)
          if (result$status_code != 200) stop('HTTP ',result$status_code)
          rawToChar(result$content)
        } else {
          old <- getOption('timeout'); options(timeout=25)
          on.exit(options(timeout=old),add=TRUE)
          paste(readLines(url,warn=FALSE,encoding='UTF-8'),collapse='\n')
        }
      },error=function(e) {message('attempt ',attempt,': ',conditionMessage(e));NULL})
      if (!is.null(response) && nzchar(response)) break
      if (attempt < 3) Sys.sleep(attempt)
    }
    if (is.null(response) || !nzchar(response)) {failed<-c(failed,id);cat('FAILED\n');next}
    response <- sub('^[[:space:]]*[A-Za-z_$][A-Za-z0-9_$]*[[:space:]]*\\([[:space:]]*','',response)
    response <- sub('[[:space:]]*\\)[[:space:]]*;?[[:space:]]*$','',response)
    doc <- tryCatch(jsonlite::fromJSON(response,simplifyVector=FALSE),error=function(e) NULL)
    meta <- doc$GC$Gamesummary$meta
    if (is.null(meta)) {empty<-c(empty,id);cat('NO GAME DATA\n');next}
    target <- file.path(raw_dir,paste0(id,'.json'))
    tmp <- tempfile(tmpdir=raw_dir,fileext='.json')
    writeLines(jsonlite::toJSON(doc,auto_unbox=TRUE,null='null',pretty=TRUE),tmp,useBytes=TRUE)
    # Preserve the old cache if replacement fails.
    if (!file.copy(tmp,target,overwrite=TRUE)) {failed<-c(failed,id);cat('WRITE FAILED\n')}
    else {downloaded<-downloaded+1L;cat(if (identical(as.character(meta$final),'1')) 'FINAL\n' else 'SAVED\n')}
    unlink(tmp)
    Sys.sleep(0.5)
  }
  cat(sprintf('Finished: %d downloaded | %d reused | %d failed | %d empty\n',downloaded,reused,length(failed),length(empty)))
  if (length(failed)) warning('Failed IDs: ',paste(failed,collapse=', '))
  if (length(empty)) message('No data IDs: ',paste(empty,collapse=', '))
  if (!length(list.files(raw_dir,pattern='^[0-9]+\\.json$'))) stop('No cached summaries available')
})
