
# ============================================================
# ICEINDEX DATA ENGINE
# HOCKEYTECH API CLIENT
# Version: 0.8.0
# ============================================================

# Requires scripts/config.R to be loaded first.

iceindex_request <- function(
    feed,
    view,
    params = list()
) {
  
  if (!requireNamespace("httr2", quietly = TRUE)) {
    stop("Package 'httr2' is required.")
  }
  
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    stop("Package 'jsonlite' is required.")
  }
  
  if (!is.list(params)) {
    stop("'params' must be a list.")
  }
  
  # ==========================================================
  # BUILD QUERY
  # ==========================================================
  
  query <- c(
    list(
      feed = feed,
      view = view,
      key = ICEINDEX_API$key,
      client_code = ICEINDEX_API$client_code,
      league_id = ICEINDEX_API$league_id,
      site_id = ICEINDEX_API$site_id,
      lang = ICEINDEX_API$language,
      fmt = "json"
    ),
    params
  )
  
  req <- httr2::request(
    ICEINDEX_API$base_url
  )
  
  req <- do.call(
    httr2::req_url_query,
    c(
      list(req),
      query
    )
  )
  
  req <- httr2::req_timeout(
    req,
    seconds = ICEINDEX_API$timeout
  )
  
  req <- httr2::req_retry(
    req,
    max_tries = ICEINDEX_API$retries
  )
  
  # ==========================================================
  # SEND REQUEST
  # ==========================================================
  
  response <- httr2::req_perform(req)
  
  body <- trimws(
    httr2::resp_body_string(response)
  )
  
  # ==========================================================
  # REMOVE JSONP WRAPPER WHEN PRESENT
  # ==========================================================
  
  if (
    !startsWith(body, "{") &&
    !startsWith(body, "[")
  ) {
    
    body <- sub(
      "^[[:space:]]*[A-Za-z_$][A-Za-z0-9_.$]*[[:space:]]*\\(",
      "",
      body
    )
    
    body <- sub(
      "\\)[[:space:]]*;?[[:space:]]*$",
      "",
      body
    )
  }
  
  # ==========================================================
  # PARSE JSON
  # ==========================================================
  
  result <- tryCatch(
    jsonlite::fromJSON(
      body,
      simplifyVector = FALSE
    ),
    error = function(e) {
      stop(
        "IceIndex API JSON parsing failed: ",
        conditionMessage(e)
      )
    }
  )
  
  result
}
