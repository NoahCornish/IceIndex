
# ============================================================
# ICEINDEX DATA ENGINE
# MASTER REFRESH SCRIPT
# VERSION 0.6.0
# ============================================================
#
# PURPOSE:
#   Central orchestration, monitoring, validation and
#   documentation of IceIndex data collection.
#
# FEATURES:
#   - Project preflight checks
#   - Configuration and API initialization
#   - Data directory verification
#   - Collector file verification
#   - Individual collector execution
#   - Collector warning and error reporting
#   - Before/after file inventories
#   - New, modified and removed file detection
#   - CSV structure and quality checks
#   - Collector execution timing
#   - Detailed console reporting
#   - Historical refresh CSV logging
#   - Final system health summary
#   - OHL skater and goalie processing after collection
#
# CURRENT COLLECTORS:
#   OHL Seasons
#   OHL Teams
#   OHL Players
#   OHL Skater Statistics
#   OHL Goalie Statistics
#
# PROCESSOR:
#   scripts/processing/ohl_process_all.R
#
# DATA:
#   data/raw/
#   data/ohl/current/
#   data/ohl/historical/
#   data/ohl/metadata/
#
# REFRESH LOG:
#   data/ohl/metadata/refresh_log.csv
#
# RUN FROM REPOSITORY ROOT:
#   source("scripts/refresh.R")
#
# IMPORTANT:
#   Existing collector logic is not modified.
#   File changes are not equivalent to record changes.
#   This script does not trigger website maintenance.
#
# ============================================================


# ============================================================
# GLOBAL OPTIONS
# ============================================================

options(
  timeout = 120,
  scipen = 999
)

REFRESH_VERSION <- "0.6.0"
ICEINDEX_VERSION <- REFRESH_VERSION

refresh_start <- Sys.time()

refresh_run_id <- paste0(
  format(
    refresh_start,
    "%Y%m%dT%H%M%S",
    tz = "UTC"
  ),
  "-",
  Sys.getpid()
)

refresh_warnings <- character()
refresh_errors <- character()

results <- data.frame(
  Task = character(),
  Status = character(),
  Seconds = numeric(),
  New_Files = integer(),
  Modified_Files = integer(),
  Removed_Files = integer(),
  Warnings = integer(),
  Error_Message = character(),
  stringsAsFactors = FALSE
)


# ============================================================
# SAFE CONSOLE UTILITIES
# ============================================================

line <- function(character = "=", width = 64) {
  
  cat(
    paste(rep(character, width), collapse = ""),
    "\n",
    sep = ""
  )
  
}

section <- function(title) {
  
  cat("\n")
  line()
  cat(title, "\n")
  line()
  
}

subsection <- function(title) {
  
  cat("\n")
  line("-")
  cat(title, "\n")
  line("-")
  
}

format_log_message <- function(...) {
  
  values <- list(...)
  
  paste0(
    vapply(
      values,
      function(x) {
        
        if (length(x) == 0) {
          return("")
        }
        
        paste(
          as.character(x),
          collapse = ", "
        )
        
      },
      character(1)
    ),
    collapse = ""
  )
  
}

log_info <- function(...) {
  
  cat(
    "[INFO] ",
    format_log_message(...),
    "\n",
    sep = ""
  )
  
}

log_ok <- function(...) {
  
  cat(
    "[ OK ] ",
    format_log_message(...),
    "\n",
    sep = ""
  )
  
}

log_warn <- function(...) {
  
  message_text <- format_log_message(...)
  
  refresh_warnings <<- c(
    refresh_warnings,
    message_text
  )
  
  cat(
    "[WARN] ",
    message_text,
    "\n",
    sep = ""
  )
  
}

log_error <- function(...) {
  
  message_text <- format_log_message(...)
  
  refresh_errors <<- c(
    refresh_errors,
    message_text
  )
  
  cat(
    "[FAIL] ",
    message_text,
    "\n",
    sep = ""
  )
  
}

format_seconds <- function(seconds) {
  
  seconds <- as.numeric(seconds)
  
  if (is.na(seconds)) {
    return("Unknown")
  }
  
  if (seconds < 60) {
    return(sprintf("%.2f seconds", seconds))
  }
  
  minutes <- floor(seconds / 60)
  remaining <- seconds %% 60
  
  sprintf(
    "%d min %.2f sec",
    minutes,
    remaining
  )
  
}

