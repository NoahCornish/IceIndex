
# ============================================================
# ICEINDEX — PLAYER GAME LOG BUILDER
# Version: v0.10.0
#
# FILE:
# scripts/games/build_game_logs.R
#
# INPUT:
# data/games/2026-27/events/*.rds
#
# OUTPUT:
# data/games/2026-27/player_game_logs.csv
# data/games/2026-27/game_event_summary.csv
# data/games/2026-27/game_log_validation.csv
#
# No API requests. Uses cached HockeyTech events.
# ============================================================

season <- "2026-27"

base_dir <- file.path("data", "games", season)
events_dir <- file.path(base_dir, "events")

files <- sort(list.files(
  events_dir,
  pattern = "\\.rds$",
  full.names = TRUE
))

if (!length(files)) {
  stop("No cached game files found.")
}

# ============================================================
# HELPERS
# ============================================================

get_col <- function(d, name) {
  if (name %in% names(d)) {
    as.character(d[[name]])
  } else {
    rep(NA_character_, nrow(d))
  }
}

valid <- function(x) {
  x <- trimws(as.character(x))
  
  !is.na(x) &
    nzchar(x) &
    !(toupper(x) %in% c(
      "NA", "NULL", "NONE", "NAN"
    ))
}

number <- function(x) {
  suppressWarnings(as.numeric(x))
}

flag <- function(x) {
  tolower(trimws(as.character(x))) %in%
    c("1", "true", "t", "yes")
}

# ============================================================
# STORAGE
# ============================================================

records <- list()
summaries <- list()
warnings <- list()

add_warning <- function(id, issue, n = 1L) {
  if (n <= 0L) return(invisible(NULL))
  
  warnings[[length(warnings) + 1L]] <<-
    data.frame(
      game_id = as.character(id),
      issue = as.character(issue),
      count = as.integer(n),
      stringsAsFactors = FALSE
    )
  
  invisible(NULL)
}

# ============================================================
# ADD STATISTIC
#
# Scalar values are expanded to all player events.
# This preserves every goal, assist, shot and faceoff.
# ============================================================

add_stat <- function(id, player, stat, value = 1) {
  
  player <- as.character(player)
  
  if (!length(player)) {
    return(invisible(NULL))
  }
  
  if (length(value) == 1L) {
    value <- rep(value, length(player))
  }
  
  if (length(value) != length(player)) {
    stop(
      "Length mismatch for ", stat,
      " in game ", id
    )
  }
  
  value <- number(value)
  
  keep <- valid(player) &
    is.finite(value) &
    value != 0
  
  if (!any(keep)) {
    return(invisible(NULL))
  }
  
  records[[length(records) + 1L]] <<-
    data.frame(
      game_id = as.character(id),
      player_id = player[keep],
      stat = stat,
      value = value[keep],
      stringsAsFactors = FALSE
    )
  
  invisible(NULL)
}

# ============================================================
# START
# ============================================================

cat("\n====================================\n")
cat("ICEINDEX — PLAYER GAME LOG BUILDER\n")
cat("Version: v0.10.0\n")
cat("====================================\n")

cat("Season:", season, "\n")
cat("Cached games:", length(files), "\n\n")

# ============================================================
# PROCESS GAMES
# ============================================================

