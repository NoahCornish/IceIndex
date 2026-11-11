
# ============================================================
# ICEINDEX DATA ENGINE
# OHL CLEANING, VALIDATION & REPAIR PIPELINE
# VERSION 0.6.0
# ============================================================
#
# SCRIPT:
#   scripts/cleaning/ohl_clean.R
#
# INPUT:
#   data/ohl/historical/
#   data/ohl/current/
#
# OUTPUT:
#   data/clean/ohl/
#
# PRINCIPLES:
#   1. Never modify original source files.
#   2. Never invent hockey statistics.
#   3. Preserve valid historical records.
#   4. Repair only when evidence is sufficient.
#   5. Audit every automatic correction.
#   6. Block publication on unresolved critical errors.
#
# DEPENDENCIES:
#   Base R only.
#
# ============================================================


# ============================================================
# 1. CONFIGURATION
# ============================================================

ICEINDEX_VERSION <- "0.6.0"

SOURCE_DIR <- "data/ohl"
OUTPUT_DIR <- "data/clean/ohl"

STRICT_MODE <- TRUE
REMOVE_EXACT_DUPLICATES <- TRUE

# Unknown statistics remain available until their
# meaning has been established.
KEEP_UNKNOWN_STATISTICS <- TRUE

# Explicitly identified presentation-only fields.
DROP_STAT_COLUMNS <- c(
  "PhotoURL",
  "Thumbnail",
  "ImageURL",
  "ProfileURL",
  "Website",
  "Biography",
  "Bio",
  "SocialMedia",
  "Twitter",
  "Instagram",
  "Facebook",
  "HTML",
  "CSS",
  "RowNumber",
  "RowIndex",
  "Unnamed0"
)

started <- Sys.time()


# ============================================================
# 2. CONSOLE UTILITIES
# ============================================================

line <- function() {
  cat("\n", strrep("=", 70), "\n", sep = "")
}

section <- function(title) {
  line()
  cat(title, "\n")
  line()
}

ok <- function(...) {
  cat("[ OK ] ", paste0(..., collapse = ""), "\n", sep = "")
}

info <- function(...) {
  cat("[INFO] ", paste0(..., collapse = ""), "\n", sep = "")
}

warn <- function(...) {
  cat("[WARN] ", paste0(..., collapse = ""), "\n", sep = "")
}


# ============================================================
# 3. REPORT TABLES
# ============================================================

column_dictionary <- data.frame(
  Dataset = character(),
  OriginalColumn = character(),
  CleanColumn = character(),
  Action = character(),
  stringsAsFactors = FALSE
)

excluded_columns <- data.frame(
  Dataset = character(),
  Column = character(),
  Reason = character(),
  stringsAsFactors = FALSE
)

quality_issues <- data.frame(
  Dataset = character(),
  Severity = character(),
  Check = character(),
  Count = integer(),
  Details = character(),
  stringsAsFactors = FALSE
)

data_corrections <- data.frame(
  Dataset = character(),
  SeasonID = character(),
  PlayerID = character(),
  TeamID = character(),
  Column = character(),
  OriginalValue = character(),
  CleanedValue = character(),
  Reason = character(),
  Method = character(),
  stringsAsFactors = FALSE
)

validation_summary <- data.frame(
  Dataset = character(),
  SourceRows = integer(),
  FinalRows = integer(),
  DuplicatesRemoved = integer(),
  PreseasonRemoved = integer(),
  ColumnsBefore = integer(),
  ColumnsAfter = integer(),
  stringsAsFactors = FALSE
)

inventory <- data.frame(
  Season = character(),
  Competition = character(),
  Dataset = character(),
  Rows = integer(),
  File = character(),
  stringsAsFactors = FALSE
)


# ============================================================
# 4. AUDIT HELPERS
# ============================================================

add_issue <- function(
    dataset,
    severity,
    check,
    count,
    details = ""
) {
  
  if (is.na(count) || count <= 0) {
    return(invisible(NULL))
  }
  
  quality_issues <<- rbind(
    quality_issues,
    data.frame(
      Dataset = dataset,
      Severity = severity,
      Check = check,
      Count = as.integer(count),
      Details = details,
      stringsAsFactors = FALSE
    )
  )
  
  if (severity == "CRITICAL") {
    warn(dataset, " | ", check, ": ", count)
  } else {
    info(dataset, " | ", check, ": ", count)
  }
}


add_correction <- function(
    dataset,
    df,
    row,
    column,
    old,
    new,
    reason,
    method
) {
  
  get_id <- function(name) {
    if (name %in% names(df)) {
      return(as.character(df[[name]][row]))
    }
    NA_character_
  }
  
  data_corrections <<- rbind(
    data_corrections,
    data.frame(
      Dataset = dataset,
      SeasonID = get_id("SeasonID"),
      PlayerID = get_id("PlayerID"),
      TeamID = get_id("TeamID"),
      Column = column,
      OriginalValue = as.character(old),
      CleanedValue = as.character(new),
      Reason = reason,
      Method = method,
      stringsAsFactors = FALSE
    )
  )
}