utc_time <- function(time) {
  
  format(
    time,
    "%Y-%m-%dT%H:%M:%SZ",
    tz = "UTC"
  )
  
}

elapsed_seconds <- function(
    start,
    end = Sys.time()
) {
  
  round(
    as.numeric(
      difftime(
        end,
        start,
        units = "secs"
      )
    ),
    2
  )
  
}


# ============================================================
# INITIAL BANNER
# ============================================================

cat("\n")
line()

cat("                    ICEINDEX\n")
cat("                  DATA ENGINE\n")
cat("                 VERSION ", REFRESH_VERSION, "\n", sep = "")

line()

log_info(
  "Run ID: ",
  refresh_run_id
)

log_info(
  "Started UTC: ",
  utc_time(refresh_start)
)

log_info(
  "Started Eastern: ",
  format(
    refresh_start,
    "%Y-%m-%d %H:%M:%S %Z",
    tz = "America/Toronto"
  )
)

log_info(
  "R version: ",
  as.character(getRversion())
)

log_info(
  "Operating system: ",
  as.character(Sys.info()[["sysname"]])
)

log_info(
  "Working directory: ",
  getwd()
)


# ============================================================
# PREFLIGHT CHECKS
# ============================================================

section("1. SYSTEM PREFLIGHT CHECKS")

required_files <- c(
  "scripts/config.R",
  "scripts/api_client.R"
)

for (file in required_files) {
  
  if (file.exists(file)) {
    
    log_ok(
      "Found: ",
      file
    )
    
  } else {
    
    log_error(
      "Missing: ",
      file
    )
    
  }
  
}

if (length(refresh_errors) > 0) {
  
  stop(
    "IceIndex preflight failed. Required files missing.",
    call. = FALSE
  )
  
}

log_ok("Project root verified")


# ============================================================
# LOAD CONFIGURATION
# ============================================================

section("2. CONFIGURATION INITIALIZATION")

source("scripts/config.R")

log_ok(
  "Loaded scripts/config.R"
)

source("scripts/api_client.R")

log_ok(
  "Loaded scripts/api_client.R"
)

if (!exists("ICEINDEX_PATHS")) {
  
  stop(
    "ICEINDEX_PATHS not defined in config.R.",
    call. = FALSE
  )
  
}

required_path_names <- c(
  "current",
  "historical",
  "metadata"
)

missing_path_names <- setdiff(
  required_path_names,
  names(ICEINDEX_PATHS)
)

if (length(missing_path_names) > 0) {
  
  stop(
    paste(
      "Missing ICEINDEX_PATHS entries:",
      paste(
        missing_path_names,
        collapse = ", "
      )
    ),
    call. = FALSE
  )
  
}

log_ok(
  "Shared configuration initialized"
)


# ============================================================
# DIRECTORY INITIALIZATION
# ============================================================

section("3. DATA DIRECTORY CHECKS")

required_directories <- unique(c(
  "data",
  "data/raw",
  "data/ohl",
  "data/ohl/current",
  "data/ohl/historical",
  "data/ohl/metadata",
  unlist(
    ICEINDEX_PATHS[required_path_names],
    use.names = FALSE
  )
))

for (directory in required_directories) {
  
  if (!dir.exists(directory)) {
    
    dir.create(
      directory,
      recursive = TRUE,
      showWarnings = FALSE
    )
    
    if (dir.exists(directory)) {
      
      log_ok(
        "Created: ",
        directory
      )
      
    }
    
  } else {
    
    log_ok(
      "Exists: ",
      directory
    )
    
  }
  
  if (!dir.exists(directory)) {
    
    stop(
      paste(
        "Cannot create directory:",
        directory
      ),
      call. = FALSE
    )
    
  }
  
  # Verify write access using a temporary file.
  
  test_file <- tempfile(
    pattern = "iceindex_write_test_",
    tmpdir = directory
  )
  
  writable <- tryCatch({
    
    file.create(test_file)
    
  }, warning = function(w) {
    
    FALSE
    
  }, error = function(e) {
    
    FALSE
    
  })
  
  if (file.exists(test_file)) {
    unlink(test_file)
  }
  
  if (!isTRUE(writable)) {
    
    stop(
      paste(
        "Directory is not writable:",
        directory
      ),
      call. = FALSE
    )
    
  }
  
}

