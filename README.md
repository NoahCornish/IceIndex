
# IceIndex

### Hockey Data Intelligence

**Every player. Every league. One index.**

IceIndex is an independent hockey data and analytics platform designed to make junior hockey statistics, player performance, team information, and game-level data accessible through a fast, modern, mobile-friendly website.

The platform combines historical statistics, player profiles, advanced analytics, detailed game information, and recent-performance tracking in one centralized experience.

IceIndex is independently developed by Noah Cornish.

**Current Version:** v0.14.0  
**Release:** November 15, 2026  
**Status:** Active Development

**Website:** https://noahcornish.github.io/IceIndex/  
**Repository:** https://github.com/NoahCornish/IceIndex

---

## Overview

IceIndex is being developed as a comprehensive hockey intelligence platform, beginning with the Ontario Hockey League (OHL).

The long-term objective is to build an independent, multi-league hockey database providing:

- Historical player and team statistics
- Detailed player and goaltender profiles
- Game-by-game performance information
- Advanced player analytics
- Interactive player comparisons
- Draft-year analysis
- Game Centre statistics and visualizations
- League standings and statistical leaders
- Recent player performance tracking
- Downloadable game reports
- Member-exclusive analytical features

IceIndex is designed for hockey fans, researchers, analysts, scouts, and anyone interested in exploring junior hockey data.

---

## Supported Leagues

| League | Status |
|---|---|
| Ontario Hockey League (OHL) | Primary supported league |
| Western Hockey League (WHL) | Interface available; data expansion planned |
| Quebec Maritimes Junior Hockey League (QMJHL) | Interface available; data expansion planned |

IceIndex uses a multi-league architecture designed to support additional Canadian Hockey League competitions.

The OHL currently serves as the primary environment for data collection, feature development, and statistical analysis.

Not all features are available across every league.

---

## Core Features

### 1. OHL Overview

The OHL Overview provides a streamlined snapshot of the current season.

Features include:

- Current-season information
- Today's OHL games
- Team logos and game results
- Players Setting the Pace
- Direct access to major IceIndex features
- Compact, responsive presentation

Version 0.14.0 simplifies the Overview by removing the Production Rankings section while preserving the four Players Setting the Pace cards.

The goal is to prioritize useful information without overcrowding the homepage.

### 2. Player Database

Explore available OHL player statistics through a searchable and sortable database.

Features include:

- Player names and team information
- Games played
- Goals, assists, and points
- Season statistics
- Player identification
- Historical statistical records
- Direct links to player profiles
- Mobile-friendly statistical tables

The database supports exploration of current and historical player performance.

### 3. Player Profiles

Dedicated player pages provide centralized access to available player information.

Features include:

- Player headshots
- Team identification
- Season-by-season statistics
- Career statistical summaries
- Historical team information
- Player game logs
- Player Development Tracker
- Advanced analytical visualizations

The Player Development Tracker allows users to explore performance changes across seasons.

Historical coverage depends on available published datasets.

### 4. Goaltender Database

IceIndex maintains dedicated goaltender functionality separate from skater statistics.

Features include:

- Goaltender database
- Individual goaltender profiles
- Goaltender comparisons
- Game-level goaltending statistics
- Save percentage and related performance measures

Goaltenders are routed to their dedicated profile pages throughout the application.

### 5. Player Comparisons

Compare players using available statistical information.

Comparison functionality supports:

- Statistical performance evaluation
- Season comparisons
- Career comparisons
- Player development analysis
- Visual analytical comparisons
- Scouting and research

### 6. Draft Year Central

Explore players through a draft-year-focused analytical interface.

Draft Year Central is designed to support evaluation of draft-eligible players using available season statistics and analytical information.

### 7. Player Analytics

IceIndex provides analytical tools for evaluating player performance beyond traditional counting statistics.

Features include:

- Statistical visualizations
- Percentile-based comparisons
- Radar charts
- Scatter plots
- Player development trends
- Interactive charts
- Season-level performance exploration

Analytical results depend on available data.

### 8. Global Player Search

Search for players directly from the main IceIndex interface.

The global search system provides quick access to available player records and individual profiles.

---

## OHL Game Centre

Introduced in v0.11.0 and expanded in subsequent releases, the Game Centre provides a detailed game-level experience for the OHL.

### Schedule and Results

Browse available games using:

- Date navigation
- Team filters
- Game status information
- Game listings
- Team logos and scoreboards

Version 0.13.0 introduced a more compact Game Centre layout and refined date navigation.

Version 0.14.0 further improves game-card sizing and mobile readability.

### Individual Game Pages

Game pages display available information including:

- Team names and logos
- Final scores and game status
- Game dates and venues
- Attendance
- Period-by-period scoring
- Shots on goal
- Scoring timelines
- Player box scores
- Goaltender statistics
- Penalty summaries
- Three stars
- Interactive shot maps

The availability of individual statistics depends on the underlying game data.

### Interactive Shot Maps

Explore recorded shot locations through rink visualizations.

Available filtering includes:

- Team
- Event type
- Period

