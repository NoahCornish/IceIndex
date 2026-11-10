
# IceIndex

### Ontario Hockey League Player Analytics

**Version 0.2.0 | Powered by OHLDataHub**

IceIndex is an independent Ontario Hockey League (OHL) statistics and player analytics website.

Built to make current and historical OHL player data accessible, searchable, and comparable through a fast, responsive interface.

IceIndex combines player statistics, career development, team information, and draft-year analysis in one platform.

---

## Features

### 1. League Overview

Explore the current OHL season through:

- Points, goals, and assists leaders
- Points-per-game rankings
- Player headshots
- Current-season production
- League-wide statistical summaries

### 2. Player Database

Search and filter OHL skater statistics by:

- Player name
- Team
- Season
- Statistical category

Supported sorting categories include:

- Points
- Goals
- Assists
- Games played
- Points per game

The database supports both current and historical seasons.

### 3. Player Profiles

Each player profile provides:

- Player headshot, when available
- Team and position
- Birthdate, when available
- Career games played
- Career goals, assists, and points
- Points per game
- Season-by-season history
- Production development
- Available advanced scoring statistics
- Season-specific production percentiles

Historical statistics depend on the completeness and availability of the underlying OHLDataHub records.

### 4. Player Comparisons

Compare two OHL players using:

- Career statistics
- Individual seasons
- Goals and assists
- Total points
- Points per game
- Power-play production
- Penalty minutes

Players can be compared across different OHL seasons.

### 5. Draft Year Central

Explore estimated NHL draft-year cohorts using player birthdates.

Includes:

- Draft-year selection
- Player search
- Points and goals rankings
- Points-per-game comparisons
- Current-season production

**Important:** Draft-year cohorts are estimates based on birthdate windows. They are not verified NHL Central Scouting eligibility lists.

### 6. Team Explorer

Browse all 20 current OHL teams.

Each team includes:

- Team name
- Team logo, when available
- Current skater count
- Direct access to the team's statistical records

Historical franchise names are also recognized by the branding engine.

---

## Mobile Experience

IceIndex v0.2.0 prioritizes mobile usability.

On smaller screens, the player database displays five essential columns:

| Player | GP | G | A | PTS |
|---|---:|---:|---:|---:|
| Player Name | 40 | 18 | 25 | 43 |

Additional mobile features include:

- Compact player headshots
- Condensed search and filter controls
- Reduced table spacing
- Responsive team cards
- Mobile navigation menu
- Touch-friendly player links
- Responsive comparison panels

Desktop users retain the expanded statistical table.

---

## Project Structure

```text
IceIndex/
│
├── index.html
├── README.md
├── CHANGELOG.md
│
├── css/
│   └── style.css
│
├── js/
│   ├── app.js
│   ├── ohl-data.js
│   └── ohl-branding.js
│
└── assets/
    └── iceindex-icon.svg
```

IceIndex is a static website built with HTML, CSS, and vanilla JavaScript.

No application server, database server, or JavaScript framework is required for the frontend.

---

## Data Source

IceIndex uses the OHLDataHub project.

**Repository:**

https://github.com/NoahCornish/OHLDataHub

The data engine reads publicly accessible CSV files from the repository.

### Current Season

```text
data/current/skaters.csv
```

### Player Directory

```text
data/player_directory.csv
```

The player directory is used to enrich player records with:

- HockeyTech PlayerID
- Player names
- Birthdates (BD)
- PhotoURL, when available

### Historical Seasons

Historical files are expected at:

```text
data/historical/YYYY-season/skaters.csv
```

For example:

```text
data/historical/2025-season/skaters.csv
data/historical/2026-season/skaters.csv
```

The year in the folder name represents the season's ending year.

### Optional Prebuilt Archive

The data engine can attempt to load:

```text
data/iceindex/archive.json
```

If a compatible archive is available, it can reduce the number of historical CSV requests.

Otherwise, IceIndex falls back to individual historical season files.

---

## Data Loading

IceIndex uses two loading stages.

### Stage 1 — Current Season

The application requests:

1. Current-season skater statistics
2. Player directory information

These requests begin concurrently.

Once current-season records are normalized, the website can display current player statistics.

### Stage 2 — Historical Archive

Historical data loads in the background.

This allows visitors to use current-season features while older seasons are being retrieved.

When the archive finishes loading, IceIndex updates its historical player records.

### Performance

The target is a responsive experience with current-season statistics available as quickly as possible.

Actual loading time depends on:

- Network connection
- GitHub raw-content response times
- CSV sizes
- Browser performance
- Historical archive availability

**A loading time under five seconds is a performance target, not a guaranteed result.**

A future optimized data pipeline should use compact, precomputed historical records and measured browser performance.

---

## Player Identity and Headshots

IceIndex attempts to resolve player identity using:

1. HockeyTech PlayerID
2. Normalized player name and birthdate
3. Unique player-name matching when unambiguous

The player directory may contain the following fields:

```text
PlayerID
Name
BD
PhotoURL
```

### Headshot Fallback

When a usable PhotoURL is unavailable, IceIndex constructs a HockeyTech image URL:

```text
https://assets.leaguestat.com/ohl/240x240/PLAYERID.jpg
```

If the image cannot be loaded, the interface displays the player's initials.

This prevents missing images from breaking the page layout.

---

## Installation

### Option A — GitHub

1. Create or open your GitHub repository.
2. Upload the IceIndex files.
3. Preserve the folder structure.
4. Commit the changes.
5. Enable GitHub Pages.

### Option B — Visual Studio Code

Clone the repository:

```bash
git clone https://github.com/NoahCornish/OHLDataHub.git
```

Open the repository in Visual Studio Code.

Edit the required website files.

Commit and push the changes through Source Control.

### Local Development

For local testing, use a local HTTP server rather than opening index.html directly with the file:// protocol.

For example:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

The site requires an internet connection to retrieve remote OHL data.

---

## GitHub Pages Deployment

If IceIndex is hosted in the OHLDataHub repository:

1. Open the repository on GitHub.
2. Select Settings.
3. Select Pages.
4. Choose the deployment source.
5. Select the appropriate branch and website folder.
6. Save the configuration.

If the site files are stored in the repository root, choose the root directory.

If the files are stored in a docs folder, choose /docs.

GitHub Pages will publish the static website.

---

## Updating OHL Statistics

Current-season data is maintained through OHLDataHub.

The master updater script is:

```text
scripts/updated_current_data.R
```

The existing GitHub Actions workflow can continue updating the CSV data independently of IceIndex's frontend.

### New OHL Seasons

When a new season begins:

1. Ensure the current CSV contains the new season.
2. Confirm the player directory includes new PlayerIDs.
3. Verify the previous season is preserved in the historical archive.
4. Confirm historical folder names use the ending year.
5. Review the frontend's current-season detection.
6. Test player profiles and career totals.

### Playoffs

Playoff statistics should be stored and identified separately from regular-season statistics.

The v0.2.0 frontend is designed around skater regular-season data.

**Playoff statistics are not yet implemented as a separate supported database view.**

---

## Technical Architecture

### index.html

Defines the page structure, navigation, loading popup, and application containers.

### css/style.css

Controls the visual design, responsive layouts, compact mobile tables, and loading popup.

### js/app.js

Manages:

- Application state
- Page navigation
- Player database
- Player profiles
- Career statistics
- Player comparisons
- Draft-year analysis
- Team Explorer
- Mobile navigation
- Loading popup

### js/ohl-data.js

Manages:

- Remote CSV requests
- CSV parsing
- Player directory matching
- PlayerID resolution
- Birthdate normalization
- Headshot URLs
- Historical data loading
- Shared request caching
- Archive progress

### js/ohl-branding.js

Manages:

- Current OHL teams
- Historical team aliases
- Team abbreviations
- Logo URLs
- Franchise history lookups
- Logo fallbacks

---

## Development Roadmap

### v0.2.x — Stability and Performance

- Validate all team logo URLs
- Improve mobile density
- Test historical career aggregation
- Improve traded-player season totals
- Optimize archive loading
- Measure initial page load times
- Improve missing-data handling

### v0.3.0 — Expanded Analytics

- Additional scoring statistics
- Position-specific leaderboards
- Advanced player comparisons
- Player development trends
- Better historical percentile calculations
- Improved team-level statistics

### v0.4.0 — Scouting Tools

- Draft-year leaderboards
- Age-adjusted production
- Statistical player similarity
- Season-over-season development
- Exportable player reports

### Future Releases

- Dedicated playoff database
- Goaltender statistics
- Team historical records
- Advanced scouting dashboards
- Precomputed career statistics
- Optimized historical data delivery

These are planned features, not existing v0.2.0 capabilities.

---

## Data Accuracy

IceIndex presents statistics from the underlying OHLDataHub datasets.

Statistical accuracy depends on the source data and the frontend's aggregation rules.

Known considerations include:

- Players traded between teams
- Duplicate season records
- Missing historical PlayerIDs
- Incomplete birthdates
- Missing headshots
- Unavailable historical CSV files
- Different statistical fields across seasons

Career totals should be independently verified before being used for formal scouting or personnel decisions.

---

## Disclaimer

IceIndex is an independent hockey statistics project.

It is not an official website of the Ontario Hockey League, Canadian Hockey League, or National Hockey League.

League names, team names, and logos belong to their respective owners.

Data is provided for informational and analytical purposes.

---

## Project Information

**Project:** IceIndex  
**Version:** 0.2.0  
**League:** Ontario Hockey League  
**Data:** OHLDataHub  
**Repository:** https://github.com/NoahCornish/OHLDataHub  
**Technology:** HTML, CSS, JavaScript, CSV  
**Status:** Active development

---

Built for people who want to understand OHL hockey beyond the box score.