log_ok(
  "All data directories are writable"
)


# ============================================================
# COLLECTOR REGISTRY
# ============================================================

section("4. COLLECTOR REGISTRY")

collectors <- data.frame(
  Task = c(
    "OHL Seasons",
    "OHL Teams",
    "OHL Players",
    "OHL Skater Statistics",
    "OHL Goalie Statistics"
  ),
  Script = c(
    "scripts/league/ohl/collect_seasons.R",
    "scripts/league/ohl/collect_teams.R",
    "scripts/league/ohl/collect_players.R",
    "scripts/league/ohl/collect_skater_stats.R",
    "scripts/league/ohl/collect_goalie_stats.R"
  ),
  stringsAsFactors = FALSE
)

for (i in seq_len(nrow(collectors))) {
  
  script <- collectors$Script[i]
  
  if (file.exists(script)) {
    
    log_ok(
      collectors$Task[i],
      " -> ",
      script
    )
    
  } else {
    
    log_warn(
      "Collector missing: ",
      script,
      " (will be recorded as FAILED)"
    )
    
  }
  
}

log_info(
  "Registered collectors: ",
  nrow(collectors) + 1L
)


# ============================================================
# DATA FILE INVENTORY
# ============================================================
#
# Takes a snapshot of files under data/.
#
# Excludes refresh_log.csv so that logging
# itself does not appear as a data change.
#
# Comparison uses file size and modification time.
#
# ============================================================

snapshot_files <- function() {
  
  files <- list.files(
    "data",
    recursive = TRUE,
    full.names = TRUE,
    all.files = FALSE,
    include.dirs = FALSE
  )
  
  files <- files[file.exists(files)]
  
  files <- files[!dir.exists(files)]
  
  files <- files[
    basename(files) != "refresh_log.csv"
  ]
  
  if (length(files) == 0) {
    
    return(data.frame(
      File = character(),
      Bytes = numeric(),
      Modified = numeric(),
      stringsAsFactors = FALSE
    ))
    
  }
  
  info <- file.info(files)
  
  data.frame(
    File = gsub(
      "\\\\",
      "/",
      files
    ),
    Bytes = as.numeric(info$size),
    Modified = as.numeric(info$mtime),
    stringsAsFactors = FALSE
  )
  
}


# ============================================================
# COMPARE FILE INVENTORIES
# ============================================================

compare_snapshots <- function(before, after) {
  
  new_files <- setdiff(
    after$File,
    before$File
  )
  
  removed_files <- setdiff(
    before$File,
    after$File
  )
  
  common_files <- intersect(
    before$File,
    after$File
  )
  
  modified_files <- character()
  
  if (length(common_files) > 0) {
    
    before_rows <- match(
      common_files,
      before$File
    )
    
    after_rows <- match(
      common_files,
      after$File
    )
    
    changed <- (
      before$Bytes[before_rows] !=
        after$Bytes[after_rows]
    ) | (
      before$Modified[before_rows] !=
        after$Modified[after_rows]
    )
    
    changed[is.na(changed)] <- TRUE
    
    modified_files <- common_files[changed]
    
  }
  
  list(
    new = new_files,
    modified = modified_files,
    removed = removed_files
  )
  
}


# ============================================================
# DISPLAY FILE CHANGES
# ============================================================

print_changes <- function(changes) {
  
  log_info(
    "New files: ",
    length(changes$new)
  )
  
  log_info(
    "Modified files: ",
    length(changes$modified)
  )
  
  log_info(
    "Removed files: ",
    length(changes$removed)
  )
  
  if (length(changes$new) > 0) {
    
    for (file in changes$new) {
      
      cat(
        "  [NEW] ",
        file,
        "\n",
        sep = ""
      )
      
    }
    
  }
  
  if (length(changes$modified) > 0) {
    
    for (file in changes$modified) {
      
      cat(
        "  [MOD] ",
        file,
        "\n",
        sep = ""
      )
      
    }
    
  }
  
  if (length(changes$removed) > 0) {
    
    for (file in changes$removed) {
      
      cat(
        "  [DEL] ",
        file,
        "\n",
        sep = ""
      )
      
    }
    
  }
  
  if (
    length(changes$new) == 0 &&
    length(changes$modified) == 0 &&
    length(changes$removed) == 0
  ) {
    
    log_ok(
      "No file metadata changes detected"
    )
    
  }
  
}


