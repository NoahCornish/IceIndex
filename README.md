
# IceIndex 🏒

**Hockey Data Intelligence · v0.5.0**

*Every player. Every league. One index.*

[Live website](https://noahcornish.github.io/IceIndex/) · [Source code](https://github.com/NoahCornish/IceIndex) · [Changelog](CHANGELOG.md)

## Overview

IceIndex is an independent, browser-based hockey statistics and analytics platform. It currently supports the **Ontario Hockey League (OHL)**, bringing together player and team data, historical exploration, player comparisons, and advanced analytics in one interface.

Version **0.5.0** refines the navigation and prepares the interface for additional leagues without claiming those leagues are available yet.

## Features

- **Home:** IceIndex platform landing page and featured OHL content.
- **League Directory:** OHL available; WHL and QMJHL identified as planned additions.
- **OHL Overview:** League-level statistics and season context.
- **Player Database:** Browse and search OHL player statistics.
- **Player Profiles:** Explore individual player information and performance.
- **Player Comparison:** Compare players side by side.
- **Draft Year Central:** Explore players by draft year.
- **Team Explorer:** Browse OHL teams and their statistics.
- **Player Analytics:** Advanced visualizations and player performance insights, including percentile and chart-based views.

Feature availability depends on the data provided by the underlying OHL datasets.

## What's new in v0.5.0

- A **compact sidebar** with six top-level destinations: Home, League Directory, Overview, Players, Teams, and Analytics.
- **Expandable Players and Analytics sections** to reduce visual clutter.
- Automatic submenu expansion and active-page highlighting for direct links such as `#profile`, `#compare`, `#draft`, and `#analytics`.
- An **active-league selector** designed for future expansion.
- A single, minimal **data-status indicator** in the top bar, replacing repetitive status text and badges.
- Cleaner sidebar footer and refined mobile navigation controls.
- Updated version branding to **0.5.0**.

> **Development status:** v0.5.0 is the current interface development release. The navigation HTML has been prepared; full cross-browser and integration testing with the existing CSS and JavaScript should be completed before calling the release stable.

## League support

| League | Status |
| --- | --- |
| Ontario Hockey League (OHL) | Available |
| Western Hockey League (WHL) | Planned — not yet integrated |
| Quebec Maritimes Junior Hockey League (QMJHL) | Planned — not yet integrated |

IceIndex does **not** currently combine statistics across these leagues.

## Technology

IceIndex is a static web application built with **HTML, CSS, and vanilla JavaScript**, hosted on **GitHub Pages**. Existing data and analytics modules support the OHL experience; charts and downloadable visualizations use browser-based rendering techniques.

The OHL data workflow is supported by [OHLDataHub](https://github.com/NoahCornish/OHLDataHub).

## Project structure

```text
IceIndex/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── ohl-data.js
│   ├── ohl-branding.js
│   └── ohl-analytics.js
├── README.md
└── CHANGELOG.md
```

## Run locally

1. Clone or download the repository.
2. Serve the project directory with a local HTTP server (recommended for browser data loading).
3. Open the local server URL in your browser.

For example, with Python installed:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000/`.

## Roadmap

- Finish v0.5.0 integration and responsive testing.
- Refine shared CSS, tables, charts, and player cards.
- Improve search and navigation across OHL tools.
- Design league-independent data models and routing.
- Explore WHL and QMJHL integrations when reliable data sources are available.

## Disclaimer

IceIndex is an independent fan/developer analytics project and is not affiliated with or endorsed by the OHL, WHL, QMJHL, CHL, or their member clubs. League names, logos, and trademarks belong to their respective owners. Statistics are provided for informational purposes and may be revised by their sources.

---

**IceIndex v0.5.0** · *Every player. Every league. One index.*