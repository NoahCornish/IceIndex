# IceIndex v0.10.0 — read-only attacking-direction audit
# Run from repository root: source('scripts/games/build_shot_orientation_audit.R')
# Does not modify caches or published shot CSVs.
input <- 'data/games/2026-27/events'
files <- list.files(input, '\\.rds$', full.names=TRUE)
if (!length(files)) stop('No .rds files found in ', input)
getcol <- function(x, name) if (name %in% names(x)) as.character(x[[name]]) else rep(NA_character_, nrow(x))
read_game <- function(f) {
  x <- readRDS(f)
  if (!is.data.frame(x) || !nrow(x)) return(NULL)
  ev <- tolower(trimws(getcol(x,'event')))
  keep <- ev %in% c('shot','goal')
  if (!any(keep)) return(NULL)
  x <- x[keep,,drop=FALSE]; ev <- ev[keep]
  gid <- getcol(x,'game_id'); gid[is.na(gid)|gid==''] <- sub('\\.rds$','',basename(f))
  player <- getcol(x,'player_id'); goal <- getcol(x,'goal_player_id')
  player[ev=='goal' & !is.na(goal) & nzchar(goal)] <- goal[ev=='goal' & !is.na(goal) & nzchar(goal)]
  team <- getcol(x,'player_team_id'); fallback <- getcol(x,'team_id')
  team[is.na(team)|team==''] <- fallback[is.na(team)|team=='']
  period <- getcol(x,'period'); pid <- getcol(x,'period_id')
  period[is.na(period)|period==''] <- pid[is.na(period)|period=='']
  data.frame(game_id=gid,team_id=team,period=period,player_id=player,event_type=ev,
             x= suppressWarnings(as.numeric(getcol(x,'x_location'))),
             y= suppressWarnings(as.numeric(getcol(x,'y_location'))), stringsAsFactors=FALSE)
}
rows <- Filter(Negate(is.null), lapply(files, read_game))
if (!length(rows)) stop('No shot/goal events found')
e <- do.call(rbind,rows)
# Keep every event; never silently remove missing or out-of-range records.
key <- paste(e$game_id,e$team_id,e$period,sep='|')
groups <- split(seq_len(nrow(e)), key)
summary <- do.call(rbind,lapply(groups,function(idx){
  d<-e[idx,,drop=FALSE]; v<-is.finite(d$x)&is.finite(d$y)
  x<-d$x[v]
  # Direction inference is ONLY a candidate. The median can be biased by unusual events.
  # Require >=5 locations and substantial displacement from rink midpoint.
  candidate<-if(length(x)>=5 && abs(median(x)-300)>=45) if(median(x)<300) 'low_x_net' else 'high_x_net' else 'unresolved'
  data.frame(game_id=d$game_id[1],team_id=d$team_id[1],period=d$period[1],
             events=nrow(d),valid_xy=sum(v),median_x=if(length(x)) median(x) else NA_real_,
             min_x=if(length(x)) min(x) else NA_real_,max_x=if(length(x)) max(x) else NA_real_,
             candidate_attack_end=candidate,stringsAsFactors=FALSE)
}))
# Compare teams within each game/period: teams should attack opposite ends.
summary$opponent_consistency <- 'unverified'
for(k in unique(paste(summary$game_id,summary$period,sep='|'))){
  idx<-which(paste(summary$game_id,summary$period,sep='|')==k)
  if(length(idx)!=2) next
  a<-summary$candidate_attack_end[idx]
  if(all(a!='unresolved')) summary$opponent_consistency[idx]<-if(a[1]!=a[2]) 'opposite' else 'CONFLICT'
}
# Audit period switches for each game/team; typical 1->2 flips, 2->3 flips.
summary$period_flip_check <- 'unverified'
for(k in unique(paste(summary$game_id,summary$team_id,sep='|'))){
  idx<-which(paste(summary$game_id,summary$team_id,sep='|')==k)
  for(i in idx){
    p<-suppressWarnings(as.integer(summary$period[i])); if(is.na(p)||p<2||p>3) next
    prev<-idx[suppressWarnings(as.integer(summary$period[idx]))==p-1]
    if(length(prev)!=1) next
    a<-summary$candidate_attack_end[c(i,prev)]
    if(all(a!='unresolved')) summary$period_flip_check[i]<-if(a[1]!=a[2]) 'flipped' else 'CONFLICT'
  }
}
outdir<-'data/games/2026-27'
dir.create(outdir,recursive=TRUE,showWarnings=FALSE)
outfile<-file.path(outdir,'shot_orientation_audit.csv')
write.csv(summary,outfile,row.names=FALSE,na='')
cat('\nICEINDEX v0.10.0 ATTACKING DIRECTION AUDIT\n')
cat('Games:',length(unique(e$game_id)),' Events:',nrow(e),' Shots:',sum(e$event_type=='shot'),' Goals:',sum(e$event_type=='goal'),'\n')
cat('Missing coordinates:',sum(!is.finite(e$x)|!is.finite(e$y)),'\n')
cat('Candidate directions:\n');print(table(summary$candidate_attack_end,useNA='ifany'))
cat('Opposite-team consistency:\n');print(table(summary$opponent_consistency))
cat('Period flip check:\n');print(table(summary$period_flip_check))
cat('Raw x/y ranges:\n');print(summary(e[c('x','y')]))
cat('Audit saved:',outfile,'\n')
cat('IMPORTANT: This is an inference audit, NOT a validated orientation mapping. Do not overwrite the shot CSV yet.\n')
