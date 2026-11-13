
# ============================================================
# ICEINDEX — PLAYER GAME LOG ENRICHMENT
# Version: v0.10.0
#
# INPUT:
# data/games/2026-27/player_game_logs.csv
# data/games/2026-27/schedule.csv
# data/games/2026-27/events/*.rds
#
# OUTPUT:
# data/games/2026-27/player_game_logs_enriched.csv
# data/games/2026-27/player_game_log_enrichment_validation.csv
#
# Local cached data only. No API requests.
# Never modifies the original statistical game logs.
# ============================================================

season <- "2026-27"
base_dir <- file.path("data", "games", season)

logs_path <- file.path(base_dir, "player_game_logs.csv")
schedule_path <- file.path(base_dir, "schedule.csv")
events_dir <- file.path(base_dir, "events")

output_path <- file.path(
  base_dir, "player_game_logs_enriched.csv"
)

validation_path <- file.path(
  base_dir, "player_game_log_enrichment_validation.csv"
)

# ============================================================
# HELPERS
# ============================================================

clean <- function(x) {
  x <- trimws(as.character(x))
  x[is.na(x) | !nzchar(x) |
      toupper(x) %in% c("NA", "NULL", "NONE", "NAN")] <-
    NA_character_
  x
}

valid <- function(x) {
  !is.na(clean(x))
}

consensus <- function(x) {
  x <- unique(clean(x))
  x <- x[!is.na(x)]
  if (length(x) == 1L) x else NA_character_
}

# Read ordinary, flattened or nested HockeyTech fields.
get_col <- function(d, field) {
  
  n <- nrow(d)
  
  if (field %in% names(d)) {
    x <- d[[field]]
    if (is.atomic(x) && length(x) == n) {
      return(clean(x))
    }
  }
  
  parts <- strsplit(field, ".", fixed = TRUE)[[1]]
  
  if (length(parts) < 2L) {
    return(rep(NA_character_, n))
  }
  
  parent <- parts[1]
  child <- paste(parts[-1], collapse = ".")
  
  if (!parent %in% names(d)) {
    return(rep(NA_character_, n))
  }
  
  x <- d[[parent]]
  
  if (is.data.frame(x)) {
    if (child %in% names(x)) {
      return(clean(x[[child]]))
    }
  }
  
  if (is.list(x) && length(x) == n) {
    return(clean(vapply(x, function(z) {
      if (is.null(z) || !is.list(z) ||
          !child %in% names(z)) {
        return(NA_character_)
      }
      value <- z[[child]]
      if (is.atomic(value) && length(value) == 1L) {
        return(as.character(value))
      }
      NA_character_
    }, character(1))))
  }
  
  rep(NA_character_, n)
}

# Extract player identity associated with an event role.
extract_role <- function(d, gid, mask, id_field, prefix) {
  
  ids <- get_col(d, id_field)
  keep <- mask & valid(ids)
  keep[is.na(keep)] <- FALSE
  
  if (!any(keep)) return(NULL)
  
  data.frame(
    game_id = gid,
    player_id = ids[keep],
    first_name = get_col(
      d, paste0(prefix, ".first_name")
    )[keep],
    last_name = get_col(
      d, paste0(prefix, ".last_name")
    )[keep],
    team_id = get_col(
      d, paste0(prefix, ".team_id")
    )[keep],
    team_code = get_col(
      d, paste0(prefix, ".team_code")
    )[keep],
    stringsAsFactors = FALSE
  )
}

# ============================================================
# LOAD INPUTS
# ============================================================

cat("\n====================================\n")
cat("ICEINDEX — PLAYER ENRICHMENT\n")
cat("Version: v0.10.0\n")
cat("====================================\n")

if (!file.exists(logs_path)) {
  stop("Missing player_game_logs.csv")
}

if (!file.exists(schedule_path)) {
  stop("Missing schedule.csv")
}

logs <- read.csv(
  logs_path,
  colClasses = c(
    game_id = "character",
    player_id = "character"
  ),
  check.names = FALSE,
  stringsAsFactors = FALSE
)

schedule <- read.csv(
  schedule_path,
  colClasses = c(ID = "character"),
  check.names = FALSE,
  stringsAsFactors = FALSE
)

required_logs <- c(
  "season", "game_id", "player_id",
  "G", "A", "P", "FO_ATT", "FO_WIN"
)

required_schedule <- c(
  "ID", "Date", "ScheduledFormattedTime",
  "HomeLongName", "VisitorLongName",
  "HomeGoals", "VisitorGoals"
)

if (!all(required_logs %in% names(logs))) {
  stop("Player game logs missing required columns.")
}

if (!all(required_schedule %in% names(schedule))) {
  stop("Schedule missing required columns.")
}