Shot maps use available recorded event coordinates.

### Share Game

Individual games can be shared through direct links.

Example:

`https://noahcornish.github.io/IceIndex/#game-centre?game=GAME_ID`

The sharing system supports compatible native device sharing and clipboard link copying.

---

## Standings, Leaders & Form

Introduced during the v0.13.0 development cycle, this page combines three major statistical views.

### Standings

The Standings section is reserved for official league standings.

**Current Status:** Coming Soon

Planned functionality includes:

- League standings
- Conference and division rankings
- Team records
- Points and winning percentages
- Goals for and against
- Recent team performance

### Leaders

The Leaders section displays the top five eligible OHL skaters across ten statistical categories.

| Category | Statistic |
|---|---|
| Points | PTS |
| Goals | G |
| Assists | A |
| Points per Game | P/GP |
| Power Play Points | PPP |
| Power Play Assists | PPA |
| Power Play Goals | PPG |
| Penalty Minutes | PIM |
| Shots | SOG |
| Shooting Percentage | SH% |

**Eligibility:** A minimum of 10 games played is required.

Leaderboard entries include player identification, team information, statistical values, and links to player profiles.

### Form Tracker

The Form Tracker identifies players producing strong results over recent games.

Users can select:

- Last 5 games
- Last 10 games
- Last 15 games

Available categories include:

- Points
- Goals
- Assists
- Points per game
- Shots
- Shooting percentage

The Form Tracker uses available game-log records to evaluate recent production rather than relying exclusively on season totals.

Players must meet the minimum season eligibility requirement of 10 games played and have sufficient recorded games for the selected sample.

---

## Membership System

**Introduced in v0.12.0**

IceIndex supports member accounts through Supabase Authentication.

The membership system establishes the foundation for exclusive analytical tools and future subscription services.

### Membership Access

Membership is currently available by request only.

Public account registration is not available through the website interface.

To request an account, contact:

**noahcornish.github@gmail.com**

Accounts are created and managed by the IceIndex administrator.

### Membership Approval

Member accounts support three approval states:

| Status | Description |
|---|---|
| Pending | Awaiting administrator approval |
| Approved | Authorized to access member features |
| Rejected | Access has not been approved |

Only approved accounts can access member-exclusive features through the website interface.

### Administrator Dashboard

The administrator interface supports:

- Viewing member accounts
- Reviewing membership status
- Approving accounts
- Rejecting accounts
- Revoking approval
- Managing access permissions

Administrator operations use Supabase database security policies and restricted functions.

### Authentication Security

The membership system uses:

- Supabase Authentication
- Authenticated sessions
- Persistent login sessions
- PostgreSQL
- Row Level Security (RLS)
- Administrator authorization checks
- Restricted membership approval functions

The Supabase publishable key is intended for browser use.

Secret API keys and service-role credentials must never be committed to the public repository.

---

## Game Export Studio

**Introduced in v0.12.0**

Game Export Studio allows approved members to generate downloadable PNG reports containing available information from individual OHL games.

### Report Contents

Depending on the available game data, reports can include:

- IceIndex branding
- Game date and venue
- Team names and final score
- Period scoring
- Team statistics
- Scoring plays
- Player statistics
- Goaltender statistics
- Penalties
- Three stars
- Shot information

### Export Access

Game exports are available through the approved-member interface.

Public visitors can continue browsing the Game Centre and sharing individual games.

**Security Limitation:** Browser-based membership restrictions do not provide complete server-side protection of published datasets or report-generation functionality.

A protected server-side export service remains a future development goal.

Subscription billing is not currently implemented.

---

## Mobile Experience

Version 0.14.0 introduces a substantial responsive interface refinement.

IceIndex is designed for use across:

- iPhone
- Android
- Tablets
- Laptops
- Desktop computers

### Mobile Improvements

- Compact navigation drawer
- Grouped navigation sections
- Expandable menu categories
- Improved navigation spacing
- Responsive layouts for different screen heights
- Larger touch targets
- Improved player statistics tables
- Better career statistics presentation
- Responsive chart containers
- Improved Game Centre scoreboards
- Compact Standings, Leaders & Form navigation
- Improved header branding
- Day and night theme compatibility

### Navigation

The navigation is organized into major sections including:

- Discover
- Essentials
- Explore Data

The Essentials heading adapts to the selected league.

Teams has been removed from the visible navigation pending a future redesign.

The underlying Teams functionality remains part of the project.

### Responsive Tables

Detailed statistics may use horizontal scrolling on smaller screens to preserve readable column widths and numerical alignment.

The website is intended to adapt to the available screen width and height without requiring a separate mobile application.

---

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | HTML5, CSS3, JavaScript |
| Data Processing | R |
| Data Storage | CSV |
| Automation | GitHub Actions |
| Hosting | GitHub Pages |
| Authentication | Supabase Authentication |
| Membership Database | PostgreSQL |
| Access Control | Supabase Row Level Security |
| Version Control | Git and GitHub |

IceIndex is a static website, not an R Shiny application.

