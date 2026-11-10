
# IceIndex

**Ontario Hockey League player statistics and analytics**  
**Current development version: v0.3.0** · Powered by [OHLDataHub](https://github.com/NoahCornish/OHLDataHub)

IceIndex is an independent, browser-based OHL statistics website for exploring current and historical skater production, player profiles, comparisons, draft-year groups, teams, and scouting-style analytics. It is not affiliated with the Ontario Hockey League.

> **Release status:** v0.3.0 is a development build. JavaScript syntax and stylesheet structure have been checked, but end-to-end browser testing, remote data availability, image export and mobile interaction have **not** been fully verified. Do not treat the features below as production-certified.

## Features

| Area | What it provides |
| --- | --- |
| League Overview | Current-season leaders and league-wide summaries |
| Player Database | Search, season/team filters, sorting and pagination |
| Player Profiles | Player details, season-by-season statistics and production trends |
| Player Comparison | Side-by-side player statistics |
| Draft Year Central | Draft-eligible player exploration using estimated draft-year grouping |
| Team Explorer | Team-based player and statistical exploration |
| Player Analytics | Position/age-cohort percentile cards, radar comparisons and scatter plots |
| Exports | Player scouting-card PNG export with headshots when cross-origin image access permits |
| Responsive UI | Dark navy/ice-blue styling for desktop and mobile screens |

**Data notes:** Statistical coverage varies by season and by the source records available in OHLDataHub. Percentiles are relative to the selected comparison cohort, not a universal scouting grade. Estimated draft years are not official eligibility determinations. Some remote headshots may be unavailable or blocked from PNG export by browser cross-origin restrictions. The current PNG implementation does not guarantee embedded team logos.

## Project structure

```text
IceIndex/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── ohl-data.js
│   ├── ohl-branding.js
│   ├── ohl-analytics.js
│   └── app.js
├── README.md
└── CHANGELOG.md
```

The JavaScript files must load in dependency order: `ohl-data.js`, `ohl-branding.js`, `ohl-analytics.js`, then `app.js`. The v0.3.0 application expects `window.loadOHLCurrent()` and, for archive loading, `window.loadOHLHistory()` from `ohl-data.js`, and `window.OHLAnalytics` from the analytics module.

## Run locally

1. Clone or download the repository and keep the directory structure intact.
2. From the repository root, run a local web server. For example:

   ```bash
   python3 -m http.server 5500
   ```

3. Open `http://localhost:5500/` in your browser.
4. Wait for the current OHL season to load. Historical records may load afterward.

Opening `index.html` directly using `file://` is not recommended; use HTTP so browser resource loading behaves consistently.

## Data pipeline

IceIndex reads published OHLDataHub datasets rather than requiring its own backend. The data module fetches and normalizes current-season data, with historical seasons loaded separately where available. See the [OHLDataHub repository](https://github.com/NoahCornish/OHLDataHub) for the upstream data pipeline and update schedule.

## Troubleshooting

**“No current OHL skater data was returned” / “Unable to load IceIndex”**

- Confirm that the actual `js/ohl-data.js` file defines `loadOHLCurrent()` and that `index.html` loads it before `app.js`.
- Confirm that the data URLs referenced by `ohl-data.js` are reachable and contain the expected CSV headers.
- In Chrome, open **Developer Tools → Console** and **Network**, reload, and inspect failed requests and the first error.
- Avoid mixing reconstructed code snippets with a different `app.js` version; the application and data-loader interfaces must match.

**PNG headshots are missing:** The remote image server may not permit CORS-enabled canvas exports. The application can fall back to player initials. This is distinct from whether a headshot displays on the page.

**Changes do not appear:** Hard-refresh the page and verify that `index.html` references the updated CSS and JavaScript filenames. GitHub Pages deployments may take time to publish.

## Development and verification

Recommended pre-release checks:

```bash
node --check js/app.js
```

Then verify in Chrome and a mobile viewport: initial data load; search and filtering; profile navigation; comparison and radar data; percentile cohort calculations; scatter-point selection; PNG download; and historical archive loading. Syntax validation alone does not establish working data integration.

## Versioning

IceIndex uses semantic-style version numbers: major for incompatible changes, minor for features, and patch for fixes. See [CHANGELOG.md](CHANGELOG.md) for development notes.

## Credits

Created as an independent OHL analytics project. Statistical data supplied through [OHLDataHub](https://github.com/NoahCornish/OHLDataHub). Hockey team names, logos and player photographs remain the property of their respective rights holders.