# ============================================================
# INITIAL DATA SNAPSHOT
# ============================================================

section("5. INITIAL DATABASE INVENTORY")

initial_snapshot <- snapshot_files()

log_info(
  "Existing data files: ",
  nrow(initial_snapshot)
)

log_info(
  "Total stored data: ",
  round(
    sum(
      initial_snapshot$Bytes,
      na.rm = TRUE
    ) / 1024^2,
    2
  ),
  " MB"
)


# ============================================================
# COLLECTOR EXECUTION
# ============================================================

run_collector <- function(name, script) {
  
  subsection(
    paste(
      "RUNNING:",
      name
    )
  )
  
  started <- Sys.time()
  
  log_info(
    "Started: ",
    utc_time(started)
  )
  
  before <- snapshot_files()
  
  collector_warnings <- character()
  
  error_message <- ""
  
  status <- tryCatch({
    
    if (!file.exists(script)) {
      
      stop(
        paste(
          "Missing collector:",
          script
        )
      )
      
    }
    
    collector_environment <- new.env(
      parent = globalenv()
    )
    
    withCallingHandlers({
      
      source(
        script,
        local = collector_environment
      )
      
    }, warning = function(w) {
      
      warning_text <- conditionMessage(w)
      
      collector_warnings <<- c(
        collector_warnings,
        warning_text
      )
      
      log_warn(
        name,
        ": ",
        warning_text
      )
      
      invokeRestart(
        "muffleWarning"
      )
      
    })
    
    "SUCCESS"
    
  }, error = function(e) {
    
    error_message <<- conditionMessage(e)
    
    log_error(
      name,
      ": ",
      error_message
    )
    
    "FAILED"
    
  })
  
  finished <- Sys.time()
  
  seconds <- elapsed_seconds(
    started,
    finished
  )
  
  after <- snapshot_files()
  
  changes <- compare_snapshots(
    before,
    after
  )
  
  cat("\n")
  
  log_info(
    "Finished: ",
    utc_time(finished)
  )
  
  log_info(
    "Runtime: ",
    format_seconds(seconds)
  )
  
  print_changes(changes)
  
  if (status == "SUCCESS") {
    
    log_ok(
      name,
      " completed"
    )
    
  } else {
    
    log_error(
      name,
      " failed"
    )
    
  }
  
  results <<- rbind(
    results,
    data.frame(
      Task = name,
      Status = status,
      Seconds = seconds,
      New_Files = length(changes$new),
      Modified_Files = length(changes$modified),
      Removed_Files = length(changes$removed),
      Warnings = length(collector_warnings),
      Error_Message = error_message,
      stringsAsFactors = FALSE
    )
  )
  
  invisible(status)
  
}


# ============================================================
# OHL DATA COLLECTION PIPELINE
# ============================================================
#
# Existing collector order is preserved.
#
# Each collector retains its own incremental
# data collection behaviour.
#
# ============================================================

section("6. OHL DATA COLLECTION PIPELINE")

for (i in seq_len(nrow(collectors))) {
  
  run_collector(
    collectors$Task[i],
    collectors$Script[i]
  )
  
}


# ============================================================
# OHL PROCESSED DATABASE PIPELINE
# ============================================================
# Only process when every upstream collector succeeded.
# Record the processor as a separate task in refresh_log.csv.
# The processor runs both skater and goalie engines and
# validates their output before reporting success.
# ============================================================

section("6B. OHL PROCESSED DATABASE PIPELINE")

processing_task <- "OHL Skater and Goalie Processing"
processing_script <- "scripts/processing/ohl_process_all.R"

