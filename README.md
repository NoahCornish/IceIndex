# 🏒 IceIndex

### Hockey Data Intelligence

**Every player. Every league. One index.**

IceIndex is an independent, mobile-first junior hockey statistics and analytics platform designed to make player data, game results, advanced statistics, and scouting information easier to explore.

Built with a focus on speed, accessibility, and detailed hockey analysis, IceIndex brings multiple statistical tools together in one place.

**Current Release:** v0.11.0  
**Status:** Active Development  
**Primary League:** Ontario Hockey League (OHL)

### 🌐 Visit IceIndex

**[Launch IceIndex](https://noahcornish.github.io/IceIndex/)**

---

## Supported Leagues

| League | Status |
|---|---|
| Ontario Hockey League (OHL) | Available |
| Western Hockey League (WHL) | Beta Coming Soon |
| Quebec Maritimes Junior Hockey League (QMJHL) | Beta Coming Soon |

The OHL is the first fully supported league.

WHL and QMJHL currently feature dedicated preview homepages. Their statistical databases, player profiles, and additional features are planned for future beta releases.

---

## Features

### 🏒 OHL Game Centre

Explore individual games throughout the OHL season.

- Daily schedules and results
- Live, upcoming, and completed game listings where supported by available data
- Team logos, scores, and game information
- Detailed game summaries
- Scoring plays and assists
- Period-by-period statistics
- Interactive shot maps
- Goaltender statistics
- Player box scores
- Penalty summaries
- Three Stars
- Clickable player names linking to IceIndex player profiles

Game Centre includes team, date, game-status, and search filters.

The default date automatically changes at **10:45 AM Eastern Time**, allowing morning visitors to review the previous day's games before switching to the current schedule.

### 📊 Player Database

Browse OHL player statistics across available seasons.

Features include:

- Player statistics and career information
- Team and season filtering
- Sortable statistical tables
- Historical player records
- Compact mobile-friendly presentation

### 👤 Player Profiles

Explore individual players through dedicated statistical profiles.

- Player information and headshots where available
- Season-by-season statistics
- Career totals
- Historical performance
- Statistical trends
- Regular-season and playoff data where available

Player profiles are connected to other parts of the platform, including Game Centre.

### ⚖️ Player Comparison

Compare OHL players using statistical performance data.

- Side-by-side comparisons
- Season and career statistics
- Multiple comparison metrics
- Player-specific statistical breakdowns

### 🎯 Draft Year Central

Explore players by draft-year eligibility and statistical performance.

### 🧤 Goaltender Database

Explore OHL goaltenders through dedicated statistics and profiles.

- Goaltender database
- Goaltender profiles
- Goaltender comparison tools

### 📈 Player Analytics

IceIndex includes tools for exploring performance beyond traditional counting statistics.

- Player percentile rankings
- Radar charts
- Statistical comparisons
- Scatter plot visualizations
- Age and position analysis
- Downloadable player cards

### 🏟️ Team Explorer

Explore OHL teams, rosters, and statistical information.

---

## Multi-League Development

IceIndex is being developed as a multi-league platform.

The league selector currently supports:

- OHL — Full platform
- WHL — Beta preview
- QMJHL — Beta preview

The long-term goal is to create a consistent statistical experience across Canadian major junior hockey.

Each league will eventually have its own databases, player profiles, game information, and analytics while sharing the IceIndex interface.

---

## Data Engine

IceIndex uses a custom R-based data collection and processing system.

The data engine is responsible for:

1. Collecting available hockey data
2. Processing player and team statistics
3. Generating player game logs
4. Processing shot locations and game events
5. Collecting official game summaries
6. Exporting website-ready CSV datasets
7. Validating statistical records
8. Maintaining refresh logs and system health reports

The central orchestration script is:

`scripts/refresh.R`

Official Game Centre processing uses:

- `scripts/games/collect_game_summaries.R`
- `scripts/games/build_official_game_data.R`

The refresh system supports compact console reporting, task execution summaries, CSV quality checks, and detailed diagnostic logs.

### Official Game Centre Data

The Game Centre uses processed datasets covering:

- Game metadata
- Team statistics
- Period statistics
- Scoring plays
- Players on ice for goals
- Goaltender statistics
- Skater statistics
- Penalties
- Three Stars
- Game officials

Data availability depends on the underlying source and whether a game has been played.

---

## Technology

| Component | Technology |
|---|---|
| Website | HTML5 |
| Styling | CSS3 |
| Application | JavaScript |
| Data Collection | R |
| Data Processing | R |
| Data Storage | CSV and JSON |
| Version Control | Git and GitHub |
| Hosting | GitHub Pages |
| Automation | GitHub Actions |

IceIndex is a standalone website, not an R Shiny application.

The frontend is designed to work with processed static data files, allowing the site to be hosted on GitHub Pages.

---

## Project Structure

```text
IceIndex/
├── index.html
├── assets/
│   └── branding/
├── css/
│   ├── style.css
│   ├── style-night.css
│   └── game-centre.css
├── js/
│   ├── app.js
│   ├── game-centre.js
│   └── ...
├── scripts/
│   ├── refresh.R
│   └── games/
├── data/
├── logs/
├── README.md
└── CHANGELOG.md
```

Additional scripts and directories support historical data collection, processing, and validation.

---

## Design Philosophy

IceIndex is built around five priorities:

**1. Mobile First**  
Statistics and navigation should remain usable on phones without unnecessary horizontal scrolling.

**2. Fast Access**  
Visitors should be able to reach player information and game statistics quickly.

**3. Connected Data**  
Players, games, teams, and analytics should link together naturally.

**4. Historical Depth**  
Historical records are an important part of understanding player development.

**5. Independent Infrastructure**  
IceIndex aims to collect, process, and maintain its own datasets.

---

## Development Roadmap

Future development priorities include:

- WHL beta integration
- QMJHL beta integration
- Expanded historical databases
- Additional player analytics
- Improved cross-league comparisons
- Further Game Centre enhancements
- Performance and mobile optimizations
- Continued data-engine automation

Features and timelines may change as development progresses.

---

## Disclaimer

IceIndex is an independent hockey statistics and analytics project.

It is not affiliated with, endorsed by, or officially operated by the Ontario Hockey League, Western Hockey League, Quebec Maritimes Junior Hockey League, Canadian Hockey League, or their member teams.

League names, logos, team logos, and other third-party trademarks remain the property of their respective owners.

Statistical information is provided for informational purposes. Data accuracy and availability depend on the underlying sources and processing systems.

---

## Creator

**Noah Cornish**

Independent Developer — IceIndex

GitHub: [noahcornish](https://github.com/noahcornish)

---

**IceIndex v0.11.0**  
*Hockey Data Intelligence*