
# IceIndex — Changelog

All notable changes to IceIndex are documented here.

IceIndex is an independent Ontario Hockey League player
statistics and analytics platform powered by OHLDataHub.

This project follows a version numbering convention:

- MAJOR: Significant architectural or compatibility changes
- MINOR: New features and substantial improvements
- PATCH: Bug fixes, performance improvements and maintenance

Release status:
v0.2.0 source files prepared; production verification pending.

---

## [0.2.0] — 2026-11-10

### Mobile Database Improvements

- Introduced a compact five-column player statistics table
  for mobile devices.
- Mobile columns display:
  - Player
  - GP
  - G
  - A
  - PTS
- Preserved the expanded desktop statistics table.
- Reduced unnecessary horizontal scrolling in the mobile
  database layout.
- Added smaller player headshots within compact player rows.
- Retained clickable player names and profile navigation.
- Added responsive table visibility rules.
- Improved pagination controls for smaller screens.
- Preserved the existing dark navy and ice-blue design.

### Player Database

- Added client-side pagination with 100 records per page.
- Added live player and team searching.
- Added filtering by OHL season.
- Added filtering by team.
- Added sorting by:
  - Points
  - Goals
  - Assists
  - Games played
  - Points per game
- Added a clear-filters control.
- Added record counts and visible pagination ranges.
- Preserved current and historical database access.

### Player Profiles

- Preserved individual player profile pages.
- Added selectable OHL seasons.
- Added career statistical summaries.
- Added season-by-season statistical history.
- Added points-per-game development visualization.
- Added available scoring breakdowns.
- Added season-specific production percentile calculations.
- Added direct navigation from a player profile to
  player comparisons.
- Improved handling of unavailable statistical fields.

### Player Comparisons

- Preserved head-to-head player comparisons.
- Added independent season selection for each player.
- Supported comparisons between different historical years.
- Included career and single-season statistical views.
- Added visual highlighting of higher statistical values.
- Included goals, assists, points, games played,
  points per game, power-play points and penalty minutes.

### Draft Year Central

- Added estimated NHL draft-year cohort filtering.
- Used normalized birthdates for cohort calculations.
- Added draft-year selection.
- Added player searching within draft cohorts.
- Added scoring and production sorting.
- Added an eligibility disclaimer.

Draft-year estimates do not independently verify
actual NHL draft eligibility, previous selection status,
or individual exceptions.

### Team Explorer

- Preserved all 20 current OHL teams.
- Preserved team logo rendering and team abbreviations.
- Added current skater counts.
- Added navigation from team cards to filtered
  player database records.
- Extended recognition of historical OHL team names.
- Added historical franchise successor information
  to the branding data.

### Data Engine

- Reworked js/ohl-data.js for IceIndex v0.2.0.
- Added shared in-memory request caching.
- Added in-flight request deduplication.
- Added fetch timeouts and limited retries.
- Added handling for missing historical season files.
- Added a CSV parser supporting quoted values,
  embedded commas and multiline fields.
- Added flexible CSV column-name matching.
- Added standardized statistical record normalization.
- Added season-label normalization.
- Added normalized player birthdates.
- Added HockeyTech PlayerID normalization.
- Added player-directory enrichment.
- Added optional prebuilt historical archive support.
- Added bounded-concurrency historical CSV loading.
- Added archive progress callbacks.
- Added public diagnostic utilities.

### Current-Season Loading

- Started current-season statistics and player-directory
  requests concurrently.
- Prioritized current-season rendering before historical
  archive completion.
- Moved historical archive loading into a background
  asynchronous stage.
- Preserved the ability to browse current-season data
  while historical records are loading.
- Added loading progress and status messaging.

A five-second loading target remains a performance goal.
It is not a guaranteed or independently benchmarked result.

### Player Identity and Headshots

- Added PlayerID-based directory lookup.
- Added normalized name and birthdate matching.
- Added unique-name fallback matching when possible.
- Added support for the BD birthdate field.
- Added support for PhotoURL.
- Added HockeyTech PlayerID headshot fallback URLs.
- Added initials-based fallback when images are unavailable.
- Added image error handling to prevent broken image icons.

### OHL Branding

- Preserved the existing current-team logo filename mappings.
- Added structured historical team records.
- Added historical team-name aliases.
- Added team-code lookup helpers.
- Added franchise successor-chain lookup.
- Added safe HTML escaping for branding output.
- Added fallback abbreviations for teams without
  available logo assets.
- Avoided automatically substituting modern successor
  logos for historical franchise identities.

Historical team logo files have not all been verified.

### Navigation and Interface

- Preserved the existing IceIndex visual theme.
- Preserved mobile sidebar navigation.
- Added navigation overlay dismissal.
- Added Escape-key menu closing.
- Added hash-based page routing.
- Added active navigation states.
- Preserved the introductory loading popup.
- Added session-based popup dismissal.
- Added loading-error messaging and retry controls.
- Added accessibility labels to key interactive controls.