for (i in seq_along(files)) {
  
  game_id <- sub(
    "\\.rds$",
    "",
    basename(files[i])
  )
  
  d <- tryCatch(
    readRDS(files[i]),
    error = function(e) {
      message(
        "Cannot read game ", game_id,
        ": ", conditionMessage(e)
      )
      NULL
    }
  )
  
  if (
    is.null(d) ||
    !is.data.frame(d) ||
    !"event" %in% names(d)
  ) {
    add_warning(game_id, "invalid_file")
    next
  }
  
  # ----------------------------------------------------------
  # EVENT TYPES
  # ----------------------------------------------------------
  
  e <- tolower(trimws(get_col(d, "event")))
  
  goals <- !is.na(e) & e == "goal"
  shots <- !is.na(e) & e == "shot"
  pens <- !is.na(e) & e == "penalty"
  fos <- !is.na(e) & e == "faceoff"
  
  count <- function(type) {
    sum(e == type, na.rm = TRUE)
  }
  
  # ----------------------------------------------------------
  # GAME SUMMARY
  # ----------------------------------------------------------
  
  summaries[[length(summaries) + 1L]] <-
    data.frame(
      game_id = game_id,
      total_events = nrow(d),
      goals = count("goal"),
      shots = count("shot"),
      faceoffs = count("faceoff"),
      penalties = count("penalty"),
      goalie_changes = count("goalie_change"),
      timeouts = count("timeout"),
      shootouts = count("shootout"),
      penaltyshots = count("penaltyshot"),
      stringsAsFactors = FALSE
    )
  
  # ==========================================================
  # GOALS AND ASSISTS
  # ==========================================================
  
  scorer <- get_col(d, "goal_player_id")
  assist1 <- get_col(d, "assist1_player_id")
  assist2 <- get_col(d, "assist2_player_id")
  
  add_stat(game_id, scorer[goals], "G")
  add_stat(game_id, assist1[goals], "A")
  add_stat(game_id, assist2[goals], "A")
  
  # ----------------------------------------------------------
  # GOAL CLASSIFICATIONS
  # ----------------------------------------------------------
  
  pp <- flag(get_col(d, "power_play"))
  sh <- flag(get_col(d, "short_handed"))
  en <- flag(get_col(d, "empty_net"))
  gw <- flag(get_col(d, "game_winning"))
  
  add_stat(
    game_id,
    scorer[goals & pp],
    "PPG"
  )
  
  add_stat(
    game_id,
    scorer[goals & sh],
    "SHG"
  )
  
  add_stat(
    game_id,
    scorer[goals & en],
    "ENG"
  )
  
  add_stat(
    game_id,
    scorer[goals & gw],
    "GWG"
  )
  
  # ==========================================================
  # SHOT EVENTS
  #
  # Raw shot events, not verified official SOG.
  # ==========================================================
  
  shot_player <- get_col(d, "player_id")
  
  add_stat(
    game_id,
    shot_player[shots],
    "SHOT_EVENT"
  )
  
  # ==========================================================
  # PENALTIES
  #
  # Confirmed HockeyTech field: player_id
  # Bench penalties excluded from player totals.
  # ==========================================================
  
  penalty_player <- get_col(d, "player_id")
  penalty_minutes <- number(get_col(d, "minutes"))
  bench <- flag(get_col(d, "bench"))
  
  player_pen <- pens &
    !bench &
    valid(penalty_player)
  
  add_stat(
    game_id,
    penalty_player[player_pen],
    "PENALTY_EVENT"
  )
  
  add_stat(
    game_id,
    penalty_player[player_pen],
    "PIM",
    penalty_minutes[player_pen]
  )
  
  # ==========================================================
  # FACEOFFS
  #
  # HockeyTech:
  # home_win = 1 means home participant won
  # home_win = 0 means visitor participant won
  #
  # Cross-check against win_team_id where available.
  # ==========================================================
  
  home_id <- get_col(d, "home_player_id")
  visitor_id <- get_col(d, "visitor_player_id")
  
  home_win_raw <- tolower(trimws(
    get_col(d, "home_win")
  ))
  
  home_team <- get_col(
    d, "player_home.team_id"
  )
  
  visitor_team <- get_col(
    d, "player_visitor.team_id"
  )
  
  winner_team <- get_col(d, "win_team_id")
  
  # ----------------------------------------------------------
  # FACEOFF ATTEMPTS
  # ----------------------------------------------------------
  
  add_stat(
    game_id,
    home_id[fos],
    "FO_ATT"
  )
  
  add_stat(
    game_id,
    visitor_id[fos],
    "FO_ATT"
  )
  
  # ----------------------------------------------------------
  # DECODE WINNER
  # ----------------------------------------------------------
  
  home_result <- home_win_raw %in%
    c("1", "true", "t", "yes")
  
  visitor_result <- home_win_raw %in%
    c("0", "false", "f", "no")
  
  # Only accept complete participant records.
  
  participants_valid <- fos &
    valid(home_id) &
    valid(visitor_id)
  
  # ----------------------------------------------------------
  # CROSS-CHECK TEAM WINNER
  # ----------------------------------------------------------
  
  team_check_available <- fos &
    valid(winner_team) &
    valid(home_team) &
    valid(visitor_team) &
    home_team != visitor_team
  
  team_home_won <- winner_team == home_team
  team_visitor_won <- winner_team == visitor_team
  
  team_home_won[is.na(team_home_won)] <- FALSE
  team_visitor_won[is.na(team_visitor_won)] <- FALSE
  
  # Team ID must identify exactly one participant.
  
  team_check_valid <- team_check_available &
    xor(team_home_won, team_visitor_won)
  
  # Detect disagreement between home_win and team ID.
  
  conflict <- team_check_valid &
    (
      (home_result & !team_home_won) |
        (visitor_result & !team_visitor_won)
    )
  
  conflict[is.na(conflict)] <- FALSE
  
  # ----------------------------------------------------------
  # RESOLVED FACEOFFS
  # ----------------------------------------------------------
  
  home_wins <- participants_valid &
    home_result &
    !conflict
  
  visitor_wins <- participants_valid &
    visitor_result &
    !conflict
  
  home_wins[is.na(home_wins)] <- FALSE
  visitor_wins[is.na(visitor_wins)] <- FALSE
  
  resolved <- home_wins | visitor_wins
  
  # ----------------------------------------------------------
  # FACEOFF WINS
  # ----------------------------------------------------------
  
  add_stat(
    game_id,
    home_id[home_wins],
    "FO_WIN"
  )
  
  add_stat(
    game_id,
    visitor_id[visitor_wins],
    "FO_WIN"
  )
  
  # ----------------------------------------------------------
  # FACEOFF LOSSES
  # ----------------------------------------------------------
  
  add_stat(
    game_id,
    visitor_id[home_wins],
    "FO_LOSS"
  )
  
  add_stat(
    game_id,
    home_id[visitor_wins],
    "FO_LOSS"
  )
  
  # ----------------------------------------------------------
  # FACEOFF VALIDATION
  # ----------------------------------------------------------
  
  unresolved <- sum(
    fos & !resolved,
    na.rm = TRUE
  )
  
  if (unresolved > 0) {
    add_warning(
      game_id,
      "faceoff_winner_unresolved",
      unresolved
    )
  }
  
  if (any(conflict)) {
    add_warning(
      game_id,
      "faceoff_winner_conflict",
      sum(conflict)
    )
  }
  
  missing_participants <- sum(
    fos &
      (!valid(home_id) | !valid(visitor_id)),
    na.rm = TRUE
  )
  
  if (missing_participants > 0) {
    add_warning(
      game_id,
      "faceoff_missing_participant",
      missing_participants
    )
  }
  
  # ==========================================================
  # EVENT VALIDATION
  # ==========================================================
  
  missing_goals <- sum(
    goals & !valid(scorer)
  )
  
  missing_shots <- sum(
    shots & !valid(shot_player)
  )
  
  missing_penalties <- sum(
    pens & !bench & !valid(penalty_player)
  )
  
  missing_minutes <- sum(
    player_pen & !is.finite(penalty_minutes)
  )
  
  if (missing_goals > 0) {
    add_warning(
      game_id,
      "goal_missing_player_id",
      missing_goals
    )
  }
  
  if (missing_shots > 0) {
    add_warning(
      game_id,
      "shot_missing_player_id",
      missing_shots
    )
  }
  
  if (missing_penalties > 0) {
    add_warning(
      game_id,
      "penalty_missing_player_id",
      missing_penalties
    )
  }
  
  if (missing_minutes > 0) {
    add_warning(
      game_id,
      "penalty_missing_minutes",
      missing_minutes
    )
  }
  
  # ----------------------------------------------------------
  # INCOMPLETE GAMES
  # ----------------------------------------------------------
  
  if (
    count("shot") < 5 ||
    count("faceoff") < 5
  ) {
    add_warning(
      game_id,
      "potentially_incomplete_game",
      nrow(d)
    )
  }
  
  # ----------------------------------------------------------
  # PROGRESS
  # ----------------------------------------------------------
  
  if (i %% 25 == 0 || i == length(files)) {
    cat(
      "Processed:", i, "/", length(files),
      "\n"
    )
  }
  
}

