
# ============================================================
# ICEINDEX | OHL GOALIE DATABASE ENGINE
# VERSION 0.8.0
# ============================================================
#
# INPUT:
#   data/clean/ohl/
#
# OUTPUT:
#   data/processed/ohl/
#
# BASE R ONLY
#
# SAFEGUARDS:
#   - No duplicate player-season-team records
#   - No unreviewed multi-team aggregates
#   - Automatic recovery of missing goalie profiles
#   - No summing percentages or averages
#   - Career totals reconciled to season records
#   - Staged publishing and rollback
#   - No changes to cleaned or raw data
#
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
  stop(
    paste0(..., collapse = ""),
    call. = FALSE
  )
}


# ============================================================
# 3. UTILITIES
# ============================================================

read_csv <- function(path) {
  
  if (!file.exists(path)) {
    fail("Missing file: ", path)
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

require_columns <- function(df, fields, label) {
  
  missing <- setdiff(fields, names(df))
  
  if (length(missing)) {
    fail(
      label,
      " missing columns: ",
      paste(missing, collapse = ", ")
    )
  }
}

make_key <- function(...) {
  do.call(
    paste,
    c(list(...), sep = "|")
  )
}

safe_sum <- function(x) {
  
  if (all(is.na(x))) {
    return(NA_real_)
  }
  
  sum(x, na.rm = TRUE)
}

sort_data <- function(df, fields) {
  
  fields <- intersect(fields, names(df))
  
  if (!nrow(df) || !length(fields)) {
    return(df)
  }
  
  idx <- do.call(
    order,
    c(df[fields], list(na.last = TRUE))
  )
  
  df <- df[idx, , drop = FALSE]
  rownames(df) <- NULL
  
  df
}

safe_rate <- function(numerator, denominator) {
  
  result <- rep(
    NA_real_,
    length(numerator)
  )
  
  valid <- !is.na(numerator) &
    !is.na(denominator) &
    denominator > 0
  
  result[valid] <- numerator[valid] /
    denominator[valid]
  
  result
}

# Detect possible alternate column names.
# These aliases are not assumed to exist.

find_column <- function(df, candidates) {
  
  available <- candidates[
    candidates %in% names(df)
  ]
  
  if (!length(available)) {
    return(NA_character_)
  }
  
  available[1]
}


# ============================================================
# 4. INITIALIZE
# ============================================================

section("ICEINDEX OHL GOALIE DATABASE | v0.6.0")

if (!dir.exists(INPUT_DIR)) {
  fail("Cleaned OHL database not found.")
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
  "PlayerID",
  "Player reference"
)

if (any(missing_value(players$PlayerID))) {
  fail("Player reference contains missing PlayerIDs.")
}

log_ok("Player reference rows: ", nrow(players))


# ============================================================
# 6. LOAD GOALIE STATISTICS
# ============================================================

section("2. LOADING CLEANED GOALIE STATISTICS")

stat_files <- list.files(
  file.path(INPUT_DIR, "seasons"),
  pattern = "^goalie_stats\\.csv$",
  recursive = TRUE,
  full.names = TRUE
)

stat_files <- sort(stat_files)

if (!length(stat_files)) {
  fail("No cleaned goalie statistics found.")
}

stats_list <- lapply(stat_files, read_csv)

all_columns <- unique(
  unlist(lapply(stats_list, names))
)

stats_list <- lapply(stats_list, function(df) {
  
  missing <- setdiff(
    all_columns,
    names(df)
  )
  
  for (nm in missing) {
    df[[nm]] <- NA_character_
  }
  
  df[, all_columns, drop = FALSE]
})

stats <- do.call(
  rbind,
  stats_list
)

rownames(stats) <- NULL

require_columns(
  stats,
  c(
    "PlayerID",
    "SeasonID",
    "HockeySeason",
    "Competition",
    "TeamID",
    "TeamName"
  ),
  "Goalie statistics"
)

if (!nrow(stats)) {
  fail("No goalie statistical records loaded.")
}

log_ok("Season files: ", length(stat_files))
log_ok("Goalie records: ", nrow(stats))


# ============================================================
# 7. VALIDATE IDENTIFIERS
# ============================================================

section("3. VALIDATING GOALIE IDENTIFIERS")

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
      ": ",
      sum(bad),
      " rows."
    )
  }
}

