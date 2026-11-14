
# IceIndex

### Hockey Data Intelligence

**Every player. Every league. One index.**

IceIndex is an independent hockey data and analytics platform designed to make junior hockey statistics, player performance, team information and game-level data accessible through a fast, modern, mobile-friendly website.

The platform combines historical statistics, player profiles, advanced analytics and detailed game information in one centralized experience.

IceIndex is developed independently by Noah Cornish.

**Current Version:** v0.12.0  
**Release:** November 14, 2026  
**Status:** Active Development

**Website:** https://noahcornish.github.io/IceIndex/

**Repository:** https://github.com/NoahCornish/IceIndex

---

## Overview

IceIndex is being developed as a comprehensive hockey intelligence platform, beginning with the Ontario Hockey League (OHL).

The long-term objective is to build an independent, multi-league hockey database that provides:

- Historical player and team statistics
- Detailed player and goaltender profiles
- Game-by-game performance information
- Advanced player analytics
- Interactive player comparisons
- Draft-year analysis
- Game Centre statistics and visualizations
- Downloadable game reports
- Member-exclusive analytical features

The platform is designed for hockey fans, researchers, analysts, scouts and anyone interested in exploring junior hockey data.

---

## Supported Leagues

| League | Status |
|---|---|
| Ontario Hockey League (OHL) | Available |
| Western Hockey League (WHL) | Planned |
| Quebec Maritimes Junior Hockey League (QMJHL) | Planned |

IceIndex is being developed with a multi-league architecture to support future expansion.

The OHL currently serves as the primary data and feature development environment.

---

## Core Features

### 1. Player Database

Explore available OHL player statistics through a searchable database.

Features include:

- Player names and team information
- Games played
- Goals, assists and points
- Season statistics
- Player identification and profiles
- Historical statistical records

The interface is optimized for desktop and mobile devices.

### 2. Player Profiles

Dedicated player pages provide a centralized view of available player information.

Features include:

- Player headshots
- Team identification
- Season-by-season statistics
- Career statistical summaries
- Performance information
- Game logs
- Advanced analytical visualizations

Historical information is dependent on available published datasets.

### 3. Goaltender Database

IceIndex maintains dedicated goaltender functionality separate from skater statistics.

Features include:

- Goaltender database
- Individual goaltender profiles
- Goaltender comparisons
- Game-level goaltending statistics
- Save percentage and related performance measures

Goaltenders are routed to their dedicated profile pages throughout the application.

### 4. Player Comparisons

Compare players using available statistical information.

Comparison functionality is intended to support:

- Performance evaluation
- Statistical comparisons
- Player development analysis
- Season comparisons
- Scouting and research

### 5. Draft Year Central

Explore players through a draft-year-focused analytical interface.

The feature is designed to help users evaluate draft-eligible players using available statistical information.

### 6. Player Analytics

IceIndex provides advanced analytical tools to support deeper player evaluation.

Available analytical features include:

- Statistical visualizations
- Player performance comparisons
- Percentile-based analysis
- Interactive charts
- Season-level performance exploration

### 7. Global Player Search

Search for players directly from the main IceIndex interface.

The global search system provides quick access to available player records and profiles.

---

## OHL Game Centre

The IceIndex Game Centre provides a detailed game-level experience for the 2026–27 OHL season.

### Schedule and Results

Browse available games using:

- Team filters
- Date filters
- Game status filters
- Search functionality
- Paginated game listings

### Individual Game Pages

Game pages provide available information including:

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

Explore recorded shot locations using rink visualizations.

Filters include:

- Team
- Event type
- Period

Shot maps preserve available recorded coordinates and provide additional information about individual events.

### Share Game

Individual games can be shared through direct links.

Example format:

`https://noahcornish.github.io/IceIndex/#game-centre?game=GAME_ID`

The sharing system supports compatible native device sharing and link copying.

---

## Membership System

**Introduced in v0.12.0**

IceIndex now supports member accounts through Supabase Authentication.

The membership system provides a foundation for exclusive analytical features and future subscription services.

### Membership Access

Membership is currently available by request only.

Visitors cannot register directly through the public website interface.

To request an IceIndex account, contact:

**noahcornish.github@gmail.com**

Accounts are created and managed by the IceIndex administrator.

### Membership Approval

Accounts have one of three approval states:

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

Administrator actions are supported by Supabase database security policies and restricted functions.

### Authentication Security

The membership system uses:

- Supabase Authentication
- Authenticated sessions
- Row Level Security (RLS)
- Administrator authorization checks
- Restricted membership approval functions

The Supabase publishable key is designed for browser use.

Secret API keys and service-role credentials must never be committed to the public repository.

---

## Game Export Studio

**Introduced in v0.12.0**

Game Export Studio allows approved members to generate downloadable PNG reports containing available information from individual OHL games.

### Report Contents

Depending on available game data, reports can include:

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

Game exports are available through the website's approved-member interface.

Public visitors can continue browsing the Game Centre and sharing individual games.

**Security note:** The current browser-generated export system uses member authorization checks in the website interface. Because published game datasets are publicly accessible, this does not constitute complete server-side protection of the underlying data or report-generation functionality.

A protected server-side export service is planned for future development.