# ============================================================
# 5. SOURCE FILES
# ============================================================

section("ICEINDEX OHL CLEANING ENGINE | v0.6.0")

paths <- c(
  seasons = "data/ohl/historical/seasons.csv",
  teams = "data/ohl/historical/teams.csv",
  players = "data/ohl/historical/players.csv",
  historical_skaters =
    "data/ohl/historical/skater_stats.csv",
  historical_goalies =
    "data/ohl/historical/goalie_stats.csv",
  current_skaters =
    "data/ohl/current/skater_stats.csv",
  current_goalies =
    "data/ohl/current/goalie_stats.csv"
)

for (path in paths) {
  
  if (!file.exists(path)) {
    stop("Missing source file: ", path)
  }
  
  ok("Found: ", path)
}


# ============================================================
# 6. COLUMN NAME STANDARDIZATION
# ============================================================

to_pascal <- function(x) {
  
  x <- gsub(
    "([a-z0-9])([A-Z])",
    "\\1 \\2",
    x,
    perl = TRUE
  )
  
  x <- gsub(
    "([A-Z])([A-Z][a-z])",
    "\\1 \\2",
    x,
    perl = TRUE
  )
  
  x <- gsub("[^A-Za-z0-9]+", " ", x)
  
  parts <- strsplit(trimws(x), " +")[[1]]
  
  if (length(parts) == 0 ||
      !nzchar(parts[1])) {
    return("Unknown")
  }
  
  paste0(
    vapply(parts, function(p) {
      paste0(
        toupper(substr(p, 1, 1)),
        tolower(substr(p, 2, nchar(p)))
      )
    }, character(1)),
    collapse = ""
  )
}


canonical_names <- c(
  playerid = "PlayerID",
  personid = "PersonID",
  teamid = "TeamID",
  seasonid = "SeasonID",
  seasontype = "SeasonType",
  playername = "PlayerName",
  firstname = "FirstName",
  lastname = "LastName",
  teamname = "TeamName",
  gamesplayed = "GamesPlayed",
  gp = "GamesPlayed",
  goals = "Goals",
  assists = "Assists",
  points = "Points",
  pim = "PIM",
  penaltyminutes = "PIM",
  plusminus = "PlusMinus",
  shots = "Shots",
  shotsongoal = "Shots",
  shootingpercentage = "ShootingPercentage",
  shootingpct = "ShootingPercentage",
  faceoffpercentage = "FaceoffPercentage",
  faceoffpct = "FaceoffPercentage",
  powerplaygoals = "PowerPlayGoals",
  powerplayassists = "PowerPlayAssists",
  powerplaypoints = "PowerPlayPoints",
  shorthandedgoals = "ShorthandedGoals",
  shorthandedassists = "ShorthandedAssists",
  shorthandedpoints = "ShorthandedPoints",
  gamewinninggoals = "GameWinningGoals",
  overtimegoals = "OvertimeGoals",
  savepercentage = "SavePercentage",
  savepct = "SavePercentage",
  goalsagainstaverage = "GoalsAgainstAverage",
  gaa = "GoalsAgainstAverage",
  saves = "Saves",
  shotsagainst = "ShotsAgainst",
  goalsagainst = "GoalsAgainst",
  wins = "Wins",
  losses = "Losses",
  ties = "Ties",
  shutouts = "Shutouts",
  overtimelosses = "OvertimeLosses",
  minutesplayed = "MinutesPlayed",
  timeonice = "TimeOnIce",
  toi = "TimeOnIce",
  photourl = "PhotoURL",
  birthdate = "BirthDate",
  nhlteam = "NHLTeam",
  jerseynumber = "JerseyNumber"
)


normalize_columns <- function(df, dataset) {
  
  original <- names(df)
  
  cleaned <- vapply(
    original,
    to_pascal,
    character(1)
  )
  
  for (i in seq_along(cleaned)) {
    
    key <- tolower(cleaned[i])
    
    if (key %in% names(canonical_names)) {
      cleaned[i] <- unname(canonical_names[[key]])
    }
  }
  
  if (anyDuplicated(cleaned)) {
    
    stop(
      dataset,
      ": duplicate normalized column names: ",
      paste(
        unique(cleaned[duplicated(cleaned)]),
        collapse = ", "
      )
    )
  }
  
  names(df) <- cleaned
  
  column_dictionary <<- rbind(
    column_dictionary,
    data.frame(
      Dataset = dataset,
      OriginalColumn = original,
      CleanColumn = cleaned,
      Action = ifelse(
        original == cleaned,
        "Retained",
        "Renamed"
      ),
      stringsAsFactors = FALSE
    )
  )
  
  df
}