# ============================================================
# AGGREGATE PLAYER STATISTICS
# ============================================================

if (!length(records)) {
  stop("No player events extracted.")
}

raw <- do.call(rbind, records)

agg <- aggregate(
  value ~ game_id + player_id + stat,
  data = raw,
  FUN = sum
)

wide <- reshape(
  agg,
  idvar = c("game_id", "player_id"),
  timevar = "stat",
  direction = "wide"
)

names(wide) <- sub(
  "^value\\.",
  "",
  names(wide)
)

# ============================================================
# ENSURE STATISTIC COLUMNS
# ============================================================

stats <- c(
  "G",
  "A",
  "PPG",
  "SHG",
  "ENG",
  "GWG",
  "SHOT_EVENT",
  "PENALTY_EVENT",
  "PIM",
  "FO_ATT",
  "FO_WIN",
  "FO_LOSS"
)

for (s in stats) {
  
  if (!s %in% names(wide)) {
    wide[[s]] <- 0
  }
  
  wide[[s]][is.na(wide[[s]])] <- 0
  
}

# ============================================================
# DERIVED STATISTICS
# ============================================================

wide$P <- wide$G + wide$A

# ============================================================
# VALIDATION TABLE
# ============================================================

validation_df <- if (length(warnings)) {
  do.call(rbind, warnings)
} else {
  data.frame(
    game_id = character(),
    issue = character(),
    count = integer(),
    stringsAsFactors = FALSE
  )
}

