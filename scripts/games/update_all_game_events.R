
# ============================================================
# ICEINDEX — ALL GAME EVENT COLLECTOR
# Development: v0.10.0
#
# FILE:
# scripts/games/update_all_game_events.R
#
# PURPOSE:
#   1. Retrieve OHL schedule
#   2. Preserve discovered game IDs
#   3. Download newly eligible games
#   4. Refresh recent and suspicious cached games
#   5. Protect existing cache from failed downloads
#   6. Maintain manifest and event schema
#   7. Resume safely
#
# No website changes.
# No changes to statistical builder or enrichment.
# ============================================================

library(OHLpkg)

# ============================================================
# 1. SETTINGS
# ============================================================

season_label <- "2026-27"

# Re-download every eligible game when TRUE.
force_refresh <- FALSE

# Retry empty responses.
retry_empty <- TRUE

# Refresh games scheduled within this many days.
recent_refresh_days <- 7L

# Cached games below this event count are suspicious.
minimum_event_count <- 10L

# Pause between API requests.
request_delay <- 0.5

# Prevent replacing an existing cache with fewer events.
protect_existing_cache <- TRUE

# Allow a completed game to be refreshed even if
# it has a large number of events.
refresh_recent_games <- TRUE

# ============================================================
# 2. PATHS
# ============================================================

base_dir <- file.path(
  "data", "games", season_label
)

events_dir <- file.path(base_dir, "events")

schedule_file <- file.path(
  base_dir, "schedule.csv"
)

manifest_file <- file.path(
  base_dir, "manifest.csv"
)

schema_file <- file.path(
  base_dir, "event_columns.csv"
)

dir.create(
  events_dir,
  recursive = TRUE,
  showWarnings = FALSE
)

# ============================================================
# 3. HELPERS
# ============================================================

clean_text <- function(x) {
  x <- trimws(as.character(x))
  x[is.na(x)] <- ""
  x
}

now_string <- function() {
  format(
    Sys.time(),
    "%Y-%m-%d %H:%M:%S %z"
  )
}

cache_path <- function(game_id) {
  file.path(
    events_dir,
    paste0(game_id, ".rds")
  )
}

read_cache <- function(path) {
  
  if (!file.exists(path)) {
    return(NULL)
  }
  
  tryCatch(
    readRDS(path),
    error = function(e) NULL
  )
}

valid_events <- function(x) {
  is.data.frame(x) &&
    nrow(x) > 0L &&
    "event" %in% names(x)
}

event_count <- function(x) {
  if (!valid_events(x)) return(0L)
  nrow(x)
}

cache_status <- function(x) {
  
  if (!valid_events(x)) {
    return("invalid_or_missing")
  }
  
  if (nrow(x) < minimum_event_count) {
    return("suspicious")
  }
  
  "usable"
}

# ============================================================
# 4. START
# ============================================================

cat("\n====================================\n")
cat("ICEINDEX — ALL GAME EVENTS\n")
cat("Development: v0.10.0\n")
cat("====================================\n\n")

cat("Season:", season_label, "\n")
cat("Recent refresh window:",
    recent_refresh_days, "days\n")
cat("Suspicious cache threshold:",
    minimum_event_count, "events\n\n")

# ============================================================
# 5. LOAD SCHEDULE
# ============================================================

schedule <- OHLpkg::get_Schedule()

if (!is.data.frame(schedule)) {
  stop("get_Schedule() did not return a data frame.")
}

if (!"ID" %in% names(schedule)) {
  stop("Schedule missing ID column.")
}

schedule$ID <- clean_text(schedule$ID)

schedule <- schedule[
  nzchar(schedule$ID),
  ,
  drop = FALSE
]

schedule <- schedule[
  !duplicated(schedule$ID),
  ,
  drop = FALSE
]

# ============================================================
# 6. PRESERVE OLD SCHEDULE
# ============================================================