# ============================================================
# 7. CLEAN TEXT VALUES
# ============================================================

clean_text <- function(x) {
  
  x <- gsub("\u00A0", " ", x, fixed = TRUE)
  x <- trimws(x)
  x <- gsub("[[:blank:]]+", " ", x)
  
  missing_tokens <- c(
    "",
    "NA",
    "N/A",
    "NULL",
    "null",
    "None",
    "none",
    "NaN",
    "--"
  )
  
  x[x %in% missing_tokens] <- NA_character_
  
  x
}


read_clean <- function(path, dataset) {
  
  df <- read.csv(
    path,
    stringsAsFactors = FALSE,
    check.names = FALSE,
    colClasses = "character",
    na.strings = character(),
    fileEncoding = "UTF-8"
  )
  
  for (nm in names(df)) {
    df[[nm]] <- clean_text(df[[nm]])
  }
  
  df <- normalize_columns(df, dataset)
  
  ok(
    dataset,
    " | ",
    nrow(df),
    " rows | ",
    ncol(df),
    " columns"
  )
  
  df
}


# ============================================================
# 8. LOAD REFERENCE DATA
# ============================================================

section("1. CLEANING REFERENCE DATA")

seasons <- read_clean(
  paths[["seasons"]],
  "Seasons"
)

teams <- read_clean(
  paths[["teams"]],
  "Teams"
)

players <- read_clean(
  paths[["players"]],
  "Players"
)


# ============================================================
# 9. HOCKEY SEASON NORMALIZATION
# ============================================================

section("2. BUILDING HOCKEY SEASON MAPPING")

is_preseason <- function(x) {
  
  grepl(
    "pre[ -]?season",
    x,
    ignore.case = TRUE
  )
}


normalize_season <- function(label, playoff) {
  
  if (is.na(label) || is.na(playoff)) {
    return(NA_character_)
  }
  
  if (playoff == "0") {
    
    match <- regmatches(
      label,
      regexpr(
        "[0-9]{4}-[0-9]{2,4}",
        label
      )
    )
    
    if (length(match) == 0 ||
        !nzchar(match)) {
      return(NA_character_)
    }
    
    years <- strsplit(
      match,
      "-",
      fixed = TRUE
    )[[1]]
    
    start <- as.integer(years[1])
    finish <- as.integer(years[2])
    
    if (nchar(years[2]) == 4) {
      
      if (finish != start + 1L) {
        return(NA_character_)
      }
      
      finish <- finish %% 100L
      
    } else if (
      finish != (start + 1L) %% 100L
    ) {
      return(NA_character_)
    }
    
    return(
      sprintf("%04d-%02d", start, finish)
    )
  }
  
  if (playoff == "1") {
    
    match <- regmatches(
      label,
      regexpr("[0-9]{4}", label)
    )
    
    if (length(match) == 0 ||
        !nzchar(match)) {
      return(NA_character_)
    }
    
    year <- as.integer(match)
    
    return(
      sprintf(
        "%04d-%02d",
        year - 1L,
        year %% 100L
      )
    )
  }
  
  NA_character_
}


preseason_mask <- is_preseason(
  seasons$Season
)

preseason_ids <- seasons$SeasonID[
  preseason_mask
]

seasons <- seasons[
  !preseason_mask,
  ,
  drop = FALSE
]

if (anyNA(seasons$SeasonID) ||
    anyDuplicated(seasons$SeasonID)) {
  stop("Invalid season reference IDs.")
}

seasons$Competition <- ifelse(
  seasons$Playoff == "1",
  "playoffs",
  "regular"
)

seasons$HockeySeason <- mapply(
  normalize_season,
  seasons$Season,
  seasons$Playoff,
  USE.NAMES = FALSE
)

if (anyNA(seasons$HockeySeason)) {
  stop("Unmapped hockey seasons.")
}

valid_ids <- seasons$SeasonID

ok("Mapped competition seasons: ", nrow(seasons))
ok("Preseason seasons excluded: ", length(preseason_ids))


# ============================================================
# 10. FILTER REFERENCE RECORDS
# ============================================================

section("3. FILTERING REFERENCE RECORDS")

filter_reference <- function(df, dataset) {
  
  unknown <- is.na(df$SeasonID) |
    !df$SeasonID %in% c(
      valid_ids,
      preseason_ids
    )
  
  add_issue(
    dataset,
    "CRITICAL",
    "Unknown SeasonID",
    sum(unknown)
  )
  
  preseason <- df$SeasonID %in% preseason_ids
  
  df <- df[
    !preseason,
    ,
    drop = FALSE
  ]
  
  attr(df, "PreseasonRemoved") <- sum(preseason)
  
  df
}