summary_df <- if (length(summaries)) {
  do.call(rbind, summaries)
} else {
  data.frame()
}

# ============================================================
# FACEoff COMPLETENESS
#
# If any faceoff winner is unresolved in a game,
# suppress affected player FO_WIN / FO_LOSS / FO_PCT.
# Do not present partial wins as complete totals.
# ============================================================

unresolved_games <- unique(
  validation_df$game_id[
    validation_df$issue ==
      "faceoff_winner_unresolved"
  ]
)

affected <- wide$game_id %in% unresolved_games &
  wide$FO_ATT > 0

wide$FO_WIN[affected] <- NA_real_
wide$FO_LOSS[affected] <- NA_real_

wide$FO_PCT <- rep(
  NA_real_,
  nrow(wide)
)

complete_fo <- wide$FO_ATT > 0 &
  !is.na(wide$FO_WIN) &
  !is.na(wide$FO_LOSS)

wide$FO_PCT[complete_fo] <- round(
  100 *
    wide$FO_WIN[complete_fo] /
    wide$FO_ATT[complete_fo],
  1
)

wide$season <- season

# ============================================================
# FINAL COLUMN ORDER
# ============================================================

wide <- wide[, c(
  "season",
  "game_id",
  "player_id",
  "G",
  "A",
  "P",
  "PPG",
  "SHG",
  "ENG",
  "GWG",
  "SHOT_EVENT",
  "PENALTY_EVENT",
  "PIM",
  "FO_ATT",
  "FO_WIN",
  "FO_LOSS",
  "FO_PCT"
)]

wide <- wide[
  order(wide$game_id, wide$player_id),
  ,
  drop = FALSE
]

rownames(wide) <- NULL

# ============================================================
# RECONCILIATION
# ============================================================

raw_goals <- sum(summary_df$goals)
raw_shots <- sum(summary_df$shots)
raw_faceoffs <- sum(summary_df$faceoffs)

log_goals <- sum(wide$G)
log_assists <- sum(wide$A)
log_shots <- sum(wide$SHOT_EVENT)
log_faceoffs <- sum(wide$FO_ATT)

resolved_wins <- sum(
  wide$FO_WIN,
  na.rm = TRUE
)

