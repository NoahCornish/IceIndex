
# CHL Data Hub

**Version 0.1.0 — OHL Intelligence**

CHL Data Hub is an independent Canadian junior hockey analytics platform.

The first public release focuses on the Ontario Hockey League, including current and historical player statistics, career development, player comparisons and NHL draft-year analysis.

## Features

### League Overview
- Current-season scoring leaders
- Goals and assists leaders
- Points-per-game leaders
- Interactive production rankings
- Current-season statistical summaries

### Player Database
- Searchable historical OHL player records
- Individual season filters
- Team filters
- Statistical sorting
- Direct access to player profiles

### Player Profile
- Complete available OHL regular-season history
- Individual season selection
- Combined career totals
- Player headshots
- Team branding
- Production development charts
- Season-by-season percentiles
- Detailed scoring and special-teams statistics

### Compare Players
- Compare two OHL players
- Compare complete careers
- Compare individual seasons
- Compare different seasons of the same player
- Side-by-side production statistics

### Draft Year Central
- Estimated first NHL draft-age birthdate cohorts
- Current OHL player statistics
- Searchable draft-year player lists
- Statistical rankings

Draft-year cohorts are estimates, not official NHL eligibility lists.

### Team Explorer
- All 20 current OHL teams
- Official team branding
- Current-season roster navigation

## Data Source

OHL statistics are supplied by:

https://github.com/NoahCornish/OHLDataHub

Current statistics:

data/current/skaters.csv

Historical regular-season statistics:

data/historical/YYYY-season/skaters.csv

Historical folders use the season-ending year.

For example:

2024-season represents the 2023–24 OHL season.

## Historical Player Matching

Historical seasons may not include permanent PlayerIDs.

The current application matches historical records using normalized player names and birthdates.

This method may produce incomplete or ambiguous player histories when source birthdates are missing or inconsistent.

Career totals should be treated as provisional until player identities and source season totals are validated.

## Technology

- HTML5
- CSS3
- Vanilla JavaScript
- GitHub-hosted CSV data
- Responsive design
- No frontend framework
- No build step

## Run Locally

1. Open the project in Visual Studio Code.
2. Install the Live Server extension.
3. Right-click index.html.
4. Select Open with Live Server.

An internet connection is required.

## Project Structure

CHLDataHub/
- index.html
- css/style.css
- js/app.js
- js/ohl-data.js
- js/ohl-branding.js
- README.md
- CHANGELOG.md

## Known Limitations

- OHL only
- Skaters only
- Historical player matching is provisional
- Historical seasons are downloaded individually
- Draft eligibility is estimated
- Some source statistics may be unavailable
- Goaltenders and playoffs are not included
- Historical coverage depends on available source files

## Roadmap

- Permanent historical PlayerID mapping
- Prebuilt historical player index
- Official draft eligibility integration
- Historical goaltender statistics
- OHL playoff statistics
- WHL and QMJHL support
- Advanced player development analytics
- Exportable scouting profiles

## Disclaimer

CHL Data Hub is an independent analytics project and is not affiliated with or endorsed by the Canadian Hockey League, Ontario Hockey League, National Hockey League or their member clubs.

Team logos, names and player images belong to their respective rights holders.
