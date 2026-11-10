
# Changelog

Notable changes to **IceIndex**, an independent Ontario Hockey League player analytics website powered by OHLDataHub.

The project uses `MAJOR.MINOR.PATCH` version numbers. Entries describe development changes; they are **not** a guarantee that all features have passed live-browser acceptance testing.

## [0.3.0] — 2026-11-10 (development build; verification pending)

### Added

- **Player Analytics** view for exploratory OHL skater analysis.
- Scouting-style **production percentile cards**, using selectable cohort criteria where supported by the analytics engine.
- **Radar comparison** visualization for player percentile metrics.
- **Scatter plot explorer** for comparing player production measures.
- Searchable player selection controls in the revised application UI.
- **PNG player-card export** using browser canvas, with an attempted player-headshot load and initials fallback when remote image access is unavailable.

### Changed

- Refined the dark navy and ice-blue interface for analytics, scouting cards and responsive layouts.
- Updated radar display logic to favor metrics with usable values for compared players, reducing blank or invalid polygons.
- Preserved current-season-first loading, with historical data loaded separately when available.
- Retained League Overview, Player Database, Player Profiles, Player Comparison, Draft Year Central and Team Explorer.

### Integration notes

- The v0.3.0 application expects the `loadOHLCurrent()` and `loadOHLHistory()` functions supplied by the existing `ohl-data.js` module.
- An earlier, separately pasted four-part `app.js` reconstruction used incompatible, guessed data-engine method names and produced a **“No current OHL skater data was returned”** error during local testing. Do not combine that reconstruction with the existing loader.
- The replacement `app.js` has passed a JavaScript syntax check, **not** a full browser integration test. Live data fetching, player search, radar rendering and PNG export still require verification.
- The canvas export attempts to include a player headshot, but external CORS policy can prevent it. Embedded team-logo export is **not confirmed** in this build.
- Draft-year grouping is estimated and should not be interpreted as official OHL/NHL draft eligibility.

### Known verification tasks

- Confirm successful current OHL data loading against the deployed OHLDataHub CSV schema.
- Confirm historical season loading and deduplication.
- Test player selection, navigation and comparisons across multiple seasons.
- Test radar charts and percentile cohorts with missing or sparse statistics.
- Test PNG downloads, especially headshot behavior in Chrome and mobile browsers.
- Verify small-screen layouts and keyboard accessibility.

## [0.2.0] — 2026-11-10 (source prepared; production verification pending)

### Added and improved

- Compact mobile player table with **Player, GP, G, A and PTS** columns.
- Desktop player statistics table retained alongside the mobile view.
- Client-side pagination, live player/team search and season/team filters.
- Sorting by points, goals, assists, games played and points per game.
- Individual player profiles with career summaries, seasonal history and production visualizations.
- Player comparisons, draft-year exploration and team browsing.
- Player headshots where available, plus responsive controls and dark-theme refinements.

## [0.1.0] — Initial development

- Established the IceIndex front-end project and OHLDataHub-powered data-loading architecture.
- Introduced foundational league statistics, player browsing and site navigation.

---

**Data source:** [NoahCornish/OHLDataHub](https://github.com/NoahCornish/OHLDataHub)  
**Project status:** Independent, actively developed; no affiliation with the Ontario Hockey League.