if (anyDuplicated(logs[c("game_id", "player_id")])) {
  stop("Duplicate player-game keys in original logs.")
}

schedule$ID <- clean(schedule$ID)

if (anyDuplicated(schedule$ID)) {
  stop("Duplicate game IDs in schedule.csv.")
}

files <- sort(list.files(
  events_dir,
  pattern = "\\.rds$",
  full.names = TRUE
))

if (!length(files)) {
  stop("No cached event files found.")
}

cat("Player-game rows:", nrow(logs), "\n")
cat("Schedule games:", nrow(schedule), "\n")
cat("Cached games:", length(files), "\n\n")

# ============================================================
# PREPARE SCHEDULE
# ============================================================

schedule_data <- data.frame(
  game_id = schedule$ID,
  game_date = clean(schedule$Date),
  scheduled_time = clean(
    schedule$ScheduledFormattedTime
  ),
  home_team_name = clean(schedule$HomeLongName),
  visitor_team_name = clean(schedule$VisitorLongName),
  home_goals = suppressWarnings(
    as.numeric(schedule$HomeGoals)
  ),
  visitor_goals = suppressWarnings(
    as.numeric(schedule$VisitorGoals)
  ),
  stringsAsFactors = FALSE
)

parsed_dates <- suppressWarnings(
  as.Date(schedule_data$game_date, format = "%Y-%m-%d")
)

schedule_data$game_date[
  is.na(parsed_dates)
] <- NA_character_

schedule_data$game_date[
  !is.na(parsed_dates)
] <- as.character(parsed_dates[!is.na(parsed_dates)])

# ============================================================
# EXTRACT CACHED PLAYER AND TEAM INFORMATION
# ============================================================

player_records <- list()
game_records <- list()
issues <- list()

add_issue <- function(gid, pid, issue) {
  issues[[length(issues) + 1L]] <<- data.frame(
    game_id = as.character(gid),
    player_id = as.character(pid),
    issue = issue,
    count = 1L,
    stringsAsFactors = FALSE
  )
}

for (i in seq_along(files)) {
  
  gid <- sub("\\.rds$", "", basename(files[i]))
  
  d <- tryCatch(
    readRDS(files[i]),
    error = function(e) NULL
  )
  
  if (is.null(d) || !is.data.frame(d) ||
      !"event" %in% names(d)) {
    add_issue(gid, NA, "invalid_event_file")
    next
  }
  
  event <- tolower(get_col(d, "event"))
  
  mask <- function(type) {
    x <- !is.na(event) & event == type
    x[is.na(x)] <- FALSE
    x
  }
  
  goals <- mask("goal")
  shots <- mask("shot")
  penalties <- mask("penalty")
  faceoffs <- mask("faceoff")
  
  roles <- list(
    extract_role(
      d, gid, goals,
      "goal_player_id", "goal_player"
    ),
    extract_role(
      d, gid, goals,
      "assist1_player_id", "assist1_player"
    ),
    extract_role(
      d, gid, goals,
      "assist2_player_id", "assist2_player"
    ),
    extract_role(
      d, gid, shots,
      "player_id", "player"
    ),
    extract_role(
      d, gid, penalties,
      "player_id", "player_penalized_info"
    ),
    extract_role(
      d, gid, faceoffs,
      "home_player_id", "player_home"
    ),
    extract_role(
      d, gid, faceoffs,
      "visitor_player_id", "player_visitor"
    )
  )
  
  roles <- Filter(Negate(is.null), roles)
  
  if (length(roles)) {
    player_records[[length(player_records) + 1L]] <-
      do.call(rbind, roles)
  }
  
  # Resolve home and visitor team identifiers from
  # faceoff participant metadata.
  
  home_id <- consensus(
    get_col(d, "player_home.team_id")[faceoffs]
  )
  
  visitor_id <- consensus(
    get_col(d, "player_visitor.team_id")[faceoffs]
  )
  
  home_code <- consensus(
    get_col(d, "player_home.team_code")[faceoffs]
  )
  
  visitor_code <- consensus(
    get_col(d, "player_visitor.team_code")[faceoffs]
  )
  
  game_records[[length(game_records) + 1L]] <-
    data.frame(
      game_id = gid,
      home_team_id = home_id,
      visitor_team_id = visitor_id,
      home_team_code = home_code,
      visitor_team_code = visitor_code,
      stringsAsFactors = FALSE
    )
  
  if (i %% 25 == 0 || i == length(files)) {
    cat("Processed:", i, "/", length(files), "\n")
  }
}

if (!length(player_records)) {
  stop("No player identities extracted.")
}

# ============================================================
# RESOLVE PLAYER IDENTITIES
# ============================================================

