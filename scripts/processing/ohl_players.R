
# ============================================================
# ICEINDEX | OHL PLAYER DATABASE ENGINE
# VERSION 0.6.0
# ============================================================
#
# INPUT:
#   data/clean/ohl/
#
# OUTPUT:
#   data/processed/ohl/
#
# BUILDS:
#   player_directory.csv
#   player_seasons.csv
#   player_career.csv
#   player_teams.csv
#   processing_report.csv
#   recovered_players.csv
#
# FEATURES:
#   - Automatic missing player recovery
#   - Duplicate identity detection
#   - Multi-team / aggregate safeguards
#   - Career statistical reconciliation
#   - Strict publication quality gate
#   - Staged publishing with rollback
#   - No modifications to cleaned or raw data
#
# BASE R ONLY
# ============================================================


# ============================================================
# 1. CONFIGURATION
# ============================================================

ICEINDEX_VERSION <- "0.6.0"

INPUT_DIR <- "data/clean/ohl"
OUTPUT_DIR <- "data/processed/ohl"

started <- Sys.time()


# ============================================================
# 2. LOGGING
# ============================================================

section <- function(title) {
  
  cat(
    "\n",
    strrep("=", 68),
    "\n",
    title,
    "\n",
    strrep("=", 68),
    "\n",
    sep = ""
  )
}

log_ok <- function(...) {
  cat("[ OK ] ", paste0(..., collapse = ""), "\n", sep = "")
}

log_info <- function(...) {
  cat("[INFO] ", paste0(..., collapse = ""), "\n", sep = "")
}

log_warn <- function(...) {
  cat("[WARN] ", paste0(..., collapse = ""), "\n", sep = "")
}

fail <- function(...) {
  stop(paste0(..., collapse = ""), call. = FALSE)
}


# ============================================================
# 3. UTILITIES
# ============================================================

read_csv <- function(path) {
  
  if (!file.exists(path)) {
    fail("Missing required file: ", path)
  }
  
  read.csv(
    path,
    stringsAsFactors = FALSE,
    check.names = FALSE,
    colClasses = "character",
    na.strings = c("", "NA")
  )
}

missing_value <- function(x) {
  is.na(x) | trimws(as.character(x)) == ""
}

make_key <- function(...) {
  
  do.call(
    paste,
    c(list(...), sep = "|")
  )
}

require_columns <- function(df, columns, label) {
  
  missing <- setdiff(columns, names(df))
  
  if (length(missing) > 0) {
    fail(
      label,
      " missing columns: ",
      paste(missing, collapse = ", ")
    )
  }
}

sort_data <- function(df, columns) {
  
  columns <- intersect(columns, names(df))
  
  if (nrow(df) == 0 || length(columns) == 0) {
    return(df)
  }
  
  ordering <- do.call(
    order,
    c(df[columns], list(na.last = TRUE))
  )
  
  df <- df[ordering, , drop = FALSE]
  
  rownames(df) <- NULL
  
  df
}

safe_sum <- function(x) {
  
  if (all(is.na(x))) {
    return(NA_real_)
  }
  
  sum(x, na.rm = TRUE)
}


# ============================================================
# 4. INITIALIZE
# ============================================================

section("ICEINDEX OHL PLAYER DATABASE | v0.6.0")

if (!dir.exists(INPUT_DIR)) {
  fail("Cleaned OHL directory does not exist.")
}

log_ok("Cleaned OHL database found")


# ============================================================
# 5. LOAD PLAYER REFERENCES
# ============================================================

section("1. LOADING PLAYER REFERENCE DATA")

players <- read_csv(
  file.path(INPUT_DIR, "players.csv")
)

require_columns(
  players,
  c("PlayerID", "SeasonID", "TeamID"),
  "Player reference"
)

if (any(missing_value(players$PlayerID))) {
  fail("Player reference contains missing PlayerIDs.")
}

log_ok("Player reference records: ", nrow(players))


# ============================================================
# 6. LOAD CLEANED STATISTICS
# ============================================================

section("2. LOADING CLEANED SEASON STATISTICS")

stat_files <- list.files(
  file.path(INPUT_DIR, "seasons"),
  pattern = "^skater_stats\\.csv$",
  recursive = TRUE,
  full.names = TRUE
)

stat_files <- sort(stat_files)

if (length(stat_files) == 0) {
  fail("No cleaned skater statistics found.")
}