if (any(
  !stats$Competition %in% c("regular", "playoffs")
)) {
  fail("Unexpected competition value.")
}

log_ok("All required identifiers present")


# ============================================================
# 8. DOUBLE COUNTING CHECKS
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
    " duplicate goalie identity rows."
  )
}

season_key <- make_key(
  stats$PlayerID,
  stats$SeasonID,
  stats$Competition
)

team_counts <- tapply(
  stats$TeamID,
  season_key,
  function(x) length(unique(x))
)

multi_team_count <- sum(team_counts > 1)

if (multi_team_count > 0) {
  fail(
    "QUALITY GATE FAILED: ",
    multi_team_count,
    " multi-team goalie seasons require review."
  )
}

aggregate_mask <- grepl(
  "total|combined|multiple|all teams|2 teams|3 teams",
  ifelse(
    is.na(stats$TeamName),
    "",
    stats$TeamName
  ),
  ignore.case = TRUE
)

aggregate_count <- sum(aggregate_mask)

if (aggregate_count > 0) {
  fail(
    "QUALITY GATE FAILED: ",
    aggregate_count,
    " possible aggregate records."
  )
}

log_ok("Duplicate identities: 0")
log_ok("Unreviewed multi-team seasons: 0")
log_ok("Named aggregate records: 0")


# ============================================================
# 9. DETECT GOALIE STATISTICAL FIELDS
# ============================================================

section("5. DETECTING GOALIE STATISTICAL FIELDS")

# Counting statistics can be summed.
# Rate statistics are excluded from career summation.

count_candidates <- c(
  "GamesPlayed",
  "GamesStarted",
  "Wins",
  "Losses",
  "Ties",
  "OvertimeLosses",
  "ShootoutLosses",
  "Shutouts",
  "GoalsAgainst",
  "ShotsAgainst",
  "Saves",
  "MinutesPlayed",
  "SecondsPlayed",
  "Goals",
  "Assists",
  "Points",
  "PIM"
)

count_fields <- intersect(
  count_candidates,
  names(stats)
)

# Detect rate columns for preservation in season output.

rate_fields <- intersect(
  c(
    "SavePercentage",
    "GoalsAgainstAverage",
    "GAA",
    "SVPercentage",
    "WinPercentage"
  ),
  names(stats)
)

log_info(
  "Counting fields: ",
  paste(count_fields, collapse = ", ")
)

log_info(
  "Rate fields: ",
  if (length(rate_fields)) {
    paste(rate_fields, collapse = ", ")
  } else {
    "None detected"
  }
)

if (!length(count_fields)) {
  fail("No recognized goalie counting statistics found.")
}


# ============================================================
# 10. CONVERT NUMERIC FIELDS
# ============================================================

section("6. STANDARDIZING STATISTICAL TYPES")

numeric_fields <- unique(
  c(count_fields, rate_fields)
)

for (nm in numeric_fields) {
  
  original <- stats[[nm]]
  
  converted <- suppressWarnings(
    as.numeric(original)
  )
  
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
  
  nonfinite <- !is.na(converted) &
    !is.finite(converted)
  
  if (any(nonfinite)) {
    
    if (nm %in% rate_fields) {
      
      log_warn(
        "Non-finite ",
        nm,
        " values converted to NA: ",
        sum(nonfinite)
      )
      
      converted[nonfinite] <- NA_real_
      
    } else {
      
      fail(
        "Non-finite counting values in ",
        nm,
        ": ",
        sum(nonfinite)
      )
    }
  }
  
  stats[[nm]] <- converted
}

log_ok("Numeric fields validated: ", length(numeric_fields))


# ============================================================
# 11. BUILD GOALIE DIRECTORY
# ============================================================

