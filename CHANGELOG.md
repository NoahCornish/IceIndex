
# IceIndex Changelog

All notable changes to IceIndex are documented here.

IceIndex is an independent hockey data intelligence platform focused on player statistics, historical records, and analytics.

---

## [0.9.0] - 2026-11-12

### Added

- Introduced a compact, mobile-friendly filtering interface for the OHL Statistics Database.
- Added an expandable **All Filters** panel containing:
  - Team filtering
  - Position filtering
  - Statistic sorting
  - Minimum games played
  - Minimum and maximum statistic values
  - Ascending and descending sorting
  - CSV export
  - Clear all filters
- Added a separate **Columns** panel for customizing visible statistics.
- Added an interactive data-status indicator in the application header.
- Added a status popover displaying the latest recorded data refresh timestamp and data freshness information.
- Added visual indicators for recent, delayed, and reported failed data refreshes.

### Changed

- Reorganized the Statistics Database controls to prioritize Search, Competition, and Season.
- Replaced the larger statistics summary cards with a compact inline summary displaying:
  - Number of matching skaters
  - Selected season
  - Active sorting statistic
  - Number of visible columns
- Abbreviated player first names in the Statistics Database table to improve readability, particularly on mobile devices.
- Preserved full player names in search results and player profiles.
- Improved the organization of advanced filtering and column-selection controls.
- Updated application version references to v0.9.0.

### Improved

- Reduced visual clutter in the Statistics Database.
- Improved access to statistics filters on smaller screens.
- Maintained horizontal scrolling for wide statistics tables.
- Improved visibility of data freshness information.
- Distinguished data refresh status from website uptime.

### Technical

- Updated `index.html`, `css/style.css`, and `js/app.js`.
- Preserved the existing OHL data loading architecture.
- Preserved existing GitHub Actions and data refresh workflows.
- Verified JavaScript syntax successfully.

### Verification

The changes above were confirmed through source-code inspection.

Full browser-based functional testing and live deployment verification have not been completed.

---

## Project

**IceIndex — Hockey Data Intelligence**

Repository: https://github.com/NoahCornish/IceIndex

Website: https://noahcornish.github.io/IceIndex/