### Documentation

- Updated README.md for v0.2.0.
- Documented the data architecture.
- Documented GitHub Pages deployment.
- Documented current and historical CSV paths.
- Documented player-directory requirements.
- Documented new-season update procedures.
- Documented planned playoff support.
- Documented known statistical limitations.

### Known Limitations

- Full production-browser testing remains outstanding.
- Current-team logo URLs require live verification.
- Historical logo coverage remains incomplete.
- Historical archive loading may exceed five seconds.
- Historical CSV availability depends on OHLDataHub.
- Some historical players may lack PlayerIDs or birthdates.
- Name-only player matching may be ambiguous.
- Traded-player season aggregation requires further
  verification against authoritative season totals.
- Some statistical fields are unavailable for older seasons.
- Goaltender statistics are not implemented.
- Playoff statistics are not implemented as a separate view.
- Draft-year cohorts are estimates, not official lists.
- Browser performance has not yet been formally benchmarked.

---

## [0.1.0] — Initial Stabilization

### Added

- IceIndex application identity and branding.
- Current-season OHL player database.
- Historical OHL player statistics integration.
- Player search and filtering.
- Individual player profile pages.
- Career statistics and season histories.
- Player comparison functionality.
- Draft-year analysis interface.
- OHL Team Explorer.
- Introductory loading popup.
- Player headshot support.
- Mobile-responsive application layout.

### Improved

- Current-season data loading priority.
- Historical data loading behavior.
- Player directory integration.
- PlayerID-based image resolution.
- Birthdate matching between data sources.
- Missing-image handling.
- Navigation between application sections.
- General loading-state messaging.

### Stabilization Work

- Separated application logic, data loading,
  and team branding into individual JavaScript files.
- Introduced background historical archive loading.
- Added support for an optional historical JSON bundle.
- Improved player identity matching across seasons.
- Reduced blocking behavior during initialization.
- Preserved the original dark IceIndex design.

### Known Limitations

- Historical CSV loading remained network-intensive.
- Player headshots were not consistently available.
- Historical traded-player totals required verification.
- Some mobile layouts were insufficiently compact.
- The loading popup did not guarantee a fixed load time.
- The optional archive build process required testing.

---

## Planned — v0.2.1

### Stability and Quality Assurance

- Test every current OHL team logo.
- Validate mobile layouts on iPhone and Android.
- Verify all navigation controls.
- Test player search, filtering and sorting.
- Verify current-season player counts.
- Validate historical archive loading.
- Verify player identity matching.
- Investigate traded-player career aggregation.
- Test loading failures and recovery.
- Measure page loading performance.

### Performance

- Investigate compact precomputed historical data.
- Reduce unnecessary historical network requests.
- Improve data caching.
- Optimize initial rendering.
- Evaluate compressed archive delivery.
- Reduce JavaScript work on the main thread.

---

## Planned — v0.3.0

### Expanded Player Analytics

- Additional player statistics.
- Improved position-specific leaderboards.
- More detailed player development analysis.
- Advanced comparison metrics.
- Improved historical percentile calculations.
- Better statistical treatment of traded players.
- Age-adjusted production analysis.

---

## Planned — v0.4.0

### Scouting and Research Tools

- Player similarity analysis.
- Expanded draft-year analytics.
- Exportable player reports.
- Improved player development charts.
- Historical team comparisons.
- Advanced scouting dashboards.

---

## Future Development

Potential longer-term features include:

- OHL playoff statistics
- Goaltender statistics
- Historical team records
- Franchise statistical histories
- Season leaderboards
- Advanced scoring metrics
- Optimized precomputed career statistics
- Expanded scouting tools

These features are not part of the current v0.2.0 release.

---

## Data Source

IceIndex uses data from OHLDataHub.

Repository:
https://github.com/NoahCornish/OHLDataHub

Current-season data:
data/current/skaters.csv

Player directory:
data/player_directory.csv

Historical data:
data/historical/YYYY-season/skaters.csv

Optional historical archive:
data/iceindex/archive.json

The master current-data update script is:

scripts/updated_current_data.R

---

## Release Notes

Version 0.2.0 focuses on making IceIndex more practical
for everyday OHL research.

The main priorities are:

1. A compact mobile statistics database.
2. Reliable player profiles and headshots.
3. Accessible current and historical statistics.
4. Functional player comparisons.
5. Faster access to current-season data.
6. Consistent OHL team branding.
7. A stable foundation for future scouting tools.

The v0.2.0 source package is prepared for deployment
and validation. Features described above reflect the
implementation, not independently verified production
behavior.

---

IceIndex — Ontario Hockey League Player Analytics

Powered by OHLDataHub.

Independent project. Not affiliated with the OHL,
CHL, NHL, or their member clubs.
