
# ============================================================
# ICEINDEX DATA ENGINE
# CONFIGURATION
# Version: 0.6.0
# ============================================================

ICEINDEX_VERSION <- "0.6.0"


# ============================================================
# OHL API SETTINGS
# ============================================================

ICEINDEX_API <- list(
  base_url = "https://lscluster.hockeytech.com/feed/index.php",
  client_code = "ohl",
  key = Sys.getenv(
    "ICEINDEX_OHL_API_KEY",
    unset = "f1aa699db3d81487"
  ),
  league_id = 1L,
  site_id = 1L,
  language = "en",
  timeout = 30,
  retries = 3
)


# ============================================================
# FILE PATHS
# ============================================================

ICEINDEX_PATHS <- list(
  
  # Main data directory
  data = "data",
  
  # Original raw data storage
  raw = "data/raw",
  
  # OHL directories
  ohl = "data/ohl",
  
  current = "data/ohl/current",
  
  historical = "data/ohl/historical",
  
  metadata = "data/ohl/metadata",
  
  # Season directory
  seasons = "data/ohl/historical/seasons.csv",
  
  # Team directory
  teams = "data/ohl/historical/teams.csv",
  
  # Player directory
  players = "data/ohl/historical/players.csv",
  
  # Player collection tracking
  players_completed = "data/ohl/metadata/players_completed.csv",
  
  players_failed = "data/ohl/metadata/players_failed.csv",
  
  # Current skater statistics
  skater_stats_current = "data/ohl/current/skater_stats.csv",
  
  # Historical skater statistics
  skater_stats_historical = "data/ohl/historical/skater_stats.csv",
  
  # Skater statistics tracking
  skater_stats_completed = "data/ohl/metadata/skater_stats_completed.csv",
  
  skater_stats_failed = "data/ohl/metadata/skater_stats_failed.csv",
  
  # Current goalie statistics
  goalie_stats_current = "data/ohl/current/goalie_stats.csv",
  
  # Historical goalie statistics
  goalie_stats_historical = "data/ohl/historical/goalie_stats.csv",
  
  # Goalie statistics tracking
  goalie_stats_completed = "data/ohl/metadata/goalie_stats_completed.csv",
  
  goalie_stats_failed = "data/ohl/metadata/goalie_stats_failed.csv"
  
)


# ============================================================
# CREATE DIRECTORIES
# ============================================================

required_directories <- c(
  ICEINDEX_PATHS$data,
  ICEINDEX_PATHS$raw,
  ICEINDEX_PATHS$ohl,
  ICEINDEX_PATHS$current,
  ICEINDEX_PATHS$historical,
  ICEINDEX_PATHS$metadata
)

for (directory in required_directories) {
  
  dir.create(
    directory,
    recursive = TRUE,
    showWarnings = FALSE
  )
  
  if (!dir.exists(directory)) {
    
    stop(
      "Unable to initialize IceIndex directory: ",
      directory,
      call. = FALSE
    )
    
  }
  
}


# ============================================================
# INITIALIZATION COMPLETE
# ============================================================

message(
  "IceIndex Data Engine v",
  ICEINDEX_VERSION,
  " initialized."
)

message(
  "OHL data directory: ",
  ICEINDEX_PATHS$ohl
)