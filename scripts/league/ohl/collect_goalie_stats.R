
# ============================================================
# ICEINDEX DATA ENGINE
# COLLECT RAW OHL GOALIE STATISTICS
# Version 0.6.0
# ============================================================
#
# SOURCE:
#   HockeyTech ModuleKit - topgoalies
#
# OUTPUTS:
#   data/ohl/current/goalie_stats.csv
#   data/ohl/historical/goalie_stats.csv
#   data/ohl/metadata/goalie_stats_completed.csv
#   data/ohl/metadata/goalie_stats_failed.csv
#
# ============================================================


# ============================================================
# SETTINGS
# ============================================================

if (!exists("ICEINDEX_PATHS")) {
  stop("IceIndex configuration not loaded. Run scripts/refresh.R.")
}

TEST_MODE <- FALSE

FORCE_HISTORICAL_REFRESH <- FALSE
RETRY_ALL_FAILURES <- FALSE

REQUEST_DELAY <- 0.30
RETRY_DAYS <- 30L

CURRENT_FILE <- ICEINDEX_PATHS$goalie_stats_current
HISTORICAL_FILE <- ICEINDEX_PATHS$goalie_stats_historical
COMPLETED_FILE <- ICEINDEX_PATHS$goalie_stats_completed
FAILED_FILE <- ICEINDEX_PATHS$goalie_stats_failed


# ============================================================
# INITIALIZE
# ============================================================

cat("\n")
cat("====================================================\n")
cat("          ICEINDEX GOALIE STATISTICS               \n")
cat("====================================================\n")

if (!requireNamespace("OHLpkg", quietly = TRUE)) {
  stop("OHLpkg is required.")
}

if (!requireNamespace("jsonlite", quietly = TRUE)) {
  stop("jsonlite is required.")
}

for (directory in unique(dirname(c(
  CURRENT_FILE,
  HISTORICAL_FILE,
  COMPLETED_FILE,
  FAILED_FILE
)))) {
  dir.create(directory, recursive = TRUE, showWarnings = FALSE)
  if (!dir.exists(directory)) {
    stop("Unable to initialize directory: ", directory)
  }
}


# ============================================================
# HELPERS
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
  
  rbind(
    a[, columns, drop = FALSE],
    b[, columns, drop = FALSE]
  )
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
  
  write.csv(
    data,
    temporary,
    row.names = FALSE,
    na = ""
  )
  
  if (!file.copy(
    temporary,
    path,
    overwrite = TRUE
  )) {
    stop("Unable to save: ", path)
  }
  
  unlink(temporary)
  
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
# LOAD OHL SEASONS
# ============================================================

seasons <- OHLpkg::get_Seasons()

required <- c(
  "Season",
  "SeasonID",
  "SeasonType"
)

if (!all(required %in% names(seasons))) {
  stop("Unexpected season directory.")
}

seasons <- seasons[
  seasons$SeasonType %in% c(
    "Regular Season",
    "Playoffs"
  ),
  required,
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

regular <- seasons[
  seasons$SeasonType == "Regular Season",
  ,
  drop = FALSE
]

if (nrow(regular) == 0L) {
  stop("No regular seasons found.")
}

CURRENT_YEAR <- max(regular$Year)

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

cat("Current season year:", CURRENT_YEAR, "\n")
cat("Current entries:", nrow(CURRENT_SEASONS), "\n")
cat("Historical entries:", nrow(HISTORICAL_SEASONS), "\n")


# ============================================================
# LOAD EXISTING DATABASE
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

current_data <- read_table(CURRENT_FILE)
historical_data <- read_table(HISTORICAL_FILE)

completed <- read_table(
  COMPLETED_FILE,
  COMPLETED_COLUMNS
)

failed <- read_table(
  FAILED_FILE,
  FAILED_COLUMNS
)


# ============================================================
# VALIDATE EXISTING DATABASE
# ============================================================

validate_schema <- function(data, label) {
  
  if (
    nrow(data) > 0L &&
    !all(
      c("SeasonID", "player_id") %in% names(data)
    )
  ) {
    stop("Invalid ", label, " goalie schema.")
  }
}

validate_schema(current_data, "current")
validate_schema(historical_data, "historical")


# ============================================================
# VALIDATE COMPLETED CACHE
# ============================================================

if (nrow(completed) > 0L) {
  
  valid <- vapply(
    seq_len(nrow(completed)),
    function(i) {
      
      id <- completed$SeasonID[i]
      
      expected <- suppressWarnings(
        as.integer(completed$RecordCount[i])
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
    valid,
    ,
    drop = FALSE
  ]
}


# ============================================================
# ARCHIVE PREVIOUS CURRENT SEASONS
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
      !is.na(current_data$SeasonID) &
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
          LastUpdated = as.character(Sys.time()),
          stringsAsFactors = FALSE
        )
      )
    }
    
    current_data <- remove_season(
      current_data,
      id
    )
    
    cat("Archived season:", id, "\n")
  }
}


