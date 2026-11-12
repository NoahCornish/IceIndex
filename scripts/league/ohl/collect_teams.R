
# ============================================================
# ICEINDEX DATA ENGINE
# HISTORICAL OHL TEAM COLLECTION
# Version: 0.8.0
# ============================================================
#
# PURPOSE:
#   Collect OHL teams for every available season.
#
# OUTPUT:
#   data/ohl/historical/teams.csv
#
# CACHE:
#   data/ohl/metadata/teams_completed.csv
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
OUTPUT_FILE <- ICEINDEX_PATHS$teams

CACHE_FILE <- file.path(
  ICEINDEX_PATHS$metadata,
  "teams_completed.csv"
)

FORCE_FULL_REFRESH <- FALSE
REFRESH_CURRENT_SEASON <- TRUE
REQUEST_DELAY <- 0.15


# ============================================================
# INITIALIZE
# ============================================================

cat("\n")
cat("==========================================\n")
cat("ICEINDEX: OHL TEAM COLLECTION\n")
cat("==========================================\n")

dir.create(
  dirname(OUTPUT_FILE),
  recursive = TRUE,
  showWarnings = FALSE
)

dir.create(
  dirname(CACHE_FILE),
  recursive = TRUE,
  showWarnings = FALSE
)


# ============================================================
# LOAD SEASONS
# ============================================================

if (!file.exists(SEASONS_FILE)) {
  stop(
    "Missing season dataset: ",
    SEASONS_FILE
  )
}

seasons <- read.csv(
  SEASONS_FILE,
  colClasses = "character",
  stringsAsFactors = FALSE
)

if (!all(c("SeasonID", "Season") %in% names(seasons))) {
  stop("Invalid seasons.csv.")
}

if (
  nrow(seasons) == 0 ||
  anyNA(seasons$SeasonID) ||
  anyDuplicated(seasons$SeasonID)
) {
  stop("Season dataset validation failed.")
}


# ============================================================
# IDENTIFY CURRENT REGULAR SEASON
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

if (length(candidates) == 0) {
  stop("No regular seasons found.")
}

latest <- candidates[
  years[candidates] == max(years[candidates])
]

CURRENT_SEASON_ID <- unique(
  seasons$SeasonID[latest]
)

if (length(CURRENT_SEASON_ID) != 1) {
  stop("Ambiguous current regular season.")
}

cat(
  "Current season:",
  CURRENT_SEASON_ID,
  "\n"
)


# ============================================================
# TEAM DATA STRUCTURE
# ============================================================

TEAM_COLUMNS <- c(
  "SeasonID",
  "TeamID",
  "TeamName",
  "City"
)

empty_teams <- function() {
  
  as.data.frame(
    setNames(
      replicate(
        length(TEAM_COLUMNS),
        character(),
        simplify = FALSE
      ),
      TEAM_COLUMNS
    ),
    stringsAsFactors = FALSE
  )
  
}


# ============================================================
# LOAD EXISTING TEAM DATA
# ============================================================

if (
  file.exists(OUTPUT_FILE) &&
  !FORCE_FULL_REFRESH
) {
  
  existing <- read.csv(
    OUTPUT_FILE,
    colClasses = "character",
    stringsAsFactors = FALSE
  )
  
  if (!all(TEAM_COLUMNS %in% names(existing))) {
    stop(
      "Existing teams.csv has incompatible columns."
    )
  }
  
  existing <- existing[
    ,
    TEAM_COLUMNS,
    drop = FALSE
  ]
  
} else {
  
  existing <- empty_teams()
  
}


# ============================================================
# LOAD COMPLETION CACHE
# ============================================================

