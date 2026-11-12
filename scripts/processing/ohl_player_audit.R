
# ============================================================
# ICEINDEX v0.8.0
# OHL PLAYER DATABASE INTEGRITY AUDIT
# ============================================================
#
# PURPOSE:
#   Investigate unmatched players, duplicate identities,
#   multi-team seasons and potential career double counting.
#
# INPUT:
#   data/clean/ohl/
#   data/processed/ohl/
#
# OUTPUT:
#   data/audits/ohl/
#
# This script NEVER modifies source or processed data.
#
# ============================================================


# ============================================================
# 1. CONFIGURATION
# ============================================================

INPUT_DIR <- "data/clean/ohl"
PROCESSED_DIR <- "data/processed/ohl"
OUTPUT_DIR <- "data/audits/ohl"

started <- Sys.time()

if (!dir.exists(INPUT_DIR)) {
  stop("Missing cleaned OHL database.")
}

if (!dir.exists(PROCESSED_DIR)) {
  stop("Missing processed OHL database.")
}

dir.create(
  OUTPUT_DIR,
  recursive = TRUE,
  showWarnings = FALSE
)


# ============================================================
# 2. UTILITIES
# ============================================================

section <- function(title) {
  
  cat(
    "\n",
    strrep("=", 70),
    "\n",
    title,
    "\n",
    strrep("=", 70),
    "\n",
    sep = ""
  )
}

info <- function(...) {
  cat("[INFO] ", paste0(..., collapse = ""), "\n", sep = "")
}

ok <- function(...) {
  cat("[ OK ] ", paste0(..., collapse = ""), "\n", sep = "")
}

warn <- function(...) {
  cat("[WARN] ", paste0(..., collapse = ""), "\n", sep = "")
}

read_data <- function(path) {
  
  if (!file.exists(path)) {
    stop("Missing file: ", path)
  }
  
  read.csv(
    path,
    stringsAsFactors = FALSE,
    check.names = FALSE,
    colClasses = "character",
    na.strings = c("", "NA")
  )
}

save_report <- function(df, filename) {
  
  path <- file.path(
    OUTPUT_DIR,
    filename
  )
  
  write.csv(
    df,
    path,
    row.names = FALSE,
    na = ""
  )
  
  ok(filename, " | ", nrow(df), " rows")
}

safe_numeric <- function(x) {
  suppressWarnings(as.numeric(x))
}

safe_text <- function(x) {
  x <- as.character(x)
  x[is.na(x)] <- ""
  trimws(x)
}

make_key <- function(...) {
  
  parts <- list(...)
  
  do.call(
    paste,
    c(parts, sep = "|")
  )
}

select_columns <- function(df, columns) {
  
  df[
    ,
    intersect(columns, names(df)),
    drop = FALSE
  ]
}


# ============================================================
# 3. LOAD DATA
# ============================================================

section("ICEINDEX v0.6.0 | OHL PLAYER INTEGRITY AUDIT")

players <- read_data(
  file.path(INPUT_DIR, "players.csv")
)

directory <- read_data(
  file.path(PROCESSED_DIR, "player_directory.csv")
)

career <- read_data(
  file.path(PROCESSED_DIR, "player_career.csv")
)

stat_files <- list.files(
  file.path(INPUT_DIR, "seasons"),
  pattern = "^skater_stats\\.csv$",
  recursive = TRUE,
  full.names = TRUE
)

if (length(stat_files) == 0) {
  stop("No cleaned skater statistics found.")
}

stat_files <- sort(stat_files)

stats_list <- lapply(
  stat_files,
  read_data
)

all_columns <- unique(
  unlist(
    lapply(stats_list, names)
  )
)

stats_list <- lapply(
  stats_list,
  function(df) {
    
    missing <- setdiff(
      all_columns,
      names(df)
    )
    
    for (nm in missing) {
      df[[nm]] <- NA_character_
    }
    
    df[
      ,
      all_columns,
      drop = FALSE
    ]
  }
)

stats <- do.call(
  rbind,
  stats_list
)

rownames(stats) <- NULL

required <- c(
  "PlayerID",
  "SeasonID",
  "TeamID",
  "HockeySeason",
  "Competition"
)

if (!all(required %in% names(stats))) {
  stop("Statistical records lack required identifiers.")
}

if (!"PlayerID" %in% names(players)) {
  stop("Player reference lacks PlayerID.")
}

if (!all(
  c("PlayerID", "Competition") %in% names(career)
)) {
  stop("Career database lacks required identifiers.")
}

