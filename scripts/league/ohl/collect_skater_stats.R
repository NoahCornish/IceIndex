
# ============================================================
# ICEINDEX DATA ENGINE
# COLLECT OHL SKATER STATISTICS
# Version: 0.6.0
# ============================================================
#
# SOURCE:
#   OHLpkg::get_AllRawStats()
#
# COLLECTS:
#   All available OHL regular seasons
#   All available OHL playoff seasons
#
# OUTPUTS:
#   data/ohl/current/skater_stats.csv
#   data/ohl/historical/skater_stats.csv
#
# TRACKING:
#   data/ohl/metadata/skater_stats_completed.csv
#   data/ohl/metadata/skater_stats_failed.csv
#
# FEATURES:
#   - Complete historical collection
#   - Automatic current-season updates
#   - Historical caching
#   - Failed-request tracking
#   - Automatic season rollover
#   - Preserves all HockeyTech statistics
#   - Supports additional API columns
#   - Saves progress after each season
#
# ============================================================


# ============================================================
# SETTINGS
# ============================================================

if (!exists("ICEINDEX_PATHS")) {
  stop("IceIndex configuration not loaded.")
}

TEST_MODE <- FALSE

FORCE_HISTORICAL_REFRESH <- FALSE
RETRY_ALL_FAILURES <- FALSE

REQUEST_DELAY <- 0.30
RETRY_DAYS <- 30L

CURRENT_FILE <- ICEINDEX_PATHS$skater_stats_current
HISTORICAL_FILE <- ICEINDEX_PATHS$skater_stats_historical

COMPLETED_FILE <- ICEINDEX_PATHS$skater_stats_completed
FAILED_FILE <- ICEINDEX_PATHS$skater_stats_failed


# ============================================================
# INITIALIZE
# ============================================================

cat("\n")
cat("====================================================\n")
cat("           ICEINDEX SKATER STATISTICS              \n")
cat("                  VERSION 0.6.0                     \n")
cat("====================================================\n")

if (!requireNamespace("OHLpkg", quietly = TRUE)) {
  stop(
    "OHLpkg is not installed. ",
    "Install NoahCornish/OHLpkg."
  )
}

if (!requireNamespace("jsonlite", quietly = TRUE)) {
  stop("Package jsonlite is required.")
}

for (directory in unique(dirname(c(
  CURRENT_FILE,
  HISTORICAL_FILE,
  COMPLETED_FILE,
  FAILED_FILE
)))) {
  
  dir.create(
    directory,
    recursive = TRUE,
    showWarnings = FALSE
  )
  
  if (!dir.exists(directory)) {
    stop("Unable to create directory: ", directory)
  }
  
}


# ============================================================
# HELPER FUNCTIONS
# ============================================================

empty_table <- function(columns) {
  
  as.data.frame(
    setNames(
      replicate(
        length(columns),
        character(),
        simplify = FALSE
      ),
      columns
    ),
    stringsAsFactors = FALSE
  )
  
}