teams <- filter_reference(teams, "Teams")
players <- filter_reference(players, "Players")


# ============================================================
# 11. LOAD STATISTICS
# ============================================================

section("4. CLEANING STATISTICAL DATA")

historical_skaters <- read_clean(
  paths[["historical_skaters"]],
  "Historical Skaters"
)

current_skaters <- read_clean(
  paths[["current_skaters"]],
  "Current Skaters"
)

historical_goalies <- read_clean(
  paths[["historical_goalies"]],
  "Historical Goalies"
)

current_goalies <- read_clean(
  paths[["current_goalies"]],
  "Current Goalies"
)


# ============================================================
# 12. COMBINE STATISTICS
# ============================================================

section("5. COMBINING STATISTICAL DATA")

combine_stats <- function(historical, current, dataset) {
  
  if (!setequal(
    names(historical),
    names(current)
  )) {
    stop(dataset, ": statistical schemas differ.")
  }
  
  current <- current[
    ,
    names(historical),
    drop = FALSE
  ]
  
  df <- rbind(historical, current)
  
  duplicates <- duplicated(df)
  
  df <- df[
    !duplicates,
    ,
    drop = FALSE
  ]
  
  rownames(df) <- NULL
  
  attr(df, "DuplicatesRemoved") <- sum(duplicates)
  
  ok(
    dataset,
    " | Combined: ",
    nrow(df),
    " | Exact duplicates removed: ",
    sum(duplicates)
  )
  
  df
}

skaters <- combine_stats(
  historical_skaters,
  current_skaters,
  "Skaters"
)

goalies <- combine_stats(
  historical_goalies,
  current_goalies,
  "Goalies"
)

skater_duplicates <- attr(
  skaters,
  "DuplicatesRemoved"
)

goalie_duplicates <- attr(
  goalies,
  "DuplicatesRemoved"
)


# ============================================================
# 13. ASSIGN SEASONS AND REMOVE PRESEASON
# ============================================================

section("6. ASSIGNING HOCKEY SEASONS")

assign_seasons <- function(df, dataset) {
  
  unknown <- is.na(df$SeasonID) |
    !df$SeasonID %in% c(
      valid_ids,
      preseason_ids
    )
  
  add_issue(
    dataset,
    "CRITICAL",
    "Unknown statistical SeasonID",
    sum(unknown)
  )
  
  preseason <- df$SeasonID %in% preseason_ids
  
  df <- df[
    !preseason,
    ,
    drop = FALSE
  ]
  
  index <- match(
    df$SeasonID,
    seasons$SeasonID
  )
  
  if (anyNA(index)) {
    stop(dataset, ": unmapped season records.")
  }
  
  df$HockeySeason <- seasons$HockeySeason[index]
  df$Competition <- seasons$Competition[index]
  
  if ("SeasonType" %in% names(df)) {
    
    expected <- ifelse(
      df$Competition == "playoffs",
      "Playoffs",
      "Regular Season"
    )
    
    mismatch <- !is.na(df$SeasonType) &
      df$SeasonType != expected
    
    add_issue(
      dataset,
      "CRITICAL",
      "SeasonType mismatch",
      sum(mismatch)
    )
  }
  
  attr(df, "PreseasonRemoved") <- sum(preseason)
  
  ok(
    dataset,
    " | Retained: ",
    nrow(df),
    " | Preseason excluded: ",
    sum(preseason)
  )
  
  df
}

skaters <- assign_seasons(skaters, "Skaters")
goalies <- assign_seasons(goalies, "Goalies")

skater_preseason <- attr(
  skaters,
  "PreseasonRemoved"
)

goalie_preseason <- attr(
  goalies,
  "PreseasonRemoved"
)


# ============================================================
# 14. RECOVER MISSING TEAM IDS
# ============================================================

section("7. RECOVERING MISSING TEAM IDENTIFIERS")

recover_team_ids <- function(df, dataset) {
  
  missing <- which(
    is.na(df$TeamID)
  )
  
  recovered <- 0L
  
  for (i in missing) {
    
    candidates <- players[
      players$SeasonID == df$SeasonID[i] &
        players$PlayerID == df$PlayerID[i] &
        !is.na(players$TeamID),
      ,
      drop = FALSE
    ]
    
    unique_teams <- unique(
      candidates$TeamID
    )
    
    if (length(unique_teams) != 1) {
      next
    }
    
    original <- df$TeamID[i]
    replacement <- unique_teams[1]
    
    add_correction(
      dataset,
      df,
      i,
      "TeamID",
      original,
      replacement,
      "Missing TeamID",
      "Unique season/player reference lookup"
    )
    
    df$TeamID[i] <- replacement
    
    if ("TeamName" %in% names(df) &&
        "TeamName" %in% names(candidates)) {
      
      names_found <- unique(
        candidates$TeamName[
          !is.na(candidates$TeamName)
        ]
      )
      
      if (
        length(names_found) == 1 &&
        is.na(df$TeamName[i])
      ) {
        
        add_correction(
          dataset,
          df,
          i,
          "TeamName",
          df$TeamName[i],
          names_found[1],
          "Missing team name",
          "Unique player reference lookup"
        )
        
        df$TeamName[i] <- names_found[1]
      }
    }
    
    recovered <- recovered + 1L
  }
  
  ok(
    dataset,
    " | TeamIDs recovered: ",
    recovered,
    " / ",
    length(missing)
  )
  
  df
}