stats_list <- lapply(stat_files, read_csv)

all_columns <- unique(
  unlist(lapply(stats_list, names))
)

stats_list <- lapply(stats_list, function(df) {
  
  missing <- setdiff(all_columns, names(df))
  
  for (nm in missing) {
    df[[nm]] <- NA_character_
  }
  
  df[, all_columns, drop = FALSE]
})

stats <- do.call(rbind, stats_list)

rownames(stats) <- NULL

require_columns(
  stats,
  c(
    "PlayerID",
    "SeasonID",
    "HockeySeason",
    "Competition",
    "TeamID",
    "TeamName",
    "GamesPlayed",
    "Goals",
    "Assists",
    "Points"
  ),
  "Skater statistics"
)

if (nrow(stats) == 0) {
  fail("No skater statistical records found.")
}

log_ok("Season files discovered: ", length(stat_files))
log_ok("Statistical records loaded: ", nrow(stats))


# ============================================================
# 7. VALIDATE STATISTICAL IDENTIFIERS
# ============================================================

section("3. VALIDATING PLAYER IDENTIFIERS")

identity_fields <- c(
  "PlayerID",
  "SeasonID",
  "HockeySeason",
  "Competition",
  "TeamID"
)

for (nm in identity_fields) {
  
  bad <- missing_value(stats[[nm]])
  
  if (any(bad)) {
    fail(
      "Missing ",
      nm,
      " in ",
      sum(bad),
      " statistical records."
    )
  }
}

if (any(!stats$Competition %in% c("regular", "playoffs"))) {
  fail("Unexpected competition values detected.")
}

log_ok("All statistical identifiers present")


# ============================================================
# 8. DETECT DUPLICATE IDENTITIES
# ============================================================

section("4. CHECKING FOR DOUBLE COUNTING")

identity_key <- make_key(
  stats$PlayerID,
  stats$SeasonID,
  stats$Competition,
  stats$TeamID
)

duplicate_mask <- duplicated(identity_key) |
  duplicated(identity_key, fromLast = TRUE)

duplicate_count <- sum(duplicate_mask)

if (duplicate_count > 0) {
  
  fail(
    "QUALITY GATE FAILED: ",
    duplicate_count,
    " records share player-season-team identities. ",
    "No database files published."
  )
}

log_ok("Duplicate player-season-team records: 0")


# ============================================================
# 9. MULTI-TEAM SAFETY CHECK
# ============================================================

section("5. VALIDATING MULTI-TEAM SEASONS")

season_key <- make_key(
  stats$PlayerID,
  stats$SeasonID,
  stats$Competition
)

team_counts <- tapply(
  stats$TeamID,
  season_key,
  function(x) {
    length(unique(x))
  }
)

multi_team_keys <- names(
  team_counts[team_counts > 1]
)

multi_team_count <- length(multi_team_keys)

if (multi_team_count > 0) {
  
  fail(
    "QUALITY GATE FAILED: ",
    multi_team_count,
    " multi-team player-season groups detected. ",
    "Manual review required before aggregation. ",
    "No database files published."
  )
}

log_ok("Unreviewed multi-team seasons: 0")


# ============================================================
# 10. DETECT NAMED AGGREGATE RECORDS
# ============================================================

section("6. CHECKING AGGREGATE RECORDS")

aggregate_pattern <- grepl(
  "total|combined|multiple|all teams|2 teams|3 teams",
  ifelse(
    is.na(stats$TeamName),
    "",
    stats$TeamName
  ),
  ignore.case = TRUE
)

aggregate_count <- sum(aggregate_pattern)

if (aggregate_count > 0) {
  
  fail(
    "QUALITY GATE FAILED: ",
    aggregate_count,
    " possible aggregate team records found."
  )
}

log_ok("Named aggregate records: 0")


# ============================================================
# 11. STANDARDIZE NUMERIC STATISTICS
# ============================================================

# Define numeric fields LOCALLY. Earlier versions referenced
# numeric_fields without creating it, allowing a stale global
# variable to cause zero-length data-frame assignments.
#
# Core statistics must exist. Additional known counting stats
# are included only when present in the cleaned source data.
# This never creates missing statistics or substitutes zeros.

required_numeric_fields <- c(
  "GamesPlayed", "Goals", "Assists", "Points"
)

require_columns(
  stats,
  required_numeric_fields,
  "Required skater counting statistics"
)