---

## Technology Stack

IceIndex uses a lightweight architecture focused on performance and maintainability.

### Frontend

- HTML5
- CSS3
- JavaScript
- Responsive layouts
- GitHub Pages hosting

### Data Processing

- R
- CSV-based data pipelines
- Automated data collection and processing
- GitHub Actions

### Authentication

- Supabase Authentication
- PostgreSQL
- Row Level Security
- Administrator-controlled membership

### Data Architecture

IceIndex is being developed around its own independent data processing system.

The objective is to maintain published hockey datasets within the IceIndex repository rather than depend on another application's processing infrastructure.

---

## Data Refresh System

IceIndex uses an R-based data processing pipeline.

The system includes:

- A central refresh orchestration script
- Configurable data collection tasks
- Data validation
- Published CSV outputs
- GitHub Actions automation

The data refresh workflow is configured to attempt execution every 15 minutes.

Actual execution times depend on GitHub Actions scheduling, workflow duration and available resources.

Successful refresh information is displayed within the website when metadata is available.

---

## Project Structure

The repository is organized around the following components:

```text
IceIndex/
│
├── index.html
│
├── css/
│   ├── style.css
│   ├── style-night.css
│   └── game-centre.css
│
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
│
├── assets/
│   └── branding/
│
├── data/
│   ├── ohl/
│   └── games/
│
├── scripts/
│   ├── refresh.R
│   └── ...
│
├── .github/
│   └── workflows/
│
├── README.md
└── CHANGELOG.md
```

Additional scripts and assets may be present depending on the release.

---

## Local Development

IceIndex is a static website supported by an R data-processing pipeline.

### Requirements

- Git
- A modern web browser
- A local HTTP server
- R and required packages for data processing
- A code editor such as Visual Studio Code

### Clone the Repository

```bash
git clone https://github.com/NoahCornish/IceIndex.git

cd IceIndex
```

### Run Locally

Start a local HTTP server from the repository directory.

For example, with Python installed:

```bash
python3 -m http.server 8000
```

Open:

`http://localhost:8000`

A local HTTP server is recommended because browser security restrictions can prevent CSV files from loading correctly when opening `index.html` directly.

### Supabase Configuration

Membership features require an appropriately configured Supabase project.

The database must contain the membership profile table, authentication trigger, RLS policies and administrator approval functions.

The frontend uses a Supabase project URL and publishable key.

Do not expose Supabase secret or service-role keys in client-side files.

---

## Design Principles

IceIndex development follows several core principles.

**Mobile First**

The platform should remain usable on modern smartphones without sacrificing desktop functionality.

**Performance**

Pages should load efficiently, with caching and optimized data access wherever practical.

**Data Transparency**

Statistics should reflect available published records, with unavailable information identified rather than invented.

**Independent Infrastructure**

IceIndex should maintain its own processing and publishing workflows.

**Scalability**

The architecture should support additional leagues, seasons, datasets and analytical tools.

**Accessibility**

Navigation, tables and interactive elements should remain readable and usable across different screen sizes.

---

## Development Roadmap

### Near-Term Priorities

- Improve Game Export Studio report design
- Refine mobile layouts
- Expand historical game data
- Improve statistical presentation
- Enhance account management
- Strengthen server-side export authorization

### Medium-Term Priorities

- Expand advanced player analytics
- Introduce additional scouting tools
- Improve historical player coverage
- Expand team-level analytics
- Support additional leagues
- Develop more downloadable analytical reports

### Long-Term Vision

- Multi-league junior hockey database
- Expanded historical records
- Advanced player evaluation tools
- Premium analytical features
- Subscription-based memberships
- Protected member-only services
- Expanded hockey intelligence capabilities

Future features are development goals and are not guaranteed release commitments.

---

## Version History

| Version | Major Development |
|---|---|
| v0.12.0 | Membership & Game Export Studio |
| v0.11.1 | Game sharing and goaltender navigation improvements |
| v0.11.0 | OHL Game Centre |
| v0.10.x | Branding, interface and navigation improvements |
| v0.9.0 | Condensed overview |
| v0.8.x | Data and application improvements |
| v0.7.0 | Independent data pipeline development |
| v0.6.0 | Data Engine and refresh orchestration |
| v0.5.0 | Homepage and responsive improvements |
| v0.4.0 | Multi-league architecture |
| v0.3.0 | Player analytics |
| v0.2.0 | IceIndex rebrand |
| v0.1.0 | Initial hockey data platform |

See [CHANGELOG.md](CHANGELOG.md) for release details.

---

## Disclaimer

IceIndex is an independent hockey data and analytics project.

It is not an official website of the Ontario Hockey League, Canadian Hockey League or their member teams.

Team names, logos and other trademarks belong to their respective owners.

Statistics and game information depend on the availability and accuracy of published source data.

IceIndex does not guarantee uninterrupted service or complete statistical coverage.

---

## Contact

**IceIndex — Hockey Data Intelligence**

Developer: Noah Cornish

Membership and general inquiries:

**noahcornish.github@gmail.com**

Website: https://noahcornish.github.io/IceIndex/

---

**IceIndex v0.12.0**

*Every player. Every league. One index.*