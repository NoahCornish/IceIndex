
# IceIndex

**IceIndex** is an Ontario Hockey League (OHL) statistics and data project combining a browser-based hockey research website with an R-powered data collection and processing pipeline.

**Current release: v0.6.0**

**Website:** https://noahcornish.github.io/IceIndex/  
**Repository:** https://github.com/NoahCornish/IceIndex

## Overview

IceIndex is designed to make OHL player statistics easier to explore, compare, and maintain. The project has two related components:

- **Website:** A GitHub Pages interface for exploring hockey data, including player statistics and historical comparisons.
- **Data engine:** R scripts that collect OHL source data, maintain current and historical datasets, build processed player and goalie tables, and perform data-quality checks.

In **v0.6.0**, the R data engine maintains IceIndex's own OHL datasets. The production website's transition from its legacy OHLDataHub data source to those datasets is planned as a separate **v0.7.0** milestone.

## v0.6.0 Highlights

- Automated OHL season, team, roster, skater-statistics, and goalie-statistics collection.
- Separate current-season and historical data storage.
- Processed skater and goalie directories, season records, career records, and team histories.
- Player identity checks, duplicate detection, and career-statistic reconciliation.
- Central refresh orchestration through `scripts/refresh.R`.
- CSV health checks and a persistent refresh log.

### Database Snapshot

The following counts are from a successful local refresh on **November 11, 2026**. They describe that run, not a live count guaranteed to remain unchanged.

| Dataset | Skaters | Goalies |
|---|---:|---:|
| Directory profiles | 8,132 | 662 |
| Processed season records | 25,081 | 2,305 |
| Career records | 10,122 | 1,037 |
| Team-history records | 25,081 | 2,305 |

The same refresh collected **516 current-season skater records** and **52 current-season goalie records**. Its six registered tasks completed successfully, with no critical CSV issues reported.

> **Data scope:** Processed records can contain different competitions, including regular season and playoffs. Do not combine them without filtering the relevant competition field. Dataset counts may change after refreshes or historical corrections.

## Repository Structure

```text
IceIndex/
├── assets/                       # Website images and other assets
├── css/                          # Website styles
├── data/
│   ├── audits/                   # Quality-control and audit outputs
│   ├── clean/                    # Cleaned source datasets
│   ├── ohl/
│   │   ├── current/              # Current OHL statistics
│   │   ├── historical/           # Historical OHL datasets
│   │   └── metadata/             # Collection status and refresh logs
│   ├── processed/
│   │   └── ohl/                   # Analytical tables
│   └── raw/                      # Raw source responses
├── js/                           # Website JavaScript
├── scripts/
│   ├── config.R                   # Shared R configuration
│   ├── api_client.R               # API helpers
│   ├── refresh.R                  # Master refresh script
│   ├── league/ohl/                # OHL data collectors
│   └── processing/                # Skater and goalie processing
├── index.html                     # Website entry point
├── README.md
└── CHANGELOG.md
```

## Data Collection and Processing

The master refresh runs the following stages:

1. Collect OHL seasons.
2. Collect OHL teams.
3. Collect OHL player rosters.
4. Collect current and historical skater statistics.
5. Collect current and historical goalie statistics.
6. Build and validate processed skater and goalie databases.
7. Inspect stored CSV files and record refresh results.

The collector scripts are located in `scripts/league/ohl/`. The processed database is built by scripts in `scripts/processing/`, including `ohl_players.R`, `ohl_goalies.R`, and `ohl_process_all.R`.

### Run a Local Refresh

From R or RStudio, with the project available locally:

```r
setwd("~/IceIndex")
source("scripts/refresh.R")
```

The project requires R and the packages used by its collector and processing scripts. Review `scripts/config.R` and the relevant script imports for the dependencies and configuration required by your checkout. Source access and network availability may affect collection.

**Refresh results:** `data/ohl/metadata/refresh_log.csv` records execution history. Collector-specific metadata files track completed work and failed requests.

## Key Processed Datasets

| File | Purpose |
|---|---|
| `data/processed/ohl/player_directory.csv` | Skater identities and profile information |
| `data/processed/ohl/player_seasons.csv` | Skater statistics by season and competition |
| `data/processed/ohl/player_career.csv` | Aggregated skater career statistics |
| `data/processed/ohl/player_teams.csv` | Skater team-history records |
| `data/processed/ohl/goalie_directory.csv` | Goalie identities and profile information |
| `data/processed/ohl/goalie_seasons.csv` | Goalie statistics by season and competition |
| `data/processed/ohl/goalie_career.csv` | Aggregated goalie career statistics |
| `data/processed/ohl/goalie_teams.csv` | Goalie team-history records |

Current-season source files include `data/ohl/current/skater_stats.csv` and `data/ohl/current/goalie_stats.csv`.

### Data-Quality Principles

IceIndex distinguishes between **critical data failures** and **expected missing values**. Optional biographical fields and intentionally empty audit reports should not, by themselves, cause a failed refresh. Processing validates important identities and statistical reconciliations before publishing processed tables.

A successful refresh does **not** imply that every optional statistic is available. For example, the November 11, 2026 run reported that goalie career save percentage could not be calculated from the available `Saves` / `ShotsAgainst` fields; career goals-against average was calculated.

## Website

The site is hosted through GitHub Pages:

**https://noahcornish.github.io/IceIndex/**

The browser-side data interface is implemented in `js/ohl-data.js`, which exposes functions including:

```javascript
loadOHLCurrent();
loadOHLHistory(progressCallback);
IceIndexData.inspect();
```

**Release boundary:** The production website's data-source migration to IceIndex's own processed CSVs is targeted for **v0.7.0**. Testing that change locally does not make it part of the v0.6.0 release.

## Roadmap

### v0.7.0 — Independent Website Data Source

- Switch website data loading from the legacy OHLDataHub paths to IceIndex's own datasets.
- Verify field compatibility, player identities, headshots, season labels, and regular-season/playoff separation.
- Test the website's existing views and interactions before release.

### Future Development

Potential areas include richer goalie views, playoff exploration, expanded analytics, and additional data-quality reporting. These are ideas, not committed release features.

## Project Status

IceIndex is under active development. Statistics and historical records are subject to corrections, missing source fields, and future updates. Verify important figures against authoritative league records before relying on them for publication or analysis.

## Maintainer

Developed by [Noah Cornish](https://github.com/NoahCornish).

See [CHANGELOG.md](CHANGELOG.md) for release history.