# CHL Data Hub Phase 2 — convert an existing OHLDataHub skater CSV to website JSON.
# Run from CHLDataHub root:
# Rscript scripts/export_ohl_players.R /absolute/path/to/ohl_skaters.csv
# Optional second argument: season label, e.g. 2026-27
suppressPackageStartupMessages(library(jsonlite))
args <- commandArgs(trailingOnly=TRUE)
if (length(args) < 1L) stop('Usage: Rscript scripts/export_ohl_players.R /path/to/skater_stats.csv [2026-27]')
input <- args[[1]]
season <- if (length(args) >= 2L) args[[2]] else '2026-27'
if (!file.exists(input)) stop('Source CSV not found: ', input)
d <- read.csv(input, check.names=FALSE, stringsAsFactors=FALSE, fileEncoding='UTF-8-BOM')
if (!nrow(d)) stop('Source CSV is empty')
normalized <- tolower(gsub('[^a-z0-9]', '', names(d)))
getcol <- function(aliases, required=TRUE, default=NA) {
  ix <- match(tolower(gsub('[^a-z0-9]', '', aliases)), normalized)
  ix <- ix[!is.na(ix)]
  if (length(ix)) return(d[[ix[[1]]]])
  if (required) stop('Missing required field (one of: ', paste(aliases, collapse=', '), '). Available columns: ', paste(names(d),collapse=', '))
  rep(default, nrow(d))
}
name <- as.character(getcol(c('PlayerName','Player','FullName','Name','player_name')))
team <- as.character(getcol(c('TeamName','Team','team_name','Club')))
gp <- suppressWarnings(as.numeric(getcol(c('GP','GamesPlayed','Games','games_played'))))
g <- suppressWarnings(as.numeric(getcol(c('G','Goals'))))
a <- suppressWarnings(as.numeric(getcol(c('A','Assists'))))
shots <- suppressWarnings(as.numeric(getcol(c('SOG','Shots','ShotsOnGoal','shots_on_goal'),FALSE,NA)))
ids <- as.character(getcol(c('PlayerID','player_id','HockeyTechPlayerID','ID'),FALSE,''))
position <- as.character(getcol(c('Position','Pos','player_position'),FALSE,'F'))
age <- suppressWarnings(as.numeric(getcol(c('Age','PlayerAge'),FALSE,NA)))
# If source contains multiple seasons, filter explicitly; never silently mix seasons.
season_col <- getcol(c('Season','SeasonName','season_name'),FALSE,'')
if (any(nzchar(season_col)) && length(unique(season_col[nzchar(season_col)])) > 1L) {
  keep_season <- grepl(season, as.character(season_col), fixed=TRUE)
  if (!any(keep_season)) stop('Multiple seasons found, but none matches ', season, '. Filter the source first.')
} else keep_season <- rep(TRUE,nrow(d))
# Keep skaters; do not silently sum repeated player/team rows from different contexts.
keep <- keep_season & !is.na(gp) & gp > 0 & !is.na(g) & !is.na(a) & nzchar(trimws(name)) & nzchar(trimws(team)) & !toupper(position) %in% c('G','GK','GOALIE')
if (!any(keep)) stop('No valid skater rows after validation')
records <- data.frame(id=ids[keep],name=name[keep],team=team[keep],position=position[keep],age=age[keep],gp=gp[keep],g=g[keep],a=a[keep],shots=shots[keep],stringsAsFactors=FALSE)
records$id[!nzchar(records$id)] <- paste0('ohl-',seq_len(sum(!nzchar(records$id))))
if (anyDuplicated(records$id)) stop('Duplicate PlayerID values. Filter source to regular-season totals, one row per player (trades need combined totals).')
if (any(records$g < 0 | records$a < 0 | records$g > records$gp*8 | records$a > records$gp*12)) stop('Suspicious counting stats detected')
records <- records[order(-(records$g+records$a),records$name),]
meta <- list(league='OHL',season=season,source=paste('OHLDataHub CSV:',basename(input)),updated=format(Sys.time(),'%Y-%m-%dT%H:%M:%S%z'),isDemo=FALSE)
out <- list(meta=meta,players=lapply(seq_len(nrow(records)),function(i) as.list(records[i,])))
dir.create('data',showWarnings=FALSE)
write_json(out,'data/players.json',pretty=TRUE,auto_unbox=TRUE,na='null')
cat('Exported ',nrow(records),' skaters to data/players.json\n',sep='')
