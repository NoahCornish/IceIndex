# IceIndex 🏒

**IceIndex is an independent Ontario Hockey League (OHL) statistics and player analytics platform.**

Built to make OHL data easier to explore, compare, and understand, IceIndex brings together player statistics, historical performance, draft-year development, team information, and analytical tools in a clean, mobile-friendly interface.

**Current Version:** v0.9.0  
**League:** Ontario Hockey League (OHL)  
**Developer:** Noah Cornish  
**Status:** Active Development

### 🌐 Website

**[Launch IceIndex](https://noahcornish.github.io/IceIndex/)**

---

## About IceIndex

IceIndex is designed for hockey fans, analysts, scouts, researchers, and anyone interested in exploring OHL player performance.

The platform combines traditional hockey statistics with player development analysis and interactive comparison tools.

Rather than simply displaying season totals, IceIndex helps users examine how players perform, how their production changes between seasons, and how their statistics compare with other players.

IceIndex is a standalone project, separate from OHLDataHub.

## Features

### 📊 OHL Statistics Database

Explore OHL player statistics across supported seasons and competitions.

Features include:

- Searchable player statistics.
- Season and competition selection.
- Team and position filtering.
- Customizable statistical columns.
- Sorting by available statistics.
- Minimum-games-played filtering.
- Advanced statistical filters.
- Ascending and descending sorting.
- CSV export.
- Direct access to player profiles.
- Dedicated goalie statistics.

The statistics interface uses compact primary filters, with additional options available through expandable controls.

### 👤 Player Profiles

Individual player profiles provide a detailed view of OHL performance.

Profiles include:

- Player identification and available biographical information.
- Team and season information.
- Historical season statistics.
- Career production.
- Advanced statistical analysis.
- Player development tracking.
- Draft-year season labels.
- Season-specific statistical selection.

Player profiles are designed to support both quick statistical lookups and more detailed performance analysis.

### 📈 Advanced Player Analytics

IceIndex calculates advanced metrics using available recorded statistics.

Supported calculations include:

- Points per game (PPG).
- Goals per game (GPG).
- Assists per game (APG).
- Shots per game (SPG).
- Shooting percentage (SH%).
- Goals-to-assists ratio.
- Points per shot.
- League percentile rankings.
- Position-specific percentile comparisons.
- Age-adjusted production where sufficient data is available.

Advanced analytics are integrated into Player Profiles and Player Compare rather than creating a separate analytics page.

**IceIndex does not calculate per-60 statistics or estimated ice-time metrics because reliable player ice-time data is not currently available.**

Metrics requiring unavailable source data are treated as unavailable rather than estimated.

### 📉 Player Development Tracker

The Player Development Tracker allows users to examine statistical progression across multiple OHL seasons.

Features include:

- User-selectable development metrics.
- Historical season-by-season charts.
- Regular-season and draft-year labeling.
- Season-over-season statistical changes.
- Selected-season highlighting.
- Support for available goals, assists, points, shots, shooting percentages, and other trackable statistics.
- Consolidation of multiple team stints within a season to avoid double-counting.

Available metrics depend on the underlying dataset.

#### Draft-Year Tracking

IceIndex supports draft-year-based development labels:

| Label | Meaning |
|---|---|
| DY−2 | Two seasons before draft year |
| DY−1 | One season before draft year |
| DY | Draft-year season |
| DY+1 | First season after draft year |
| DY+2 | Second season after draft year |

Draft-year labels are also included in player season selectors.

These labels provide an alternative way to evaluate development relative to NHL draft eligibility.

### ⚖️ Player Compare

Compare two to four OHL players using the existing comparison interface.

Features include:

- Side-by-side player statistics.
- Advanced performance metrics.
- Visual statistical comparisons.
- Percentile-based analysis.
- Historical season selection.
- CSV export.
- Shareable comparisons.

The comparison tools are designed to make differences in production easier to identify without relying exclusively on raw season totals.

### 🏒 Team Information

Explore OHL teams and their associated player statistics through the existing team interfaces.

Team information connects users with relevant player records and available season data.

### 🎯 Draft Year Central

IceIndex includes draft-oriented tools for examining players through the context of NHL draft eligibility.

Draft-year analysis supports prospect research and comparisons across player development stages.

### 🔍 Player Search

Search the available player directory and open individual player profiles.

IceIndex uses player identifiers to connect records across supported datasets and seasons.

### 🏠 Overview Dashboard

The Overview dashboard is the default IceIndex landing page.

It provides a condensed introduction to available league information, player production, and statistics.

The interface is designed to minimize unnecessary scrolling, particularly on mobile devices.

The previous Home page is deactivated, with its code retained for potential future use.

---

## Mobile-First Design

IceIndex is designed to work across desktop computers, tablets, and mobile devices.

Interface features include:

- Responsive layouts.
- Compact statistics controls.
- Expandable advanced filters.
- Mobile-friendly navigation.
- Horizontal scrolling for wide statistical tables.
- Customizable columns.
- Condensed Overview layout.
- Responsive player analytics.
- Compact player development controls.

Player names are abbreviated in the main statistics tables to improve readability on smaller screens. Full names remain available in player profiles, search, and relevant interface elements.

## Data Sources

IceIndex uses OHL statistical information collected and processed through its own data pipeline.

The project uses the **[OHLpkg R package](https://github.com/NoahCornish/OHLpkg)** for supported OHL data retrieval operations.

OHLpkg is maintained separately and provides functions for accessing OHL information through supported HockeyTech data feeds.

IceIndex maintains its own processed data files and automated refresh workflows rather than relying on another website repository to supply its datasets.

### Data Updates

IceIndex uses R scripts and GitHub Actions to support automated data updates.

The project includes:

- Central refresh orchestration.
- Configuration management.
- Data retrieval and processing.
- Processed CSV datasets.
- Refresh metadata.
- Scheduled GitHub Actions workflows.

The website includes a data-status indicator that provides information about the latest recorded refresh.

This indicator represents **data freshness and refresh status**, not website uptime.

### Data Accuracy

IceIndex aims to preserve the accuracy of its source statistics.

Important considerations:

- Statistical availability varies by season and competition.
- Some advanced metrics require fields that may not exist in every dataset.
- Missing statistics should not be interpreted as zero.
- Percentile comparisons depend on the selected comparison population.
- Draft-year labels depend on available player information and eligibility calculations.
- Historical data may be corrected or updated by its original provider.

IceIndex is an independent analytics project and is not an official OHL website.

---

## Technology

IceIndex uses a lightweight static website architecture.

| Component | Technology |
|---|---|
| Frontend | HTML5 |
| Styling | CSS3 |
| Interactivity | JavaScript |
| Data collection | R |
| OHL data retrieval | OHLpkg |
| Data storage | CSV and JSON |
| Automation | GitHub Actions |
| Hosting | GitHub Pages |
| Version control | Git and GitHub |

This architecture allows the website to operate without requiring a continuously running application server.

## Repository

**[GitHub — NoahCornish/IceIndex](https://github.com/NoahCornish/IceIndex)**

The repository contains the IceIndex website, supporting scripts, processed datasets, and automation workflows.

Key project components include:

- `index.html` — Main website entry point.
- `css/style.css` — Website styling and responsive layouts.
- `js/app.js` — Interface logic and statistical visualizations.
- `scripts/` — Data processing and update scripts.
- `scripts/refresh.R` — Central refresh orchestration.
- `scripts/config.R` — Shared configuration.
- `data/` — Stored and processed statistical datasets.
- `.github/workflows/` — Automated GitHub Actions workflows.

## Development Roadmap

### v0.9.0 — Player Analytics and Development

- Advanced player statistics.
- Expanded player comparison tools.
- Customizable player development tracking.
- Draft-year season labels.
- Condensed Overview dashboard.
- Improved mobile statistics controls.
- Data refresh-status information.

### Future — Game-Level Analytics

Planned development includes:

- Individual game results.
- Player game logs.
- Opponent-based statistical filtering.
- Home and away splits.
- Game-by-game production.
- Even-strength and special-teams analysis.
- Historical game data collection.
- Shot-location tracking and visualizations where reliable coordinates are available.

Game-level analytics are **not included in v0.9.0**.

### Long-Term Vision

The long-term goal is to develop IceIndex into a comprehensive OHL research platform that combines historical player statistics, draft-year development, game-level performance, and event-based analytics.

---

## Version History

See [CHANGELOG.md](CHANGELOG.md) for detailed release information.

**Current release: v0.9.0**

## Developer

Developed and maintained by **Noah Cornish**.

- [GitHub Profile](https://github.com/NoahCornish)
- [IceIndex Website](https://noahcornish.github.io/IceIndex/)

---

**IceIndex — Explore the numbers behind OHL hockey.**