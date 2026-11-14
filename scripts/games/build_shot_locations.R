# IceIndex v0.10.0 — event-level shot and goal export
# Run from the repository root. Does not change cached RDS data.
season <- '2026-27'
input_dir <- file.path('data','games',season,'events')
output_file <- file.path('data','games',season,'player_shot_locations.csv')
files <- sort(list.files(input_dir, pattern='\\.rds$', full.names=TRUE))
if (!length(files)) stop('No cached events in ',input_dir)

clean <- function(v) {
  v <- trimws(as.character(v))
  v[is.na(v) | !nzchar(v) | toupper(v) %in% c('NA','NULL','NONE','NAN')] <- NA_character_
  v
}
getfield <- function(d, key) {
  n <- nrow(d)
  if (key %in% names(d)) {
    v <- d[[key]]
    if (is.atomic(v) && length(v)==n) return(clean(v))
  }
  parts <- strsplit(key, '.', fixed=TRUE)[[1]]
  if(length(parts)<2L || !parts[1] %in% names(d)) return(rep(NA_character_,n))
  parent <- d[[parts[1]]]; child <- paste(parts[-1],collapse='.')
  if(is.data.frame(parent) && child %in% names(parent)) return(clean(parent[[child]]))
  if(is.list(parent) && length(parent)==n) {
    return(clean(vapply(parent,function(z){
      if(is.null(z) || !is.list(z) || !child %in% names(z)) return(NA_character_)
      v <- z[[child]]
      if(is.atomic(v) && length(v)==1L) as.character(v) else NA_character_
    },character(1))))
  }
  rep(NA_character_,n)
}
pick <- function(d, keys) {
  result <- rep(NA_character_,nrow(d))
  for(k in keys) {
    v <- getfield(d,k)
    missing <- is.na(result)
    result[missing] <- v[missing]
  }
  result
}
name_role <- function(d,prefix, fallback) {
  direct <- pick(d,fallback)
  first <- pick(d,c(paste0(prefix,'.first_name'),paste0(prefix,'.firstname')))
  last <- pick(d,c(paste0(prefix,'.last_name'),paste0(prefix,'.lastname')))
  combined <- clean(paste(ifelse(is.na(first),'',first),ifelse(is.na(last),'',last)))
  direct[is.na(direct)] <- combined[is.na(direct)]
  direct
}
flag <- function(v) tolower(trimws(as.character(v))) %in% c('1','true','t','yes','y')
num <- function(v) suppressWarnings(as.numeric(v))
extract <- function(file) {
  d <- tryCatch(readRDS(file),error=function(e){warning(conditionMessage(e));NULL})
  if(is.null(d) || !is.data.frame(d) || !nrow(d) || !'event' %in% names(d)) return(NULL)
  event <- tolower(trimws(getfield(d,'event')))
  keep <- !is.na(event) & event %in% c('shot','goal')
  if(!any(keep)) return(NULL)
  d <- d[keep,,drop=FALSE]; event <- event[keep]
  gid <- pick(d,'game_id')
  gid[is.na(gid)] <- sub('\\.rds$','',basename(file))
  scorer <- pick(d,c('goal_player_id','goal_player.id'))
  shooter <- pick(d,c('player_id','player.id'))
  shooter[event=='goal' & !is.na(scorer)] <- scorer[event=='goal' & !is.na(scorer)]
  a1id <- pick(d,c('assist1_player_id','assist1_player.id'))
  a2id <- pick(d,c('assist2_player_id','assist2_player.id'))
  a1name <- name_role(d,'assist1_player',c('assist1_player_name','assist1_name'))
  a2name <- name_role(d,'assist2_player',c('assist2_player_name','assist2_name'))
  # Resolve names from other cached event roles within this same game.
  ids <- c(pick(d,'goal_player_id'),pick(d,'player_id'),a1id,a2id)
  names_found <- c(name_role(d,'goal_player','goal_player_name'),
                   name_role(d,'player','player_name'),a1name,a2name)
  good <- !is.na(ids) & !is.na(names_found)
  lookup <- setNames(names_found[good],ids[good]); lookup <- lookup[!duplicated(names(lookup))]
  fill <- function(id,nm) {
    ix <- which(is.na(nm) & !is.na(id))
    if(length(ix)) nm[ix] <- unname(lookup[id[ix]])
    nm
  }
  a1name <- fill(a1id,a1name); a2name <- fill(a2id,a2name)
  goaltype <- pick(d,c('goal_type_name','goal_type','goal_type_description'))
  pp <- flag(pick(d,c('power_play','is_power_play')))
  sh <- flag(pick(d,c('short_handed','is_short_handed')))
  en <- flag(pick(d,c('empty_net','is_empty_net')))
  type_lower <- tolower(ifelse(is.na(goaltype),'',goaltype))
  pp <- pp | grepl('power.?play|\\bppg?\\b',type_lower)
  sh <- sh | grepl('short.?hand|\\bshg?\\b',type_lower)
  en <- en | grepl('empty.?net',type_lower)
  kind <- ifelse(event!='goal',NA_character_,ifelse(pp,'PP',ifelse(sh,'SH',ifelse(en,'EN','EV'))))
  # EV is a fallback when no strength classification was supplied; expose verification.
  strength_source <- ifelse(event!='goal',NA_character_,
                            ifelse(pp|sh|en|'power_play' %in% names(d)|'short_handed' %in% names(d)|!is.na(goaltype),
                                   'event_fields','unverified_default'))
  assist_text <- mapply(function(a,b){v <- unique(c(a,b));v <- v[!is.na(v)];if(length(v)) paste(v,collapse='; ') else NA_character_},a1name,a2name,USE.NAMES=FALSE)
  data.frame(
    season=season,game_id=gid,player_id=shooter,event_type=event,
    x_location=num(pick(d,'x_location')),y_location=num(pick(d,'y_location')),
    period=pick(d,c('period_id','period')),
    time_formatted=pick(d,c('time_formatted','event_time','time')),
    shot_type=pick(d,'shot_type'),shot_type_description=pick(d,c('shot_type_description','shot_type_name')),
    shot_quality=pick(d,'shot_quality_description'),
    team_id=pick(d,c('player_team_id','team_id')),
    goalie_name=name_role(d,'goalie',c('goalie_name','opposing_goalie_name','goalie_player_name')),
    assist1_player_id=a1id,assist2_player_id=a2id,
    assist1_player_name=a1name,assist2_player_name=a2name,
    assist_names=assist_text,
    assists_count=ifelse(event=='goal',as.integer(!is.na(a1id))+as.integer(!is.na(a2id)),NA_integer_),
    goal_type=goaltype,goal_strength=kind,goal_strength_source=strength_source,
    power_play=pp,short_handed=sh,empty_net=en,
    score_at_event=pick(d,c('score_at_event','score_at_time')),
    location_valid=is.finite(num(pick(d,'x_location'))) & is.finite(num(pick(d,'y_location'))),
    stringsAsFactors=FALSE
  )
}
parts <- Filter(Negate(is.null),lapply(files,extract))
if(!length(parts)) stop('No shot/goal events found')
out <- do.call(rbind,parts)
# Never discard shots solely because their coordinates are missing or unexpected.
out <- out[order(out$game_id,out$period,out$time_formatted,na.last=TRUE),,drop=FALSE]
rownames(out) <- NULL
dir.create(dirname(output_file),recursive=TRUE,showWarnings=FALSE)
write.csv(out,output_file,row.names=FALSE,na='')
cat('Exported ',nrow(out),' events; ',sum(out$event_type=='goal'),' goals; ',
    sum(!out$location_valid),' missing-coordinate rows retained.\n',sep='')
cat('Goals with assist IDs: ',sum(out$event_type=='goal' & (!is.na(out$assist1_player_id)|!is.na(out$assist2_player_id))), '\n',sep='')
cat('Goal-strength defaults requiring review: ',sum(out$event_type=='goal' & out$goal_strength_source=='unverified_default'), '\n',sep='')
cat('Saved: ',output_file,'\n',sep='')