ok("Skater records: ", nrow(stats))
ok("Player reference rows: ", nrow(players))
ok("Directory profiles: ", nrow(directory))
ok("Published career rows: ", nrow(career))
ok("Season files: ", length(stat_files))


# ============================================================
# 4. UNMATCHED PLAYER IDENTIFIERS
# ============================================================

section("1. INVESTIGATING UNMATCHED PLAYERS")

unmatched_ids <- setdiff(
  unique(stats$PlayerID),
  unique(players$PlayerID)
)

unmatched <- stats[
  stats$PlayerID %in% unmatched_ids,
  ,
  drop = FALSE
]

unmatched_columns <- c(
  "PlayerID",
  "PersonID",
  "PlayerName",
  "FirstName",
  "LastName",
  "SeasonID",
  "HockeySeason",
  "Competition",
  "TeamID",
  "TeamName",
  "Position",
  "GamesPlayed",
  "Goals",
  "Assists",
  "Points"
)

unmatched_report <- select_columns(
  unmatched,
  unmatched_columns
)

save_report(
  unmatched_report,
  "unmatched_players.csv"
)

info(
  "Unique unmatched PlayerIDs: ",
  length(unmatched_ids)
)

info(
  "Statistical rows affected: ",
  nrow(unmatched)
)

if (nrow(unmatched_report) > 0) {
  
  print(
    unmatched_report,
    row.names = FALSE
  )
}


# ============================================================
# 5. CHECK ALTERNATIVE PLAYER IDENTITIES
# ============================================================

section("2. CHECKING ALTERNATIVE PLAYER IDENTITIES")

identity_matches <- data.frame(
  PlayerID = character(),
  SeasonID = character(),
  CandidatePlayerID = character(),
  MatchMethod = character(),
  stringsAsFactors = FALSE
)

if (
  "PersonID" %in% names(stats) &&
  "PersonID" %in% names(players)
) {
  
  for (i in seq_len(nrow(unmatched))) {
    
    person <- unmatched$PersonID[i]
    
    if (is.na(person) || !nzchar(person)) {
      next
    }
    
    candidates <- players[
      !is.na(players$PersonID) &
        players$PersonID == person,
      ,
      drop = FALSE
    ]
    
    if (nrow(candidates) == 0) {
      next
    }
    
    for (candidate in unique(candidates$PlayerID)) {
      
      identity_matches <- rbind(
        identity_matches,
        data.frame(
          PlayerID = unmatched$PlayerID[i],
          SeasonID = unmatched$SeasonID[i],
          CandidatePlayerID = candidate,
          MatchMethod = "PersonID",
          stringsAsFactors = FALSE
        )
      )
    }
  }
}

identity_matches <- unique(identity_matches)

save_report(
  identity_matches,
  "alternative_identity_matches.csv"
)

info(
  "Alternative identity candidates: ",
  nrow(identity_matches)
)


# ============================================================
# 6. DUPLICATE PLAYER-SEASON-TEAM IDENTITIES
# ============================================================

section("3. CHECKING DUPLICATE STATISTICAL IDENTITIES")

identity_key <- make_key(
  stats$PlayerID,
  stats$SeasonID,
  stats$TeamID
)

duplicate_mask <- duplicated(identity_key) |
  duplicated(
    identity_key,
    fromLast = TRUE
  )

duplicate_records <- stats[
  duplicate_mask,
  ,
  drop = FALSE
]

duplicate_report <- select_columns(
  duplicate_records,
  c(
    "PlayerID",
    "PlayerName",
    "SeasonID",
    "HockeySeason",
    "Competition",
    "TeamID",
    "TeamName",
    "GamesPlayed",
    "Goals",
    "Assists",
    "Points"
  )
)

save_report(
  duplicate_report,
  "duplicate_identities.csv"
)

info(
  "Repeated identity records: ",
  nrow(duplicate_records)
)

info(
  "Repeated identity groups: ",
  length(unique(
    identity_key[duplicate_mask]
  ))
)


# ============================================================
# 7. MULTI-TEAM PLAYER SEASONS
# ============================================================

section("4. INVESTIGATING MULTI-TEAM SEASONS")

season_key <- make_key(
  stats$PlayerID,
  stats$SeasonID
)

team_counts <- tapply(
  stats$TeamID,
  season_key,
  function(x) {
    
    length(
      unique(
        x[!is.na(x)]
      )
    )
  }
)

multi_keys <- names(
  team_counts[team_counts > 1]
)

multi_team <- stats[
  season_key %in% multi_keys,
  ,
  drop = FALSE
]

multi_team_report <- select_columns(
  multi_team,
  c(
    "PlayerID",
    "PlayerName",
    "SeasonID",
    "HockeySeason",
    "Competition",
    "TeamID",
    "TeamName",
    "GamesPlayed",
    "Goals",
    "Assists",
    "Points"
  )
)