if (all(results$Status == "SUCCESS") &&
    nrow(results) == nrow(collectors)) {
  
  run_collector(processing_task, processing_script)
  
} else {
  
  log_error(
    "OHL processing skipped because one or more upstream ",
    "collectors failed. Existing processed files retained."
  )
  
  results <- rbind(
    results,
    data.frame(
      Task = processing_task,
      Status = "FAILED",
      Seconds = 0,
      New_Files = 0L,
      Modified_Files = 0L,
      Removed_Files = 0L,
      Warnings = 0L,
      Error_Message = "Skipped: upstream collector failure",
      stringsAsFactors = FALSE
    )
  )
  
}


# ============================================================
# FUTURE COLLECTORS
# ============================================================
#
# Add future collectors to the registry above.
#
# Possible additions:
#
# OHL Games
# OHL Player Game Logs
# OHL Goalie Game Logs
# OHL Shots
# OHL Play-by-Play
# OHL Team Statistics
# OHL Standings
# OHL Live Games
#
# Future leagues:
#
# WHL
# QMJHL
# NHL
#
# ============================================================


# ============================================================
# FINAL DATA INVENTORY
# ============================================================

section("7. FINAL DATABASE INVENTORY")

final_snapshot <- snapshot_files()

overall_changes <- compare_snapshots(
  initial_snapshot,
  final_snapshot
)

log_info(
  "Files before: ",
  nrow(initial_snapshot)
)

log_info(
  "Files after: ",
  nrow(final_snapshot)
)

log_info(
  "Storage before: ",
  round(
    sum(
      initial_snapshot$Bytes,
      na.rm = TRUE
    ) / 1024^2,
    2
  ),
  " MB"
)

log_info(
  "Storage after: ",
  round(
    sum(
      final_snapshot$Bytes,
      na.rm = TRUE
    ) / 1024^2,
    2
  ),
  " MB"
)

cat("\n")

print_changes(overall_changes)


# ============================================================
# CSV DATA QUALITY CHECKS — SIGNAL-BASED REPORTING
# ============================================================
# Missing optional values and empty audit reports are normal.
# Only structural failures and missing critical keys are errors.
# All inspected files are counted; only actionable findings print.
# ============================================================

section("8. CSV DATA QUALITY CHECKS")

csv_files <- final_snapshot$File[
  grepl("\\.csv$", final_snapshot$File, ignore.case = TRUE)
]

csv_checked <- 0L
csv_failed <- 0L
csv_empty <- 0L
csv_expected_empty <- 0L
csv_missing_values <- 0
csv_optional_missing_files <- 0L
csv_critical_issues <- 0L

# These are the processed products used by the application.
# Their identity keys must exist and must not be blank.
# Team-history exports do not contain SeasonID; season identity is
# already checked in the corresponding player_seasons/goalie_seasons tables.
critical_processed_keys <- list(
  "player_directory.csv" = c("PlayerID"),
  "player_seasons.csv" = c("PlayerID", "SeasonID", "TeamID", "Competition"),
  "player_career.csv" = c("PlayerID", "Competition"),
  "player_teams.csv" = c("PlayerID", "TeamID", "Competition"),
  "goalie_directory.csv" = c("PlayerID"),
  "goalie_seasons.csv" = c("PlayerID", "SeasonID", "TeamID", "Competition"),
  "goalie_career.csv" = c("PlayerID", "Competition"),
  "goalie_teams.csv" = c("PlayerID", "TeamID", "Competition")
)

is_expected_empty <- function(path) {
  normalized <- gsub("\\\\", "/", path)
  grepl("^data/audits/", normalized) ||
    grepl("^data/ohl/metadata/.*_failed\\.csv$", normalized)
}

