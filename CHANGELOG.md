
# IceIndex Changelog

All notable changes to IceIndex are documented in this file.

IceIndex follows a version-based development approach, with each release introducing new functionality, improvements, and maintenance updates.

The project is currently in active development.

---

## [0.7.0] - 2026-11-12

### OHL Data Platform and Automation

Version 0.7.0 expands IceIndex into a more complete junior hockey statistics and analytics platform.

This release focuses on OHL player and goaltender data, dashboard functionality, automated data processing, website navigation, and refresh monitoring.

### Added

#### Goaltender Statistics

- Dedicated OHL goaltender database.
- Goaltender profile pages.
- Goaltender comparison interface.
- Goaltender season statistics.
- Goaltender career statistics.
- Historical goaltending records.
- Goaltender data processing integration.

#### Player Features

- Player database navigation.
- Individual player profiles.
- Player comparison interface.
- Draft Year Central navigation.
- Season and career statistical exploration.
- Player identification and headshot support where available.

#### Dashboard and Analytics

- OHL overview dashboard.
- Player production rankings.
- Featured player presentation.
- Team exploration.
- Player analytics navigation.
- Improved access to statistical tools.

#### Automated Data Refresh

- GitHub Actions data refresh workflow.
- Automated execution of the master R pipeline.
- Four targeted daily refresh times:
  - 3:06 AM Eastern
  - 12:02 PM Eastern
  - 6:03 PM Eastern
  - 10:25 PM Eastern
- Manual workflow execution.
- Automated commits of refreshed datasets.
- Eastern daylight saving time scheduling logic.

#### Refresh Metadata

- Last successful refresh metadata support.
- Sidebar data timestamp indicator.
- Eastern Time timestamp formatting.
- Integration with `last_updated.json`.
- Timestamp display independent of browser visit time.

#### Data Validation

- Collector execution monitoring.
- CSV structural validation.
- Critical identifier checks.
- Unexpected empty dataset detection.
- Warning and error reporting.
- File inventory comparisons.
- Refresh execution timing.
- Historical refresh logging.

### Changed

#### Website Interface

- Refined dark navy and ice-blue visual design.
- Improved sidebar navigation.
- Compact league selection interface.
- Expandable player navigation.
- Expandable goaltender navigation.
- Expandable analytics navigation.
- Responsive mobile navigation.
- Compact sidebar footer.
- GitHub repository link in the sidebar.
- Sidebar display of the current application version.

#### Data Engine

- Expanded master refresh orchestration.
- Integrated skater and goaltender processing.
- Improved pipeline execution summaries.
- Improved data quality reporting.
- Preserved existing collector execution order.
- Added support for refresh metadata publication.

#### GitHub Actions

- Updated workflow verification paths.
- Added verification of required OHL collectors.
- Added verification of the OHL processing script.
- Added refresh timestamp validation.
- Preserved automated Git commits.
- Updated scheduling configuration for multiple daily runs.

### Fixed

- Production Rankings layout issue caused by an unclosed HTML container.
- Workflow project verification path mismatch.
- Sidebar timestamp placement and visibility.
- Separation of website loading status from actual data refresh time.

### Technical Notes

The primary data refresh script remains:

```text
scripts/refresh.R
```

The OHL processing script is:

```text
scripts/processing/ohl_process_all.R
```

Refresh history is stored at:

```text
data/ohl/metadata/refresh_log.csv
```

The latest successful refresh timestamp is stored at:

```text
data/ohl/metadata/last_updated.json
```

The website is deployed through GitHub Pages.

Scheduled refresh execution may be delayed by GitHub Actions.

---

## [0.6.0] - Previous Development Release

### Data Engine Foundation

Version 0.6.0 established the central IceIndex data refresh architecture.

### Added

- Master R refresh script.
- Project preflight verification.
- Shared configuration initialization.
- API client initialization.
- OHL collector registry.
- Sequential collector execution.
- Before-and-after data inventories.
- File change detection.
- CSV data quality checks.
- Collector execution timing.
- Refresh history logging.
- System health reporting.
- OHL skater and goaltender processing orchestration.

### Data Collection

Introduced the registered OHL collection pipeline:

- OHL seasons
- OHL teams
- OHL players
- OHL skater statistics
- OHL goaltender statistics

### Infrastructure

- Independent R data collection system.
- Organized current and historical data directories.
- Metadata storage.
- Refresh logging.
- GitHub repository integration.

---

## [0.5.0] - Earlier Development

### Platform Foundation

IceIndex developed as an independent hockey data platform with its own repository, website, and data collection architecture.

### Highlights

- Standalone IceIndex project structure.
- HTML, CSS, and JavaScript website foundation.
- OHL statistical data integration.
- R-based collection scripts.
- Central refresh orchestration.
- GitHub Pages hosting.
- Early dashboard and navigation development.

---

## Planned: [0.8.0]

### Player Discovery and Data Exploration

The next development release is expected to focus on usability, statistical exploration, and player discovery.

Potential features include:

- Global player search.
- Shareable player profile URLs.
- Sortable statistical tables.
- CSV exports.
- Statistical definitions and methodology.
- Mobile interface improvements.
- Additional data validation.
- Historical performance charts.
- Expanded player discovery tools.

These features are planned and are not part of the completed v0.7.0 release.

---

## Long-Term Roadmap

### Additional Leagues

- Western Hockey League (WHL).
- Quebec Maritimes Junior Hockey League (QMJHL).
- Multi-league statistical exploration.

### Advanced Analytics

- Expanded scouting tools.
- Player development analysis.
- Historical performance comparisons.
- Advanced statistical models.
- Multi-season statistical visualizations.

### Data Infrastructure

- Additional automated collectors.
- Expanded historical coverage.
- Enhanced pipeline monitoring.
- Improved data documentation.
- Scalable multi-league processing.

---

## Project Information

**Project:** IceIndex

**Current Version:** 0.7.0

**Developer:** Noah Cornish

**Repository:** https://github.com/NoahCornish/IceIndex

**Website:** https://noahcornish.github.io/IceIndex/

---

*Every player. Every league. One index.*