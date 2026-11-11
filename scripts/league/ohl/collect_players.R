
# ============================================================
# ICEINDEX DATA ENGINE
# HISTORICAL OHL PLAYER DIRECTORY
# Version: 0.6.0
# ============================================================
#
# OUTPUT:
#   data/ohl/historical/players.csv
#
# TRACKING:
#   data/ohl/metadata/players_completed.csv
#   data/ohl/metadata/players_failed.csv
#
# ============================================================


# ============================================================
# CONFIGURATION
# ============================================================

if (!exists("ICEINDEX_PATHS")) {
  stop("IceIndex configuration not loaded.")
}

if (!exists("iceindex_request", mode = "function")) {
  stop("IceIndex API client not loaded.")
}

SEASONS_FILE <- ICEINDEX_PATHS$seasons
TEAMS_FILE <- ICEINDEX_PATHS$teams

OUTPUT_FILE <- ICEINDEX_PATHS$players
COMPLETED_FILE <- ICEINDEX_PATHS$players_completed
FAILED_FILE <- ICEINDEX_PATHS$players_failed

REQUEST_DELAY <- 0.15
SAVE_EVERY <- 10L
FAILURE_RETRY_DAYS <- 30L

FORCE_FULL_REFRESH <- FALSE
REFRESH_CURRENT_SEASON <- TRUE
RETRY_ALL_FAILURES <- FALSE


# ============================================================
# INITIALIZE
# ============================================================

cat("\n==========================================\n")
cat("ICEINDEX: OHL PLAYER COLLECTION\n")
cat("==========================================\n")

for (directory in unique(dirname(c(
  OUTPUT_FILE,
  COMPLETED_FILE,
  FAILED_FILE
)))) {
  
  dir.create(
    directory,
    recursive = TRUE,
    showWarnings = FALSE
  )
  
}

if (!file.exists(SEASONS_FILE)) {
  stop("Missing seasons dataset: ", SEASONS_FILE)
}

if (!file.exists(TEAMS_FILE)) {
  stop("Missing teams dataset: ", TEAMS_FILE)
}


# ============================================================
# CSV HELPERS
# ============================================================

