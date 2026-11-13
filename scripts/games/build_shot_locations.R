# IceIndex v0.10.0 — richer shot and goal event export
# Run from repository root. Reads cached events; does not modify input RDS files.
input_dir <- file.path("data", "games", "2026-27", "events")
output_file <- file.path("data", "games", "2026-27", "player_shot_locations.csv")
files <- list.files(input_dir, pattern="\\.rds$", full.names=TRUE)
if (!length(files)) stop("No cached game events found in ", input_dir)

pick <- function(x, names) {
  for (key in names) {
    if (key %in% names(x)) {
      value <- x[[key]]
      if (is.list(value)) next
      return(as.character(value))
    }
  }
  rep(NA_character_, nrow(x))
}
extract <- function(file) {
  x <- readRDS(file)
  if (!is.data.frame(x) || !nrow(x)) return(NULL)
  event <- tolower(trimws(pick(x, "event")))
  keep <- event %in% c("shot", "goal")
  if (!any(keep)) return(NULL)
  x <- x[keep,,drop=FALSE]; event <- event[keep]
  player <- pick(x, "player_id")
  scorer <- pick(x, "goal_player_id")
  use_goal <- event=="goal" & !is.na(scorer) & nzchar(scorer)
  player[use_goal] <- scorer[use_goal]
  game <- pick(x, "game_id")
  game[is.na(game)|!nzchar(game)] <- sub("\\.rds$", "", basename(file))
  data.frame(
    season="2026-27",game_id=game,player_id=player,event_type=event,
    x_location=suppressWarnings(as.numeric(pick(x,"x_location"))),
    y_location=suppressWarnings(as.numeric(pick(x,"y_location"))),
    period=pick(x,c("period_id","period")),
    time_formatted=pick(x,c("time_formatted","event_time","time")),
    shot_type=pick(x,"shot_type"),
    shot_type_description=pick(x,c("shot_type_description","shot_type_name")),
    shot_quality=pick(x,"shot_quality_description"),
    team_id=pick(x,c("team_id","player_team_id")),
    goalie_name=pick(x,c("goalie_name","opposing_goalie_name","goalie_player_name")),
    assist1_player_name=pick(x,c("assist1_player_name","assist1_name")),
    assist2_player_name=pick(x,c("assist2_player_name","assist2_name")),
    assist_names=pick(x,c("assist_names","assists_text")),
    assists_count=pick(x,c("assists_count","assist_count")),
    score_at_event=pick(x,c("score_at_event","score_at_time")),
    stringsAsFactors=FALSE
  )
}
parts <- Filter(Negate(is.null), lapply(files,extract))
if (!length(parts)) stop("No shot/goal events found")
raw <- do.call(rbind,parts)
valid <- !is.na(raw$player_id) & nzchar(raw$player_id) & is.finite(raw$x_location) & is.finite(raw$y_location)
cat("Events before validation:",nrow(raw),"\n")
cat("Missing shooter or coordinates:",sum(!valid),"\n")
out <- raw[valid,,drop=FALSE]
if (!nrow(out)) stop("No valid events; output not written")
if (any(out$x_location<0 | out$x_location>583 | out$y_location<0 | out$y_location>297)) warning("Coordinates outside observed range")
out <- out[order(out$game_id,out$player_id,out$event_type),,drop=FALSE]
rownames(out) <- NULL
dir.create(dirname(output_file),recursive=TRUE,showWarnings=FALSE)
write.csv(out,output_file,row.names=FALSE,na="")
cat("Exported",nrow(out),"events (",sum(out$event_type=="shot"),"shots,",sum(out$event_type=="goal"),"goals) to",output_file,"\n")