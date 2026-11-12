
# IceIndex Changelog

Notable changes to IceIndex are documented here.

IceIndex is an independent hockey data and analytics platform under active development.

---

## [0.8.0] — 2026-11-12

**Status: Release candidate — deployment not yet verified**

### Advanced Statistics Database — Added

- Introduced a dedicated OHL skater statistics database.
- Added season and competition selection.
- Added player search, team filtering, and position filtering.
- Added minimum-games-played and statistical value filters.
- Introduced customizable statistical column visibility.
- Added selectable sorting and statistical rankings.
- Added filtered CSV exports.
- Integrated player headshots and team abbreviations.
- Added direct navigation to player profiles.
- Implemented a dense, responsive statistics table.
- Added sticky rank, player name, and team columns.
- Improved full-name readability across screen sizes.
- Removed redundant grouped table headings.

### GM Player Comparison — Expanded

- Expanded player comparison from two players to **two, three, or four players**.
- Added independent player, season, and competition selectors.
- Added a season-alignment control for more consistent comparisons.
- Added warnings when comparison windows differ.
- Introduced player summary cards showing:
  - Games played.
  - Goals.
  - Points.
  - Points per game.
- Expanded the side-by-side statistical comparison matrix.
- Added scoring, efficiency, shooting, and special-teams statistics where available.
- Introduced league percentile rankings.
- Added configurable minimum-games-played thresholds.
- Added forward/defenceman peer-group comparisons where position data permits.
- Added rate-only comparisons.
- Added statistical-category filters.
- Added highlighting of the highest available statistical values.
- Added CSV exports and comparison-link controls.
- Refined player-selection cards for a more compact scouting interface.
- Improved comparison-matrix spacing and mobile responsiveness.

### Player Experience — Improved

- Improved global player discovery and profile navigation.
- Enhanced the integration of player headshots.
- Refined historical season and career exploration.
- Improved career highlight and season ranking presentation.
- Expanded responsive statistical browsing.
- Improved mobile navigation and readability.

### Data and Interpretation

- Preserved IceIndex's independent OHL data collection and processing workflow.
- Preserved existing refresh automation.
- Added clearer distinctions between career totals and single-season percentile rankings.
- Maintained missing values for unavailable statistics rather than treating them as zero.
- Clarified that statistical percentiles are descriptive rankings, not professional scouting grades.

### Release Verification

The v0.8.0 interface was developed and tested locally.

JavaScript syntax checks passed during development, and interface layouts were reviewed through browser screenshots.

Full end-to-end validation, including shareable comparison links and production deployment, should be completed before declaring the release live.

---

## [0.7.0] — 2026-11-12

### OHL Data Platform and Automation

Version 0.7.0 expanded the OHL player and goaltender platform, website navigation, automated data processing, and refresh monitoring.

### Added

- Goaltender database, profiles, and comparisons.
- Goaltender season and career statistics.
- Historical goaltender records.
- Player database navigation and individual player profiles.
- Player comparison tools.
- Draft Year Central.
- Player headshot support.
- OHL overview dashboard.
- Production rankings and featured player.
- Team exploration.
- Analytics navigation.
- GitHub Actions refresh workflow with scheduled and manual execution.
- Last-successful-refresh metadata.
- Sidebar data-refresh timestamp with Eastern Time formatting.
- Data validation covering:
  - Collector execution.
  - CSV structure.
  - Critical identifiers.
  - Empty datasets.
  - File inventory.
  - Execution timing.
  - Refresh history.

### Changed

- Refined the dark navy and ice-blue visual design.
- Improved responsive navigation.
- Expanded master refresh orchestration.
- Integrated skater and goaltender processing.
- Improved workflow verification.
- Enhanced refresh metadata publication.
- Expanded data-quality reporting.

### Fixed

- Corrected a Production Rankings layout issue caused by an unclosed HTML container.
- Fixed a workflow project verification path mismatch.
- Improved sidebar timestamp visibility.
- Distinguished the actual data refresh time from the page-load time.

### Technical References

- Master refresh: `scripts/refresh.R`
- OHL processing: `scripts/processing/ohl_process_all.R`
- Refresh history: `data/ohl/metadata/refresh_log.csv`
- Last update: `data/ohl/metadata/last_updated.json`

---

## [0.6.0] — Previous Development Release

### Data Engine Foundation

- Introduced the master R refresh script.
- Added configuration initialization.
- Added API helper functions.
- Established the OHL collector registry.
- Added sequential data collectors for:
  - Seasons.
  - Teams.
  - Rosters.
  - Skater statistics.
  - Goaltender statistics.
- Established separate current and historical datasets.
- Added processed skater and goaltender statistical tables.
- Added preflight checks.
- Introduced data inventories.
- Added file-change detection.
- Added CSV validation.
- Introduced execution timing and refresh logs.

---

## [0.5.0] — Earlier Development

### Platform Foundation

- Established IceIndex as a standalone hockey data project.
- Created its independent GitHub repository.
- Introduced the GitHub Pages website.
- Established the HTML, CSS, and JavaScript frontend.
- Integrated early OHL datasets.
- Introduced R-based data collection scripts.
- Established the central refresh architecture.

---

## Long-Term Roadmap

Potential future development includes:

- WHL and QMJHL expansion.
- Advanced player scouting tools.
- Player development tracking.
- Historical statistical comparisons.
- Expanded game-level data.
- Improved statistical methodology documentation.
- Additional pipeline monitoring.
- Independent data collection across more hockey leagues.

---

## Project Information

- **Project:** IceIndex
- **Latest prepared version:** 0.8.0 (release candidate)
- **Developer:** Noah Cornish
- **Repository:** https://github.com/NoahCornish/IceIndex
- **Website:** https://noahcornish.github.io/IceIndex/

---

*Every player. Every league. One index.*