skaters <- recover_team_ids(
  skaters,
  "Skaters"
)

goalies <- recover_team_ids(
  goalies,
  "Goalies"
)


# ============================================================
# 15. REMOVE UNNECESSARY COLUMNS
# ============================================================

section("8. CURATING STATISTICAL COLUMNS")

exclude_columns <- function(df, dataset) {
  
  before <- ncol(df)
  
  empty <- names(df)[
    vapply(
      df,
      function(x) all(is.na(x)),
      logical(1)
    )
  ]
  
  protected <- c(
    "SeasonID",
    "PlayerID",
    "TeamID",
    "HockeySeason",
    "Competition"
  )
  
  empty <- setdiff(empty, protected)
  
  drop <- union(
    intersect(names(df), DROP_STAT_COLUMNS),
    empty
  )
  
  for (nm in drop) {
    
    reason <- if (nm %in% empty) {
      "Entirely missing column"
    } else {
      "Unnecessary presentation metadata"
    }
    
    excluded_columns <<- rbind(
      excluded_columns,
      data.frame(
        Dataset = dataset,
        Column = nm,
        Reason = reason,
        stringsAsFactors = FALSE
      )
    )
  }
  
  df <- df[
    ,
    !names(df) %in% drop,
    drop = FALSE
  ]
  
  ok(
    dataset,
    " | Columns: ",
    before,
    " -> ",
    ncol(df)
  )
  
  df
}

skater_columns_before <- ncol(skaters)
goalie_columns_before <- ncol(goalies)

skaters <- exclude_columns(skaters, "Skaters")
goalies <- exclude_columns(goalies, "Goalies")


# ============================================================
# 16. CONVERT STATISTICAL DATA TYPES
# ============================================================

section("9. STANDARDIZING DATA TYPES")

TEXT_FIELDS <- c(
  "Season",
  "SeasonType",
  "HockeySeason",
  "Competition",
  "PlayerName",
  "FirstName",
  "LastName",
  "TeamName",
  "Position",
  "City",
  "Shoots",
  "Catches",
  "JerseyNumber",
  "BirthDate",
  "Height",
  "Weight"
)

ID_FIELDS <- c(
  "SeasonID",
  "PlayerID",
  "PersonID",
  "TeamID"
)


convert_types <- function(df, dataset) {
  
  for (nm in names(df)) {
    
    if (nm %in% c(TEXT_FIELDS, ID_FIELDS)) {
      next
    }
    
    x <- df[[nm]]
    
    if (!is.character(x)) {
      next
    }
    
    candidate <- gsub(
      ",",
      "",
      x,
      fixed = TRUE
    )
    
    candidate <- sub("%$", "", candidate)
    
    nonmissing <- !is.na(candidate)
    
    if (!any(nonmissing)) {
      next
    }
    
    valid <- grepl(
      "^[+-]?[0-9]+(\\.[0-9]+)?$",
      candidate
    )
    
    valid[is.na(valid)] <- FALSE
    
    if (all(valid[nonmissing])) {
      
      df[[nm]] <- as.numeric(candidate)
      
    } else {
      
      # Preserve original text instead of
      # silently converting invalid values.
      next
    }
  }
  
  df
}

skaters <- convert_types(skaters, "Skaters")
goalies <- convert_types(goalies, "Goalies")

ok("Statistical types standardized.")


# ============================================================
# 17. REPAIR HISTORICAL SHOOTING DATA
# ============================================================

section("10. REPAIRING HISTORICAL SHOOTING STATISTICS")

