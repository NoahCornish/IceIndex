
# ============================================================
# ICEINDEX — HISTORICAL OHL GAME EVENT DOWNLOADER
# Version: v0.11.0
#
# Seasons: 2021-22 through 2025-26
# 2026-27 is deliberately excluded.
#
# Uses OHLpkg::get_GameEvents() for event retrieval.
# Saves one .rds file per game.
# Resumable; does not overwrite valid cached games.
# ============================================================

library(OHLpkg)
library(jsonlite)

SEASONS <- c(
  "2021-22" = 70L,
  "2022-23" = 73L,
  "2023-24" = 76L,
  "2024-25" = 79L,
  "2025-26" = 83L
)

ROOT <- file.path("data", "games")
DELAY_SECONDS <- 0.5
MAX_ATTEMPTS <- 3L

# ------------------------------------------------------------
# HELPERS
# ------------------------------------------------------------

valid_events <- function(x) {
  is.data.frame(x) &&
    nrow(x) > 0L &&
    "event" %in% names(x)
}

fetch_schedule <- function(season_id) {
  
  url <- paste0(
    "https://lscluster.hockeytech.com/feed/",
    "?feed=modulekit",
    "&view=schedule",
    "&key=f1aa699db3d81487",
    "&client_code=ohl",
    "&season_id=", season_id,
    "&fmt=json"
  )
  
  response <- jsonlite::fromJSON(
    url,
    simplifyDataFrame = TRUE
  )
  
  if (!is.null(response$SiteKit$Schedule)) {
    return(response$SiteKit$Schedule)
  }
  
  stop(
    "Unexpected schedule response for season ID ",
    season_id,
    ". Inspect the API response before proceeding."
  )
}

extract_game_ids <- function(schedule) {
  
  if (!is.data.frame(schedule)) {
    stop("Schedule is not a data frame.")
  }
  
  candidates <- c(
    "ID", "id", "game_id", "GameID"
  )
  
  column <- intersect(candidates, names(schedule))
  
  if (!length(column)) {
    stop(
      "Game ID column not found. Available columns: ",
      paste(names(schedule), collapse = ", ")
    )
  }
  
  ids <- unique(as.character(schedule[[column[1]]]))
  
  ids <- ids[
    !is.na(ids) &
      grepl("^[1-9][0-9]*$", ids)
  ]
  
  ids
}

download_game <- function(game_id) {
  
  for (attempt in seq_len(MAX_ATTEMPTS)) {
    
    result <- tryCatch(
      OHLpkg::get_GameEvents(as.integer(game_id)),
      error = function(e) {
        message(
          "Game ", game_id,
          " attempt ", attempt,
          ": ", conditionMessage(e)
        )
        NULL
      }
    )
    
    if (valid_events(result)) {
      return(result)
    }
    
    if (attempt < MAX_ATTEMPTS) {
      Sys.sleep(attempt * 2)
    }
  }
  
  NULL
}

# ------------------------------------------------------------
# DOWNLOAD ALL HISTORICAL SEASONS
# ------------------------------------------------------------

all_results <- list()

for (season in names(SEASONS)) {
  
  season_id <- SEASONS[[season]]
  
  cat("\n====================================\n")
  cat("ICEINDEX HISTORICAL DOWNLOAD\n")
  cat("Season:", season, "\n")
  cat("Season ID:", season_id, "\n")
  cat("====================================\n")
  
  season_dir <- file.path(ROOT, season)
  events_dir <- file.path(season_dir, "events")
  
  dir.create(
    events_dir,
    recursive = TRUE,
    showWarnings = FALSE
  )
  
  schedule <- tryCatch(
    fetch_schedule(season_id),
    error = function(e) {
      message(conditionMessage(e))
      NULL
    }
  )
  
  if (is.null(schedule)) {
    message("Skipping season: schedule unavailable.")
    next
  }
  
  game_ids <- extract_game_ids(schedule)
  
  if (!length(game_ids)) {
    message("Skipping season: no game IDs found.")
    next
  }
  
  write.csv(
    schedule,
    file.path(season_dir, "season_schedule.csv"),
    row.names = FALSE
  )
  
  cat("Games in schedule:", length(game_ids), "\n")
  
  season_results <- vector(
    "list",
    length(game_ids)
  )
  
  for (i in seq_along(game_ids)) {
    
    game_id <- game_ids[[i]]
    
    destination <- file.path(
      events_dir,
      paste0(game_id, ".rds")
    )
    
    status <- "failed"
    event_count <- NA_integer_
    
    if (file.exists(destination)) {
      
      existing <- tryCatch(
        readRDS(destination),
        error = function(e) NULL
      )
      
      if (valid_events(existing)) {
        status <- "cached"
        event_count <- nrow(existing)
      }
    }
    
    if (status != "cached") {
      
      events <- download_game(game_id)
      
      if (valid_events(events)) {
        
        # Atomic replacement prevents partial RDS files.
        temp <- tempfile(
          pattern = paste0(game_id, "_"),
          tmpdir = events_dir,
          fileext = ".rds"
        )
        
        saveRDS(events, temp)
        
        if (!file.rename(temp, destination)) {
          unlink(temp)
          stop("Unable to save game ", game_id)
        }
        
        status <- "downloaded"
        event_count <- nrow(events)
      }
      
      Sys.sleep(DELAY_SECONDS)
    }
    
    season_results[[i]] <- data.frame(
      season = season,
      season_id = season_id,
      game_id = game_id,
      status = status,
      event_count = event_count,
      stringsAsFactors = FALSE
    )
    
    cat(sprintf(
      "[%d/%d] Game %s: %s\n",
      i, length(game_ids),
      game_id, status
    ))
  }
  
  report <- do.call(rbind, season_results)
  
  write.csv(
    report,
    file.path(season_dir, "download_report.csv"),
    row.names = FALSE
  )
  
  all_results[[season]] <- report
  
  cat("\nSeason completed:", season, "\n")
  print(table(report$status))
}

# ------------------------------------------------------------
# MASTER REPORT
# ------------------------------------------------------------

if (length(all_results)) {
  
  master <- do.call(rbind, all_results)
  
  write.csv(
    master,
    file.path(ROOT, "historical_download_report.csv"),
    row.names = FALSE
  )
  
  cat("\n====================================\n")
  cat("ICEINDEX v0.11.0 — DOWNLOAD COMPLETE\n")
  cat("====================================\n")
  
  print(
    with(master, table(season, status))
  )
  
  cat("\nTotal scheduled games:",
      nrow(master), "\n")
  
  cat("Games cached or downloaded:",
      sum(master$status %in% c(
        "cached", "downloaded"
      )), "\n")
  
  cat("Failed games:",
      sum(master$status == "failed"), "\n")
}