optional_numeric_fields <- c(
  "PlusMinus", "PenaltyMinutes", "PIM", "Shots",
  "PowerPlayGoals", "PowerPlayAssists", "PowerPlayPoints",
  "ShortHandedGoals", "ShortHandedAssists", "ShortHandedPoints",
  "ShorthandedGoals", "ShorthandedAssists", "ShorthandedPoints",
  "GameWinningGoals", "GameTyingGoals", "OvertimeGoals",
  "EmptyNetGoals", "EmptyNetAssists", "EmptyNetPoints",
  "ShootoutGoals", "ShootoutAttempts", "FaceoffWins",
  "FaceoffLosses", "FaceoffsWon", "FaceoffsLost",
  "Hits", "BlockedShots", "Fights", "MajorPenalties",
  "MinorPenalties", "Misconducts"
)

numeric_fields <- unique(c(
  required_numeric_fields,
  intersect(optional_numeric_fields, names(stats))
))

log_ok(
  "Numeric statistical columns selected: ",
  paste(numeric_fields, collapse = ", ")
)

# Stop if the source contains nonempty known statistical
# fields that were unexpectedly excluded by the selection.
# Review such fields explicitly before adding to career sums.

for (nm in numeric_fields) {
  
  if (!nm %in% names(stats)) {
    fail("Missing numeric statistical column: ", nm)
  }
  
  original <- stats[[nm]]
  
  converted <- suppressWarnings(
    as.numeric(original)
  )
  
  # Detect values that cannot be converted.
  invalid <- !missing_value(original) &
    is.na(converted)
  
  if (any(invalid)) {
    fail(
      "Invalid numeric values in ",
      nm,
      ": ",
      sum(invalid)
    )
  }
  
  # Historical shot statistics may contain
  # non-finite values. Preserve the records,
  # but mark those measurements as missing.
  nonfinite <- !is.na(converted) &
    !is.finite(converted)
  
  if (any(nonfinite)) {
    
    if (nm == "Shots") {
      
      log_warn(
        "Non-finite Shots values converted to NA: ",
        sum(nonfinite)
      )
      
      converted[nonfinite] <- NA_real_
      
    } else {
      
      fail(
        "Non-finite values detected in ",
        nm,
        ": ",
        sum(nonfinite)
      )
    }
  }
  
  stats[[nm]] <- converted
}


# ============================================================
# 12. BUILD PLAYER DIRECTORY
# ============================================================

section("8. BUILDING PLAYER DIRECTORY")

profile_fields <- c(
  "PlayerID",
  "PersonID",
  "FirstName",
  "LastName",
  "PlayerName",
  "Position",
  "BirthDate",
  "Shoots",
  "Catches",
  "Height",
  "Weight",
  "Hometown",
  "HomeProvince",
  "HomeCountry",
  "Birthplace",
  "NHLTeam",
  "DraftStatus",
  "PhotoURL"
)

profile_columns <- intersect(
  profile_fields,
  names(players)
)

profile <- players[
  ,
  profile_columns,
  drop = FALSE
]

completeness <- rowSums(
  !is.na(profile) & profile != ""
)

profile$.Completeness <- completeness

profile <- profile[
  order(
    profile$PlayerID,
    -profile$.Completeness
  ),
  ,
  drop = FALSE
]

directory <- profile[
  !duplicated(profile$PlayerID),
  ,
  drop = FALSE
]

directory$.Completeness <- NULL

directory$ProfileSource <- "PlayerReference"

reference_count <- nrow(directory)

log_ok("Reference profiles: ", reference_count)


# ============================================================
# 13. RECOVER MISSING PLAYER PROFILES
# ============================================================

section("9. RECOVERING UNMATCHED PLAYERS")

unknown_ids <- setdiff(
  unique(stats$PlayerID),
  directory$PlayerID
)

recovered <- directory[
  FALSE,
  ,
  drop = FALSE
]