save_report(
  multi_team_report,
  "multi_team_seasons.csv"
)

info(
  "Multi-team player-season groups: ",
  length(multi_keys)
)

info(
  "Multi-team statistical rows: ",
  nrow(multi_team)
)


# ============================================================
# 8. IDENTIFY POTENTIAL AGGREGATE ROWS
# ============================================================

section("5. CHECKING POTENTIAL AGGREGATE ROWS")

aggregate_pattern <- rep(
  FALSE,
  nrow(stats)
)

if ("TeamName" %in% names(stats)) {
  
  aggregate_pattern <- grepl(
    "total|combined|multiple|all teams|2 teams|3 teams",
    safe_text(stats$TeamName),
    ignore.case = TRUE
  )
}

possible_aggregates <- stats[
  aggregate_pattern,
  ,
  drop = FALSE
]

aggregate_report <- select_columns(
  possible_aggregates,
  c(
    "PlayerID",
    "PlayerName",
    "SeasonID",
    "HockeySeason",
    "Competition",
    "TeamID",
    "TeamName",
    "GamesPlayed",
    "Goals",
    "Assists",
    "Points"
  )
)

save_report(
  aggregate_report,
  "possible_aggregate_rows.csv"
)

info(
  "Potential aggregate rows: ",
  nrow(possible_aggregates)
)


# ============================================================
# 9. DETECT NUMERICALLY MATCHING TOTAL ROWS
# ============================================================

section("6. TESTING FOR HIDDEN COMBINED TOTALS")

stat_fields <- intersect(
  c(
    "GamesPlayed",
    "Goals",
    "Assists",
    "Points",
    "PIM"
  ),
  names(stats)
)

for (nm in stat_fields) {
  stats[[nm]] <- safe_numeric(stats[[nm]])
}

potential_total_rows <- data.frame(
  PlayerID = character(),
  SeasonID = character(),
  TeamID = character(),
  HockeySeason = character(),
  Competition = character(),
  Reason = character(),
  stringsAsFactors = FALSE
)

multi_indices <- split(
  which(season_key %in% multi_keys),
  season_key[season_key %in% multi_keys]
)

for (indices in multi_indices) {
  
  group <- stats[
    indices,
    ,
    drop = FALSE
  ]
  
  if (nrow(group) < 3) {
    next
  }
  
  for (i in seq_len(nrow(group))) {
    
    others <- group[-i, , drop = FALSE]
    
    if (nrow(others) < 2) {
      next
    }
    
    fields_available <- stat_fields[
      !is.na(
        unlist(group[i, stat_fields, drop = FALSE])
      )
    ]
    
    if (length(fields_available) < 3) {
      next
    }
    
    matches <- vapply(
      fields_available,
      function(nm) {
        
        target <- group[[nm]][i]
        values <- others[[nm]]
        
        if (anyNA(values)) {
          return(FALSE)
        }
        
        abs(
          target - sum(values)
        ) < 1e-8
      },
      logical(1)
    )
    
    if (all(matches)) {
      
      potential_total_rows <- rbind(
        potential_total_rows,
        data.frame(
          PlayerID = group$PlayerID[i],
          SeasonID = group$SeasonID[i],
          TeamID = group$TeamID[i],
          HockeySeason = group$HockeySeason[i],
          Competition = group$Competition[i],
          Reason = paste(
            "Matches sum of other team rows:",
            paste(fields_available, collapse = ", ")
          ),
          stringsAsFactors = FALSE
        )
      )
    }
  }
}

potential_total_rows <- unique(
  potential_total_rows
)

save_report(
  potential_total_rows,
  "numerical_aggregate_candidates.csv"
)

info(
  "Numerical aggregate candidates: ",
  nrow(potential_total_rows)
)


# ============================================================
# 10. RECOMPUTE CAREER TOTALS
# ============================================================

section("7. RECONCILING CAREER TOTALS")

recomputed <- aggregate(
  stats[, stat_fields, drop = FALSE],
  by = list(
    PlayerID = stats$PlayerID,
    Competition = stats$Competition
  ),
  FUN = function(x) {
    
    if (all(is.na(x))) {
      return(NA_real_)
    }
    
    sum(x, na.rm = TRUE)
  }
)

names(recomputed)[
  names(recomputed) %in% stat_fields
] <- paste0(
  "Career",
  names(recomputed)[
    names(recomputed) %in% stat_fields
  ]
)