empty_csv <- function(columns) {
  
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


read_csv <- function(path, columns = NULL) {
  
  if (!file.exists(path)) {
    
    if (is.null(columns)) {
      return(data.frame())
    }
    
    return(empty_csv(columns))
    
  }
  
  out <- read.csv(
    path,
    colClasses = "character",
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  
  if (!is.null(columns)) {
    
    missing <- setdiff(columns, names(out))
    
    if (length(missing)) {
      
      stop(
        "Incompatible columns in ",
        path,
        ": ",
        paste(missing, collapse = ", ")
      )
      
    }
    
    out <- out[, columns, drop = FALSE]
    
  }
  
  out
  
}


save_csv <- function(x, path) {
  
  dir.create(
    dirname(path),
    recursive = TRUE,
    showWarnings = FALSE
  )
  
  tmp <- tempfile(
    pattern = "iceindex_",
    tmpdir = dirname(path),
    fileext = ".csv"
  )
  
  on.exit(
    unlink(tmp),
    add = TRUE
  )
  
  write.csv(
    x,
    tmp,
    row.names = FALSE,
    na = ""
  )
  
  if (!file.copy(
    tmp,
    path,
    overwrite = TRUE
  )) {
    
    stop("Could not save ", path)
    
  }
  
}


roster_key <- function(season, team) {
  paste(season, team, sep = ":")
}


# ============================================================
# LOAD SEASONS AND TEAMS
# ============================================================

seasons <- read_csv(SEASONS_FILE)
teams_info <- read_csv(TEAMS_FILE)

if (!all(
  c("SeasonID", "Season") %in% names(seasons)
)) {
  stop("Unexpected seasons.csv schema.")
}

if (!all(
  c("SeasonID", "TeamID") %in% names(teams_info)
)) {
  stop("Unexpected teams.csv schema.")
}

teams <- unique(
  teams_info[
    ,
    c("SeasonID", "TeamID"),
    drop = FALSE
  ]
)


# ============================================================
# CURRENT REGULAR SEASON
# ============================================================

regular <- grepl(
  "regular season",
  seasons$Season,
  ignore.case = TRUE
)

years <- suppressWarnings(
  as.integer(
    regmatches(
      seasons$Season,
      regexpr(
        "(19|20)[0-9]{2}",
        seasons$Season
      )
    )
  )
)

candidates <- which(
  regular & !is.na(years)
)

if (!length(candidates)) {
  stop("No regular seasons found.")
}

latest <- candidates[
  years[candidates] == max(years[candidates])
]

CURRENT_SEASON_ID <- unique(
  seasons$SeasonID[latest]
)

if (length(CURRENT_SEASON_ID) != 1L) {
  stop("Ambiguous current regular season.")
}

cat(
  "Current regular season:",
  CURRENT_SEASON_ID,
  "\n"
)


# ============================================================
# DATA STRUCTURES
# ============================================================

PLAYER_COLUMNS <- c(
  "SeasonID",
  "TeamID",
  "PlayerID",
  "PersonID",
  "FirstName",
  "LastName",
  "PlayerName",
  "Position",
  "JerseyNumber",
  "BirthDate",
  "Shoots",
  "Catches",
  "Height",
  "Weight",
  "Hometown",
  "HomeProvince",
  "HomeCountry",
  "Birthplace",
  "TeamName",
  "NHLTeam",
  "DraftStatus",
  "PhotoURL"
)

COMPLETED_COLUMNS <- c(
  "SeasonID",
  "TeamID",
  "PlayerCount"
)

FAILED_COLUMNS <- c(
  "SeasonID",
  "Season",
  "TeamID",
  "TeamName",
  "Reason",
  "Attempts",
  "LastAttempt",
  "NextRetry"
)


# ============================================================
# LOAD EXISTING DATA AND TRACKING
# ============================================================

existing <- if (FORCE_FULL_REFRESH) {
  
  empty_csv(PLAYER_COLUMNS)
  
} else {
  
  read_csv(
    OUTPUT_FILE,
    PLAYER_COLUMNS
  )
  
}

completed <- if (FORCE_FULL_REFRESH) {
  
  empty_csv(COMPLETED_COLUMNS)
  
} else {
  
  read_csv(
    COMPLETED_FILE,
    COMPLETED_COLUMNS
  )
  
}

# Preserve failure history during full refreshes.

failed <- read_csv(
  FAILED_FILE,
  FAILED_COLUMNS
)


# ============================================================
# PLAYER FIELD EXTRACTION
# ============================================================

player_field <- function(record, candidates) {
  
  if (!is.list(record)) {
    return(NA_character_)
  }
  
  for (field in candidates) {
    
    value <- record[[field]]
    
    if (
      !is.null(value) &&
      length(value) == 1L &&
      !is.list(value) &&
      !is.na(value)
    ) {
      
      value <- trimws(
        as.character(value)
      )
      
      if (nzchar(value)) {
        return(value)
      }
      
    }
    
  }
  
  NA_character_
  
}


# ============================================================
# FIND ROSTER SECTION
# ============================================================

find_roster_section <- function(node) {
  
  if (!is.list(node)) {
    return(NULL)
  }
  
  if (!is.null(node$Roster)) {
    return(node$Roster)
  }
  
  for (child in node) {
    
    result <- find_roster_section(child)
    
    if (!is.null(result)) {
      return(result)
    }
    
  }
  
  NULL
  
}


# ============================================================
# FIND PLAYER RECORDS
# ============================================================

find_player_records <- function(response) {
  
  roster <- find_roster_section(response)
  
  if (is.null(roster)) {
    stop("HockeyTech response has no Roster section.")
  }
  
  extract <- function(node) {
    
    if (is.data.frame(node)) {
      
      node <- lapply(
        seq_len(nrow(node)),
        function(i) {
          as.list(node[i, , drop = FALSE])
        }
      )
      
    }
    
    if (!is.list(node)) {
      return(list())
    }
    
    id <- player_field(
      node,
      c(
        "player_id",
        "playerId",
        "PlayerID",
        "id"
      )
    )
    
    first <- player_field(
      node,
      c(
        "first_name",
        "firstName",
        "FirstName"
      )
    )
    
    last <- player_field(
      node,
      c(
        "last_name",
        "lastName",
        "LastName"
      )
    )
    
    if (
      !is.na(id) &&
      !is.na(first) &&
      !is.na(last)
    ) {
      return(list(node))
    }
    
    result <- list()
    
    for (child in node) {
      result <- c(
        result,
        extract(child)
      )
    }
    
    result
    
  }
  
  players <- extract(roster)
  
  if (!length(players)) {
    stop("Roster contains no recognizable players.")
  }
  
  ids <- vapply(
    players,
    player_field,
    character(1),
    candidates = c(
      "player_id",
      "playerId",
      "PlayerID",
      "id"
    )
  )
  
  players[!duplicated(ids)]
  
}


# ============================================================
# PARSE ROSTER
# ============================================================

parse_roster <- function(response, season_id, team_id) {
  
  roster <- find_player_records(response)
  
  rows <- lapply(
    roster,
    function(p) {
      
      first <- player_field(
        p,
        c(
          "first_name",
          "firstName",
          "FirstName"
        )
      )
      
      last <- player_field(
        p,
        c(
          "last_name",
          "lastName",
          "LastName"
        )
      )
      
      full <- player_field(
        p,
        c(
          "name",
          "player_name",
          "playerName"
        )
      )
      
      if (is.na(full)) {
        full <- paste(first, last)
      }
      
      data.frame(
        SeasonID = season_id,
        TeamID = team_id,
        
        PlayerID = player_field(
          p,
          c(
            "player_id",
            "playerId",
            "PlayerID",
            "id"
          )
        ),
        
        PersonID = player_field(
          p,
          c(
            "person_id",
            "personId"
          )
        ),
        
        FirstName = first,
        LastName = last,
        PlayerName = full,
        
        Position = player_field(
          p,
          c(
            "position",
            "position_code"
          )
        ),
        
        JerseyNumber = player_field(
          p,
          c(
            "tp_jersey_number",
            "jersey_number",
            "number"
          )
        ),
        
        BirthDate = player_field(
          p,
          c(
            "birthdate",
            "birth_date"
          )
        ),
        
        Shoots = player_field(
          p,
          c(
            "shoots",
            "shoots_catches"
          )
        ),
        
        Catches = player_field(
          p,
          c("catches")
        ),
        
        Height = player_field(
          p,
          c(
            "height_hyphenated",
            "height"
          )
        ),
        
        Weight = player_field(
          p,
          c("weight")
        ),
        
        Hometown = player_field(
          p,
          c("hometown")
        ),
        
        HomeProvince = player_field(
          p,
          c(
            "homeprov",
            "home_province"
          )
        ),
        
        HomeCountry = player_field(
          p,
          c(
            "homecntry",
            "home_country"
          )
        ),
        
        Birthplace = player_field(
          p,
          c("birthplace")
        ),
        
        TeamName = player_field(
          p,
          c("team_name")
        ),
        
        NHLTeam = player_field(
          p,
          c(
            "nhlteam",
            "nhl_team"
          )
        ),
        
        DraftStatus = player_field(
          p,
          c("draft_status")
        ),
        
        PhotoURL = player_field(
          p,
          c(
            "player_image",
            "photo_url"
          )
        ),
        
        stringsAsFactors = FALSE
      )
      
    }
  )
  
  result <- unique(
    do.call(rbind, rows)
  )
  
  if (
    !nrow(result) ||
    anyNA(result$PlayerID) ||
    anyNA(result$FirstName) ||
    anyNA(result$LastName) ||
    anyDuplicated(result$PlayerID)
  ) {
    stop("Invalid player roster.")
  }
  
  result
  
}


# ============================================================
# SAVE ALL DATA AND TRACKING
# ============================================================

save_all <- function() {
  
  existing <- unique(existing)
  
  save_csv(
    existing,
    OUTPUT_FILE
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
# VALIDATE COMPLETION CACHE
# ============================================================

counts <- table(
  roster_key(
    existing$SeasonID,
    existing$TeamID
  )
)

valid_completed <- vapply(
  seq_len(nrow(completed)),
  function(i) {
    
    key <- roster_key(
      completed$SeasonID[i],
      completed$TeamID[i]
    )
    
    expected <- suppressWarnings(
      as.integer(
        completed$PlayerCount[i]
      )
    )
    
    actual <- if (key %in% names(counts)) {
      as.integer(counts[[key]])
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


# ============================================================
# DETERMINE PENDING ROSTERS
# ============================================================

completed_keys <- roster_key(
  completed$SeasonID,
  completed$TeamID
)

failed_keys <- roster_key(
  failed$SeasonID,
  failed$TeamID
)

team_keys <- roster_key(
  teams$SeasonID,
  teams$TeamID
)

is_current <- teams$SeasonID == CURRENT_SEASON_ID

retry_due <- rep(
  FALSE,
  nrow(teams)
)

for (i in seq_len(nrow(teams))) {
  
  idx <- match(
    team_keys[i],
    failed_keys
  )
  
  if (!is.na(idx)) {
    
    next_date <- suppressWarnings(
      as.Date(
        failed$NextRetry[idx]
      )
    )
    
    retry_due[i] <-
      RETRY_ALL_FAILURES ||
      is.na(next_date) ||
      Sys.Date() >= next_date
    
  }
  
}

needs_refresh <-
  FORCE_FULL_REFRESH |
  (
    !(team_keys %in% completed_keys) &
      (
        !(team_keys %in% failed_keys) |
          retry_due
      )
  ) |
  (
    is_current &
      REFRESH_CURRENT_SEASON
  )

pending <- teams[
  needs_refresh,
  ,
  drop = FALSE
]

cat(
  "Total rosters:",
  nrow(teams),
  "\n"
)

cat(
  "Cached:",
  nrow(teams) - nrow(pending),
  "\n"
)

cat(
  "To collect:",
  nrow(pending),
  "\n"
)

cat(
  "Historical failures waiting for retry:",
  sum(
    !is_current &
      team_keys %in% failed_keys &
      !retry_due
  ),
  "\n"
)


# ============================================================
# COLLECT PLAYER ROSTERS
# ============================================================

updated <- 0L
run_failures <- character()

for (i in seq_len(nrow(pending))) {
  
  season_id <- pending$SeasonID[i]
  team_id <- pending$TeamID[i]
  
  key <- roster_key(
    season_id,
    team_id
  )
  
  cat(
    sprintf(
      "[%d/%d] Season %s | Team %s\n",
      i,
      nrow(pending),
      season_id,
      team_id
    )
  )
  
  
  # ==========================================================
  # REQUEST AND PARSE
  # ==========================================================
  
  result <- tryCatch({
    
    response <- iceindex_request(
      feed = "modulekit",
      view = "roster",
      params = list(
        season_id = season_id,
        team_id = team_id
      )
    )
    
    parse_roster(
      response,
      season_id,
      team_id
    )
    
  }, error = function(e) {
    
    structure(
      list(
        message = conditionMessage(e)
      ),
      class = "iceindex_roster_error"
    )
    
  })
  
  
  # ==========================================================
  # HANDLE FAILED REQUEST
  # ==========================================================
  
  if (inherits(result, "iceindex_roster_error")) {
    
    old_index <- match(
      key,
      roster_key(
        failed$SeasonID,
        failed$TeamID
      )
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
      roster_key(
        failed$SeasonID,
        failed$TeamID
      ) != key,
      ,
      drop = FALSE
    ]
    
    season_name <- seasons$Season[
      match(
        season_id,
        seasons$SeasonID
      )
    ]
    
    if (
      !length(season_name) ||
      is.na(season_name)
    ) {
      season_name <- ""
    }
    
    team_name <- if (
      "TeamName" %in% names(teams_info)
    ) {
      
      teams_info$TeamName[
        match(
          key,
          roster_key(
            teams_info$SeasonID,
            teams_info$TeamID
          )
        )
      ]
      
    } else {
      
      ""
      
    }
    
    if (
      !length(team_name) ||
      is.na(team_name)
    ) {
      team_name <- ""
    }
    
    failed <- rbind(
      failed,
      data.frame(
        SeasonID = season_id,
        Season = season_name,
        TeamID = team_id,
        TeamName = team_name,
        Reason = result$message,
        Attempts = as.character(attempts),
        LastAttempt = as.character(Sys.Date()),
        NextRetry = as.character(
          Sys.Date() + FAILURE_RETRY_DAYS
        ),
        stringsAsFactors = FALSE
      )
    )
    
    run_failures <- c(
      run_failures,
      key
    )
    
    message(
      "  FAILED: ",
      result$message
    )
    
    # Preserve failed request history immediately.
    save_all()
    
    
    # ==========================================================
    # HANDLE SUCCESSFUL REQUEST
    # ==========================================================
    
  } else {
    
    existing <- existing[
      roster_key(
        existing$SeasonID,
        existing$TeamID
      ) != key,
      ,
      drop = FALSE
    ]
    
    existing <- rbind(
      existing,
      result
    )
    
    completed <- completed[
      roster_key(
        completed$SeasonID,
        completed$TeamID
      ) != key,
      ,
      drop = FALSE
    ]
    
    completed <- rbind(
      completed,
      data.frame(
        SeasonID = season_id,
        TeamID = team_id,
        PlayerCount = as.character(
          nrow(result)
        ),
        stringsAsFactors = FALSE
      )
    )
    
    failed <- failed[
      roster_key(
        failed$SeasonID,
        failed$TeamID
      ) != key,
      ,
      drop = FALSE
    ]
    
    updated <- updated + 1L
    
    cat(
      "  Players:",
      nrow(result),
      "\n"
    )
    
    if (updated %% SAVE_EVERY == 0L) {
      
      save_all()
      
      cat("  Progress saved.\n")
      
    }
    
  }
  
  Sys.sleep(REQUEST_DELAY)
  
}


# ============================================================
# FINAL SAVE
# ============================================================

save_all()


# ============================================================
# COLLECTION SUMMARY
# ============================================================

cat("\n==========================================\n")
cat("ICEINDEX PLAYER COLLECTION SUMMARY\n")
cat("==========================================\n")

cat(
  "Player records:",
  nrow(existing),
  "\n"
)

cat(
  "Unique players:",
  length(unique(existing$PlayerID)),
  "\n"
)

cat(
  "Rosters updated:",
  updated,
  "\n"
)

cat(
  "New failures:",
  length(run_failures),
  "\n"
)

cat(
  "Tracked failures:",
  nrow(failed),
  "\n"
)

cat(
  "Output:",
  OUTPUT_FILE,
  "\n"
)

cat(
  "Completion cache:",
  COMPLETED_FILE,
  "\n"
)

cat(
  "Failure report:",
  FAILED_FILE,
  "\n"
)

cat("==========================================\n")


# ============================================================
# CURRENT-SEASON FAILURE CHECK
# ============================================================

current_failures <- run_failures[
  startsWith(
    run_failures,
    paste0(
      CURRENT_SEASON_ID,
      ":"
    )
  )
]

if (length(current_failures)) {
  
  stop(
    "Current-season player collection failed: ",
    paste(
      current_failures,
      collapse = ", "
    ),
    call. = FALSE
  )
  
}

cat("IceIndex player collection complete.\n")