resolved_losses <- sum(
  wide$FO_LOSS,
  na.rm = TRUE
)

cat("\n====================================\n")
cat("ICEINDEX — RECONCILIATION\n")
cat("====================================\n")

cat("Raw goal events:", raw_goals, "\n")
cat("Player goals:", log_goals, "\n")

cat("Player assists:", log_assists, "\n")

cat("Raw shot events:", raw_shots, "\n")
cat("Player shot events:", log_shots, "\n")

cat("Raw faceoffs:", raw_faceoffs, "\n")
cat("Player faceoff attempts:", log_faceoffs, "\n")

cat("Published faceoff wins:", resolved_wins, "\n")
cat("Published faceoff losses:", resolved_losses, "\n")

cat(
  "Unresolved faceoff games:",
  length(unresolved_games),
  "\n"
)

# ------------------------------------------------------------
# HARD VALIDATION
#
# Do not overwrite existing CSVs if key event totals
# fail reconciliation.
# ------------------------------------------------------------

if (raw_goals != log_goals) {
  stop("Goal reconciliation failed. CSVs not written.")
}

if (raw_shots != log_shots) {
  stop("Shot reconciliation failed. CSVs not written.")
}

if (log_faceoffs > raw_faceoffs * 2) {
  stop("Faceoff attempts exceed possible participants.")
}

if (resolved_wins != resolved_losses) {
  stop("Faceoff win/loss reconciliation failed.")
}

if (any(
  wide$FO_WIN > wide$FO_ATT,
  na.rm = TRUE
)) {
  stop("Faceoff wins exceed attempts.")
}

if (any(
  wide$FO_LOSS > wide$FO_ATT,
  na.rm = TRUE
)) {
  stop("Faceoff losses exceed attempts.")
}

if (any(
  wide$FO_WIN + wide$FO_LOSS != wide$FO_ATT &
  complete_fo,
  na.rm = TRUE
)) {
  stop("Faceoff totals do not reconcile.")
}

# ============================================================
# EXPORT
# ============================================================

write.csv(
  wide,
  file.path(
    base_dir,
    "player_game_logs.csv"
  ),
  row.names = FALSE,
  na = ""
)

write.csv(
  summary_df,
  file.path(
    base_dir,
    "game_event_summary.csv"
  ),
  row.names = FALSE
)

write.csv(
  validation_df,
  file.path(
    base_dir,
    "game_log_validation.csv"
  ),
  row.names = FALSE
)

# ============================================================
# FINAL REPORT
# ============================================================

cat("\n====================================\n")
cat("ICEINDEX GAME LOGS COMPLETE\n")
cat("====================================\n")

cat("Games:", nrow(summary_df), "\n")
cat("Player-game rows:", nrow(wide), "\n")
cat("Goals:", sum(wide$G), "\n")
cat("Assists:", sum(wide$A), "\n")
cat("Points:", sum(wide$P), "\n")
cat("Shot events:", sum(wide$SHOT_EVENT), "\n")
cat("Player PIM:", sum(wide$PIM), "\n")

cat("Faceoff attempts:", sum(wide$FO_ATT), "\n")

cat(
  "Faceoff wins (published):",
  sum(wide$FO_WIN, na.rm = TRUE),
  "\n"
)

cat(
  "Faceoff losses (published):",
  sum(wide$FO_LOSS, na.rm = TRUE),
  "\n"
)

cat(
  "Faceoff games unresolved:",
  length(unresolved_games),
  "\n"
)

cat("\nVALIDATION WARNINGS:\n")

if (nrow(validation_df)) {
  
  print(
    aggregate(
      count ~ issue,
      data = validation_df,
      FUN = sum
    ),
    row.names = FALSE
  )
  
  cat("\nGames with each warning:\n")
  
  print(
    aggregate(
      game_id ~ issue,
      data = validation_df,
      FUN = function(x) length(unique(x))
    ),
    row.names = FALSE
  )
  
} else {
  cat("No warnings.\n")
}

cat("\nFiles saved to:", base_dir, "\n")
cat("\nICEINDEX BUILD FINISHED\n")