if (
  file.exists(CACHE_FILE) &&
  !FORCE_FULL_REFRESH
) {
  
  completed <- read.csv(
    CACHE_FILE,
    colClasses = "character",
    stringsAsFactors = FALSE
  )
  
} else {
  
  completed <- data.frame(
    SeasonID = character(),
    TeamCount = character(),
    stringsAsFactors = FALSE
  )
  
  # Bootstrap cache from existing team records.
  # Require multiple teams before considering
  # a season previously collected.
  
  if (nrow(existing) > 0) {
    
    counts <- table(existing$SeasonID)
    
    valid_counts <- counts[counts >= 2]
    
    completed <- data.frame(
      SeasonID = names(valid_counts),
      TeamCount = as.character(
        as.integer(valid_counts)
      ),
      stringsAsFactors = FALSE
    )
    
  }
  
}

if (!all(
  c("SeasonID", "TeamCount") %in% names(completed)
)) {
  stop("Invalid teams completion cache.")
}


# ============================================================
# VERIFY COMPLETION CACHE
# ============================================================

counts <- table(existing$SeasonID)

valid <- vapply(
  seq_len(nrow(completed)),
  function(i) {
    
    id <- completed$SeasonID[i]
    
    expected <- suppressWarnings(
      as.integer(completed$TeamCount[i])
    )
    
    actual <- if (id %in% names(counts)) {
      as.integer(counts[[id]])
    } else {
      0L
    }
    
    !is.na(expected) &&
      expected >= 2 &&
      expected == actual
    
  },
  logical(1)
)

completed <- completed[
  valid,
  ,
  drop = FALSE
]


# ============================================================
# FIELD HELPERS
# ============================================================

team_field <- function(record, candidates) {
  
  for (field in candidates) {
    
    value <- record[[field]]
    
    if (
      !is.null(value) &&
      length(value) == 1 &&
      !is.list(value) &&
      !is.na(value) &&
      nzchar(trimws(as.character(value)))
    ) {
      return(trimws(as.character(value)))
    }
    
  }
  
  NA_character_
  
}


find_team_records <- function(node) {
  
  if (is.data.frame(node)) {
    
    node <- lapply(
      seq_len(nrow(node)),
      function(i) as.list(
        node[i, , drop = FALSE]
      )
    )
    
  }
  
  if (!is.list(node)) {
    return(NULL)
  }
  
  if (length(node) > 0) {
    
    valid <- vapply(
      node,
      function(item) {
        
        if (!is.list(item)) {
          return(FALSE)
        }
        
        id <- team_field(
          item,
          c(
            "id",
            "team_id",
            "teamId",
            "TeamID"
          )
        )
        
        name <- team_field(
          item,
          c(
            "name",
            "team_name",
            "teamName",
            "TeamName"
          )
        )
        
        !is.na(id) && !is.na(name)
        
      },
      logical(1)
    )
    
    if (all(valid)) {
      return(node)
    }
    
  }
  
  for (child in node) {
    
    result <- find_team_records(child)
    
    if (!is.null(result)) {
      return(result)
    }
    
  }
  
  NULL
  
}


# ============================================================
# DETERMINE PENDING SEASONS
# ============================================================

pending <- seasons[
  FORCE_FULL_REFRESH |
    !(seasons$SeasonID %in% completed$SeasonID) |
    (
      REFRESH_CURRENT_SEASON &
        seasons$SeasonID == CURRENT_SEASON_ID
    ),
  ,
  drop = FALSE
]

cat(
  "Total seasons:",
  nrow(seasons),
  "\n"
)

cat(
  "Cached seasons:",
  nrow(seasons) - nrow(pending),
  "\n"
)

cat(
  "Seasons to collect:",
  nrow(pending),
  "\n"
)


# ============================================================
# COLLECT TEAMS
# ============================================================

failures <- character()

