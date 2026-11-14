# IceIndex v0.10.0 — local-only Game Centre enrichment.
# Run from the IceIndex repository root after build_shot_locations.R.
# IMPORTANT: shot events are not guaranteed to equal official SOG.
season <- '2026-27'
base <- file.path('data','games',season)
shotfile <- file.path(base,'player_shot_locations.csv')
schedulefile <- file.path(base,'schedule.csv')
if (!file.exists(shotfile) || !file.exists(schedulefile)) stop('Missing shot or schedule CSV')
s <- read.csv(shotfile,colClasses='character',check.names=FALSE,stringsAsFactors=FALSE)
g <- read.csv(schedulefile,colClasses='character',check.names=FALSE,stringsAsFactors=FALSE)
col <- function(d,names) { for (n in names) if(n %in% names(d)) return(as.character(d[[n]])); rep('',nrow(d)) }
clean <- function(x) { x <- trimws(as.character(x)); x[is.na(x)] <- ''; x }
ids <- col(g,c('ID','game_id'))
metadata <- data.frame(game_id=ids,arena=clean(col(g,c('Venue','VenueName','Arena','ArenaName','venue','arena','Location'))),attendance=clean(col(g,c('Attendance','attendance','GameAttendance'))),stringsAsFactors=FALSE)
# Supplement only where an existing local CSV has authoritative metadata.
manual <- file.path(base,'game_metadata_overrides.csv')
if(file.exists(manual)) {
  m <- read.csv(manual,colClasses='character',stringsAsFactors=FALSE)
  if(all(c('game_id','arena','attendance') %in% names(m))) for(i in seq_len(nrow(m))) {
    idx <- which(metadata$game_id==m$game_id[i]); if(length(idx)==1L) {
      if(nzchar(clean(m$arena[i]))) metadata$arena[idx] <- clean(m$arena[i])
      if(nzchar(clean(m$attendance[i]))) metadata$attendance[idx] <- clean(m$attendance[i])
    }
  }
}
write.csv(metadata,file.path(base,'game_metadata.csv'),row.names=FALSE,na='')
# Home/away team IDs from enriched game logs, which already map team IDs to venues.
logfile <- file.path(base,'player_game_logs_enriched.csv')
logs <- if(file.exists(logfile)) read.csv(logfile,colClasses='character',stringsAsFactors=FALSE) else data.frame()
side_for <- function(game,team) {
  if(!nrow(logs)||!all(c('game_id','team_id','home_away') %in% names(logs))) return('unknown')
  v <- unique(logs$home_away[logs$game_id==game & logs$team_id==team]); v<-v[!is.na(v)&nzchar(v)]
  if(length(v)!=1L) return('unknown')
  if(v=='H') 'home' else if(v=='A') 'away' else 'unknown'
}
s$game_id <- clean(col(s,'game_id')); s$team_id <- clean(col(s,'team_id')); s$period <- clean(col(s,'period'))
s$event_type <- tolower(clean(col(s,'event_type')))
keys <- unique(s[,c('game_id','team_id','period'),drop=FALSE]); periods <- vector('list',nrow(keys))
for(i in seq_len(nrow(keys))) {
  k<-keys[i,]; d<-s[s$game_id==k$game_id & s$team_id==k$team_id & s$period==k$period,,drop=FALSE]
  periods[[i]]<-data.frame(game_id=k$game_id,side=side_for(k$game_id,k$team_id),team_id=k$team_id,period=k$period,goals=sum(d$event_type=='goal'),shot_events=sum(d$event_type=='shot'),stringsAsFactors=FALSE)
}
periods<-do.call(rbind,periods)
write.csv(periods,file.path(base,'game_period_stats.csv'),row.names=FALSE,na='')
# Goalie statistics derived from goalie-attributed events only; estimates, not official saves.
# Group by goalie name (ID not available in published shot CSV).
s$goalie_name<-clean(col(s,'goalie_name'))
keepers<-unique(s[s$goalie_name!='',c('game_id','goalie_name'),drop=FALSE]); out<-vector('list',nrow(keepers))
for(i in seq_len(nrow(keepers))) {
  k<-keepers[i,];d<-s[s$game_id==k$game_id&s$goalie_name==k$goalie_name,,drop=FALSE]
  shots<-sum(d$event_type=='shot');goals<-sum(d$event_type=='goal'); faced<-shots+goals
  # Source team_id is SHOOTING team, not the defending goalie's team.
  out[[i]]<-data.frame(game_id=k$game_id,goalie_name=k$goalie_name,team_id='',team_name='',shot_events_against=faced,goals_against=goals,estimated_saves=shots,estimated_save_pct=if(faced>0) sprintf('%.3f',shots/faced) else '',stringsAsFactors=FALSE)
}
if(length(out)) {out<-do.call(rbind,out)} else {out<-data.frame(game_id=character(),goalie_name=character(),team_id=character(),team_name=character(),shot_events_against=integer(),goals_against=integer(),estimated_saves=integer(),estimated_save_pct=character())}
write.csv(out,file.path(base,'game_goalie_stats.csv'),row.names=FALSE,na='')
cat('IceIndex Game Centre metadata export complete\n',nrow(metadata),'games,',nrow(periods),'team-periods,',nrow(out),'goalie-event summaries\n')
cat('Attendance/arena remain blank unless provided by schedule or verified overrides.\n')
cat('Goalie saves and period shots are EVENT-BASED estimates, not official totals.\n')