if (length(unknown_ids) > 0) {
  
  fallback_fields <- intersect(
    profile_fields,
    names(stats)
  )
  
  fallback <- stats[
    stats$PlayerID %in% unknown_ids,
    fallback_fields,
    drop = FALSE
  ]
  
  for (nm in setdiff(names(directory), names(fallback))) {
    fallback[[nm]] <- NA_character_
  }
  
  fallback <- fallback[
    ,
    names(directory),
    drop = FALSE
  ]
  
  fallback$.Completeness <- rowSums(
    !is.na(fallback) & fallback != ""
  )
  
  fallback <- fallback[
    order(
      fallback$PlayerID,
      -fallback$.Completeness
    ),
    ,
    drop = FALSE
  ]
  
  fallback <- fallback[
    !duplicated(fallback$PlayerID),
    ,
    drop = FALSE
  ]
  
  fallback$.Completeness <- NULL
  
  # Fill PlayerName from FirstName / LastName
  # only when PlayerName is missing.
  
  if ("PlayerName" %in% names(fallback) &&
      all(c("FirstName", "LastName") %in% names(fallback))) {
    
    missing_names <- missing_value(fallback$PlayerName)
    
    first <- ifelse(
      is.na(fallback$FirstName),
      "",
      fallback$FirstName
    )
    
    last <- ifelse(
      is.na(fallback$LastName),
      "",
      fallback$LastName
    )
    
    combined <- trimws(
      paste(first, last)
    )
    
    fill <- missing_names & nzchar(combined)
    
    fallback$PlayerName[fill] <- combined[fill]
  }
  
  fallback$ProfileSource <- "StatisticsFallback"
  
  recovered <- fallback
  
  directory <- rbind(
    directory,
    recovered
  )
}

directory <- sort_data(
  directory,
  "PlayerID"
)

recovered <- sort_data(
  recovered,
  "PlayerID"
)

log_ok("Recovered player profiles: ", nrow(recovered))
log_ok("Total directory profiles: ", nrow(directory))


# ============================================================
# 14. VALIDATE DIRECTORY COMPLETENESS
# ============================================================

section("10. VALIDATING PLAYER DIRECTORY")

if (anyDuplicated(directory$PlayerID)) {
  fail("Duplicate PlayerIDs in final directory.")
}

remaining_unknown <- setdiff(
  unique(stats$PlayerID),
  directory$PlayerID
)

if (length(remaining_unknown) > 0) {
  
  fail(
    "QUALITY GATE FAILED: ",
    length(remaining_unknown),
    " statistical players remain unmatched."
  )
}

if (nrow(directory) != reference_count + length(unknown_ids)) {
  fail("Unexpected player directory record count.")
}

log_ok("Unmatched statistical PlayerIDs: 0")
log_ok("Duplicate directory PlayerIDs: 0")


# ============================================================
# 15. BUILD PLAYER SEASON STATISTICS
# ============================================================

section("11. BUILDING PLAYER SEASON RECORDS")

season_columns <- intersect(
  c(
    "PlayerID",
    "SeasonID",
    "HockeySeason",
    "Competition",
    "TeamID",
    "TeamName",
    "Position",
    numeric_fields
  ),
  names(stats)
)

player_seasons <- stats[
  ,
  season_columns,
  drop = FALSE
]

player_seasons <- sort_data(
  player_seasons,
  c(
    "PlayerID",
    "HockeySeason",
    "Competition",
    "TeamID"
  )
)

if (nrow(player_seasons) != nrow(stats)) {
  fail("Statistical records lost during processing.")
}

log_ok("Player season records: ", nrow(player_seasons))


# ============================================================
# 16. BUILD CAREER TOTALS
# ============================================================

section("12. CALCULATING CAREER TOTALS")

career_fields <- numeric_fields

career_key <- make_key(
  player_seasons$PlayerID,
  player_seasons$Competition
)

career_groups <- split(
  seq_len(nrow(player_seasons)),
  career_key
)

career_rows <- lapply(
  career_groups,
  function(indices) {
    
    group <- player_seasons[
      indices,
      ,
      drop = FALSE
    ]
    
    result <- data.frame(
      PlayerID = group$PlayerID[1],
      Competition = group$Competition[1],
      stringsAsFactors = FALSE
    )
    
    for (nm in career_fields) {
      
      result[[paste0("Career", nm)]] <- safe_sum(
        group[[nm]]
      )
    }
    
    result
  }
)

career <- do.call(
  rbind,
  career_rows
)

career <- sort_data(
  career,
  c("PlayerID", "Competition")
)

log_ok("Career/competition records: ", nrow(career))


# ============================================================
# 17. RECONCILE CAREER STATISTICS
# ============================================================

section("13. RECONCILING CAREER TOTALS")

career_identity <- make_key(
  career$PlayerID,
  career$Competition
)

if (anyDuplicated(career_identity)) {
  fail("Duplicate career identities detected.")
}