The public interface runs through HTML, CSS, and JavaScript.

R scripts handle data collection, processing, and publication.

---

## Data Engine

IceIndex maintains an independent R-based data-processing system.

The system is designed to:

1. Collect hockey data from supported sources.
2. Process and standardize records.
3. Generate CSV datasets.
4. Store processed data within the IceIndex repository.
5. Publish updated datasets through GitHub.
6. Serve the resulting information through GitHub Pages.

The central orchestration script is:

`scripts/refresh.R`

Supporting scripts handle configuration, API requests, and individual collection tasks.

### Automated Refresh

GitHub Actions supports automated data collection and processing.

The previously documented refresh workflow is configured to attempt execution every 15 minutes.

Actual execution timing depends on GitHub Actions scheduling, workflow duration, and available resources.

Successful refresh information is displayed within the website when metadata is available.

---

## Project Structure

A simplified overview of the repository:

```text
IceIndex/
├── index.html
├── css/
│   ├── style.css
│   ├── style-night.css
│   ├── game-centre.css
│   ├── standings-leaders.css
│   └── mobile-overhaul.css
├── js/
│   ├── app.js
│   ├── ohl-data.js
│   ├── ohl-branding.js
│   ├── ohl-analytics.js
│   ├── ohl-goalies.js
│   ├── game-logs.js
│   ├── shot-map.js
│   ├── game-centre.js
│   ├── iceindex-members.js
│   └── maintenance.js
├── assets/
│   ├── branding/
│   └── teams/
├── data/
│   ├── ohl/
│   └── games/
├── scripts/
│   ├── refresh.R
│   └── ...
├── .github/
│   └── workflows/
├── README.md
└── CHANGELOG.md
```

Additional scripts, stylesheets, assets, and datasets may be present.

---

## Local Development

### Requirements

- Git
- Modern web browser
- Local HTTP server
- Code editor such as Visual Studio Code
- R and required packages for data processing

### Clone the Repository

```bash
git clone https://github.com/NoahCornish/IceIndex.git
cd IceIndex
```

### Run Locally

Start a local HTTP server:

```bash
python3 -m http.server 8000
```

Open:

`http://localhost:8000`

A local server is recommended because browser security restrictions may prevent JavaScript from loading CSV files when opening `index.html` directly.

### Supabase Configuration

Membership functionality requires an appropriately configured Supabase project.

The project must include the required authentication configuration, membership profiles, Row Level Security policies, and restricted administrator functions.

Never expose Supabase secret or service-role keys in client-side files.

---

## Development Roadmap

### Near-Term Priorities

- Complete OHL standings integration
- Refine mobile layouts
- Improve Game Export Studio formatting
- Expand historical game data
- Add historical season leaderboards
- Introduce goaltender leaderboards
- Refine the Form Tracker

### Medium-Term Priorities

- Revitalize team profiles
- Expand player shot-map functionality
- Improve game-level analytical tools
- Expand advanced player comparisons
- Improve historical player coverage
- Develop additional scouting tools
- Strengthen server-side export authorization

### Long-Term Vision

- Multi-league junior hockey database
- Expanded WHL and QMJHL support
- Comprehensive historical CHL records
- Advanced player evaluation models
- Premium analytical features
- Subscription-based memberships
- Protected member-only services
- Expanded hockey intelligence capabilities

Future features are development goals and are not guaranteed release commitments.

---

## Version History

| Version | Major Development |
|---|---|
| v0.14.0 | Mobile Experience & Navigation Overhaul |
| v0.13.0 | Game Centre, Standings, Leaders & Form |
| v0.12.0 | Membership & Game Export Studio |
| v0.11.1 | Game Sharing & Goaltender Navigation |
| v0.11.0 | OHL Game Centre |
| v0.10.x | Website Interface Improvements |
| v0.9.0 | Condensed Overview |
| v0.8.x | Data & Application Improvements |
| v0.7.0 | Independent Data Infrastructure |
| v0.6.0 | Data Engine |
| v0.5.0 | Homepage & Mobile Improvements |
| v0.4.0 | Multi-League Architecture |
| v0.3.0 | Player Analytics |
| v0.2.0 | IceIndex Rebrand |
| v0.1.0 | Initial Release |

See [CHANGELOG.md](CHANGELOG.md) for release details.

---

## Disclaimer

IceIndex is an independent hockey data and analytics project.

It is not affiliated with, endorsed by, or officially operated by the Ontario Hockey League, Canadian Hockey League, or their member teams.

Team names, logos, and other trademarks belong to their respective owners.

Statistics and game information depend on the availability and accuracy of published source data.

IceIndex does not guarantee uninterrupted service or complete statistical coverage.

---

## Contact

**IceIndex — Hockey Data Intelligence**

Developer: Noah Cornish

Membership and general inquiries:

**noahcornish.github@gmail.com**

Website: https://noahcornish.github.io/IceIndex/

Repository: https://github.com/NoahCornish/IceIndex

---

**IceIndex v0.14.0**

*Every player. Every league. One index.*