raw <- do.call(rbind, player_records)

raw <- raw[
  valid(raw$player_id),
  ,
  drop = FALSE
]

key <- paste(raw$game_id, raw$player_id, sep = "\r")

groups <- split(seq_len(nrow(raw)), key)

identities <- do.call(rbind, lapply(groups, function(idx) {
  
  x <- raw[idx, , drop = FALSE]
  
  data.frame(
    game_id = x$game_id[1],
    player_id = x$player_id[1],
    first_name = consensus(x$first_name),
    last_name = consensus(x$last_name),
    team_id = consensus(x$team_id),
    team_code = consensus(x$team_code),
    stringsAsFactors = FALSE
  )
}))

rownames(identities) <- NULL

# Season-wide name fallback.
# Do not carry team assignments across games.

player_groups <- split(
  seq_len(nrow(raw)),
  raw$player_id
)

fallback <- do.call(rbind, lapply(
  player_groups,
  function(idx) {
    
    x <- raw[idx, , drop = FALSE]
    
    data.frame(
      player_id = x$player_id[1],
      fallback_first = consensus(x$first_name),
      fallback_last = consensus(x$last_name),
      stringsAsFactors = FALSE
    )
  }
))

rownames(fallback) <- NULL

# ============================================================
# JOIN PLAYER INFORMATION
# ============================================================

enriched <- logs
enriched$.original_order <- seq_len(nrow(enriched))

enriched <- merge(
  enriched,
  identities,
  by = c("game_id", "player_id"),
  all.x = TRUE,
  sort = FALSE
)

enriched <- merge(
  enriched,
  fallback,
  by = "player_id",
  all.x = TRUE,
  sort = FALSE
)

missing_first <- !valid(enriched$first_name)
missing_last <- !valid(enriched$last_name)

enriched$first_name[missing_first] <-
  enriched$fallback_first[missing_first]

enriched$last_name[missing_last] <-
  enriched$fallback_last[missing_last]

enriched$fallback_first <- NULL
enriched$fallback_last <- NULL

enriched$player_name <- clean(paste(
  ifelse(valid(enriched$first_name),
         enriched$first_name, ""),
  ifelse(valid(enriched$last_name),
         enriched$last_name, "")
))

# ============================================================
# JOIN GAME AND SCHEDULE INFORMATION
# ============================================================

games <- do.call(rbind, game_records)

if (anyDuplicated(games$game_id)) {
  stop("Duplicate cached game metadata.")
}

enriched <- merge(
  enriched,
  games,
  by = "game_id",
  all.x = TRUE,
  sort = FALSE
)

enriched <- merge(
  enriched,
  schedule_data,
  by = "game_id",
  all.x = TRUE,
  sort = FALSE
)

# ============================================================
# HOME / AWAY AND OPPONENT
# ============================================================

enriched$home_away <- NA_character_
enriched$opponent_team_id <- NA_character_
enriched$opponent_team_code <- NA_character_
enriched$opponent_team_name <- NA_character_
enriched$team_name <- NA_character_

home_match <- valid(enriched$team_id) &
  valid(enriched$home_team_id) &
  enriched$team_id == enriched$home_team_id

away_match <- valid(enriched$team_id) &
  valid(enriched$visitor_team_id) &
  enriched$team_id == enriched$visitor_team_id

home_match[is.na(home_match)] <- FALSE
away_match[is.na(away_match)] <- FALSE

ambiguous <- home_match & away_match

home_match[ambiguous] <- FALSE
away_match[ambiguous] <- FALSE

enriched$home_away[home_match] <- "H"
enriched$home_away[away_match] <- "A"

enriched$team_name[home_match] <-
  enriched$home_team_name[home_match]

enriched$team_name[away_match] <-
  enriched$visitor_team_name[away_match]

enriched$opponent_team_id[home_match] <-
  enriched$visitor_team_id[home_match]

enriched$opponent_team_id[away_match] <-
  enriched$home_team_id[away_match]

enriched$opponent_team_code[home_match] <-
  enriched$visitor_team_code[home_match]

enriched$opponent_team_code[away_match] <-
  enriched$home_team_code[away_match]

enriched$opponent_team_name[home_match] <-
  enriched$visitor_team_name[home_match]

enriched$opponent_team_name[away_match] <-
  enriched$home_team_name[away_match]

# ============================================================
# RESTORE ORIGINAL ORDER
# ============================================================

enriched <- enriched[
  order(enriched$.original_order),
  ,
  drop = FALSE
]

enriched$.original_order <- NULL
rownames(enriched) <- NULL

# ============================================================
# VALIDATION
# ============================================================