for (file in csv_files) {
  csv_checked <- csv_checked + 1L
  info <- file.info(file)
  
  if (is.na(info$size) || info$size == 0) {
    csv_empty <- csv_empty + 1L
    csv_failed <- csv_failed + 1L
    csv_critical_issues <- csv_critical_issues + 1L
    log_error("CSV file is empty or inaccessible: ", file)
    next
  }
  
  # Read all columns as character: stable missingness/identity checks,
  # no type-guessing warnings or accidental conversion of identifiers.
  data <- tryCatch(
    read.csv(file, stringsAsFactors = FALSE,
             check.names = FALSE, colClasses = "character"),
    error = function(e) {
      log_error("CSV cannot be read: ", file, " | ", conditionMessage(e))
      NULL
    }
  )
  
  if (is.null(data)) {
    csv_failed <- csv_failed + 1L
    csv_critical_issues <- csv_critical_issues + 1L
    next
  }
  
  if (anyDuplicated(names(data)) > 0L) {
    csv_critical_issues <- csv_critical_issues + 1L
    log_error("Duplicate CSV column headers: ", file)
  }
  
  if (nrow(data) == 0L) {
    csv_empty <- csv_empty + 1L
    if (is_expected_empty(file)) {
      csv_expected_empty <- csv_expected_empty + 1L
    } else {
      csv_critical_issues <- csv_critical_issues + 1L
      log_error("Unexpected zero-row CSV: ", file)
    }
    next
  }
  
  # NA and empty strings are both considered missing for diagnostics.
  missing <- is.na(data) | trimws(as.matrix(data)) == ""
  missing[is.na(missing)] <- TRUE
  missing_count <- sum(missing)
  csv_missing_values <- csv_missing_values + missing_count
  if (missing_count > 0L) {
    csv_optional_missing_files <- csv_optional_missing_files + 1L
  }
  
  normalized <- gsub("\\\\", "/", file)
  if (grepl("^data/processed/ohl/", normalized)) {
    required <- critical_processed_keys[[basename(file)]]
    if (!is.null(required)) {
      absent <- setdiff(required, names(data))
      if (length(absent) > 0L) {
        csv_critical_issues <- csv_critical_issues + 1L
        log_error("Missing critical columns in ", file, ": ",
                  paste(absent, collapse = ", "))
      }
      for (key in intersect(required, names(data))) {
        bad <- is.na(data[[key]]) | trimws(data[[key]]) == ""
        if (any(bad)) {
          csv_critical_issues <- csv_critical_issues + 1L
          log_error("Missing critical ", key, " in ", file,
                    " (", sum(bad), " rows)")
        }
      }
    }
  }
}

cat("\n")
log_info("CSV files inspected: ", csv_checked)
log_info("CSV read failures: ", csv_failed)
log_info("Expected empty audit/failure reports: ", csv_expected_empty)
log_info("Files with optional/blank values: ", csv_optional_missing_files)
log_info("Blank cells across all CSVs (diagnostic only): ", csv_missing_values)
log_info("Critical CSV issues: ", csv_critical_issues)
if (csv_critical_issues == 0L) {
  log_ok("CSV structural and processed identity checks passed")
}


# ============================================================
# REFRESH SUMMARY
# ============================================================

refresh_end <- Sys.time()

total_seconds <- elapsed_seconds(
  refresh_start,
  refresh_end
)

successful_tasks <- sum(
  results$Status == "SUCCESS"
)

failed_tasks <- sum(
  results$Status == "FAILED"
)

overall_failed <- (
  failed_tasks > 0 ||
    csv_failed > 0 ||
    csv_critical_issues > 0
)

overall_status <- if (overall_failed) {
  
  "FAILED"
  
} else if (
  length(refresh_warnings) > 0 ||
  length(refresh_errors) > 0
) {
  
  "WARNING"
  
} else {
  
  "SUCCESS"
  
}

section("9. REFRESH EXECUTION SUMMARY")

print(
  results[
    ,
    c(
      "Task",
      "Status",
      "Seconds",
      "New_Files",
      "Modified_Files",
      "Removed_Files",
      "Warnings"
    )
  ],
  row.names = FALSE
)

cat("\n")

log_info(
  "Successful tasks: ",
  successful_tasks
)

log_info(
  "Failed tasks: ",
  failed_tasks
)

log_info(
  "Total runtime: ",
  format_seconds(total_seconds)
)

log_info(
  "Warnings recorded: ",
  length(refresh_warnings)
)

log_info(
  "Errors recorded: ",
  length(refresh_errors)
)

log_info(
  "Overall status: ",
  overall_status
)


# ============================================================
# REFRESH HISTORY RECORDS
# ============================================================

section("10. REFRESH HISTORY LOGGING")

