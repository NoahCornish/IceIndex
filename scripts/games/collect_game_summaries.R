# IceIndex v0.12.1 diagnostic - freshness-aware official OHL game-summary collector
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
      if (any(!is.na(dates))) ids <- ids[!is.na(dates) & dates <= as.Date(format(Sys.time(), '%Y-%m-%d', tz='America/Toronto'))]
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
  # Assess completeness, not merely whether the API marked a game final.
  summary_quality <- function(doc) {
    g <- tryCatch(doc$GC$Gamesummary, error=function(e) NULL)
    if (is.null(g) || is.null(g$meta)) return(list(valid=FALSE, complete=FALSE, score=NA_character_, richness=-1L))
    m <- g$meta
    final <- identical(as.character(m$final), '1')
    home <- suppressWarnings(as.numeric(m$home_goal_count))
    away <- suppressWarnings(as.numeric(m$visiting_goal_count))
    if (length(home)!=1L || length(away)!=1L || !is.finite(home) || !is.finite(away))
      return(list(valid=TRUE, complete=FALSE, score=NA_character_, richness=0L))
    goals <- g$goals
    goal_count <- length(goals)
    status <- paste(as.character(g$status_value), collapse=' ')
    # A shootout may add a single scoreboard goal not present in the goal list.
    shootout <- grepl('SO|shootout', status, ignore.case=TRUE)
    goal_ok <- goal_count == home+away || (shootout && goal_count == home+away-1L)
    teams <- g$totalShotsOn
    shots <- tryCatch(c(as.numeric(teams$home),as.numeric(teams$visitor)),error=function(e) numeric())
    shots_ok <- length(shots)==2L && all(is.finite(shots)) &&
      (sum(shots)>0 || home+away==0)
    # Do not require three stars: the league may publish them later.
    complete <- final && goal_ok && shots_ok
    richness <- as.integer(goal_count + 2L*length(g$penalties) +
                             2L*length(g$mvps) + 3L*length(g$home_team_lineup$goalies) +
                             3L*length(g$visitor_team_lineup$goalies) +
                             if (shots_ok) 10L else 0L)
    list(valid=TRUE, complete=complete, score=paste(away,home,sep='-'),
         richness=richness, final=final)
  }
  read_cache <- function(path) {
    if (!file.exists(path)) return(NULL)
    tryCatch(jsonlite::fromJSON(path,simplifyVector=FALSE),error=function(e) NULL)
  }
  # Eastern time matters when a GitHub runner uses UTC.
  eastern_today <- as.Date(format(Sys.time(), '%Y-%m-%d', tz='America/Toronto'))
  schedule_dates <- setNames(rep(as.Date(NA),length(ids)),ids)
  if (file.exists(file.path(base,'schedule.csv'))) {
    sched <- tryCatch(read.csv(file.path(base,'schedule.csv'),colClasses='character',check.names=FALSE),error=function(e) NULL)
    if (!is.null(sched)) {
      idcol <- intersect(c('ID','game_id','GameID','id'),names(sched))
      datecol <- intersect(c('Date','date','game_date'),names(sched))
      if (length(idcol) && length(datecol)) {
        sd <- suppressWarnings(as.Date(sched[[datecol[1]]]))
        schedule_dates <- setNames(sd,trimws(sched[[idcol[1]]]))
      }
    }
  }
  todo <- character(); reused <- 0L
  for (id in ids) {
    path <- file.path(raw_dir,paste0(id,'.json'))
    cached <- read_cache(path)
    quality <- summary_quality(cached)
    age <- if (file.exists(path)) as.numeric(difftime(Sys.time(),file.info(path)$mtime,units='hours')) else Inf
    game_date <- schedule_dates[[id]]
    days_old <- if (!is.null(game_date) && !is.na(game_date)) as.numeric(eastern_today-game_date) else NA_real_
    # Recent games: every 15 minutes; days 2-7: every 6 hours.
    # Older complete finals: weekly; older incomplete finals: every 6 hours.
    ttl <- max_age
    if (is.finite(days_old)) {
      if (days_old <= 1) ttl <- 0.25
      else if (days_old <= 7) ttl <- 6
      else if (isTRUE(quality$complete)) ttl <- 168
      else ttl <- 6
    }
    if (!force && isTRUE(quality$valid) && age < ttl) reused <- reused+1L
    else todo <- c(todo,id)
  }
  # With a run limit, prioritize newest games rather than oldest IDs.
  if (length(todo)>1L) {
    d <- as.numeric(schedule_dates[todo]); d[is.na(d)] <- -Inf
    todo <- todo[order(d,decreasing=TRUE)]
  }
  if (limit > 0L && length(todo) > limit) {
    message('Batch mode: processing first ',limit,' of ',length(todo),' games needing download. Run again for next batch.')
    todo <- head(todo,limit)
  }
  cat(sprintf('IceIndex summaries: %d scheduled IDs | %d cached | %d to download now\n',length(ids),reused,length(todo)))
  downloaded <- 0L; failed <- character(); empty <- character()
  diagnostic_rows <- list()
  record_diagnostic <- function(id, action, old, new) {
    diagnostic_rows[[length(diagnostic_rows)+1L]] <<- data.frame(
      game_id=id, action=action,
      old_score=as.character(old$score %||% ''), new_score=as.character(new$score %||% ''),
      old_complete=isTRUE(old$complete), new_complete=isTRUE(new$complete),
      old_richness=as.integer(old$richness %||% -1L),
      new_richness=as.integer(new$richness %||% -1L),
      stringsAsFactors=FALSE)
  }
  `%||%` <- function(a,b) if(is.null(a) || length(a)==0L || all(is.na(a))) b else a
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
    old_doc <- read_cache(target)
    old_quality <- summary_quality(old_doc)
    new_quality <- summary_quality(doc)
    # Never replace a complete final with a partial response for the same score.
    if (isTRUE(old_quality$complete) && !isTRUE(new_quality$complete) &&
        identical(old_quality$score,new_quality$score)) {
      record_diagnostic(id,'preserved_complete_cache',old_quality,new_quality)
      reused <- reused+1L
      cat('PRESERVED COMPLETE CACHE\n')
      next
    }
    # Same final score, less detailed response: retain richer official record.
    if (isTRUE(old_quality$final) && isTRUE(new_quality$final) &&
        identical(old_quality$score,new_quality$score) &&
        new_quality$richness < old_quality$richness) {
      record_diagnostic(id,'preserved_richer_cache',old_quality,new_quality)
      reused <- reused+1L
      cat('PRESERVED RICHER CACHE\n')
      next
    }
    tmp <- tempfile(tmpdir=raw_dir,fileext='.json')
    writeLines(jsonlite::toJSON(doc,auto_unbox=TRUE,null='null',pretty=TRUE),tmp,useBytes=TRUE)
    # Preserve the old cache if replacement fails.
    if (!file.copy(tmp,target,overwrite=TRUE)) {
      record_diagnostic(id,'write_failed',old_quality,new_quality)
      failed<-c(failed,id);cat('WRITE FAILED\n')
    } else {
      record_diagnostic(id,'saved',old_quality,new_quality)
      downloaded<-downloaded+1L
      cat(if (identical(as.character(meta$final),'1')) 'FINAL\n' else 'SAVED\n')
    }
    unlink(tmp)
    Sys.sleep(0.5)
  }
  if (length(diagnostic_rows)) {
    audit_path <- file.path(base,'summary_refresh_diagnostics.csv')
    write.csv(do.call(rbind,diagnostic_rows),audit_path,row.names=FALSE,na='')
    cat('Diagnostic report: ',audit_path,'\n',sep='')
  }
  cat(sprintf('Finished: %d downloaded | %d reused | %d failed | %d empty\n',downloaded,reused,length(failed),length(empty)))
  if (length(failed)) warning('Failed IDs: ',paste(failed,collapse=', '))
  if (length(empty)) message('No data IDs: ',paste(empty,collapse=', '))
  if (!length(list.files(raw_dir,pattern='^[0-9]+\\.json$'))) stop('No cached summaries available')
})