repair_shooting <- function(df, dataset) {
  
  required <- c(
    "Goals",
    "Shots"
  )
  
  if (!all(required %in% names(df))) {
    return(df)
  }
  
  if (!is.numeric(df$Goals) ||
      !is.numeric(df$Shots)) {
    stop("Goals and Shots must be numeric.")
  }
  
  invalid <- which(
    !is.na(df$Goals) &
      !is.na(df$Shots) &
      df$Goals > df$Shots
  )
  
  info(
    dataset,
    " | Goals exceeding Shots: ",
    length(invalid)
  )
  
  # Retain Goals.
  # Do not invent replacement Shots.
  #
  # Nullify the demonstrably inconsistent shot
  # value and dependent shooting percentage.
  
  for (i in invalid) {
    
    add_correction(
      dataset,
      df,
      i,
      "Shots",
      df$Shots[i],
      NA,
      "Goals exceed reported shots",
      "Invalid historical shot count"
    )
    
    df$Shots[i] <- NA_real_
    
    if (
      "ShootingPercentage" %in% names(df)
    ) {
      
      add_correction(
        dataset,
        df,
        i,
        "ShootingPercentage",
        df$ShootingPercentage[i],
        NA,
        "Underlying shot count unreliable",
        "Dependent statistic invalidation"
      )
      
      df$ShootingPercentage[i] <- NA_real_
    }
  }
  
  # Check any remaining percentages.
  if (
    "ShootingPercentage" %in% names(df)
  ) {
    
    pct <- df$ShootingPercentage
    
    bad_pct <- which(
      !is.na(pct) &
        (pct < 0 | pct > 100)
    )
    
    for (i in bad_pct) {
      
      add_correction(
        dataset,
        df,
        i,
        "ShootingPercentage",
        pct[i],
        NA,
        "Percentage outside 0-100",
        "Invalid percentage nullification"
      )
      
      df$ShootingPercentage[i] <- NA_real_
    }
    
    info(
      dataset,
      " | Additional invalid percentages: ",
      length(bad_pct)
    )
  }
  
  df
}

skaters <- repair_shooting(
  skaters,
  "Skaters"
)


# ============================================================
# 18. VALIDATE STATISTICS
# ============================================================

section("11. VALIDATING HOCKEY STATISTICS")

COUNT_FIELDS <- c(
  "GamesPlayed",
  "Goals",
  "Assists",
  "Points",
  "PIM",
  "Shots",
  "PowerPlayGoals",
  "PowerPlayAssists",
  "PowerPlayPoints",
  "ShorthandedGoals",
  "ShorthandedAssists",
  "ShorthandedPoints",
  "GameWinningGoals",
  "OvertimeGoals",
  "Wins",
  "Losses",
  "Ties",
  "OvertimeLosses",
  "GoalsAgainst",
  "ShotsAgainst",
  "Saves",
  "Shutouts"
)


validate_counts <- function(df, dataset) {
  
  for (nm in intersect(
    COUNT_FIELDS,
    names(df)
  )) {
    
    x <- df[[nm]]
    
    if (!is.numeric(x)) {
      next
    }
    
    negative <- !is.na(x) & x < 0
    
    fractional <- !is.na(x) &
      abs(x - round(x)) > 1e-8
    
    add_issue(
      dataset,
      "CRITICAL",
      paste("Negative", nm),
      sum(negative)
    )
    
    add_issue(
      dataset,
      "CRITICAL",
      paste("Fractional", nm),
      sum(fractional)
    )
  }
}


validate_scoring <- function(df, dataset) {
  
  required <- c(
    "Goals",
    "Assists",
    "Points"
  )
  
  if (!all(required %in% names(df))) {
    return(invisible(NULL))
  }
  
  if (!all(vapply(
    df[required],
    is.numeric,
    logical(1)
  ))) {
    return(invisible(NULL))
  }
  
  valid <- complete.cases(df[required])
  
  mismatch <- valid &
    df$Points != df$Goals + df$Assists
  
  add_issue(
    dataset,
    "CRITICAL",
    "Goals + Assists != Points",
    sum(mismatch)
  )
}


validate_identity <- function(df, dataset) {
  
  required <- c(
    "SeasonID",
    "PlayerID",
    "TeamID"
  )
  
  missing <- !complete.cases(
    df[required]
  )
  
  add_issue(
    dataset,
    "CRITICAL",
    "Missing statistical identity",
    sum(missing)
  )
}


validate_goalies <- function(df) {
  
  if (all(
    c("Saves", "ShotsAgainst") %in% names(df)
  )) {
    
    if (
      is.numeric(df$Saves) &&
      is.numeric(df$ShotsAgainst)
    ) {
      
      bad <- !is.na(df$Saves) &
        !is.na(df$ShotsAgainst) &
        df$Saves > df$ShotsAgainst
      
      add_issue(
        "Goalies",
        "CRITICAL",
        "Saves exceed ShotsAgainst",
        sum(bad)
      )
    }
  }
}


validate_counts(skaters, "Skaters")
validate_counts(goalies, "Goalies")

validate_scoring(skaters, "Skaters")
validate_scoring(goalies, "Goalies")

validate_identity(skaters, "Skaters")
validate_identity(goalies, "Goalies")

validate_goalies(goalies)