refresh_log_file <- file.path(
  ICEINDEX_PATHS$metadata,
  "refresh_log.csv"
)

collector_log <- data.frame(
  Run_ID = rep(
    refresh_run_id,
    nrow(results)
  ),
  Started_UTC = rep(
    utc_time(refresh_start),
    nrow(results)
  ),
  Finished_UTC = rep(
    utc_time(refresh_end),
    nrow(results)
  ),
  Task = results$Task,
  Status = results$Status,
  Seconds = results$Seconds,
  Total_Seconds = rep(
    total_seconds,
    nrow(results)
  ),
  Successful_Tasks = rep(
    successful_tasks,
    nrow(results)
  ),
  Failed_Tasks = rep(
    failed_tasks,
    nrow(results)
  ),
  New_Files = results$New_Files,
  Modified_Files = results$Modified_Files,
  Removed_Files = results$Removed_Files,
  Warnings = results$Warnings,
  Error_Message = results$Error_Message,
  stringsAsFactors = FALSE
)

summary_log <- data.frame(
  Run_ID = refresh_run_id,
  Started_UTC = utc_time(refresh_start),
  Finished_UTC = utc_time(refresh_end),
  Task = "ICEINDEX TOTAL",
  Status = overall_status,
  Seconds = total_seconds,
  Total_Seconds = total_seconds,
  Successful_Tasks = successful_tasks,
  Failed_Tasks = failed_tasks,
  New_Files = length(overall_changes$new),
  Modified_Files = length(overall_changes$modified),
  Removed_Files = length(overall_changes$removed),
  Warnings = length(refresh_warnings),
  Error_Message = paste(
    unique(refresh_errors),
    collapse = " | "
  ),
  stringsAsFactors = FALSE
)

new_log <- rbind(
  collector_log,
  summary_log
)


# ============================================================
# SAVE REFRESH HISTORY
# ============================================================
#
# Supports older refresh logs by adding new columns.
# Existing records are preserved.
#
# ============================================================

