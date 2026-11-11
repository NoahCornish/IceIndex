
# ============================================================
# ICEINDEX
# OHL MASTER PROCESSING ENGINE
# VERSION 0.6.0
# ============================================================
#
# PURPOSE
# ------------------------------------------------------------
# Run and validate the standalone OHL skater and goalie
# processing engines.
#
# INPUT ENGINES
#   scripts/processing/ohl_players.R
#   scripts/processing/ohl_goalies.R
#
# OUTPUT
#   data/processed/ohl/ohl_processing_summary.csv
#
# SAFETY
#   - Never modifies cleaned or raw source data directly
#   - Stops when an engine fails
#   - Checks output identities and references
#   - Does not fabricate missing statistical columns
#   - Preserves the previous consolidated summary on failure
#
# NOTE
#   Each individual engine controls publication of its
#   own CSV files. This script is not a cross-engine
#   atomic transaction.
# ============================================================


local({
  
  # ==========================================================
  # 1. CONFIGURATION
  # ==========================================================
  
  started <- Sys.time()
  
  version <- "0.6.1"
  
  root <- normalizePath(
    getwd(),
    winslash = "/",
    mustWork = TRUE
  )
  
  script_dir <- file.path(
    root,
    "scripts",
    "processing"
  )
  
  clean_dir <- file.path(
    root,
    "data",
    "clean",
    "ohl"
  )
  
  output_dir <- file.path(
    root,
    "data",
    "processed",
    "ohl"
  )
  
  
  # ==========================================================
  # 2. LOGGING
  # ==========================================================
  
  section <- function(message) {
    
    cat(
      "\n",
      strrep("=", 68),
      "\n",
      message,
      "\n",
      strrep("=", 68),
      "\n",
      sep = ""
    )
    
  }
  
  
  log_ok <- function(...) {
    
    cat(
      "[ OK ] ",
      paste0(..., collapse = ""),
      "\n",
      sep = ""
    )
    
  }
  
  
  log_warn <- function(...) {
    
    cat(
      "[ WARN ] ",
      paste0(..., collapse = ""),
      "\n",
      sep = ""
    )
    
  }
  
  
  fail <- function(...) {
    
    stop(
      paste0(..., collapse = ""),
      call. = FALSE
    )
    
  }
  
  
  # ==========================================================
  # 3. BASIC FILE VALIDATION
  # ==========================================================
  
  section("ICEINDEX | OHL MASTER PROCESSING v0.6.1")
  
  required_scripts <- c(
    "ohl_players.R",
    "ohl_goalies.R"
  )
  
  for (filename in required_scripts) {
    
    path <- file.path(
      script_dir,
      filename
    )
    
    if (!file.exists(path)) {
      
      fail(
        "Required processing engine missing: ",
        path
      )
      
    }
    
    # Validate R syntax before executing either engine.
    tryCatch(
      
      parse(file = path),
      
      error = function(e) {
        
        fail(
          "Syntax error in ",
          filename,
          ": ",
          conditionMessage(e)
        )
        
      }
      
    )
    
    log_ok(
      filename,
      " found and syntax validated"
    )
    
  }
  
  
  if (!dir.exists(clean_dir)) {
    
    fail(
      "Cleaned OHL database not found: ",
      clean_dir
    )
    
  }
  
  log_ok("Cleaned OHL database found")
  
  
  # ==========================================================
  # 4. READ OUTPUT HELPER
  # ==========================================================
  
  read_output <- function(filename) {
    
    path <- file.path(
      output_dir,
      filename
    )
    
    if (!file.exists(path)) {
      
      fail(
        "Required processed output missing: ",
        filename
      )
      
    }
    
    result <- tryCatch(
      
      read.csv(
        path,
        stringsAsFactors = FALSE,
        check.names = FALSE,
        colClasses = "character",
        na.strings = c("", "NA")
      ),
      
      error = function(e) {
        
        fail(
          "Unable to read ",
          filename,
          ": ",
          conditionMessage(e)
        )
        
      }
      
    )
    
    if (nrow(result) == 0L) {
      
      fail(
        "Processed output contains no records: ",
        filename
      )
      
    }
    
    log_ok(
      filename,
      ": ",
      nrow(result),
      " records"
    )
    
    result
    
  }
  
  
  # ==========================================================
  # 5. COLUMN VALIDATION
  # ==========================================================
  
  require_columns <- function(
    data,
    columns,
    label
  ) {
    
    missing <- setdiff(
      columns,
      names(data)
    )
    
    if (length(missing) > 0L) {
      
      fail(
        label,
        " missing required columns: ",
        paste(missing, collapse = ", ")
      )
      
    }
    
    invisible(TRUE)
    
  }
  
  
  # ==========================================================
  # 6. IDENTITY VALIDATION
  # ==========================================================
  
  check_unique <- function(
    data,
    columns,
    label
  ) {
    
    require_columns(
      data,
      columns,
      label
    )
    
    identity <- data[
      ,
      columns,
      drop = FALSE
    ]
    
    missing_identity <- any(
      is.na(identity) |
        trimws(as.matrix(identity)) == ""
    )
    
    if (missing_identity) {
      
      fail(
        label,
        " contains missing identity values"
      )
      
    }
    
    duplicates <- sum(
      duplicated(identity)
    )
    
    if (duplicates > 0L) {
      
      fail(
        label,
        " contains ",
        duplicates,
        " duplicate identities"
      )
      
    }
    
    log_ok(
      label,
      ": identities validated"
    )
    
  }
  
  
  # ==========================================================
  # 7. PROCESSING REPORT VALIDATION
  # ==========================================================
  
  report_metric <- function(
    report,
    metric_name,
    required = TRUE
  ) {
    
    require_columns(
      report,
      c("Metric", "Value"),
      "Processing report"
    )
    
    matches <- which(
      report$Metric == metric_name
    )
    
    if (length(matches) == 0L) {
      
      if (required) {
        
        fail(
          "Processing report missing metric: ",
          metric_name
        )
        
      }
      
      return(NULL)
      
    }
    
    if (length(matches) > 1L) {
      
      fail(
        "Duplicate processing report metric: ",
        metric_name
      )
      
    }
    
    report$Value[matches]
    
  }
  
  
  check_quality_report <- function(
    report,
    label
  ) {
    
    section(
      paste("VERIFYING", label, "QUALITY")
    )
    
    require_columns(
      report,
      c("Metric", "Value"),
      paste(label, "processing report")
    )
    
    quality <- report_metric(
      report,
      "QualityGatePassed",
      required = FALSE
    )
    
    if (is.null(quality)) {
      
      log_warn(
        label,
        " report has no explicit QualityGatePassed metric"
      )
      
    } else {
      
      if (!tolower(trimws(quality)) %in%
          c("true", "passed", "pass", "yes")) {
        
        fail(
          label,
          " processing quality gate failed: ",
          quality
        )
        
      }
      
      log_ok(
        label,
        " quality gate passed"
      )
      
    }
    
    mismatches <- report_metric(
      report,
      "CareerReconciliationMismatches",
      required = FALSE
    )
    
    if (!is.null(mismatches)) {
      
      value <- suppressWarnings(
        as.numeric(mismatches)
      )
      
      if (
        length(value) != 1L ||
        is.na(value) ||
        value != 0
      ) {
        
        fail(
          label,
          " career reconciliation mismatch: ",
          mismatches
        )
        
      }
      
      log_ok(
        label,
        " career reconciliation passed"
      )
      
    } else {
      
      log_warn(
        label,
        " report has no recognized career ",
        "reconciliation metric"
      )
      
    }
    
  }
  
  
  # ==========================================================
  # 8. RUN PROCESSING ENGINE
  # ==========================================================
  
  run_engine <- function(
    filename,
    label
  ) {
    
    section(
      paste("RUNNING", label)
    )
    
    path <- file.path(
      script_dir,
      filename
    )
    
    # Separate environment for each engine.
    engine_env <- new.env(
      parent = globalenv()
    )
    
    tryCatch(
      
      sys.source(
        path,
        envir = engine_env,
        keep.source = TRUE
      ),
      
      error = function(e) {
        
        cat(
          "\n",
          strrep("!", 68),
          "\nPROCESSING ENGINE FAILED\n",
          strrep("!", 68),
          "\n",
          sep = ""
        )
        
        cat(
          "Engine: ",
          filename,
          "\n",
          sep = ""
        )
        
        cat(
          "Error: ",
          conditionMessage(e),
          "\n",
          sep = ""
        )
        
        # Show available call information.
        calls <- sys.calls()
        
        if (length(calls) > 0L) {
          
          cat("\nRecent R calls:\n")
          
          recent <- tail(
            calls,
            8L
          )
          
          for (call in recent) {
            
            cat(
              paste(
                deparse(call),
                collapse = " "
              ),
              "\n"
            )
            
          }
          
        }
        
        fail(
          label,
          " FAILED. Master processing stopped."
        )
        
      }
      
    )
    
    log_ok(
      label,
      " completed successfully"
    )
    
    invisible(TRUE)
    
  }
  
  
  # ==========================================================
  # 9. RUN SKATER PROCESSING
  # ==========================================================
  
  run_engine(
    "ohl_players.R",
    "OHL SKATER ENGINE"
  )
  
  
  # ==========================================================
  # 10. RUN GOALIE PROCESSING
  # ==========================================================
  
  run_engine(
    "ohl_goalies.R",
    "OHL GOALIE ENGINE"
  )
  
  
  # ==========================================================
  # 11. LOAD ALL PROCESSED TABLES
  # ==========================================================
  
  section("LOADING PROCESSED OHL DATABASE")
  
  skater_directory <- read_output(
    "player_directory.csv"
  )
  
  skater_seasons <- read_output(
    "player_seasons.csv"
  )
  
  skater_career <- read_output(
    "player_career.csv"
  )
  
  skater_teams <- read_output(
    "player_teams.csv"
  )
  
  skater_report <- read_output(
    "processing_report.csv"
  )
  
  goalie_directory <- read_output(
    "goalie_directory.csv"
  )
  
  goalie_seasons <- read_output(
    "goalie_seasons.csv"
  )
  
  goalie_career <- read_output(
    "goalie_career.csv"
  )
  
  goalie_teams <- read_output(
    "goalie_teams.csv"
  )
  
  goalie_report <- read_output(
    "goalie_processing_report.csv"
  )
  
  
  # ==========================================================
  # 12. VALIDATE IDENTITIES
  # ==========================================================
  
  section("VALIDATING PLAYER IDENTITIES")
  
  check_unique(
    skater_directory,
    "PlayerID",
    "Skater directory"
  )
  
  check_unique(
    goalie_directory,
    "PlayerID",
    "Goalie directory"
  )
  
  check_unique(
    skater_seasons,
    c(
      "PlayerID",
      "SeasonID",
      "Competition",
      "TeamID"
    ),
    "Skater seasons"
  )
  
  check_unique(
    goalie_seasons,
    c(
      "PlayerID",
      "SeasonID",
      "Competition",
      "TeamID"
    ),
    "Goalie seasons"
  )
  
  check_unique(
    skater_career,
    c(
      "PlayerID",
      "Competition"
    ),
    "Skater careers"
  )
  
  check_unique(
    goalie_career,
    c(
      "PlayerID",
      "Competition"
    ),
    "Goalie careers"
  )
  
  
  # ==========================================================
  # 13. VALIDATE PLAYER REFERENCES
  # ==========================================================
  
  section("VALIDATING PLAYER REFERENCES")
  
  check_references <- function(
    data,
    directory,
    label
  ) {
    
    require_columns(
      data,
      "PlayerID",
      label
    )
    
    require_columns(
      directory,
      "PlayerID",
      paste(label, "directory")
    )
    
    unmatched <- unique(
      data$PlayerID[
        !data$PlayerID %in% directory$PlayerID
      ]
    )
    
    if (length(unmatched) > 0L) {
      
      fail(
        label,
        " contains ",
        length(unmatched),
        " unmatched PlayerIDs"
      )
      
    }
    
    log_ok(
      label,
      ": all PlayerIDs matched"
    )
    
  }
  
  
  check_references(
    skater_seasons,
    skater_directory,
    "Skater seasons"
  )
  
  check_references(
    skater_career,
    skater_directory,
    "Skater careers"
  )
  
  check_references(
    skater_teams,
    skater_directory,
    "Skater teams"
  )
  
  check_references(
    goalie_seasons,
    goalie_directory,
    "Goalie seasons"
  )
  
  check_references(
    goalie_career,
    goalie_directory,
    "Goalie careers"
  )
  
  check_references(
    goalie_teams,
    goalie_directory,
    "Goalie teams"
  )
  
  
  # ==========================================================
  # 14. VALIDATE TEAM HISTORY COUNTS
  # ==========================================================
  
  section("VALIDATING TEAM HISTORY")
  
  if (
    nrow(skater_teams) !=
    nrow(skater_seasons)
  ) {
    
    fail(
      "Skater team history row count mismatch"
    )
    
  }
  
  if (
    nrow(goalie_teams) !=
    nrow(goalie_seasons)
  ) {
    
    fail(
      "Goalie team history row count mismatch"
    )
    
  }
  
  log_ok(
    "Skater team history: ",
    nrow(skater_teams),
    " records"
  )
  
  log_ok(
    "Goalie team history: ",
    nrow(goalie_teams),
    " records"
  )
  
  
  # ==========================================================
  # 15. VALIDATE QUALITY REPORTS
  # ==========================================================
  
  check_quality_report(
    skater_report,
    "SKATER"
  )
  
  check_quality_report(
    goalie_report,
    "GOALIE"
  )
  
  
  # ==========================================================
  # 16. CREATE CONSOLIDATED REPORT
  # ==========================================================
  
  section("CREATING CONSOLIDATED PROCESSING REPORT")
  
  elapsed <- round(
    as.numeric(
      difftime(
        Sys.time(),
        started,
        units = "secs"
      )
    ),
    2
  )
  
  summary <- data.frame(
    
    Metric = c(
      "IceIndexVersion",
      "ProcessingStatus",
      "ProcessedAtUTC",
      "SkaterProfiles",
      "SkaterSeasonRows",
      "SkaterCareerRows",
      "SkaterTeamRows",
      "GoalieProfiles",
      "GoalieSeasonRows",
      "GoalieCareerRows",
      "GoalieTeamRows",
      "CombinedSeasonRows",
      "CombinedCareerRows",
      "SkaterEngine",
      "GoalieEngine",
      "RuntimeSeconds"
    ),
    
    Value = as.character(c(
      version,
      "PASSED",
      format(
        Sys.time(),
        "%Y-%m-%dT%H:%M:%SZ",
        tz = "UTC"
      ),
      nrow(skater_directory),
      nrow(skater_seasons),
      nrow(skater_career),
      nrow(skater_teams),
      nrow(goalie_directory),
      nrow(goalie_seasons),
      nrow(goalie_career),
      nrow(goalie_teams),
      nrow(skater_seasons) +
        nrow(goalie_seasons),
      nrow(skater_career) +
        nrow(goalie_career),
      "COMPLETED",
      "COMPLETED",
      elapsed
    )),
    
    stringsAsFactors = FALSE
    
  )
  
  
  # ==========================================================
  # 17. STAGE CONSOLIDATED REPORT
  # ==========================================================
  
  dir.create(
    output_dir,
    recursive = TRUE,
    showWarnings = FALSE
  )
  
  destination <- file.path(
    output_dir,
    "ohl_processing_summary.csv"
  )
  
  staged <- tempfile(
    pattern = ".iceindex_summary_",
    tmpdir = output_dir,
    fileext = ".csv"
  )
  
  write.csv(
    summary,
    staged,
    row.names = FALSE,
    na = ""
  )
  
  verified <- read.csv(
    staged,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  
  if (
    !identical(
      as.character(verified$Metric),
      as.character(summary$Metric)
    ) ||
    !identical(
      as.character(verified$Value),
      as.character(summary$Value)
    )
  ) {
    
    unlink(staged)
    
    fail(
      "Consolidated processing report verification failed"
    )
    
  }
  
  
  # ==========================================================
  # 18. PUBLISH CONSOLIDATED REPORT
  # ==========================================================
  
  backup <- NULL
  
  if (file.exists(destination)) {
    
    backup <- tempfile(
      pattern = ".iceindex_backup_",
      tmpdir = output_dir
    )
    
    if (!file.copy(
      destination,
      backup
    )) {
      
      unlink(staged)
      
      fail(
        "Could not back up existing processing summary"
      )
      
    }
    
  }
  
  published <- file.copy(
    staged,
    destination,
    overwrite = TRUE
  )
  
  if (!published) {
    
    if (!is.null(backup)) {
      
      restored <- file.copy(
        backup,
        destination,
        overwrite = TRUE
      )
      
      if (!restored) {
        log_warn("Summary backup restoration failed")
      }
      
    } else {
      
      if (file.exists(destination)) {
        unlink(destination)
      }
      
    }
    
    unlink(staged)
    
    fail(
      "Unable to publish consolidated processing report"
    )
    
  }
  
  unlink(staged)
  
  if (!is.null(backup)) {
    unlink(backup)
  }
  
  log_ok(
    "Consolidated processing summary published"
  )
  
  
  # ==========================================================
  # 19. FINAL PROCESSING SUMMARY
  # ==========================================================
  
  section("ICEINDEX | OHL PROCESSING COMPLETE")
  
  cat(
    "\nSKATER DATABASE\n",
    "Profiles:       ", nrow(skater_directory), "\n",
    "Season records: ", nrow(skater_seasons), "\n",
    "Career records: ", nrow(skater_career), "\n",
    "Team records:   ", nrow(skater_teams), "\n",
    sep = ""
  )
  
  cat(
    "\nGOALIE DATABASE\n",
    "Profiles:       ", nrow(goalie_directory), "\n",
    "Season records: ", nrow(goalie_seasons), "\n",
    "Career records: ", nrow(goalie_career), "\n",
    "Team records:   ", nrow(goalie_teams), "\n",
    sep = ""
  )
  
  cat(
    "\nCOMBINED DATABASE\n",
    "Season records: ",
    nrow(skater_seasons) + nrow(goalie_seasons),
    "\n",
    "Career records: ",
    nrow(skater_career) + nrow(goalie_career),
    "\n",
    sep = ""
  )
  
  cat(
    "\nRuntime: ",
    elapsed,
    " seconds\n",
    sep = ""
  )
  
  cat(
    "\n",
    strrep("=", 68),
    "\nICEINDEX OHL MASTER PROCESSING SUCCESSFUL\n",
    strrep("=", 68),
    "\n",
    sep = ""
  )
  
})