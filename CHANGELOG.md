# IceIndex — Changelog

All notable changes to IceIndex are documented here.

This project uses version numbers to identify major development milestones, feature additions, improvements, and maintenance releases.

---

## [0.11.0] — 2026-11-14

### Multi-League Beta Foundation & Official Branding

Version 0.11.0 introduces a major visual and structural update to IceIndex, including official branding, multi-league selection, and an expanded OHL Game Centre.

### Added

**Multi-League Selection**
- Added selectable OHL, WHL, and QMJHL leagues.
- Added league logos to the active-league selector.
- Added dedicated WHL and QMJHL beta preview homepages.
- Added league-aware navigation and homepage labels.
- Added navigation between the OHL platform and upcoming league previews.

**Official IceIndex Branding**
- Introduced the IceIndex hockey shield logo.
- Integrated branding into the sidebar.
- Added branding to the application header.
- Added homepage branding.
- Added branding near the data-update indicator.
- Preserved day and night theme compatibility.

**OHL Game Centre**
- Expanded the official game statistics experience.
- Added daily schedule and results presentation.
- Added detailed individual-game views.
- Added scoring and assist information.
- Added player and goaltender box scores.
- Added period-based statistics.
- Added interactive shot maps.
- Added penalties and Three Stars information.
- Added clickable player names linking to player profiles.
- Added team, date, game-status, and search filters.
- Added automatic 10:45 AM Eastern Time date rollover.
- Added schedule ordering improvements when filters are cleared.

**Official Game Data Pipeline**
- Integrated official game-summary collection into the master refresh.
- Integrated official Game Centre CSV exports.
- Added ten official game-statistics datasets.
- Added scoring reconciliation for completed games.
- Added support for expected shootout scoring differences.

### Changed

**Navigation**
- Renamed Overview to OHL Home.
- Moved OHL Game Centre to the top-level sidebar.
- Moved Compare OHL Players to the top-level sidebar.
- Reorganized the Players submenu.
- Renamed the Goaltenders navigation heading to Goalies.
- Preserved Teams and Analytics navigation.
- Added league-specific navigation behaviour.

**Data Engine**
- Updated `scripts/refresh.R` to include the official Game Centre pipeline.
- Improved console output with compact task reporting.
- Added task runtime and file-change summaries.
- Preserved detailed diagnostic logging.
- Improved refresh reporting and visibility into warnings.

**Interface**
- Improved mobile presentation.
- Refined game schedule cards.
- Improved game-statistics readability.
- Updated league selector presentation.
- Integrated the new visual identity across the website.

### Fixed

- Corrected an individual-game rendering error that could leave Game Centre stuck on its loading message.
- Corrected league selector HTML structure that temporarily hid the OHL sidebar.
- Improved player-profile routing from Game Centre statistics.
- Corrected Game Centre date-selection behaviour.
- Improved schedule ordering when date filters are cleared.
- Addressed compact layout and alignment issues across game statistics.

### Notes

- OHL remains the fully supported league.
- WHL and QMJHL are selectable beta previews only.
- Official game statistics depend on source availability.
- The full data pipeline requires validation in the deployment environment.

---

## [0.10.0] — 2026

### OHL Game Centre & Data Expansion

- Developed the OHL Game Centre foundation.
- Expanded game event collection and processing.
- Added player game logs and game metadata processing.
- Developed shot-location processing and orientation auditing.
- Introduced official game-summary collection and statistical exports during the v0.10 development cycle.
- Improved game-level data validation.
- Expanded the connection between game statistics and player records.
- Continued mobile interface refinements.

---

## [0.9.0] — 2026

### Condensed Overview

- Introduced a condensed homepage overview.
- Improved information density.
- Refined mobile presentation.
- Continued player and team navigation improvements.
- Established the condensed overview as the active development baseline.

---

## [0.8.0] — 2026

### Application & Search Improvements

- Continued development of player search and navigation.
- Expanded historical player-data support.
- Improved application data handling.
- Refined the interface and player exploration tools.

---

## [0.7.0] — 2026

### Independent Data Infrastructure

- Advanced the transition toward IceIndex-managed datasets.
- Developed the foundation for independent data processing.
- Improved repository-level data organization.
- Continued work toward reducing external processed-data dependencies.

---

## [0.6.0] — 2026

### Data Engine Foundation

- Introduced the IceIndex Data Engine architecture.
- Added a centralized R refresh orchestrator.
- Organized data collection and processing scripts.
- Established configuration and API client infrastructure.
- Prepared the foundation for automated data refreshes.

---

## [0.5.0] — 2026

### Homepage & Responsive Improvements

- Condensed the homepage layout.
- Simplified navigation and status presentation.
- Improved mobile responsiveness.
- Reduced unnecessary interface elements.
- Continued performance and usability improvements.

---

## [0.4.0] — 2026

### Multi-League Architecture

- Introduced the multi-league homepage concept.
- Separated the overall IceIndex homepage from OHL-specific functionality.
- Added league-selection foundations.
- Improved homepage organization.
- Prepared the application for future league expansion.

---

## [0.3.0] — 2026

### Player Analytics

- Introduced player analytics functionality.
- Added percentile-based player analysis.
- Added radar charts and scatter plots.
- Expanded player comparison tools.
- Added downloadable player-card functionality.
- Improved player search and visualization.

---

## [0.2.0] — 2026

### IceIndex Rebrand

- Rebranded the project as IceIndex.
- Improved mobile navigation.
- Added compact player statistics tables.
- Expanded player profiles and career totals.
- Improved comparison and draft-year features.
- Added interface and performance improvements.

---

## [0.1.0] — 2026

### Initial Development

- Established the initial junior hockey data website.
- Introduced OHL player and team databases.
- Added basic player profiles.
- Developed player comparison functionality.
- Introduced draft-year exploration.
- Created the initial mobile-first application structure.

---

## Upcoming

### WHL Beta
- WHL player and team databases
- WHL player profiles
- WHL statistics and analytics
- WHL Game Centre integration

### QMJHL Beta
- QMJHL player and team databases
- QMJHL player profiles
- QMJHL statistics and analytics
- QMJHL Game Centre integration

### Future Enhancements
- Cross-league player comparisons
- Expanded historical data
- Additional advanced statistics
- Improved data validation
- Performance improvements
- Continued interface refinements

---

**IceIndex — Hockey Data Intelligence**

*Every player. Every league. One index.*