for (i in seq_len(nrow(pending))) {
  
  season_id <- pending$SeasonID[i]
  
  cat(
    "[",
    i,
    "/",
    nrow(pending),
    "] Season ",
    season_id,
    "\n",
    sep = ""
  )
  
  tryCatch({
    
    response <- iceindex_request(
      feed = "modulekit",
      view = "teamsbyseason",
      params = list(
        season_id = season_id
      )
    )
    
    records <- find_team_records(response)
    
    if (
      is.null(records) ||
      length(records) == 0
    ) {
      stop("No recognizable teams.")
    }
    
    rows <- do.call(
      rbind,
      lapply(records, function(team) {
        
        data.frame(
          SeasonID = season_id,
          TeamID = team_field(
            team,
            c(
              "id",
              "team_id",
              "teamId",
              "TeamID"
            )
          ),
          TeamName = team_field(
            team,
            c(
              "name",
              "team_name",
              "teamName",
              "TeamName"
            )
          ),
          City = team_field(
            team,
            c(
              "city",
              "team_city",
              "teamCity",
              "City"
            )
          ),
          stringsAsFactors = FALSE
        )
        
      })
    )
    
    if (
      anyNA(rows$TeamID) ||
      anyNA(rows$TeamName) ||
      anyDuplicated(rows$TeamID)
    ) {
      stop("Team validation failed.")
    }
    
    # Replace this season's existing records.
    
    existing <- existing[
      existing$SeasonID != season_id,
      ,
      drop = FALSE
    ]
    
    existing <- rbind(
      existing,
      rows
    )
    
    # Update successful completion cache.
    
    completed <- completed[
      completed$SeasonID != season_id,
      ,
      drop = FALSE
    ]
    
    completed <- rbind(
      completed,
      data.frame(
        SeasonID = season_id,
        TeamCount = as.character(
          nrow(rows)
        ),
        stringsAsFactors = FALSE
      )
    )
    
    cat(
      "  Teams:",
      nrow(rows),
      "\n"
    )
    
  }, error = function(e) {
    
    failures <<- c(
      failures,
      season_id
    )
    
    message(
      "  FAILED: ",
      conditionMessage(e)
    )
    
  })
  
  Sys.sleep(REQUEST_DELAY)
  
}


# ============================================================
# SORT AND VALIDATE FINAL DATA
# ============================================================

existing <- unique(existing)

existing <- existing[
  order(
    suppressWarnings(
      as.integer(existing$SeasonID)
    ),
    existing$TeamName,
    na.last = TRUE
  ),
  ,
  drop = FALSE
]

rownames(existing) <- NULL


# ============================================================
# SAVE TEAM DATA
# ============================================================

temp <- tempfile(
  tmpdir = dirname(OUTPUT_FILE),
  fileext = ".csv"
)

write.csv(
  existing,
  temp,
  row.names = FALSE,
  na = ""
)

if (!file.copy(
  temp,
  OUTPUT_FILE,
  overwrite = TRUE
)) {
  
  unlink(temp)
  
  stop("Unable to save teams.csv.")
  
}

unlink(temp)


# ============================================================
# SAVE COMPLETION CACHE
# ============================================================

temp_cache <- tempfile(
  tmpdir = dirname(CACHE_FILE),
  fileext = ".csv"
)

write.csv(
  completed,
  temp_cache,
  row.names = FALSE,
  na = ""
)

if (!file.copy(
  temp_cache,
  CACHE_FILE,
  overwrite = TRUE
)) {
  
  unlink(temp_cache)
  
  stop("Unable to save team completion cache.")
  
}

unlink(temp_cache)


# ============================================================
# SUMMARY
# ============================================================

cat("\n")

cat(
  "Total team records:",
  nrow(existing),
  "\n"
)

cat(
  "Seasons failed:",
  length(failures),
  "\n"
)

cat(
  "Output:",
  OUTPUT_FILE,
  "\n"
)

cat(
  "Completion cache:",
  CACHE_FILE,
  "\n"
)

if (length(failures) > 0) {
  
  stop(
    "Team collection failed for seasons: ",
    paste(failures, collapse = ", "),
    call. = FALSE
  )
  
}

cat("OHL team collection complete.\n")