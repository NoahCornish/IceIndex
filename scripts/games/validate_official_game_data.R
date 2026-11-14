# IceIndex v0.10.0 — read-only official game data audit
# Run from IceIndex repository root:
# source('scripts/games/validate_official_game_data.R')
local({
  season <- Sys.getenv('ICEINDEX_GAME_SEASON', '2026-27')
  base <- file.path('data', 'games', season)
  raw <- file.path(base, 'summaries_raw')
  if (!requireNamespace('jsonlite', quietly=TRUE)) stop('Install jsonlite first: install.packages("jsonlite")')
  files <- list.files(raw, pattern='^[0-9]+\\.json$', full.names=TRUE)
  if (!length(files)) stop('No cached summaries found in ', raw)
  audit_dir <- file.path(base, 'validation')
  dir.create(audit_dir, recursive=TRUE, showWarnings=FALSE)
  value <- function(x, key, default=NA_character_) {
    z <- if (is.list(x)) x[[key]] else NULL
    if (is.null(z) || length(z)!=1L || is.list(z) || is.na(z) || !nzchar(as.character(z))) default else as.character(z)
  }
  number <- function(x, key) suppressWarnings(as.numeric(value(x,key)))
  rows <- list(); issues <- list(); goalie_rows <- list()
  issue <- function(id, type, severity, detail) {
    issues[[length(issues)+1L]] <<- data.frame(game_id=id,check=type,severity=severity,detail=detail,stringsAsFactors=FALSE)
  }
  flagged <- c('29036','29061','29073','29076','29077','29113','29124','29192')
  for (i in seq_along(files)) {
    path <- files[[i]]; id <- sub('\\.json$','',basename(path))
    if (i==1L || i%%25L==0L || i==length(files)) cat(sprintf('Validating %d/%d: %s\n',i,length(files),id))
    doc <- tryCatch(jsonlite::fromJSON(path,simplifyVector=FALSE),error=function(e)e)
    if (inherits(doc,'error')) { issue(id,'json_parse','ERROR',conditionMessage(doc));next }
    g <- doc$GC$Gamesummary
    if (is.null(g) || !is.list(g)) {issue(id,'missing_summary','ERROR','GC.Gamesummary missing');next}
    m <- g$meta
    hg <- number(m,'home_goal_count'); vg <- number(m,'visiting_goal_count')
    goals <- g$goals; if(is.null(goals)) goals <- list()
    actual_h <- sum(vapply(goals,function(z) identical(value(z,'home'),'1'),logical(1)))
    actual_v <- length(goals)-actual_h
    final <- identical(value(m,'final'),'1')
    shootout <- identical(value(m,'shootout'),'1')
    discrepancy <- is.finite(hg) && is.finite(vg) && (actual_h!=hg || actual_v!=vg)
    rows[[length(rows)+1L]] <- data.frame(game_id=id,date=value(m,'date_played'),status=value(g,'status_value'),final=final,shootout=shootout,home=value(g$home,'name'),visitor=value(g$visitor,'name'),home_score=hg,visitor_score=vg,home_goal_events=actual_h,visitor_goal_events=actual_v,home_difference=hg-actual_h,visitor_difference=vg-actual_v,goal_count_match=!discrepancy,previously_flagged=id %in% flagged,stringsAsFactors=FALSE)
    if (discrepancy) issue(id,'goal_event_mismatch',if(final && !shootout) 'REVIEW' else 'INFO',sprintf('Home score/events: %s/%s; visitor score/events: %s/%s; final=%s; shootout=%s',hg,actual_h,vg,actual_v,final,shootout))
    if (final && (is.na(hg) || is.na(vg))) issue(id,'missing_final_score','ERROR','Final game missing score')
    if (final && length(goals)==0L && is.finite(hg+vg) && hg+vg>0) issue(id,'no_goal_events','REVIEW','Final game has score but no goal events')
    if (length(goals)) for (j in seq_along(goals)) {
      z <- goals[[j]]
      if(is.na(value(z$goal_scorer,'player_id'))) issue(id,'missing_scorer','REVIEW',paste('Goal',j,'has no scorer ID'))
    }
    for (side in c('home','visitor')) {
      lineup <- g[[paste0(side,'_team_lineup')]]
      if(is.null(lineup)) {if(final) issue(id,'missing_lineup','REVIEW',paste(side,'lineup missing'));next}
      goalies <- lineup$goalies
      if(is.null(goalies)) next
      for (j in seq_along(goalies)) {
        p <- goalies[[j]]
        sa <- number(p,'shots_against'); sv <- number(p,'saves'); ga <- number(p,'goals_against')
        goalie_rows[[length(goalie_rows)+1L]] <- data.frame(game_id=id,side=side,player_id=value(p,'player_id'),player_name=paste(value(p,'first_name',''),value(p,'last_name','')),shots_against=sa,saves=sv,goals_against=ga,arithmetic_valid=if(all(is.finite(c(sa,sv,ga)))) sa==sv+ga else NA,stringsAsFactors=FALSE)
        if(all(is.finite(c(sa,sv,ga))) && sa!=sv+ga) issue(id,'goalie_arithmetic','REVIEW',sprintf('%s goalie %s: SA=%s SV=%s GA=%s',side,value(p,'player_id'),sa,sv,ga))
        if(any(is.finite(c(sa,sv,ga)) & c(sa,sv,ga)<0)) issue(id,'negative_goalie_stat','ERROR',paste(side,value(p,'player_id')))
      }
    }
  }
  bind <- function(x) if(length(x)) do.call(rbind,x) else data.frame()
  games <- bind(rows); problems <- bind(issues); goalies <- bind(goalie_rows)
  write.csv(games,file.path(audit_dir,'game_score_audit.csv'),row.names=FALSE,na='')
  write.csv(problems,file.path(audit_dir,'validation_issues.csv'),row.names=FALSE,na='')
  write.csv(goalies,file.path(audit_dir,'goalie_arithmetic_audit.csv'),row.names=FALSE,na='')
  if(nrow(games)) write.csv(games[games$previously_flagged | !games$goal_count_match,,drop=FALSE],file.path(audit_dir,'flagged_games_detail.csv'),row.names=FALSE,na='')
  cat(sprintf('\nAUDIT COMPLETE: %d parsed games | %d scoring discrepancies | %d issues | %d goalie records\n',nrow(games),if(nrow(games))sum(!games$goal_count_match) else 0,nrow(problems),nrow(goalies)))
  if(nrow(problems)) print(table(problems$check,problems$severity))
  cat('Reports saved to: ',normalizePath(audit_dir), '\n',sep='')
  cat('This script does not change source JSON, official CSVs, collectors, or refresh.R.\n')
})