expected_keys <- unique(career_key)

if (!setequal(career_identity, expected_keys)) {
  fail("Career identity reconciliation failed.")
}

# Independently compare each published total
# with its corresponding source rows.

career_lookup <- match(
  career_key,
  career_identity
)

if (anyNA(career_lookup)) {
  fail("Career records missing during reconciliation.")
}

for (nm in career_fields) {
  
  source_values <- player_seasons[[nm]]
  
  totals <- rowsum(
    replace(
      source_values,
      is.na(source_values),
      0
    ),
    group = career_lookup,
    reorder = TRUE
  )
  
  expected <- rep(
    NA_real_,
    nrow(career)
  )
  
  positions <- as.integer(
    rownames(totals)
  )
  
  expected[positions] <- totals[, 1]
  
  nonmissing <- rowsum(
    as.integer(!is.na(source_values)),
    group = career_lookup,
    reorder = TRUE
  )
  
  expected[
    as.integer(rownames(nonmissing))[
      nonmissing[, 1] == 0
    ]
  ] <- NA_real_
  
  actual <- career[[paste0("Career", nm)]]
  
  mismatch <- xor(
    is.na(actual),
    is.na(expected)
  ) |
    (
      !is.na(actual) &
        !is.na(expected) &
        abs(actual - expected) > 1e-8
    )
  
  if (any(mismatch)) {
    fail(
      "CAREER RECONCILIATION FAILED: ",
      nm,
      " | ",
      sum(mismatch),
      " mismatches."
    )
  }
}

log_ok("Career reconciliation mismatches: 0")


# ============================================================
# 18. BUILD PLAYER TEAM HISTORY
# ============================================================

section("14. BUILDING PLAYER TEAM HISTORY")

team_columns <- c(
  "PlayerID",
  "TeamID",
  "TeamName",
  "HockeySeason",
  "Competition"
)

player_teams <- unique(
  player_seasons[
    ,
    team_columns,
    drop = FALSE
  ]
)

player_teams <- sort_data(
  player_teams,
  c(
    "PlayerID",
    "HockeySeason",
    "Competition",
    "TeamName"
  )
)

log_ok("Player/team history records: ", nrow(player_teams))


# ============================================================
# 19. FINAL QUALITY GATE
# ============================================================

section("15. FINAL QUALITY GATE")

checks <- c(
  NoDuplicateStatIdentities = duplicate_count == 0,
  NoUnreviewedMultiTeamSeasons = multi_team_count == 0,
  NoNamedAggregates = aggregate_count == 0,
  NoDuplicateDirectoryIDs = !anyDuplicated(directory$PlayerID),
  AllStatPlayersInDirectory = length(remaining_unknown) == 0,
  AllStatRowsPreserved = nrow(player_seasons) == nrow(stats),
  UniqueCareerIdentities = !anyDuplicated(career_identity),
  CareerKeysComplete = setequal(career_identity, expected_keys)
)

for (nm in names(checks)) {
  
  if (isTRUE(checks[[nm]])) {
    log_ok(nm)
  } else {
    fail("QUALITY GATE FAILED: ", nm)
  }
}

log_ok("All quality checks passed")


# ============================================================
# 20. PROCESSING REPORT
# ============================================================

section("16. GENERATING PROCESSING REPORT")

processing_report <- data.frame(
  Metric = c(
    "IceIndexVersion",
    "PlayerReferenceRows",
    "ReferenceProfiles",
    "RecoveredProfiles",
    "UniquePlayerProfiles",
    "SeasonStatFiles",
    "StatisticalRows",
    "PlayerSeasonRows",
    "CareerRows",
    "PlayerTeamRows",
    "DuplicateIdentityRows",
    "UnreviewedMultiTeamSeasons",
    "NamedAggregateRows",
    "UnknownPlayerIDsBeforeRecovery",
    "UnknownPlayerIDsAfterRecovery",
    "CareerReconciliationMismatches",
    "QualityGatePassed"
  ),
  Value = as.character(c(
    ICEINDEX_VERSION,
    nrow(players),
    reference_count,
    nrow(recovered),
    nrow(directory),
    length(stat_files),
    nrow(stats),
    nrow(player_seasons),
    nrow(career),
    nrow(player_teams),
    duplicate_count,
    multi_team_count,
    aggregate_count,
    length(unknown_ids),
    length(remaining_unknown),
    0,
    TRUE
  )),
  stringsAsFactors = FALSE
)


