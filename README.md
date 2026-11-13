
# IceIndex

**Independent Hockey Data & Analytics**

IceIndex is an independent hockey statistics and analytics platform built to make junior hockey data accessible, organized, and easy to explore.

The project combines player statistics, historical records, game logs, interactive shot maps, and advanced analytics in a responsive web interface.

**Current Version:** v0.10.0  
**Primary League:** Ontario Hockey League (OHL)  
**Status:** Active Development  
**Developer:** Noah Cornish

**Website:** https://noahcornish.github.io/IceIndex/  
**Repository:** https://github.com/NoahCornish/IceIndex

---

## Overview

IceIndex is designed to provide a centralized destination for exploring hockey statistics across seasons, teams, and individual players.

The platform emphasizes:

- Independent data collection and processing
- Historical player statistics
- Interactive player profiles
- Detailed statistical comparisons
- Game-by-game performance analysis
- Shot and goal location visualization
- Advanced statistical metrics
- Mobile-friendly presentation

IceIndex is a standalone project with its own data-processing infrastructure, separate from OHLDataHub.

---

## Features

### Player Database

Explore OHL player statistics with searchable and sortable tables.

Features include:

- Player and team searches
- Regular-season and playoff statistics
- Season selection
- Historical player records
- Statistical sorting and filtering
- Customizable statistical columns

### Player Profiles

Individual player profiles combine career statistics and season-specific performance.

Available information includes:

- Player name, team, and photograph
- Career and season totals
- Games played, goals, assists, and points
- Points per game
- Shots and shooting percentage, where available
- Power-play production
- Penalty minutes
- Historical season breakdowns

### Interactive Shot Maps

Version 0.10.0 introduces interactive shot and goal location visualization.

Shot-map features include:

- Attacking-half rink visualization
- Individual shot and goal markers
- Separate marker colours for shots and goals
- Dots and Zones display modes
- Event-type filtering
- Period filtering
- Interactive event information panels
- Game information linked to available event records
- Responsive desktop and mobile interactions

**Shot-map coverage:** Currently focused on the 2026–27 OHL season.

Shot locations are derived from recorded game-event coordinates and transformed into a common attacking direction.

Events outside the displayed rink area are excluded from the visualization but retained in the underlying data.

Shot-map event details depend on the fields available in the source records.

### Player Game Logs

Explore individual player performances on a game-by-game basis.

Available features include:

- Game dates and opponents
- Home and away information
- Goals, assists, and points
- Shots, where recorded
- Penalty minutes
- Faceoff statistics, where available
- Game-level filtering and sorting

### Advanced Analytics

IceIndex includes tools for examining player performance beyond traditional counting statistics.

Metrics and visualizations include:

- Points per game
- Goals per game
- Assists per game
- Shots per game
- Shooting percentage
- Power-play production
- Statistical percentiles
- Radar charts
- Scatter plots
- Player comparisons
- Age and position cohorts

Advanced metrics depend on source-data availability and should not be interpreted as comprehensive tracking or expected-goals models.

### Team Explorer

Explore OHL teams and their associated player statistics.

### Draft Year Central

Review and compare players by draft-year cohorts.

---

## Day and Night Themes

IceIndex v0.10.0 includes an automatic day/night colour system.

| Time (Eastern) | Theme |
|---|---|
| 7:00 AM – 4:59 PM | Navy & Ice Blue |
| 5:00 PM – 6:59 AM | Amber & Graphite |

The daytime theme uses the original IceIndex blue palette.

The nighttime theme introduces warmer graphite, tan, and amber colours intended to reduce visual harshness during evening use.

A sun/moon control allows users to manually switch themes.

The schedule follows Eastern Time, including daylight saving time.

---

## Data Architecture

IceIndex maintains its own data files and processing workflows.

The platform uses:

- R for data collection, cleaning, and processing
- CSV files for processed datasets
- JavaScript for data loading and interactive visualizations
- HTML and CSS for the website
- GitHub for source control and publishing
- GitHub Actions for automated workflows

### Main Project Structure

```text
IceIndex/
|
|-- index.html
|-- cooling.html
|
|-- css/
|   |-- style.css
|   |-- style-night.css
|
|-- js/
|   |-- app.js
|   |-- ohl-data.js
|   |-- ohl-branding.js
|   |-- ohl-analytics.js
|   |-- ohl-goalies.js
|   |-- game-logs.js
|   |-- shot-map.js
|   |-- maintenance.js
|
|-- data/
|   |-- ohl/
|   |-- processed/
|   |-- games/
|
|-- scripts/
|   |-- games/
|
|-- .github/
|   |-- workflows/
|
|-- README.md
|-- CHANGELOG.md
```

The directory structure may evolve as additional leagues and datasets are introduced.

---

## Shot-Location Data

Shot maps use processed event-location data.

Current source:

`data/games/2026-27/player_shot_locations.csv`

The shot-map processing workflow:

1. Reads cached OHL game-event records.
2. Extracts recorded shot and goal events.
3. Associates events with players, teams, and games.
4. Retains original event coordinates.
5. Normalizes attacking direction for visualization.
6. Generates processed CSV output.
7. Displays events through the website.

The visualization is not a substitute for manually verified rink-tracking data.

Attacking direction and location normalization may involve inference where the source does not explicitly identify rink orientation.

---

## Data Availability and Limitations

IceIndex is an independent analytics project.

Data availability varies by season, competition, and statistical category.

Some limitations include:

- Historical coverage may be incomplete.
- Certain game-event fields may not be available.
- Shot locations depend on source-coordinate quality.
- Not all shot types have verified text descriptions.
- Goalie and assist details may be unavailable for individual events.
- Advanced tracking statistics are not available for every player.
- Historical shot-map coverage is still being developed.

Missing information is not intentionally replaced with estimated values presented as verified facts.

---

## Development Roadmap

Planned development priorities include:

- Expanded historical shot-map coverage
- Improved event-level metadata
- More detailed goalie and assist information
- Additional OHL seasons
- Expanded team analytics
- Improved mobile interactions
- Further statistical visualizations
- Automated historical data refreshes
- Additional hockey leagues

These features are development goals and are not guaranteed to be available in the current release.

---

## Maintenance

IceIndex includes a maintenance controller and a dedicated cooling page.

Maintenance scheduling and forced maintenance can be configured through the website's maintenance script.

During maintenance, the website may display a temporary cooling-down message while data processing or updates take place.

---

## Disclaimer

IceIndex is an independent hockey data project.

It is not officially affiliated with, endorsed by, or operated by the Ontario Hockey League, Canadian Hockey League, or their member teams.

Team names, logos, and other trademarks remain the property of their respective owners.

Statistics and event information are provided for informational and analytical purposes.

---

## Author

**Noah Cornish**

GitHub: https://github.com/NoahCornish

---

**IceIndex v0.10.0 — Independent Hockey Data & Analytics**