log_saved <- tryCatch({
  
  if (file.exists(refresh_log_file)) {
    
    existing_log <- read.csv(
      refresh_log_file,
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
    
    missing_existing <- setdiff(
      names(new_log),
      names(existing_log)
    )
    
    for (column in missing_existing) {
      
      existing_log[[column]] <- NA
      
    }
    
    missing_new <- setdiff(
      names(existing_log),
      names(new_log)
    )
    
    for (column in missing_new) {
      
      new_log[[column]] <- NA
      
    }
    
    new_log <- new_log[
      ,
      names(existing_log),
      drop = FALSE
    ]
    
    combined_log <- rbind(
      existing_log,
      new_log
    )
    
  } else {
    
    combined_log <- new_log
    
  }
  
  temporary_log <- tempfile(
    pattern = "iceindex_refresh_",
    tmpdir = dirname(refresh_log_file),
    fileext = ".csv"
  )
  
  write.csv(
    combined_log,
    temporary_log,
    row.names = FALSE,
    na = ""
  )
  
  if (file.exists(refresh_log_file)) {
    
    saved <- file.copy(
      temporary_log,
      refresh_log_file,
      overwrite = TRUE
    )
    
    unlink(temporary_log)
    
  } else {
    
    saved <- file.rename(
      temporary_log,
      refresh_log_file
    )
    
    if (
      !saved &&
      file.exists(temporary_log)
    ) {
      
      unlink(temporary_log)
      
    }
    
  }
  
  if (!isTRUE(saved)) {
    
    stop(
      "Unable to save refresh history."
    )
    
  }
  
  log_ok(
    "History saved: ",
    refresh_log_file
  )
  
  log_info(
    "Recorded refresh runs: ",
    length(
      unique(combined_log$Run_ID)
    )
  )
  
  log_info(
    "Total history records: ",
    nrow(combined_log)
  )
  
  TRUE
  
}, error = function(e) {
  
  log_error(
    "Refresh log save failed: ",
    conditionMessage(e)
  )
  
  FALSE
  
})


# ============================================================
# FINAL SYSTEM HEALTH REPORT
# ============================================================

section("11. ICEINDEX SYSTEM HEALTH REPORT")

log_info(
  "Version: ",
  REFRESH_VERSION
)

log_info(
  "Run ID: ",
  refresh_run_id
)

log_info(
  "Started: ",
  utc_time(refresh_start)
)

log_info(
  "Finished: ",
  utc_time(refresh_end)
)

log_info(
  "Runtime: ",
  format_seconds(total_seconds)
)

log_info(
  "Data files: ",
  nrow(final_snapshot)
)

log_info(
  "Files added: ",
  length(overall_changes$new)
)

log_info(
  "Files modified: ",
  length(overall_changes$modified)
)

log_info(
  "Files removed: ",
  length(overall_changes$removed)
)

log_info(
  "Tasks successful: ",
  successful_tasks,
  "/",
  nrow(collectors) + 1L
)

log_info(
  "Collector failures: ",
  failed_tasks
)

log_info(
  "CSV read failures: ",
  csv_failed
)

log_info(
  "Warnings: ",
  length(refresh_warnings)
)

log_info(
  "Errors: ",
  length(refresh_errors)
)

log_info(
  "Refresh log saved: ",
  if (log_saved) "YES" else "NO"
)

cat("\n")

if (length(refresh_warnings) > 0) {
  
  subsection(
    "RECORDED WARNINGS"
  )
  
  for (
    warning_text in unique(refresh_warnings)
  ) {
    
    cat(
      "  - ",
      warning_text,
      "\n",
      sep = ""
    )
    
  }
  
}

if (length(refresh_errors) > 0) {
  
  subsection(
    "RECORDED ERRORS"
  )
  
  for (
    error_text in unique(refresh_errors)
  ) {
    
    cat(
      "  - ",
      error_text,
      "\n",
      sep = ""
    )
    
  }
  
}


# ============================================================
# EXIT STATUS
# ============================================================

cat("\n")
line()

if (!log_saved) {
  
  cat(
    "ICEINDEX REFRESH LOGGING FAILED\n"
  )
  
  line()
  
  stop(
    "Refresh history could not be saved.",
    call. = FALSE
  )
  
}

if (overall_failed) {
  
  cat(
    "ICEINDEX REFRESH FAILED\n"
  )
  
  line()
  
  stop(
    "Review collection, processing and data validation errors.",
    call. = FALSE
  )
  
}

# ============================================================
# PUBLISH LAST SUCCESSFUL DATA REFRESH
# ============================================================
# Reached only after collector/processor validation and
# refresh-history logging have succeeded.
# A failed run leaves the previously published timestamp intact.

last_updated_file <- file.path(
  ICEINDEX_PATHS$metadata,
  "last_updated.json"
)

last_updated_time <- Sys.time()
last_updated_json <- paste0(
  '{\n',
  '  "league": "OHL",\n',
  '  "status": "success",\n',
  '  "last_updated_utc": "', utc_time(last_updated_time), '",\n',
  '  "run_id": "', refresh_run_id, '"\n',
  '}\n'
)

tryCatch({
  temp_metadata <- tempfile(
    pattern = "iceindex_last_updated_",
    tmpdir = dirname(last_updated_file),
    fileext = ".json"
  )
  writeLines(last_updated_json, temp_metadata, useBytes = TRUE)
  
  # Replace only after the new JSON has been written successfully.
  if (!file.copy(temp_metadata, last_updated_file, overwrite = TRUE)) {
    stop("Could not publish last_updated.json")
  }
  unlink(temp_metadata)
  log_ok("Published successful refresh timestamp: ", last_updated_file)
}, error = function(e) {
  if (exists("temp_metadata", inherits = FALSE) && file.exists(temp_metadata)) {
    unlink(temp_metadata)
  }
  stop(paste("Refresh metadata publication failed:", conditionMessage(e)),
       call. = FALSE)
})

if (overall_status == "WARNING") {
  
  cat(
    "ICEINDEX REFRESH COMPLETED WITH WARNINGS\n"
  )
  
} else {
  
  cat(
    "ICEINDEX REFRESH COMPLETED SUCCESSFULLY\n"
  )
  
}

cat(
  "VERSION ",
  REFRESH_VERSION,
  " | ",
  format_seconds(total_seconds),
  "\n",
  sep = ""
)

line()

cat("\n")