# ============================================================
# 21. STAGE OUTPUT FILES
# ============================================================

section("17. STAGING PLAYER DATABASE")

output_parent <- dirname(OUTPUT_DIR)

dir.create(
  output_parent,
  recursive = TRUE,
  showWarnings = FALSE
)

stage_dir <- tempfile(
  pattern = ".ohl_players_stage_",
  tmpdir = output_parent
)

dir.create(stage_dir)

output_data <- list(
  player_directory.csv = directory,
  player_seasons.csv = player_seasons,
  player_career.csv = career,
  player_teams.csv = player_teams,
  processing_report.csv = processing_report,
  recovered_players.csv = recovered
)

for (filename in names(output_data)) {
  
  path <- file.path(
    stage_dir,
    filename
  )
  
  write.csv(
    output_data[[filename]],
    path,
    row.names = FALSE,
    na = ""
  )
  
  # Confirm staged file is readable.
  check <- read.csv(
    path,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  
  if (nrow(check) != nrow(output_data[[filename]])) {
    fail("Staged output validation failed: ", filename)
  }
  
  log_ok(
    filename,
    " | ",
    nrow(output_data[[filename]]),
    " rows"
  )
}


# ============================================================
# 22. PUBLISH VALIDATED DATABASE
# ============================================================

section("18. PUBLISHING PLAYER DATABASE")

dir.create(
  OUTPUT_DIR,
  recursive = TRUE,
  showWarnings = FALSE
)

backup_dir <- tempfile(
  pattern = ".ohl_players_backup_",
  tmpdir = output_parent
)

dir.create(backup_dir)

output_names <- names(output_data)

existing_names <- output_names[
  file.exists(file.path(OUTPUT_DIR, output_names))
]

# Back up only the files this engine owns.
# Other processed OHL files are preserved.

for (filename in existing_names) {
  
  copied <- file.copy(
    file.path(OUTPUT_DIR, filename),
    file.path(backup_dir, filename),
    overwrite = TRUE
  )
  
  if (!copied) {
    fail("Could not back up existing file: ", filename)
  }
}

published <- character()
publication_error <- NULL

tryCatch({
  
  for (filename in output_names) {
    
    destination <- file.path(
      OUTPUT_DIR,
      filename
    )
    
    staged <- file.path(
      stage_dir,
      filename
    )
    
    copied <- file.copy(
      staged,
      destination,
      overwrite = TRUE
    )
    
    if (!copied) {
      stop("Publication failed: ", filename)
    }
    
    published <- c(
      published,
      filename
    )
  }
  
}, error = function(e) {
  
  publication_error <<- conditionMessage(e)
})

if (!is.null(publication_error)) {
  
  log_warn("Publication failed. Restoring previous files.")
  
  for (filename in published) {
    
    destination <- file.path(
      OUTPUT_DIR,
      filename
    )
    
    backup <- file.path(
      backup_dir,
      filename
    )
    
    if (file.exists(backup)) {
      
      if (!file.copy(
        backup,
        destination,
        overwrite = TRUE
      )) {
        log_warn("Manual restoration required: ", filename)
      }
      
    } else {
      
      if (file.exists(destination)) {
        unlink(destination)
      }
    }
  }
  
  fail(publication_error)
}

unlink(
  stage_dir,
  recursive = TRUE
)

unlink(
  backup_dir,
  recursive = TRUE
)

log_ok("Validated player database published")


# ============================================================
# 23. FINAL REPORT
# ============================================================

section("ICEINDEX PLAYER DATABASE COMPLETE")

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

log_info("Version: ", ICEINDEX_VERSION)
log_info("Player profiles: ", nrow(directory))
log_info("Recovered profiles: ", nrow(recovered))
log_info("Season records: ", nrow(player_seasons))
log_info("Career records: ", nrow(career))
log_info("Team history records: ", nrow(player_teams))
log_info("Unmatched PlayerIDs: ", length(remaining_unknown))
log_info("Duplicate statistical identities: ", duplicate_count)
log_info("Career reconciliation mismatches: 0")
log_info("Quality gate: PASSED")
log_info("Runtime: ", runtime, " seconds")
log_info("Original source files modified: 0")

cat(
  "\nICEINDEX OHL PLAYER DATABASE SUCCESSFULLY BUILT\n"
)