comparison <- merge(
  career,
  recomputed,
  by = c(
    "PlayerID",
    "Competition"
  ),
  all = TRUE,
  suffixes = c(
    "_Published",
    "_Recomputed"
  )
)

difference <- rep(
  FALSE,
  nrow(comparison)
)

for (nm in stat_fields) {
  
  published_column <- paste0(
    "Career",
    nm,
    "_Published"
  )
  
  recomputed_column <- paste0(
    "Career",
    nm,
    "_Recomputed"
  )
  
  if (!all(
    c(
      published_column,
      recomputed_column
    ) %in% names(comparison)
  )) {
    next
  }
  
  a <- safe_numeric(
    comparison[[published_column]]
  )
  
  b <- safe_numeric(
    comparison[[recomputed_column]]
  )
  
  mismatch <- xor(
    is.na(a),
    is.na(b)
  ) |
    (
      !is.na(a) &
        !is.na(b) &
        abs(a - b) > 1e-8
    )
  
  difference <- difference | mismatch
}

career_mismatches <- comparison[
  difference,
  ,
  drop = FALSE
]

save_report(
  career_mismatches,
  "career_mismatches.csv"
)

info(
  "Career reconciliation mismatches: ",
  nrow(career_mismatches)
)


# ============================================================
# 11. CHECK PLAYER NAME CONFLICTS
# ============================================================

section("8. CHECKING PLAYER IDENTITY CONSISTENCY")

name_conflicts <- data.frame(
  PlayerID = character(),
  DistinctNames = integer(),
  Names = character(),
  stringsAsFactors = FALSE
)

if ("PlayerName" %in% names(stats)) {
  
  name_groups <- split(
    safe_text(stats$PlayerName),
    stats$PlayerID
  )
  
  for (id in names(name_groups)) {
    
    unique_names <- unique(
      name_groups[[id]]
    )
    
    unique_names <- unique_names[
      nzchar(unique_names)
    ]
    
    if (length(unique_names) > 1) {
      
      name_conflicts <- rbind(
        name_conflicts,
        data.frame(
          PlayerID = id,
          DistinctNames = length(unique_names),
          Names = paste(
            unique_names,
            collapse = " | "
          ),
          stringsAsFactors = FALSE
        )
      )
    }
  }
}

save_report(
  name_conflicts,
  "player_name_conflicts.csv"
)

info(
  "PlayerIDs with multiple names: ",
  nrow(name_conflicts)
)


# ============================================================
# 12. AUDIT SUMMARY
# ============================================================

section("9. FINAL AUDIT SUMMARY")

audit_summary <- data.frame(
  Metric = c(
    "StatisticalRows",
    "UniqueStatisticalPlayers",
    "ReferencePlayerRows",
    "DirectoryProfiles",
    "UnmatchedPlayerIDs",
    "UnmatchedStatisticalRows",
    "RepeatedIdentityRows",
    "RepeatedIdentityGroups",
    "MultiTeamPlayerSeasons",
    "MultiTeamStatisticalRows",
    "NamedAggregateCandidates",
    "NumericalAggregateCandidates",
    "CareerReconciliationMismatches",
    "PlayerNameConflicts"
  ),
  Value = c(
    nrow(stats),
    length(unique(stats$PlayerID)),
    nrow(players),
    nrow(directory),
    length(unmatched_ids),
    nrow(unmatched),
    nrow(duplicate_records),
    length(unique(
      identity_key[duplicate_mask]
    )),
    length(multi_keys),
    nrow(multi_team),
    nrow(possible_aggregates),
    nrow(potential_total_rows),
    nrow(career_mismatches),
    nrow(name_conflicts)
  ),
  stringsAsFactors = FALSE
)

print(
  audit_summary,
  row.names = FALSE
)

save_report(
  audit_summary,
  "audit_summary.csv"
)


# ============================================================
# 13. FINAL STATUS
# ============================================================

section("ICEINDEX PLAYER INTEGRITY AUDIT COMPLETE")

runtime <- round(
  as.numeric(
    difftime(
      Sys.time(),
      started,
      units = "secs"
    )
  ),
  2
)

info("Version: 0.6.0")
info("Audit directory: ", OUTPUT_DIR)
info("Runtime: ", runtime, " seconds")
info("Source files modified: 0")

if (
  nrow(duplicate_records) > 0 ||
  nrow(potential_total_rows) > 0 ||
  length(unmatched_ids) > 0
) {
  
  warn(
    "Potential integrity issues require investigation."
  )
  
} else {
  
  ok(
    "No duplicate or unmatched player identities detected."
  )
}

cat(
  "\nAUDIT COMPLETE — NO STATISTICS WERE MODIFIED\n"
)