# ============================================================
# 19. REFERENCE INTEGRITY
# ============================================================

section("12. CHECKING REFERENCE INTEGRITY")

check_team_reference <- function(df, dataset) {
  
  ref_keys <- paste(
    teams$SeasonID,
    teams$TeamID,
    sep = "|"
  )
  
  stat_keys <- paste(
    df$SeasonID,
    df$TeamID,
    sep = "|"
  )
  
  missing <- !is.na(df$TeamID) &
    !(stat_keys %in% ref_keys)
  
  add_issue(
    dataset,
    "WARNING",
    "Unmatched team reference",
    sum(missing)
  )
}

check_team_reference(skaters, "Skaters")
check_team_reference(goalies, "Goalies")


# ============================================================
# 20. ORGANIZE FINAL COLUMNS
# ============================================================

section("13. ORGANIZING FINAL COLUMN ORDER")

reorder_columns <- function(df) {
  
  front <- c(
    "SeasonID",
    "HockeySeason",
    "Competition",
    "Season",
    "SeasonType",
    "PlayerID",
    "PersonID",
    "PlayerName",
    "FirstName",
    "LastName",
    "TeamID",
    "TeamName",
    "Position",
    "GamesPlayed"
  )
  
  front <- intersect(front, names(df))
  
  remaining <- setdiff(
    names(df),
    front
  )
  
  df[
    ,
    c(front, remaining),
    drop = FALSE
  ]
}

skaters <- reorder_columns(skaters)
goalies <- reorder_columns(goalies)


# ============================================================
# 21. VALIDATION SUMMARY
# ============================================================

section("14. BUILDING VALIDATION SUMMARY")

validation_summary <- rbind(
  validation_summary,
  data.frame(
    Dataset = "Skaters",
    SourceRows =
      nrow(historical_skaters) +
      nrow(current_skaters),
    FinalRows = nrow(skaters),
    DuplicatesRemoved = skater_duplicates,
    PreseasonRemoved = skater_preseason,
    ColumnsBefore = skater_columns_before,
    ColumnsAfter = ncol(skaters)
  ),
  data.frame(
    Dataset = "Goalies",
    SourceRows =
      nrow(historical_goalies) +
      nrow(current_goalies),
    FinalRows = nrow(goalies),
    DuplicatesRemoved = goalie_duplicates,
    PreseasonRemoved = goalie_preseason,
    ColumnsBefore = goalie_columns_before,
    ColumnsAfter = ncol(goalies)
  )
)

print(validation_summary, row.names = FALSE)


# ============================================================
# 22. STAGING DIRECTORY
# ============================================================

section("15. PREPARING STAGED DATABASE")

dir.create(
  dirname(OUTPUT_DIR),
  recursive = TRUE,
  showWarnings = FALSE
)

stage <- tempfile(
  pattern = ".ohl_stage_",
  tmpdir = dirname(OUTPUT_DIR)
)

dir.create(stage)

if (!dir.exists(stage)) {
  stop("Unable to create staging directory.")
}


# ============================================================
# 23. EXPORT SEASON STATISTICS
# ============================================================

section("16. EXPORTING SEASON STATISTICS")

export_stats <- function(df, dataset, filename) {
  
  for (season in sort(unique(df$HockeySeason))) {
    
    for (competition in c("regular", "playoffs")) {
      
      subset <- df[
        df$HockeySeason == season &
          df$Competition == competition,
        ,
        drop = FALSE
      ]
      
      if (nrow(subset) == 0) {
        next
      }
      
      relative <- file.path(
        "seasons",
        season,
        competition,
        filename
      )
      
      path <- file.path(
        stage,
        relative
      )
      
      dir.create(
        dirname(path),
        recursive = TRUE,
        showWarnings = FALSE
      )
      
      write.csv(
        subset,
        path,
        row.names = FALSE,
        na = ""
      )
      
      inventory <<- rbind(
        inventory,
        data.frame(
          Season = season,
          Competition = competition,
          Dataset = dataset,
          Rows = nrow(subset),
          File = file.path(
            OUTPUT_DIR,
            relative
          ),
          stringsAsFactors = FALSE
        )
      )
      
      ok(
        season,
        " / ",
        competition,
        " / ",
        filename,
        " | ",
        nrow(subset),
        " rows"
      )
    }
  }
}

export_stats(
  skaters,
  "Skaters",
  "skater_stats.csv"
)

export_stats(
  goalies,
  "Goalies",
  "goalie_stats.csv"
)


# ============================================================
# 24. EXPORT REFERENCE TABLES
# ============================================================

section("17. EXPORTING REFERENCE DATA")

references <- list(
  seasons = seasons,
  teams = teams,
  players = players
)

