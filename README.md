
# IceIndex 🏒

**Hockey Data Intelligence | Version 0.4.0**

*Every player. Every league. One index.*

IceIndex is an independent hockey statistics and analytics platform designed to make player performance data accessible, searchable, and easy to explore.

Originally developed as an Ontario Hockey League (OHL) statistics application, IceIndex is evolving into a multi-league hockey analytics platform.

**Live Website:** https://noahcornish.github.io/IceIndex/

**Repository:** https://github.com/NoahCornish/IceIndex

## Version 0.4.0 — Platform Expansion

Version 0.4.0 introduces a new identity for IceIndex, including a dedicated homepage, league selection interface, featured player spotlight, and updated styling.

The Ontario Hockey League remains the first fully supported league, with future expansion planned for the Western Hockey League (WHL) and Quebec Maritimes Junior Hockey League (QMJHL).

## Current Features

### Platform Homepage

- Dedicated IceIndex landing page.
- Featured OHL player based on current-season points.
- League selection interface.
- Navigation to player databases and analytics.
- Updated responsive styling.

### OHL Player Database

- Searchable player statistics.
- Current-season and historical player records.
- Filtering by season and team.
- Sortable statistical rankings.
- Player profiles with career information.

### Player Comparison

- Compare individual player statistics.
- Explore production across seasons.
- Evaluate scoring and performance differences.

### Player Analytics

- Scouting-style percentile cards.
- Peer-group comparisons by position, age, season, and games played.
- Radar charts for player comparisons.
- Interactive statistical scatter plots.
- Analytics leaderboards.
- Downloadable player analytics cards in PNG format.

### Additional OHL Tools

- Team Explorer.
- Draft Year Central.
- League overview and statistical leaders.

## Supported Leagues

| League | Status |
|---|---|
| Ontario Hockey League (OHL) | Supported |
| Western Hockey League (WHL) | Planned |
| Quebec Maritimes Junior Hockey League (QMJHL) | Planned |

Planned leagues are displayed in the interface but do not yet have integrated statistical databases.

## Data Sources

IceIndex's OHL statistics are powered by data from the **OHLDataHub** project.

The application uses JavaScript data-loading modules to retrieve and process current and historical player statistics.

Statistical analytics are calculated using the available underlying data. Percentile rankings represent a player's position within a selected comparison group and should not be interpreted as professional scouting grades or projections.

## Technology

IceIndex is built using:

- HTML5
- CSS3
- Vanilla JavaScript
- SVG-based data visualizations
- HTML Canvas for downloadable player cards
- GitHub Pages for website hosting

The application is designed to operate as a static website without requiring a traditional backend server.

## Project Structure

```text
IceIndex/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── ohl-data.js
│   ├── ohl-analytics.js
│   └── ohl-branding.js
├── README.md
└── CHANGELOG.md
```

Additional data and asset files may be present in the repository.

## Development Roadmap

### v0.4.0 — Platform Foundation (Complete)

Establish the IceIndex identity, introduce league selection, and integrate the existing OHL statistics and analytics experience.

### Future Development

- Expand statistical coverage beyond the OHL.
- Improve player discovery and search.
- Enhance mobile usability.
- Expand analytical tools and visualizations.
- Add additional features as validated data becomes available.

Future features and release schedules are subject to development and data availability.

## Disclaimer

IceIndex is an independent hockey analytics project and is not an official website of the Ontario Hockey League, Canadian Hockey League, or their member teams.

All statistics depend on the accuracy and availability of their underlying data sources.

Team names, logos, and related trademarks belong to their respective owners.

---

**IceIndex v0.4.0**

*Built for the game. Powered by data.*
