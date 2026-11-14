# IceIndex v0.10.0 - official OHL Game Centre CSV exporter
# Reads cached HockeyTech Gamesummary JSON; does not modify refresh.R.
# Run from repository root: source('scripts/games/build_official_game_data.R')
local({
  if (!requireNamespace('jsonlite', quietly=TRUE)) stop('Install jsonlite first')
  season <- Sys.getenv('ICEINDEX_GAME_SEASON', '2026-27')
  base <- file.path('data','games',season)
  raw_dir <- file.path(base,'summaries_raw')
  paths <- list.files(raw_dir, pattern='^[0-9]+\\.json$', full.names=TRUE)
  selected <- trimws(strsplit(Sys.getenv('ICEINDEX_GAME_IDS',''), ',', fixed=TRUE)[[1]])
  selected <- selected[nzchar(selected)]
  if(length(selected)) paths <- paths[tools::file_path_sans_ext(basename(paths)) %in% selected]
  if(!length(paths)) stop('No matching summaries_raw/*.json found')
  if(length(selected)) message('LIMITED GAME EXPORT: only selected game IDs will be written to CSVs. Clear ICEINDEX_GAME_IDS to export all cached games.')
  get <- function(x, ..., default=NA) {
    for(k in c(...)) { if(is.null(x) || !is.list(x) || is.null(x[[as.character(k)]])) return(default); x<-x[[as.character(k)]] }
    if(is.null(x)) return(default)
    if(is.list(x)) return(x)
    if(length(x)!=1L) return(default)
    if(is.character(x) && !nzchar(x)) return(default)
    x
  }
  val <- function(x) { if(is.null(x) || !length(x) || is.list(x)) return(NA_character_); as.character(x[1]) }
  num <- function(x) suppressWarnings(as.numeric(val(x)))
  name <- function(x) trimws(paste(ifelse(is.na(val(get(x,'first_name'))),'',val(get(x,'first_name'))),ifelse(is.na(val(get(x,'last_name'))),'',val(get(x,'last_name')))))
  flag <- function(x) identical(val(x),'1') || identical(x,TRUE)
  records <- list(metadata=list(), periods=list(), goals=list(), on_ice=list(), goalies=list(), skaters=list(), penalties=list(), stars=list(), officials=list(), teams=list())
  add <- function(tbl, row) { records[[tbl]][[length(records[[tbl]])+1L]] <<- row }
  cat(sprintf('Building official CSVs from %d cached games...\n',length(paths)))
  for(path_index in seq_along(paths)) {
    path <- paths[[path_index]]
    if(path_index == 1L || path_index %% 25L == 0L || path_index == length(paths)) {cat(sprintf('  Parsing %d/%d: %s\n',path_index,length(paths),basename(path)));flush.console()}
    id <- tools::file_path_sans_ext(basename(path))
    doc <- tryCatch(jsonlite::fromJSON(path,simplifyVector=FALSE),error=function(e) {warning(id,': ',conditionMessage(e));NULL})
    g <- get(doc,'GC','Gamesummary',default=NULL)
    if(is.null(g) || !is.list(g)) { warning(id,': missing GC.Gamesummary');next }
    m <- g$meta
    h <- g$home; v <- g$visitor
    add('metadata',list(game_id=id,season=season,date=get(m,'date_played'),status=get(g,'status_value'),final=get(m,'final'),home_team_id=get(h,'id'),home_team=get(h,'name'),home_code=get(h,'code'),visitor_team_id=get(v,'id'),visitor_team=get(v,'name'),visitor_code=get(v,'code'),home_goals=get(m,'home_goal_count'),visitor_goals=get(m,'visiting_goal_count'),arena=get(g,'venue'),attendance=get(m,'attendance'),scheduled_time=get(m,'schedule_time'),actual_start=get(m,'start_time'),actual_end=get(m,'end_time'),timezone=get(m,'timezone'),game_length=get(g,'game_length'),referee1=get(g,'referee1'),referee2=get(g,'referee2'),linesman1=get(g,'linesman1'),linesman2=get(g,'linesman2'),source_last_modified=get(m,'last_modified')))
    for(side in c('visitor','home')) {
      t <- g[[side]]; team_id <- get(t,'id'); team_name <- get(t,'name')
      add('teams',list(game_id=id,side=side,team_id=team_id,team_name=team_name,team_code=get(t,'code'),goals=get(g,'totalGoals',side),shots_on_goal=get(g,'totalShotsOn',side),power_play_goals=get(g,'powerPlayGoals',side),power_play_opportunities=get(g,'powerPlayCount',side),faceoff_wins=get(g,'totalFaceoffs',side,'won'),faceoff_attempts=get(g,'totalFaceoffs',side,'att'),penalty_minutes=get(g,'pimTotal',side)))
      for(p in names(g$periods)) {
        add('periods',list(game_id=id,side=side,team_id=team_id,period=p,period_name=get(g,'periods',p,'long_name'),goals=get(g,'goalsByPeriod',side,p),shots_on_goal=get(g,'shotsByPeriod',side,p)))
      }
      # Lineup goalie rows aggregate multiple appearances by the same goalie.
      lineup <- g[[paste0(if(side=='home') 'home' else 'visitor','_team_lineup')]]
      for(p in lineup$goalies) {
        sa <- num(get(p,'shots_against')); ga <- num(get(p,'goals_against')); sv <- num(get(p,'saves'))
        add('goalies',list(game_id=id,side=side,team_id=team_id,player_id=get(p,'player_id'),player_name=name(p),jersey_number=get(p,'jersey_number'),started=get(p,'start'),time_on_ice=get(p,'time'),seconds=get(p,'seconds'),shots_against=sa,goals_against=ga,saves=sv,save_pct=if(is.finite(sa)&&sa>0&&is.finite(sv)) round(sv/sa,4) else NA_real_,appeared=if(is.finite(num(get(p,'seconds')))) num(get(p,'seconds'))>0 || (is.finite(sa) && sa>0) else if(is.finite(sa) && sa>0) TRUE else NA,appearance_basis='official_seconds_or_shots_against',source='official_lineup'))
      }
      for(p in lineup$players) {
        add('skaters',list(game_id=id,side=side,team_id=team_id,player_id=get(p,'player_id'),player_name=name(p),jersey_number=get(p,'jersey_number'),position=get(p,'position_str'),goals=get(p,'goals'),assists=get(p,'assists'),points=if(is.finite(num(get(p,'goals')))&&is.finite(num(get(p,'assists')))) num(get(p,'goals'))+num(get(p,'assists')) else NA_real_,plus_minus=get(p,'plusminus'),shots=get(p,'shots'),shots_on_goal=get(p,'shots_on'),pim=get(p,'pim'),faceoff_wins=get(p,'faceoff_wins'),faceoff_attempts=get(p,'faceoff_attempts'),power_play_goals=get(p,'power_play_goals'),short_handed_goals=get(p,'short_handed_goals'),game_winning_goal=get(p,'game_winning_goal')))
      }
    }
    for(i in seq_along(g$goals)) {
      e <- g$goals[[i]]; scorer <- e$goal_scorer; a1 <- e$assist1_player; a2 <- e$assist2_player
      strength <- if(flag(get(e,'power_play'))) 'PP' else if(flag(get(e,'short_handed'))) 'SH' else 'EV'
      add('goals',list(game_id=id,goal_number=i,period=get(e,'period_id'),time=get(e,'time'),team_id=get(e,'team_id'),side=if(flag(get(e,'home'))) 'home' else 'visitor',scorer_id=get(scorer,'player_id'),scorer_name=name(scorer),scorer_jersey=get(scorer,'jersey_number'),scorer_season_goals=get(e,'scorer_goal_num'),assist1_id=get(a1,'player_id'),assist1_name=if(is.na(val(get(a1,'player_id')))) NA_character_ else name(a1),assist2_id=get(a2,'player_id'),assist2_name=if(is.na(val(get(a2,'player_id')))) NA_character_ else name(a2),strength=strength,empty_net=get(e,'empty_net'),penalty_shot=get(e,'penalty_shot'),game_winning=get(e,'game_winning'),game_tying=get(e,'game_tieing'),x_location=get(e,'x_location'),y_location=get(e,'y_location'),plus_player_ids=paste(vapply(e$plus,function(z) val(get(z,'player_id')),character(1)),collapse=';'),minus_player_ids=paste(vapply(e$minus,function(z) val(get(z,'player_id')),character(1)),collapse=';')))
      for(kind in c('plus','minus')) for(p in e[[kind]]) add('on_ice',list(game_id=id,goal_number=i,period=get(e,'period_id'),time=get(e,'time'),goal_team_id=get(e,'team_id'),side=kind,player_id=get(p,'player_id'),player_name=name(p),jersey_number=get(p,'jersey_number')))
    }
    for(i in seq_along(g$penalties)) {
      p <- g$penalties[[i]]; penalized <- p$player_penalized_info; served <- p$player_served_info
      add('penalties',list(game_id=id,penalty_number=i,period=get(p,'period_id'),time=get(p,'time_off_formatted'),team_id=get(p,'team_id'),side=if(flag(get(p,'home'))) 'home' else 'visitor',player_id=get(penalized,'player_id'),player_name=if(is.na(val(get(penalized,'player_id')))) 'Team / bench' else name(penalized),served_by_id=get(served,'player_id'),served_by_name=name(served),description=get(p,'lang_penalty_description'),penalty_class=get(p,'penalty_class'),minutes=get(p,'minutes'),bench=get(p,'bench'),power_play=get(p,'pp')))
    }
    for(i in seq_along(g$mvps)) {p<-g$mvps[[i]];add('stars',list(game_id=id,star=i,player_id=get(p,'player_id'),player_name=name(p),jersey_number=get(p,'jersey_number'),side=if(flag(get(p,'home'))) 'home' else 'visitor'))}
    for(group in c('officialsOnIce','officialsOffIce')) for(p in g[[group]]) add('officials',list(game_id=id,group=group,role=get(p,'description'),person_id=get(p,'person_id'),name=name(p),jersey_number=get(p,'jersey_number')))
  }
  output <- c(metadata='official_game_metadata.csv',teams='official_team_stats.csv',periods='official_period_stats.csv',goals='official_scoring_plays.csv',on_ice='official_goal_on_ice.csv',goalies='official_goalie_stats.csv',skaters='official_skater_stats.csv',penalties='official_penalties.csv',stars='official_three_stars.csv',officials='official_game_officials.csv')
  dir.create(base,recursive=TRUE,showWarnings=FALSE)
  for(tbl in names(output)) {
    rows <- records[[tbl]]
    if(!length(rows)) {message('No ',tbl,' rows; skipping file');next}
    df <- do.call(rbind,lapply(rows,function(x) as.data.frame(x,stringsAsFactors=FALSE,check.names=FALSE)))
    target <- file.path(base,output[[tbl]])
    temp <- tempfile(tmpdir=base,fileext='.csv')
    utils::write.csv(df,temp,row.names=FALSE,na='')
    if(!file.copy(temp,target,overwrite=TRUE)) stop('Could not write ',target)
    unlink(temp)
    cat(sprintf('%-12s %6d rows -> %s\n',tbl,nrow(df),output[[tbl]]))
  }
  # Validate goals per team. A shootout adds one scoreboard goal without a
  # normal goal event; this is expected and should not raise a warning.
  checked <- 0L; shootout_expected <- 0L; mismatched <- 0L; pending <- 0L
  for(row in records$metadata) {
    id <- as.character(row$game_id)
    status <- as.character(row$status)
    is_final <- identical(as.character(row$final), '1')
    if(!is_final) {pending <- pending+1L; next}
    gs <- Filter(function(x) identical(as.character(x$game_id),id), records$goals)
    actual_home <- sum(vapply(gs,function(x) identical(as.character(x$side),'home'),logical(1)))
    actual_visitor <- sum(vapply(gs,function(x) identical(as.character(x$side),'visitor'),logical(1)))
    score_home <- num(row$home_goals); score_visitor <- num(row$visitor_goals)
    if(!is.finite(score_home) || !is.finite(score_visitor)) next
    checked <- checked+1L
    shootout_status <- grepl('\\bSO\\b|shootout', status, ignore.case=TRUE, perl=TRUE)
    # The API's shootout flag is not always reliable, so the displayed
    # official status is also used to recognize Final SO games.
    if(shootout_status &&
       (score_home-actual_home == 1 && score_visitor-actual_visitor == 0 ||
        score_home-actual_home == 0 && score_visitor-actual_visitor == 1)) {
      shootout_expected <- shootout_expected+1L
      next
    }
    if(score_home != actual_home || score_visitor != actual_visitor) {
      mismatched <- mismatched+1L
      warning(sprintf('Game %s: official score %s-%s, recorded goals %s-%s (status: %s)',
                      id,score_visitor,score_home,actual_visitor,actual_home,status))
    }
  }
  cat(sprintf('Score validation: %d completed checked | %d expected shootout differences | %d unexplained mismatches | %d unfinished skipped\n',
              checked,shootout_expected,mismatched,pending))
  cat('Official game data export complete.\n')
})