# ============================================================
# HISTORICAL COLLECTION QUEUE
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
    
    index <- match(id, failed$SeasonID)
    
    if (is.na(index)) {
      return(TRUE)
    }
    
    next_retry <- suppressWarnings(
      as.Date(failed$NextRetry[index])
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
  
  save_csv(current_data, CURRENT_FILE)
  
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
# COLLECT RAW GOALIE STATISTICS
# ============================================================

collect_season <- function(
    season_id,
    season_name,
    season_type
) {
  
  # Exact HockeyTech topgoalies endpoint used
  # by OHLpkg::get_GoalieStats().
  #
  # No minimum-games filter is applied.
  
  url <- paste0(
    "https://lscluster.hockeytech.com/feed/",
    "?feed=modulekit",
    "&view=statviewtype",
    "&type=topgoalies",
    "&key=2976319eb44abe94",
    "&fmt=json",
    "&client_code=ohl",
    "&lang=en",
    "&season_id=",
    season_id,
    "&first=0",
    "&limit=50000",
    "&sort=active",
    "&stat=all",
    "&order_direction="
  )
  
  response <- jsonlite::fromJSON(
    url,
    simplifyDataFrame = TRUE
  )
  
  raw <- response[["SiteKit"]][["Statviewtype"]]
  
  if (
    !is.data.frame(raw) ||
    nrow(raw) == 0L
  ) {
    stop("No goalie statistics returned.")
  }
  
  required_stats <- c(
    "player_id",
    "team_id",
    "games_played",
    "saves",
    "shots",
    "goals_against",
    "wins",
    "losses"
  )
  
  missing <- setdiff(
    required_stats,
    names(raw)
  )
  
  if (length(missing) > 0L) {
    stop(
      "Missing API fields: ",
      paste(missing, collapse = ", ")
    )
  }
  
  ids <- as.character(raw$player_id)
  
  if (
    anyNA(ids) ||
    any(!nzchar(ids))
  ) {
    stop("Missing goalie PlayerIDs.")
  }
  
  raw <- serialize_raw(raw)
  
  raw$SeasonID <- as.character(season_id)
  raw$Season <- as.character(season_name)
  raw$SeasonType <- as.character(season_type)
  
  raw[
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
    "\n[", i, "/", nrow(queue), "] ",
    season_name,
    " (", season_type, ")\n",
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
        list(message = conditionMessage(e)),
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
        as.integer(failed$Attempts[old_index])
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
        LastAttempt = as.character(Sys.Date()),
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
    
    message("FAILED: ", result$message)
    
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
          LastUpdated = as.character(Sys.time()),
          stringsAsFactors = FALSE
        )
      )
      
      updated_historical <- updated_historical + 1L
    }
    
    failed <- failed[
      failed$SeasonID != season_id,
      ,
      drop = FALSE
    ]
    
    cat("Records:", nrow(result), "\n")
    cat("Columns:", ncol(result), "\n")
  }
  
  # Preserve progress after each season.
  save_progress()
  
  Sys.sleep(REQUEST_DELAY)
}


# ============================================================
# SUMMARY
# ============================================================

cat("\n")
cat("====================================================\n")
cat("       ICEINDEX GOALIE STATISTICS SUMMARY          \n")
cat("====================================================\n")

cat("Current records:", nrow(current_data), "\n")
cat("Historical records:", nrow(historical_data), "\n")

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

cat("Current file:", CURRENT_FILE, "\n")
cat("Historical file:", HISTORICAL_FILE, "\n")

cat("====================================================\n")


# ============================================================
# EXIT
# ============================================================

if (length(run_failures) > 0L) {
  
  stop(
    "Goalie statistics collection failed for SeasonIDs: ",
    paste(run_failures, collapse = ", "),
    call. = FALSE
  )
}

cat(
  "\nIceIndex goalie statistics updated successfully.\n"
)