checks <- list(
  missing_player_name = !valid(enriched$player_name),
  missing_team_id = !valid(enriched$team_id),
  missing_team_code = !valid(enriched$team_code),
  missing_game_date = !valid(enriched$game_date),
  missing_home_away = !valid(enriched$home_away),
  missing_opponent = !valid(
    enriched$opponent_team_id
  ),
  missing_team_name = !valid(enriched$team_name),
  missing_opponent_name = !valid(
    enriched$opponent_team_name
  )
)

for (issue in names(checks)) {
  
  idx <- which(checks[[issue]])
  
  if (length(idx)) {
    
    issues[[length(issues) + 1L]] <- data.frame(
      game_id = enriched$game_id[idx],
      player_id = enriched$player_id[idx],
      issue = issue,
      count = 1L,
      stringsAsFactors = FALSE
    )
  }
}

# ============================================================
# STATISTICAL RECONCILIATION
# ============================================================

if (nrow(enriched) != nrow(logs)) {
  stop("Enrichment changed player-game row count.")
}

if (anyDuplicated(
  enriched[c("game_id", "player_id")]
)) {
  stop("Duplicate player-game records.")
}

# Confirm that original row order and player IDs
# have not changed.

if (!identical(
  as.character(enriched$game_id),
  as.character(logs$game_id)
)) {
  stop("Game ID order changed.")
}

if (!identical(
  as.character(enriched$player_id),
  as.character(logs$player_id)
)) {
  stop("Player ID order changed.")
}

# Compare every original column, not just selected totals.

for (column in names(logs)) {
  
  if (!isTRUE(all.equal(
    logs[[column]],
    enriched[[column]],
    check.attributes = FALSE
  ))) {
    stop(
      "Original data changed during enrichment: ",
      column
    )
  }
}

# ============================================================
# FINAL COLUMN ORDER
# ============================================================

metadata_cols <- c(
  "season",
  "game_id",
  "game_date",
  "scheduled_time",
  "player_id",
  "player_name",
  "first_name",
  "last_name",
  "team_id",
  "team_code",
  "team_name",
  "home_away",
  "opponent_team_id",
  "opponent_team_code",
  "opponent_team_name",
  "home_team_name",
  "visitor_team_name",
  "home_goals",
  "visitor_goals"
)

stat_cols <- setdiff(
  names(logs),
  metadata_cols
)

enriched <- enriched[, c(
  metadata_cols,
  stat_cols
), drop = FALSE]

# ============================================================
# VALIDATION EXPORT
# ============================================================

validation <- if (length(issues)) {
  do.call(rbind, issues)
} else {
  data.frame(
    game_id = character(),
    player_id = character(),
    issue = character(),
    count = integer(),
    stringsAsFactors = FALSE
  )
}

# ============================================================
# WRITE OUTPUTS
# ============================================================

write.csv(
  enriched,
  output_path,
  row.names = FALSE,
  na = ""
)

write.csv(
  validation,
  validation_path,
  row.names = FALSE,
  na = ""
)

# ============================================================
# FINAL REPORT
# ============================================================

cat("\n====================================\n")
cat("ICEINDEX — ENRICHMENT RECONCILIATION\n")
cat("====================================\n")

cat("Player-game rows:", nrow(enriched), "\n")
cat("Unique games:", length(unique(enriched$game_id)), "\n")

report_field <- function(label, field) {
  n <- sum(valid(enriched[[field]]))
  pct <- round(100 * n / nrow(enriched), 2)
  
  cat(
    sprintf(
      "%-25s %5d / %d (%5.2f%%)\n",
      label, n, nrow(enriched), pct
    )
  )
}

report_field("Player names:", "player_name")
report_field("Team IDs:", "team_id")
report_field("Team codes:", "team_code")
report_field("Team names:", "team_name")
report_field("Game dates:", "game_date")
report_field("Home/away:", "home_away")
report_field("Opponent IDs:", "opponent_team_id")
report_field("Opponent names:", "opponent_team_name")

cat("\nSTATISTICS PRESERVED\n")

for (stat in c(
  "G", "A", "P", "PIM",
  "FO_ATT", "FO_WIN", "FO_LOSS"
)) {
  
  if (stat %in% names(enriched)) {
    cat(
      stat, ": ",
      sum(enriched[[stat]], na.rm = TRUE),
      "\n",
      sep = ""
    )
  }
}

cat("\nVALIDATION WARNINGS\n")

if (nrow(validation)) {
  
  print(
    aggregate(
      count ~ issue,
      data = validation,
      FUN = sum
    ),
    row.names = FALSE
  )
  
} else {
  cat("None.\n")
}

cat("\nFILES SAVED\n")
cat(output_path, "\n")
cat(validation_path, "\n")

cat("\nICEINDEX v0.10.0 ENRICHMENT FINISHED\n")