for (nm in names(references)) {
  
  write.csv(
    references[[nm]],
    file.path(
      stage,
      paste0(nm, ".csv")
    ),
    row.names = FALSE,
    na = ""
  )
  
  ok(
    nm,
    ".csv | ",
    nrow(references[[nm]]),
    " rows"
  )
}


# ============================================================
# 25. EXPORT AUDIT REPORTS
# ============================================================

section("18. EXPORTING QUALITY REPORTS")

reports <- list(
  column_dictionary = column_dictionary,
  excluded_columns = excluded_columns,
  quality_issues = quality_issues,
  data_corrections = data_corrections,
  validation_summary = validation_summary,
  season_inventory = inventory
)

for (nm in names(reports)) {
  
  write.csv(
    reports[[nm]],
    file.path(
      stage,
      paste0(nm, ".csv")
    ),
    row.names = FALSE,
    na = ""
  )
  
  ok(nm, ".csv")
}


# ============================================================
# 26. VERIFY EXPORTS
# ============================================================

section("19. VERIFYING DATABASE EXPORTS")

for (i in seq_len(nrow(inventory))) {
  
  filename <- if (
    inventory$Dataset[i] == "Skaters"
  ) {
    "skater_stats.csv"
  } else {
    "goalie_stats.csv"
  }
  
  path <- file.path(
    stage,
    "seasons",
    inventory$Season[i],
    inventory$Competition[i],
    filename
  )
  
  if (!file.exists(path)) {
    stop("Missing exported file: ", path)
  }
  
  check <- read.csv(
    path,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  
  if (nrow(check) != inventory$Rows[i]) {
    stop("Export row count mismatch: ", path)
  }
}

if (
  sum(inventory$Rows[
    inventory$Dataset == "Skaters"
  ]) != nrow(skaters)
) {
  stop("Skater export reconciliation failed.")
}

if (
  sum(inventory$Rows[
    inventory$Dataset == "Goalies"
  ]) != nrow(goalies)
) {
  stop("Goalie export reconciliation failed.")
}

ok("All statistical records reconciled.")


# ============================================================
# 27. STRICT QUALITY GATE
# ============================================================

section("20. FINAL QUALITY GATE")

critical <- quality_issues[
  quality_issues$Severity == "CRITICAL",
  ,
  drop = FALSE
]

if (nrow(critical) > 0) {
  
  print(critical, row.names = FALSE)
  
  if (STRICT_MODE) {
    
    warn(
      "Unresolved critical quality issues detected."
    )
    
    info(
      "Staged audit reports: ",
      stage
    )
    
    stop(
      "IceIndex quality gate failed. ",
      "Review quality_issues.csv."
    )
  }
}

ok("Quality gate passed.")


# ============================================================
# 28. PUBLISH CLEAN DATABASE
# ============================================================

section("21. PUBLISHING CLEAN DATABASE")

backup <- NULL

if (dir.exists(OUTPUT_DIR)) {
  
  backup <- tempfile(
    pattern = ".ohl_backup_",
    tmpdir = dirname(OUTPUT_DIR)
  )
  
  if (!file.rename(
    OUTPUT_DIR,
    backup
  )) {
    stop("Unable to back up existing database.")
  }
}

published <- file.rename(
  stage,
  OUTPUT_DIR
)

if (!published) {
  
  if (!is.null(backup)) {
    
    restored <- file.rename(
      backup,
      OUTPUT_DIR
    )
    
    if (!restored) {
      stop(
        "Publication and rollback failed. ",
        "Backup location: ",
        backup
      )
    }
  }
  
  stop("Unable to publish cleaned database.")
}

if (!is.null(backup)) {
  unlink(backup, recursive = TRUE)
}

ok("Published: ", OUTPUT_DIR)


# ============================================================
# 29. FINAL HEALTH REPORT
# ============================================================

section("22. ICEINDEX CLEANING HEALTH REPORT")

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

info("Version: ", ICEINDEX_VERSION)

info(
  "Hockey seasons: ",
  length(unique(inventory$Season))
)

info(
  "Season-specific files: ",
  nrow(inventory)
)

info("Skater records: ", nrow(skaters))
info("Goalie records: ", nrow(goalies))

info(
  "Total statistical records: ",
  nrow(skaters) + nrow(goalies)
)

info(
  "Preseason records excluded: ",
  skater_preseason + goalie_preseason
)

info(
  "Columns removed: ",
  nrow(excluded_columns)
)

info(
  "Automatic corrections: ",
  nrow(data_corrections)
)

info(
  "Quality findings: ",
  nrow(quality_issues)
)

info("Original source files modified: 0")
info("Runtime: ", runtime, " seconds")

line()

cat(
  "ICEINDEX OHL CLEANING COMPLETED SUCCESSFULLY\n"
)

cat(
  "VERSION ",
  ICEINDEX_VERSION,
  "\n",
  sep = ""
)

line()