read_table <- function(path, columns = NULL) {
  
  if (!file.exists(path)) {
    
    if (is.null(columns)) {
      return(data.frame())
    }
    
    return(empty_table(columns))
  }
  
  result <- read.csv(
    path,
    colClasses = "character",
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  
  if (!is.null(columns)) {
    
    for (column in setdiff(columns, names(result))) {
      result[[column]] <- rep(
        NA_character_,
        nrow(result)
      )
    }
    
    result <- result[
      ,
      columns,
      drop = FALSE
    ]
  }
  
  result
}


bind_tables <- function(a, b) {
  
  columns <- union(
    names(a),
    names(b)
  )
  
  for (column in setdiff(columns, names(a))) {
    a[[column]] <- rep(
      NA_character_,
      nrow(a)
    )
  }
  
  for (column in setdiff(columns, names(b))) {
    b[[column]] <- rep(
      NA_character_,
      nrow(b)
    )
  }
  
  a <- a[, columns, drop = FALSE]
  b <- b[, columns, drop = FALSE]
  
  rbind(a, b)
}


save_csv <- function(data, path) {
  
  if (ncol(data) == 0L) {
    return(invisible(NULL))
  }
  
  temporary <- tempfile(
    pattern = "iceindex_",
    tmpdir = dirname(path),
    fileext = ".csv"
  )
  
  on.exit(
    unlink(temporary),
    add = TRUE
  )
  
  write.csv(
    data,
    temporary,
    row.names = FALSE,
    na = ""
  )
  
  success <- file.copy(
    temporary,
    path,
    overwrite = TRUE
  )
  
  if (!success) {
    stop("Unable to save file: ", path)
  }
  
  invisible(NULL)
}


remove_season <- function(data, season_id) {
  
  if (
    nrow(data) == 0L ||
    !"SeasonID" %in% names(data)
  ) {
    return(data)
  }
  
  data[
    is.na(data$SeasonID) |
      data$SeasonID != season_id,
    ,
    drop = FALSE
  ]
}


serialize_raw <- function(raw) {
  
  raw[] <- lapply(
    raw,
    function(column) {
      
      if (is.list(column)) {
        
        return(vapply(
          column,
          function(value) {
            
            as.character(
              jsonlite::toJSON(
                value,
                auto_unbox = TRUE,
                null = "null"
              )
            )
            
          },
          character(1)
        ))
        
      }
      
      as.character(column)
    }
  )
  
  raw
}


# ============================================================
# REMOVE OBSOLETE STATISTICAL COLUMNS
# ============================================================

LEGACY_COLUMNS <- c(
  "PlayerID",
  "TeamID",
  "PlayerName",
  "TeamName",
  "Position",
  "GP",
  "G",
  "A",
  "PTS",
  "PIM",
  "SOG",
  "ShotsPerGame",
  "ShootingPercentage"
)

clean_legacy <- function(data) {
  
  if (ncol(data) == 0L) {
    return(data)
  }
  
  data[
    ,
    !names(data) %in% LEGACY_COLUMNS,
    drop = FALSE
  ]
}


# ============================================================
# LOAD OHL SEASON DIRECTORY
# ============================================================

seasons <- OHLpkg::get_Seasons()

required_columns <- c(
  "Season",
  "SeasonID",
  "SeasonType"
)

if (!all(required_columns %in% names(seasons))) {
  stop("Unexpected OHLpkg season directory.")
}

seasons <- seasons[
  seasons$SeasonType %in% c(
    "Regular Season",
    "Playoffs"
  ),
  required_columns,
  drop = FALSE
]

seasons$SeasonID <- as.character(
  seasons$SeasonID
)

seasons$Year <- suppressWarnings(
  as.integer(
    sub(
      "^([0-9]{4}).*$",
      "\\1",
      seasons$Season
    )
  )
)

seasons <- seasons[
  !is.na(seasons$Year),
  ,
  drop = FALSE
]

seasons <- seasons[
  order(
    seasons$Year,
    seasons$SeasonType == "Playoffs",
    decreasing = TRUE
  ),
  ,
  drop = FALSE
]

regular_seasons <- seasons[
  seasons$SeasonType == "Regular Season",
  ,
  drop = FALSE
]

if (nrow(regular_seasons) == 0L) {
  stop("No regular seasons found.")
}

CURRENT_YEAR <- max(
  regular_seasons$Year
)

CURRENT_SEASONS <- seasons[
  seasons$Year == CURRENT_YEAR,
  ,
  drop = FALSE
]

HISTORICAL_SEASONS <- seasons[
  seasons$Year < CURRENT_YEAR,
  ,
  drop = FALSE
]

cat(
  "Current OHL season year:",
  CURRENT_YEAR,
  "\n"
)

cat(
  "Current season entries:",
  nrow(CURRENT_SEASONS),
  "\n"
)

cat(
  "Historical season entries:",
  nrow(HISTORICAL_SEASONS),
  "\n"
)


# ============================================================
# DATABASE TRACKING STRUCTURES
# ============================================================

COMPLETED_COLUMNS <- c(
  "SeasonID",
  "Season",
  "SeasonType",
  "RecordCount",
  "LastUpdated"
)

FAILED_COLUMNS <- c(
  "SeasonID",
  "Season",
  "SeasonType",
  "Reason",
  "Attempts",
  "LastAttempt",
  "NextRetry"
)


# ============================================================
# LOAD EXISTING DATABASE
# ============================================================

current_data <- read_table(
  CURRENT_FILE
)

historical_data <- read_table(
  HISTORICAL_FILE
)

completed <- read_table(
  COMPLETED_FILE,
  COMPLETED_COLUMNS
)

failed <- read_table(
  FAILED_FILE,
  FAILED_COLUMNS
)

current_data <- clean_legacy(current_data)
historical_data <- clean_legacy(historical_data)


# ============================================================
# VALIDATE DATABASE SCHEMA
# ============================================================

validate_schema <- function(data, label) {
  
  if (
    nrow(data) > 0L &&
    !all(
      c("SeasonID", "player_id") %in%
      names(data)
    )
  ) {
    
    stop(
      "Invalid ",
      label,
      " statistics schema."
    )
    
  }
  
}

validate_schema(
  current_data,
  "current"
)

validate_schema(
  historical_data,
  "historical"
)


# ============================================================
# VALIDATE HISTORICAL COMPLETION CACHE
# ============================================================

if (nrow(completed) > 0L) {
  
  valid_completed <- vapply(
    seq_len(nrow(completed)),
    function(i) {
      
      id <- completed$SeasonID[i]
      
      expected <- suppressWarnings(
        as.integer(
          completed$RecordCount[i]
        )
      )
      
      actual <- if (
        "SeasonID" %in% names(historical_data)
      ) {
        
        sum(
          historical_data$SeasonID == id,
          na.rm = TRUE
        )
        
      } else {
        0L
      }
      
      !is.na(expected) &&
        expected > 0L &&
        actual == expected
      
    },
    logical(1)
  )
  
  completed <- completed[
    valid_completed,
    ,
    drop = FALSE
  ]
  
}


# ============================================================
# AUTOMATIC SEASON ROLLOVER
# ============================================================

if (
  nrow(current_data) > 0L &&
  "SeasonID" %in% names(current_data)
) {
  
  old_ids <- setdiff(
    unique(current_data$SeasonID),
    CURRENT_SEASONS$SeasonID
  )
  
  for (id in old_ids) {
    
    archived <- current_data[
      current_data$SeasonID == id,
      ,
      drop = FALSE
    ]
    
    if (nrow(archived) == 0L) {
      next
    }
    
    historical_data <- remove_season(
      historical_data,
      id
    )
    
    historical_data <- bind_tables(
      historical_data,
      archived
    )
    
    matching <- seasons[
      seasons$SeasonID == id,
      ,
      drop = FALSE
    ]
    
    if (nrow(matching) > 0L) {
      
      completed <- completed[
        completed$SeasonID != id,
        ,
        drop = FALSE
      ]
      
      completed <- rbind(
        completed,
        data.frame(
          SeasonID = id,
          Season = matching$Season[1],
          SeasonType = matching$SeasonType[1],
          RecordCount = as.character(
            nrow(archived)
          ),
          LastUpdated = as.character(
            Sys.time()
          ),
          stringsAsFactors = FALSE
        )
      )
      
    }
    
    current_data <- remove_season(
      current_data,
      id
    )
    
    cat(
      "Archived previous season:",
      id,
      "\n"
    )
    
  }
  
}


# ============================================================
# DETERMINE HISTORICAL COLLECTION QUEUE
# ============================================================

needs_collection <- vapply(
  HISTORICAL_SEASONS$SeasonID,
  function(id) {
    
    FORCE_HISTORICAL_REFRESH ||
      !(id %in% completed$SeasonID)
    
  },
  logical(1)
)

can_retry <- vapply(
  HISTORICAL_SEASONS$SeasonID,
  function(id) {
    
    if (RETRY_ALL_FAILURES) {
      return(TRUE)
    }
    
    index <- match(
      id,
      failed$SeasonID
    )
    
    if (is.na(index)) {
      return(TRUE)
    }
    
    next_retry <- suppressWarnings(
      as.Date(
        failed$NextRetry[index]
      )
    )
    
    is.na(next_retry) ||
      Sys.Date() >= next_retry
    
  },
  logical(1)
)

pending_historical <- HISTORICAL_SEASONS[
  needs_collection & can_retry,
  ,
  drop = FALSE
]

if (TEST_MODE) {
  
  pending_historical <- pending_historical[
    FALSE,
    ,
    drop = FALSE
  ]
  
}

cat(
  "Historical seasons pending:",
  nrow(pending_historical),
  "\n"
)


# ============================================================
# SAVE PROGRESS
# ============================================================

save_progress <- function() {
  
  save_csv(
    current_data,
    CURRENT_FILE
  )
  
  save_csv(
    historical_data,
    HISTORICAL_FILE
  )
  
  save_csv(
    completed,
    COMPLETED_FILE
  )
  
  save_csv(
    failed,
    FAILED_FILE
  )
  
}


# ============================================================
# COLLECT ONE SEASON
# ============================================================

collect_season <- function(
    season_id,
    season_name,
    season_type
) {
  
  raw <- OHLpkg::get_AllRawStats(
    season_name = season_name
  )
  
  if (
    !is.data.frame(raw) ||
    nrow(raw) == 0L
  ) {
    stop("No skater statistics returned.")
  }
  
  required <- c(
    "player_id",
    "team_id",
    "games_played",
    "goals",
    "assists",
    "points"
  )
  
  missing <- setdiff(
    required,
    names(raw)
  )
  
  if (length(missing) > 0L) {
    
    stop(
      "Missing API fields: ",
      paste(missing, collapse = ", ")
    )
    
  }
  
  ids <- as.character(
    raw$player_id
  )
  
  if (
    anyNA(ids) ||
    any(!nzchar(ids))
  ) {
    stop("API returned missing player IDs.")
  }
  
  raw <- serialize_raw(raw)
  
  raw$SeasonID <- as.character(
    season_id
  )
  
  raw$Season <- as.character(
    season_name
  )
  
  raw$SeasonType <- as.character(
    season_type
  )
  
  raw <- raw[
    ,
    c(
      "SeasonID",
      "Season",
      "SeasonType",
      setdiff(
        names(raw),
        c(
          "SeasonID",
          "Season",
          "SeasonType"
        )
      )
    ),
    drop = FALSE
  ]
  
  raw
}


# ============================================================
# BUILD COLLECTION QUEUE
# ============================================================

queue <- rbind(
  CURRENT_SEASONS,
  pending_historical
)

cat(
  "Total seasons to process:",
  nrow(queue),
  "\n"
)


# ============================================================
# RUN COLLECTION
# ============================================================

updated_current <- 0L
updated_historical <- 0L

run_failures <- character()

for (i in seq_len(nrow(queue))) {
  
  season_id <- queue$SeasonID[i]
  season_name <- queue$Season[i]
  season_type <- queue$SeasonType[i]
  
  is_current <- season_id %in%
    CURRENT_SEASONS$SeasonID
  
  cat(
    "\n[",
    i,
    "/",
    nrow(queue),
    "] ",
    season_name,
    " (",
    season_type,
    ")\n",
    sep = ""
  )
  
  result <- tryCatch(
    
    collect_season(
      season_id,
      season_name,
      season_type
    ),
    
    error = function(e) {
      
      structure(
        list(
          message = conditionMessage(e)
        ),
        class = "iceindex_error"
      )
      
    }
  )
  
  if (inherits(result, "iceindex_error")) {
    
    old_index <- match(
      season_id,
      failed$SeasonID
    )
    
    attempts <- if (is.na(old_index)) {
      
      1L
      
    } else {
      
      suppressWarnings(
        as.integer(
          failed$Attempts[old_index]
        )
      ) + 1L
      
    }
    
    if (is.na(attempts)) {
      attempts <- 1L
    }
    
    failed <- failed[
      failed$SeasonID != season_id,
      ,
      drop = FALSE
    ]
    
    failed <- rbind(
      failed,
      data.frame(
        SeasonID = season_id,
        Season = season_name,
        SeasonType = season_type,
        Reason = result$message,
        Attempts = as.character(attempts),
        LastAttempt = as.character(
          Sys.Date()
        ),
        NextRetry = as.character(
          Sys.Date() + RETRY_DAYS
        ),
        stringsAsFactors = FALSE
      )
    )
    
    run_failures <- c(
      run_failures,
      season_id
    )
    
    message(
      "FAILED: ",
      result$message
    )
    
  } else {
    
    if (is_current) {
      
      current_data <- remove_season(
        current_data,
        season_id
      )
      
      current_data <- bind_tables(
        current_data,
        result
      )
      
      updated_current <- updated_current + 1L
      
    } else {
      
      historical_data <- remove_season(
        historical_data,
        season_id
      )
      
      historical_data <- bind_tables(
        historical_data,
        result
      )
      
      completed <- completed[
        completed$SeasonID != season_id,
        ,
        drop = FALSE
      ]
      
      completed <- rbind(
        completed,
        data.frame(
          SeasonID = season_id,
          Season = season_name,
          SeasonType = season_type,
          RecordCount = as.character(
            nrow(result)
          ),
          LastUpdated = as.character(
            Sys.time()
          ),
          stringsAsFactors = FALSE
        )
      )
      
      updated_historical <-
        updated_historical + 1L
      
    }
    
    failed <- failed[
      failed$SeasonID != season_id,
      ,
      drop = FALSE
    ]
    
    cat(
      "Records:",
      nrow(result),
      "\n"
    )
    
    cat(
      "Columns:",
      ncol(result),
      "\n"
    )
    
  }
  
  # Save after every request, including failures.
  save_progress()
  
  Sys.sleep(
    REQUEST_DELAY
  )
  
}


# ============================================================
# FINAL SUMMARY
# ============================================================

cat("\n")
cat("====================================================\n")
cat("       ICEINDEX SKATER STATISTICS SUMMARY          \n")
cat("====================================================\n")

cat(
  "Current records:",
  nrow(current_data),
  "\n"
)

cat(
  "Historical records:",
  nrow(historical_data),
  "\n"
)

cat(
  "Current seasons updated:",
  updated_current,
  "\n"
)

cat(
  "Historical seasons updated:",
  updated_historical,
  "\n"
)

cat(
  "Historical seasons cached:",
  nrow(completed),
  "\n"
)

cat(
  "Failed this run:",
  length(run_failures),
  "\n"
)

cat(
  "Tracked failures:",
  nrow(failed),
  "\n"
)

cat(
  "Current file:",
  CURRENT_FILE,
  "\n"
)

cat(
  "Historical file:",
  HISTORICAL_FILE,
  "\n"
)

cat("====================================================\n")


# ============================================================
# EXIT
# ============================================================

if (length(run_failures) > 0L) {
  
  stop(
    "Skater statistics collection failed for SeasonIDs: ",
    paste(
      run_failures,
      collapse = ", "
    ),
    call. = FALSE
  )
  
}

cat(
  "\nIceIndex skater statistics updated successfully.\n"
)