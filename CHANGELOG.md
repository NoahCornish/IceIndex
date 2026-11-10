
# Changelog

All notable changes to CHL Data Hub are documented here.

## [0.1.0] - 2026-11-10

### Added

- Initial public OHL analytics release
- Responsive desktop and mobile navigation
- Current-season league overview
- Scoring leaders and production rankings
- Historical OHL player database
- Historical season and team filters
- Individual player profiles
- Combined OHL career statistics
- Season-by-season player history
- Player production development charts
- Position-group seasonal percentiles
- Historical player comparisons
- Same-player season comparisons
- Draft Year Central
- Estimated NHL first-draft-age cohorts
- Current OHL team explorer
- OHLDataHub GitHub data integration
- Loading progress and error handling

### Changed

- Renamed Scouting Reports to Player Profile
- Consolidated application functionality into app.js
- Consolidated all styling into style.css
- Improved mobile layouts and image framing
- Removed the Chart.js dependency

### Removed

- Legacy scouting-ui.js dependency
- Fictional players.json dependency
- Obsolete Phase 2 setup instructions

### Known Limitations

- Historical player matching uses names and birthdates
- Some historical records may be incomplete
- Draft-year estimates are not official eligibility decisions
- Historical data requires multiple network requests
- Goaltender statistics are not yet supported
- Playoff statistics are not yet supported