section("7. BUILDING GOALIE DIRECTORY")

goalie_ids <- unique(stats$PlayerID)

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
  players$PlayerID %in% goalie_ids,
  profile_columns,
  drop = FALSE
]

profile$.Completeness <- rowSums(
  !is.na(profile) & profile != ""
)

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

log_ok("Reference goalie profiles: ", reference_count)


# ============================================================
# 12. RECOVER MISSING GOALIES
# ============================================================

section("8. RECOVERING MISSING GOALIE PROFILES")

unknown_ids <- setdiff(
  goalie_ids,
  directory$PlayerID
)

recovered <- directory[
  FALSE,
  ,
  drop = FALSE
]

if (length(unknown_ids)) {
  
  fallback_columns <- intersect(
    profile_fields,
    names(stats)
  )
  
  fallback <- stats[
    stats$PlayerID %in% unknown_ids,
    fallback_columns,
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
  
  if (
    "PlayerName" %in% names(fallback) &&
    all(c("FirstName", "LastName") %in% names(fallback))
  ) {
    
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
    
    fill <- missing_value(fallback$PlayerName) &
      nzchar(combined)
    
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

remaining_unknown <- setdiff(
  goalie_ids,
  directory$PlayerID
)

if (length(remaining_unknown)) {
  fail("Unmatched goalie PlayerIDs remain.")
}

if (anyDuplicated(directory$PlayerID)) {
  fail("Duplicate goalie directory PlayerIDs.")
}

log_ok("Recovered goalie profiles: ", nrow(recovered))
log_ok("Total goalie profiles: ", nrow(directory))
log_ok("Unmatched goalie PlayerIDs: 0")


# ============================================================
# 13. BUILD GOALIE SEASON RECORDS
# ============================================================

section("9. BUILDING GOALIE SEASON RECORDS")

season_columns <- unique(
  c(
    intersect(
      c(
        "PlayerID",
        "SeasonID",
        "HockeySeason",
        "Competition",
        "TeamID",
        "TeamName",
        "Position"
      ),
      names(stats)
    ),
    count_fields,
    rate_fields
  )
)

goalie_seasons <- stats[
  ,
  season_columns,
  drop = FALSE
]

goalie_seasons <- sort_data(
  goalie_seasons,
  c(
    "PlayerID",
    "HockeySeason",
    "Competition",
    "TeamID"
  )
)

if (nrow(goalie_seasons) != nrow(stats)) {
  fail("Goalie season records were lost.")
}

log_ok("Goalie season records: ", nrow(goalie_seasons))


# ============================================================
# 14. BUILD GOALIE CAREER TOTALS
# ============================================================

section("10. CALCULATING GOALIE CAREER TOTALS")

career_key <- make_key(
  goalie_seasons$PlayerID,
  goalie_seasons$Competition
)

career_groups <- split(
  seq_len(nrow(goalie_seasons)),
  career_key
)

career_rows <- lapply(
  career_groups,
  function(indices) {
    
    group <- goalie_seasons[
      indices,
      ,
      drop = FALSE
    ]
    
    result <- data.frame(
      PlayerID = group$PlayerID[1],
      Competition = group$Competition[1],
      stringsAsFactors = FALSE
    )
    
    for (nm in count_fields) {
      
      result[[paste0("Career", nm)]] <- safe_sum(
        group[[nm]]
      )
    }
    
    result
  }
)

goalie_career <- do.call(
  rbind,
  career_rows
)

goalie_career <- sort_data(
  goalie_career,
  c("PlayerID", "Competition")
)

log_ok("Goalie career records: ", nrow(goalie_career))


# ============================================================
# 15. CAREER SAVE PERCENTAGE
# ============================================================

section("11. CALCULATING CAREER RATE STATISTICS")

# Save percentage must use total saves / total shots.
# Never average season save percentages.

if (
  all(c("CareerSaves", "CareerShotsAgainst") %in%
      names(goalie_career))
) {
  
  goalie_career$CareerSavePercentage <- safe_rate(
    goalie_career$CareerSaves,
    goalie_career$CareerShotsAgainst
  )
  
  log_ok("Career save percentage calculated")
  
} else {
  
  log_warn(
    "Save percentage unavailable: ",
    "Saves and/or ShotsAgainst missing."
  )
}

# GAA requires actual time played.
# MinutesPlayed and SecondsPlayed are treated as
# alternative representations, not added together.

time_minutes <- NULL

if ("CareerMinutesPlayed" %in% names(goalie_career)) {
  
  time_minutes <- goalie_career$CareerMinutesPlayed
  
} else if (
  "CareerSecondsPlayed" %in% names(goalie_career)
) {
  
  time_minutes <- goalie_career$CareerSecondsPlayed / 60
}

if (
  !is.null(time_minutes) &&
  "CareerGoalsAgainst" %in% names(goalie_career)
) {
  
  goalie_career$CareerGoalsAgainstAverage <- safe_rate(
    goalie_career$CareerGoalsAgainst * 60,
    time_minutes
  )
  
  log_ok("Career GAA calculated")
  
} else {
  
  log_warn(
    "Career GAA unavailable: ",
    "GoalsAgainst and/or time played missing."
  )
}


# ============================================================
# 16. RECONCILE CAREER COUNTING STATISTICS
# ============================================================

section("12. RECONCILING CAREER STATISTICS")

career_identity <- make_key(
  goalie_career$PlayerID,
  goalie_career$Competition
)

if (anyDuplicated(career_identity)) {
  fail("Duplicate goalie career identities.")
}

if (!setequal(
  career_identity,
  unique(career_key)
)) {
  fail("Career identity reconciliation failed.")
}

career_lookup <- match(
  career_key,
  career_identity
)

if (anyNA(career_lookup)) {
  fail("Missing career identities.")
}

for (nm in count_fields) {
  
  source_values <- goalie_seasons[[nm]]
  
  sums <- rowsum(
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
    nrow(goalie_career)
  )
  
  positions <- as.integer(
    rownames(sums)
  )
  
  expected[positions] <- sums[, 1]
  
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
  
  actual <- goalie_career[[paste0("Career", nm)]]
  
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

log_ok("Career counting-stat mismatches: 0")


# ============================================================
# 17. BUILD GOALIE TEAM HISTORY
# ============================================================

section("13. BUILDING GOALIE TEAM HISTORY")

team_columns <- c(
  "PlayerID",
  "TeamID",
  "TeamName",
  "HockeySeason",
  "Competition"
)

goalie_teams <- unique(
  goalie_seasons[
    ,
    team_columns,
    drop = FALSE
  ]
)

goalie_teams <- sort_data(
  goalie_teams,
  c(
    "PlayerID",
    "HockeySeason",
    "Competition",
    "TeamName"
  )
)

log_ok("Goalie team history records: ", nrow(goalie_teams))


# ============================================================
# 18. FINAL QUALITY GATE
# ============================================================

section("14. FINAL QUALITY GATE")

checks <- c(
  NoDuplicateIdentities = duplicate_count == 0,
  NoUnreviewedMultiTeamSeasons = multi_team_count == 0,
  NoNamedAggregateRows = aggregate_count == 0,
  AllGoaliesInDirectory = length(remaining_unknown) == 0,
  NoDuplicateDirectoryIDs = !anyDuplicated(directory$PlayerID),
  AllSeasonRowsPreserved = nrow(goalie_seasons) == nrow(stats),
  NoDuplicateCareerIDs = !anyDuplicated(career_identity),
  CareerIdentitiesComplete = setequal(
    career_identity,
    unique(career_key)
  )
)

for (nm in names(checks)) {
  
  if (!isTRUE(checks[[nm]])) {
    fail("QUALITY GATE FAILED: ", nm)
  }
  
  log_ok(nm)
}

log_ok("All goalie quality checks passed")


# ============================================================
# 19. PROCESSING REPORT
# ============================================================

section("15. GENERATING PROCESSING REPORT")

processing_report <- data.frame(
  Metric = c(
    "IceIndexVersion",
    "PlayerReferenceRows",
    "ReferenceGoalieProfiles",
    "RecoveredGoalieProfiles",
    "TotalGoalieProfiles",
    "GoalieStatFiles",
    "GoalieStatisticalRows",
    "GoalieSeasonRows",
    "GoalieCareerRows",
    "GoalieTeamRows",
    "DuplicateIdentityRows",
    "UnreviewedMultiTeamSeasons",
    "NamedAggregateRows",
    "UnmatchedGoaliesAfterRecovery",
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
    nrow(goalie_seasons),
    nrow(goalie_career),
    nrow(goalie_teams),
    duplicate_count,
    multi_team_count,
    aggregate_count,
    length(remaining_unknown),
    0,
    TRUE
  )),
  stringsAsFactors = FALSE
)


# ============================================================
# 20. STAGE OUTPUT FILES
# ============================================================

section("16. STAGING GOALIE DATABASE")

output_parent <- dirname(OUTPUT_DIR)

dir.create(
  output_parent,
  recursive = TRUE,
  showWarnings = FALSE
)

stage_dir <- tempfile(
  pattern = ".ohl_goalies_stage_",
  tmpdir = output_parent
)

dir.create(stage_dir)

output_data <- list(
  goalie_directory.csv = directory,
  goalie_seasons.csv = goalie_seasons,
  goalie_career.csv = goalie_career,
  goalie_teams.csv = goalie_teams,
  goalie_recovered_players.csv = recovered,
  goalie_processing_report.csv = processing_report
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
  
  check <- read.csv(
    path,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  
  if (nrow(check) != nrow(output_data[[filename]])) {
    fail("Staged validation failed: ", filename)
  }
  
  log_ok(
    filename,
    " | ",
    nrow(output_data[[filename]]),
    " rows"
  )
}


# ============================================================
# 21. PUBLISH GOALIE DATABASE
# ============================================================

section("17. PUBLISHING GOALIE DATABASE")

dir.create(
  OUTPUT_DIR,
  recursive = TRUE,
  showWarnings = FALSE
)

backup_dir <- tempfile(
  pattern = ".ohl_goalies_backup_",
  tmpdir = output_parent
)

dir.create(backup_dir)

output_names <- names(output_data)

existing_names <- output_names[
  file.exists(
    file.path(OUTPUT_DIR, output_names)
  )
]

for (filename in existing_names) {
  
  copied <- file.copy(
    file.path(OUTPUT_DIR, filename),
    file.path(backup_dir, filename),
    overwrite = TRUE
  )
  
  if (!copied) {
    fail("Backup failed: ", filename)
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
    
    published <- c(published, filename)
  }
  
}, error = function(e) {
  
  publication_error <<- conditionMessage(e)
})

if (!is.null(publication_error)) {
  
  log_warn("Publication failed. Restoring backups.")
  
  for (filename in output_names) {
    
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
      
    } else if (file.exists(destination)) {
      
      unlink(destination)
    }
  }
  
  fail(publication_error)
}

unlink(stage_dir, recursive = TRUE)
unlink(backup_dir, recursive = TRUE)

log_ok("Validated goalie database published")


# ============================================================
# 22. FINAL REPORT
# ============================================================

section("ICEINDEX GOALIE DATABASE COMPLETE")

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
log_info("Goalie profiles: ", nrow(directory))
log_info("Recovered profiles: ", nrow(recovered))
log_info("Season records: ", nrow(goalie_seasons))
log_info("Career records: ", nrow(goalie_career))
log_info("Team history records: ", nrow(goalie_teams))
log_info("Duplicate identities: ", duplicate_count)
log_info("Career reconciliation mismatches: 0")
log_info("Quality gate: PASSED")
log_info("Runtime: ", runtime, " seconds")
log_info("Original source files modified: 0")

cat(
  "\nICEINDEX OHL GOALIE DATABASE SUCCESSFULLY BUILT\n"
)