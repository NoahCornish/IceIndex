
# IceIndex 🏒

**Hockey Data Intelligence | v0.8.0 Release Candidate**

*Every player. Every league. One index.*

IceIndex is an independent hockey statistics and analytics platform. It combines a responsive, browser-based research interface with an R-powered data collection and processing pipeline.

**The Ontario Hockey League (OHL) is the currently supported league.** Expansion to other junior hockey leagues is a longer-term goal.

- **Website:** https://noahcornish.github.io/IceIndex/
- **Repository:** https://github.com/NoahCornish/IceIndex
- **Release status:** v0.8.0 prepared for release; verify deployment before describing it as the live version.

---

## What's New in v0.8.0

### Advanced OHL Statistics Database

A dedicated, compact statistics workspace for exploring OHL skater performance.

Features include:

- Season, competition (regular season/playoffs), team, position, player search, and games-played filters.
- Customizable visible statistical columns and additional value filters.
- Sortable statistics and league rankings.
- Player headshots, team abbreviations, and links to player profiles.
- Compact mobile table with sticky rank, player name, and team columns.
- Horizontal scrolling for additional statistics.
- CSV export of filtered statistics.
- Statistical columns displayed only where supported by the underlying dataset.

The Statistics Database is designed to make detailed OHL statistical research accessible on both desktop and mobile devices.

### GM Player Comparison — 2 to 4 Players

A scouting-oriented workspace for comparing **two, three, or four OHL players** simultaneously.

Features include:

- Independent player, season, and regular-season/playoff selection.
- Season-alignment control to support like-for-like comparisons when relevant records exist.
- Player summary cards featuring headshots, games played, goals, points, and points per game.
- Side-by-side statistical comparison matrix.
- Statistical category filters and rate-only comparisons.
- League percentile rankings with selectable minimum-games-played thresholds.
- Peer-group comparisons against all skaters or forwards/defencemen where position data permits.
- Highlighted statistical leaders.
- CSV export and comparison-link controls.
- Responsive layouts for desktop scouting analysis and mobile access.

**Statistical interpretation:** Percentiles compare a player's performance with qualifying skaters in the selected season, competition, and peer group. They are descriptive statistical rankings, not scouting grades or projections.

Career totals do not receive single-season percentiles. Comparisons involving different seasons, competitions, or career totals should be interpreted carefully.

### Player Discovery and Profiles

IceIndex provides an integrated player research experience.

- Global OHL player search.
- Searchable historical player database.
- Individual player profiles with headshots where available.
- Regular-season and playoff statistics.
- Season-by-season career histories.
- Historical team information.
- Career statistical highlights.
- Season-specific OHL rankings.
- Player comparison and analytics tools.
- Draft Year Central navigation.

### Additional OHL Tools

IceIndex also includes:

- OHL overview dashboard and statistical leaderboards.
- Team exploration tools.
- Goaltender database and individual goalie profiles.
- Goaltender comparison and historical statistics.
- Existing analytics views and visualizations.

---

## Data Platform

IceIndex maintains its **own OHL datasets** through R-based data collectors and processing scripts.

The website uses JavaScript data-loading modules to serve its OHL statistical views.

IceIndex is a standalone project and operates independently from OHLDataHub.

The data workflow covers:

- OHL seasons and teams.
- Team rosters.
- Skater statistics.
- Goaltender statistics.
- Historical player records.
- Season and career statistical tables.
- Player and goaltender directories.
- Data validation and refresh monitoring.

GitHub Actions supports automated and manual data refreshes.

### Refreshing Data Locally

From the IceIndex repository root in R or RStudio:

```r
source("scripts/refresh.R")
```

The project requires R and the dependencies referenced in its collection and processing scripts.

Review `scripts/config.R` and the relevant script imports before running a refresh.

Data availability and source access can affect results.

### Main Datasets

| Dataset | Purpose |
|---|---|
| `data/processed/ohl/player_directory.csv` | Player identities and profile information |
| `data/processed/ohl/player_seasons.csv` | Season- and competition-level skater statistics |
| `data/processed/ohl/player_career.csv` | Aggregated skater career records |
| `data/processed/ohl/player_teams.csv` | Player team histories |
| `data/processed/ohl/goalie_directory.csv` | Goaltender identities |
| `data/processed/ohl/goalie_seasons.csv` | Goaltender season records |
| `data/processed/ohl/goalie_career.csv` | Goaltender career records |
| `data/processed/ohl/goalie_teams.csv` | Goaltender team histories |
| `data/ohl/metadata/last_updated.json` | Successful refresh timestamp |
| `data/ohl/metadata/refresh_log.csv` | Refresh history |

**Data note:** Available statistics vary by source, season, and competition. Some advanced metrics may be unavailable.

Statistics may change following data refreshes or corrections. Regular-season and playoff records should be analyzed separately.

---

## Technology

IceIndex uses a lightweight technology stack designed for maintainability and automated operation.

**Frontend**
- HTML5
- CSS3
- Vanilla JavaScript
- GitHub Pages

**Data Processing**
- R
- CSV and JSON datasets
- Automated collection and processing scripts

**Automation**
- GitHub Actions
- Scheduled and manual data refreshes
- Validation and refresh logging

---

## Repository Structure

```text
IceIndex/
├── .github/workflows/          # Automated refresh workflows
├── assets/                     # Site assets
├── css/
│   └── style.css               # Responsive styling
├── data/                       # Raw, historical and processed data
├── js/
│   ├── app.js                  # Site routes and interfaces
│   ├── ohl-data.js             # OHL data loading
│   ├── ohl-branding.js         # Team branding
│   ├── ohl-analytics.js        # Analytics
│   └── ohl-goalies.js          # Goaltender support
├── scripts/
│   ├── config.R
│   ├── refresh.R               # Master refresh orchestration
│   ├── league/ohl/             # OHL data collectors
│   └── processing/             # Processed datasets
├── index.html
├── cooling.html                # Maintenance view
├── README.md
└── CHANGELOG.md
```

---

## Release Checklist — v0.8.0

Before publishing the release:

- [ ] Confirm all v0.8.0 frontend files and version labels are synchronized.
- [ ] Test player selection with two, three, and four players.
- [ ] Verify season alignment and regular-season/playoff separation.
- [ ] Validate percentile calculations against source records.
- [ ] Test CSV exports and comparison URLs in a fresh browser session.
- [ ] Check sticky statistics columns and full player-name readability on mobile.
- [ ] Verify automated refreshes and the last-updated timestamp.
- [ ] Confirm GitHub Pages is serving the intended release files.

---

## Development Roadmap

Future development opportunities include:

- Additional validated scouting metrics.
- Team-strength and league-context analysis.
- Expanded historical records and statistical documentation.
- Player development tracking.
- Game-level statistics and analysis.
- Expanded data-quality reporting.
- WHL and QMJHL support when reliable independent data collection becomes available.

These are potential development directions rather than confirmed release commitments.

---

## Disclaimer

IceIndex is an independent hockey analytics project and is not affiliated with or endorsed by the Ontario Hockey League, Canadian Hockey League, or their member teams.

Team names, logos, and trademarks remain the property of their respective owners.

Statistics and rankings depend on the completeness and accuracy of the underlying source data. Consequential figures should be verified against authoritative records.

---

## Maintainer

Developed by [Noah Cornish](https://github.com/NoahCornish).

See [CHANGELOG.md](CHANGELOG.md) for release history.

---

*Built for the game. Powered by data.*