if (file.exists(schedule_file)) {
  
  old_schedule <- read.csv(
    schedule_file,
    colClasses = "character",
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  
  if ("ID" %in% names(old_schedule)) {
    
    old_schedule$ID <- clean_text(
      old_schedule$ID
    )
    
    all_columns <- union(
      names(schedule),
      names(old_schedule)
    )
    
    for (column in setdiff(
      all_columns, names(schedule)
    )) {
      schedule[[column]] <- NA_character_
    }
    
    for (column in setdiff(
      all_columns, names(old_schedule)
    )) {
      old_schedule[[column]] <- NA_character_
    }
    
    schedule <- schedule[, all_columns]
    old_schedule <- old_schedule[, all_columns]
    
    schedule <- rbind(
      schedule,
      old_schedule[
        !old_schedule$ID %in% schedule$ID,
        ,
        drop = FALSE
      ]
    )
  }
}

schedule <- schedule[
  !duplicated(schedule$ID),
  ,
  drop = FALSE
]

write.csv(
  schedule,
  schedule_file,
  row.names = FALSE,
  na = ""
)

cat("Discovered games:", nrow(schedule), "\n")

# ============================================================
# 7. GAME DATE HANDLING
# ============================================================

date_candidates <- c(
  "Date", "date", "GameDate", "game_date"
)

date_column <- intersect(
  date_candidates,
  names(schedule)
)

if (!length(date_column)) {
  stop(
    "No schedule date column found. ",
    "Cannot safely exclude future games."
  )
}

game_dates <- suppressWarnings(
  as.Date(
    substr(
      as.character(schedule[[date_column[1]]]),
      1, 10
    )
  )
)

schedule$parsed_game_date <- game_dates

today <- Sys.Date()

eligible <- schedule[
  !is.na(schedule$parsed_game_date) &
    schedule$parsed_game_date <= today,
  ,
  drop = FALSE
]

cat("Games dated today or earlier:",
    nrow(eligible), "\n")

# ============================================================
# 8. LOAD MANIFEST
# ============================================================

manifest_columns <- c(
  "game_id",
  "status",
  "event_count",
  "updated_at",
  "error",
  "cache_status",
  "refresh_reason"
)

if (file.exists(manifest_file)) {
  
  manifest <- read.csv(
    manifest_file,
    colClasses = "character",
    stringsAsFactors = FALSE
  )
  
} else {
  
  manifest <- as.data.frame(
    setNames(
      replicate(
        length(manifest_columns),
        character(),
        simplify = FALSE
      ),
      manifest_columns
    )
  )
}

for (column in setdiff(
  manifest_columns,
  names(manifest)
)) {
  manifest[[column]] <- NA_character_
}

manifest <- manifest[, manifest_columns]

# ============================================================
# 9. IDENTIFY REFRESH CANDIDATES
# ============================================================

candidates <- list()

for (i in seq_len(nrow(eligible))) {
  
  game_id <- eligible$ID[i]
  game_date <- eligible$parsed_game_date[i]
  
  if (!grepl("^[A-Za-z0-9_-]+$", game_id)) {
    next
  }
  
  path <- cache_path(game_id)
  existing <- read_cache(path)
  
  existing_count <- event_count(existing)
  existing_status <- cache_status(existing)
  
  age_days <- as.integer(today - game_date)
  
  reason <- NA_character_
  
  if (force_refresh) {
    
    reason <- "force_refresh"
    
  } else if (!file.exists(path)) {
    
    previous <- manifest[
      manifest$game_id == game_id,
      ,
      drop = FALSE
    ]
    
    if (
      !retry_empty &&
      nrow(previous) > 0 &&
      any(previous$status == "empty", na.rm = TRUE)
    ) {
      next
    }
    
    reason <- "missing_cache"
    
  } else if (existing_status == "invalid_or_missing") {
    
    reason <- "invalid_cache"
    
  } else if (existing_status == "suspicious") {
    
    reason <- "suspicious_cache"
    
  } else if (
    refresh_recent_games &&
    age_days >= 0L &&
    age_days <= recent_refresh_days
  ) {
    
    reason <- "recent_game"
    
  }
  
  if (!is.na(reason)) {
    
    candidates[[length(candidates) + 1L]] <-
      data.frame(
        game_id = game_id,
        game_date = as.character(game_date),
        old_events = existing_count,
        refresh_reason = reason,
        stringsAsFactors = FALSE
      )
  }
}

if (length(candidates)) {
  
  candidates <- do.call(rbind, candidates)
  
} else {
  
  candidates <- data.frame(
    game_id = character(),
    game_date = character(),
    old_events = integer(),
    refresh_reason = character(),
    stringsAsFactors = FALSE
  )
}

cat("Games to attempt:", nrow(candidates), "\n")

if (nrow(candidates)) {
  
  cat("\nRefresh reasons:\n")
  
  print(table(candidates$refresh_reason))
}

# ============================================================
# 10. UPDATE MANIFEST
# ============================================================

update_manifest <- function(
    game_id,
    status,
    count,
    error_text,
    cache_state,
    reason
) {
  
  manifest <<- manifest[
    is.na(manifest$game_id) |
      manifest$game_id != game_id,
    ,
    drop = FALSE
  ]
  
  manifest <<- rbind(
    manifest,
    data.frame(
      game_id = game_id,
      status = status,
      event_count = as.character(count),
      updated_at = now_string(),
      error = error_text,
      cache_status = cache_state,
      refresh_reason = reason,
      stringsAsFactors = FALSE
    )
  )
  
  write.csv(
    manifest,
    manifest_file,
    row.names = FALSE,
    na = ""
  )
}

# ============================================================
# 11. UPDATE EVENT SCHEMA
# ============================================================

update_schema <- function(events) {
  
  schema <- data.frame(
    column = names(events),
    class = vapply(
      events,
      function(x) paste(
        class(x),
        collapse = "/"
      ),
      character(1)
    ),
    stringsAsFactors = FALSE
  )
  
  if (file.exists(schema_file)) {
    
    previous <- read.csv(
      schema_file,
      stringsAsFactors = FALSE
    )
    
    if (all(
      c("column", "class") %in% names(previous)
    )) {
      
      schema <- unique(rbind(
        previous[, c("column", "class")],
        schema
      ))
    }
  }
  
  write.csv(
    schema,
    schema_file,
    row.names = FALSE
  )
}

# ============================================================
# 12. DOWNLOAD AND REFRESH
# ============================================================

downloaded <- 0L
refreshed <- 0L
protected <- 0L
failed <- 0L
empty <- 0L

for (i in seq_len(nrow(candidates))) {
  
  game_id <- candidates$game_id[i]
  reason <- candidates$refresh_reason[i]
  
  output_file <- cache_path(game_id)
  
  old_data <- read_cache(output_file)
  old_count <- event_count(old_data)
  
  cat(
    sprintf(
      "\n[%d/%d] Game %s (%s)\n",
      i,
      nrow(candidates),
      game_id,
      reason
    )
  )
  
  cat("Existing events:", old_count, "\n")
  
  result <- tryCatch(
    OHLpkg::get_GameEvents(game_id),
    error = function(e) e
  )
  
  # ----------------------------------------------------------
  # API ERROR
  # ----------------------------------------------------------
  
  if (inherits(result, "error")) {
    
    failed <- failed + 1L
    
    cat(
      "API ERROR:",
      conditionMessage(result),
      "\n"
    )
    
    update_manifest(
      game_id,
      "error",
      old_count,
      conditionMessage(result),
      cache_status(old_data),
      reason
    )
    
    Sys.sleep(request_delay)
    next
  }
  
  # ----------------------------------------------------------
  # EMPTY OR INVALID RESPONSE
  # ----------------------------------------------------------
  
  if (!valid_events(result)) {
    
    empty <- empty + 1L
    
    cat("No usable event data returned.\n")
    
    update_manifest(
      game_id,
      "empty",
      old_count,
      "API returned no usable events",
      cache_status(old_data),
      reason
    )
    
    Sys.sleep(request_delay)
    next
  }
  
  new_count <- nrow(result)
  
  cat("New events:", new_count, "\n")
  
  # ----------------------------------------------------------
  # PROTECT EXISTING CACHE
  # ----------------------------------------------------------
  
  if (
    protect_existing_cache &&
    valid_events(old_data) &&
    new_count < old_count
  ) {
    
    protected <- protected + 1L
    
    cat(
      "PROTECTED: New response has fewer events.\n"
    )
    
    update_manifest(
      game_id,
      "protected",
      old_count,
      paste0(
        "Rejected response with ",
        new_count,
        " events; existing cache has ",
        old_count
      ),
      cache_status(old_data),
      reason
    )
    
    Sys.sleep(request_delay)
    next
  }
  
  # ----------------------------------------------------------
  # SAFE CACHE REPLACEMENT
  # ----------------------------------------------------------
  
  temporary_file <- tempfile(
    pattern = paste0(game_id, "_"),
    tmpdir = events_dir,
    fileext = ".rds"
  )
  
  saved <- tryCatch({
    
    saveRDS(result, temporary_file)
    
    check <- readRDS(temporary_file)
    
    if (!valid_events(check)) {
      stop("Temporary cache validation failed.")
    }
    
    if (nrow(check) != new_count) {
      stop("Temporary cache event count mismatch.")
    }
    
    # Keep a rollback copy when replacing an existing file.
    backup_file <- paste0(
      output_file, ".backup"
    )
    
    had_existing <- file.exists(output_file)
    
    if (had_existing) {
      
      if (!file.copy(
        output_file,
        backup_file,
        overwrite = TRUE
      )) {
        stop("Could not create cache backup.")
      }
    }
    
    replaced <- file.copy(
      temporary_file,
      output_file,
      overwrite = TRUE
    )
    
    if (!replaced) {
      
      if (had_existing) {
        file.copy(
          backup_file,
          output_file,
          overwrite = TRUE
        )
      }
      
      stop("Could not replace cache file.")
    }
    
    final_check <- read_cache(output_file)
    
    if (!valid_events(final_check) ||
        nrow(final_check) != new_count) {
      
      if (had_existing) {
        file.copy(
          backup_file,
          output_file,
          overwrite = TRUE
        )
      } else {
        unlink(output_file)
      }
      
      stop("Final cache verification failed.")
    }
    
    if (file.exists(backup_file)) {
      unlink(backup_file)
    }
    
    TRUE
    
  }, error = function(e) {
    
    cat(
      "CACHE SAVE ERROR:",
      conditionMessage(e),
      "\n"
    )
    
    FALSE
    
  })
  
  if (file.exists(temporary_file)) {
    unlink(temporary_file)
  }
  
  if (!saved) {
    
    failed <- failed + 1L
    
    update_manifest(
      game_id,
      "error",
      old_count,
      "Cache replacement failed",
      cache_status(old_data),
      reason
    )
    
    Sys.sleep(request_delay)
    next
  }
  
  update_schema(result)
  
  if (old_count > 0L) {
    refreshed <- refreshed + 1L
  } else {
    downloaded <- downloaded + 1L
  }
  
  cat("SAVED:", new_count, "events\n")
  
  update_manifest(
    game_id,
    "success",
    new_count,
    "",
    cache_status(result),
    reason
  )
  
  Sys.sleep(request_delay)
}

# ============================================================
# 13. FINAL CACHE INVENTORY
# ============================================================

all_files <- list.files(
  events_dir,
  pattern = "\\.rds$",
  full.names = TRUE
)

inventory <- data.frame(
  game_id = sub(
    "\\.rds$", "",
    basename(all_files)
  ),
  event_count = integer(length(all_files)),
  cache_status = character(length(all_files)),
  stringsAsFactors = FALSE
)

for (i in seq_along(all_files)) {
  
  x <- read_cache(all_files[i])
  
  inventory$event_count[i] <- event_count(x)
  inventory$cache_status[i] <- cache_status(x)
}

# ============================================================
# 14. FINAL REPORT
# ============================================================

cat("\n====================================\n")
cat("ICEINDEX COLLECTION COMPLETE\n")
cat("====================================\n")

cat("Discovered games:", nrow(schedule), "\n")
cat("Eligible games:", nrow(eligible), "\n")
cat("Games attempted:", nrow(candidates), "\n")

cat("\nTHIS RUN\n")
cat("New downloads:", downloaded, "\n")
cat("Refreshed caches:", refreshed, "\n")
cat("Protected caches:", protected, "\n")
cat("Empty responses:", empty, "\n")
cat("Failures:", failed, "\n")

cat("\nCACHE INVENTORY\n")
cat("Cached game files:", nrow(inventory), "\n")

if (nrow(inventory)) {
  print(table(inventory$cache_status))
}

cat("\nFILES\n")
cat(schedule_file, "\n")
cat(manifest_file, "\n")
cat(schema_file, "\n")
cat(events_dir, "\n")

cat("\nICEINDEX v0.10.0 EVENT COLLECTION FINISHED\n")