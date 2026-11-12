
# ============================================================
# ICEINDEX DATA ENGINE
# OHL SEASON COLLECTION
# Version: 0.8.0
# ============================================================
#
# PURPOSE:
#   Collect and maintain OHL season information
#   directly from the HockeyTech API.
#
# OUTPUT:
#   data/ohl/historical/seasons.csv
#
# RAW RESPONSE:
#   data/raw/ohl_seasons.json
#
# ============================================================


# ============================================================
# CONFIGURATION
# ============================================================

if (!exists("ICEINDEX_PATHS")) {
  stop("IceIndex configuration not loaded.")
}

OUTPUT_FILE <- ICEINDEX_PATHS$seasons

RAW_FILE <- file.path(
  ICEINDEX_PATHS$raw,
  "ohl_seasons.json"
)

CACHE_DAYS <- 7
FORCE_REFRESH <- FALSE


# ============================================================
# INITIALIZE
# ============================================================

cat("\n")
cat("==========================================\n")
cat("ICEINDEX: OHL SEASON COLLECTION\n")
cat("==========================================\n")

dir.create(
  dirname(OUTPUT_FILE),
  recursive = TRUE,
  showWarnings = FALSE
)

dir.create(
  dirname(RAW_FILE),
  recursive = TRUE,
  showWarnings = FALSE
)


# ============================================================
# CACHE CHECK
# ============================================================

use_cache <- FALSE
existing <- NULL
age <- NA_real_

if (file.exists(OUTPUT_FILE) && !FORCE_REFRESH) {
  
  existing <- tryCatch(
    read.csv(
      OUTPUT_FILE,
      colClasses = "character",
      stringsAsFactors = FALSE
    ),
    error = function(e) NULL
  )
  
  age <- as.numeric(
    difftime(
      Sys.time(),
      file.info(OUTPUT_FILE)$mtime,
      units = "days"
    )
  )
  
  if (!is.null(existing)) {
    
    use_cache <-
      is.finite(age) &&
      age < CACHE_DAYS &&
      nrow(existing) > 0 &&
      all(c("SeasonID", "Season") %in% names(existing)) &&
      !anyNA(existing$SeasonID) &&
      !anyDuplicated(existing$SeasonID)
    
  }
  
}


# ============================================================
# USE CACHE OR COLLECT DATA
# ============================================================

if (use_cache) {
  
  cat("Using cached seasons.\n")
  cat("Seasons:", nrow(existing), "\n")
  cat("Cache age:", round(age, 2), "days\n")
  
} else {
  
  if (!exists("iceindex_request", mode = "function")) {
    stop("IceIndex API client not loaded.")
  }
  
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    stop("Package 'jsonlite' is required.")
  }
  
  cat("Connecting to HockeyTech...\n")
  
  response <- iceindex_request(
    feed = "modulekit",
    view = "seasons"
  )
  
  
  # ==========================================================
  # SAVE RAW RESPONSE
  # ==========================================================
  
  jsonlite::write_json(
    response,
    RAW_FILE,
    pretty = TRUE,
    auto_unbox = TRUE,
    null = "null"
  )
  
  
  # ==========================================================
  # EXTRACT SEASON RECORDS
  # ==========================================================
  
  get_field <- function(record, fields) {
    
    for (field in fields) {
      
      value <- record[[field]]
      
      if (
        !is.null(value) &&
        length(value) == 1 &&
        !is.list(value) &&
        !is.na(value)
      ) {
        return(as.character(value))
      }
      
    }
    
    NA_character_
    
  }
  
  
  find_seasons <- function(node) {
    
    if (is.data.frame(node)) {
      
      node <- lapply(
        seq_len(nrow(node)),
        function(i) as.list(node[i, , drop = FALSE])
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
          
          id <- get_field(
            item,
            c("id", "season_id", "SeasonID")
          )
          
          name <- get_field(
            item,
            c("name", "season_name", "Season")
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
      
      result <- find_seasons(child)
      
      if (!is.null(result)) {
        return(result)
      }
      
    }
    
    NULL
    
  }
  
  
  # ==========================================================
  # BUILD SEASON DATASET
  # ==========================================================
  
  records <- find_seasons(response)
  
  if (is.null(records) || length(records) == 0) {
    stop("No recognizable season records.")
  }
  
  seasons <- do.call(
    rbind,
    lapply(records, function(item) {
      
      name <- get_field(
        item,
        c("name", "season_name", "Season")
      )
      
      playoff <- get_field(
        item,
        c("playoff", "is_playoff", "Playoff")
      )
      
      if (is.na(playoff)) {
        
        playoff <- ifelse(
          grepl("playoff", name, ignore.case = TRUE),
          "1",
          "0"
        )
        
      }
      
      data.frame(
        SeasonID = get_field(
          item,
          c("id", "season_id", "SeasonID")
        ),
        Season = name,
        ShortName = get_field(
          item,
          c("shortname", "short_name", "ShortName")
        ),
        Playoff = playoff,
        stringsAsFactors = FALSE
      )
      
    })
  )
  
  
  # ==========================================================
  # VALIDATE DATA
  # ==========================================================
  
  if (
    nrow(seasons) == 0 ||
    anyNA(seasons$SeasonID) ||
    anyDuplicated(seasons$SeasonID)
  ) {
    stop("Season validation failed.")
  }
  
  seasons <- seasons[
    order(
      suppressWarnings(
        as.integer(seasons$SeasonID)
      ),
      na.last = TRUE
    ),
    ,
    drop = FALSE
  ]
  
  rownames(seasons) <- NULL
  
  
  # ==========================================================
  # SAVE SEASON DATA
  # ==========================================================
  
  temp <- tempfile(
    tmpdir = dirname(OUTPUT_FILE),
    fileext = ".csv"
  )
  
  write.csv(
    seasons,
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
    
    stop("Failed to save seasons.csv.")
    
  }
  
  unlink(temp)
  
  cat("Season cache updated.\n")
  cat("Total seasons:", nrow(seasons), "\n")
  
}


# ============================================================
# COMPLETE
# ============================================================

cat("Output:", OUTPUT_FILE, "\n")
cat("Raw response:", RAW_FILE, "\n")
cat("OHL season collection complete.\n")