
# IceIndex Changelog

All notable changes to IceIndex are documented in this file.

IceIndex follows a development-oriented version numbering system.

---

## [0.14.0] — 2026-11-15

### Mobile Experience & Navigation Overhaul

Version 0.14.0 focuses on making IceIndex more responsive, readable, and accessible across smartphones, tablets, laptops, and desktop computers.

The release introduces significant interface refinements while preserving existing statistical functionality and the independent data engine.

### Added — Mobile Experience

- Introduced additional mobile-focused responsive styling.
- Added `mobile-overhaul.css`.
- Added responsive layout rules for smaller displays.
- Added screen-height-aware navigation adjustments.
- Added additional safeguards against horizontal page overflow.
- Added improved table overflow handling.
- Added responsive chart-container styling.
- Added mobile-specific spacing and sizing adjustments.
- Improved touch-target sizing.

### Changed — Navigation

- Reorganized navigation into clearer sections.
- Introduced a more compact, grouped navigation drawer.
- Improved navigation item spacing.
- Reduced excessive padding and indentation.
- Improved expandable navigation sections.
- Refined navigation behaviour on shorter screens.
- Improved sidebar layout for desktop and laptop displays.
- Preserved existing navigation routes.
- Preserved league selection.
- Preserved expandable Players, Goalies, and Analytics groups.

### Changed — League Navigation

- Updated the Essentials navigation heading.
- OHL displays `OHL ESSENTIALS`.
- WHL displays `ESSENTIALS`.
- QMJHL displays `ESSENTIALS`.
- Preserved other navigation headings.

### Changed — Teams Navigation

- Removed Teams as a visible navigation option.
- Preserved the underlying Teams functionality.
- Deferred team interface redevelopment to a future release.

### Changed — Overview

- Removed the Production Rankings section.
- Preserved the four Players Setting the Pace cards.
- Preserved Today's OHL Games.
- Improved spacing and layout consistency.
- Reduced unnecessary interface clutter.

### Changed — Game Presentation

- Increased the size of compact game displays.
- Enlarged team logos.
- Improved score readability.
- Improved matchup text sizing.
- Increased spacing between important game elements.
- Improved mobile placement of arena information.
- Preserved existing Game Centre functionality.

### Changed — Branding

- Improved IceIndex header alignment.
- Positioned the IceIndex logo beside the website title.
- Improved spacing around branding elements.
- Preserved the existing IceIndex visual identity.

### Changed — Player Database

- Improved responsive statistical tables.
- Reduced unnecessary table spacing.
- Improved numerical alignment.
- Improved readability of player names.
- Added overflow safeguards for narrow displays.
- Improved filter and control spacing.

### Changed — Player Profiles

- Improved mobile headshot sizing.
- Refined player information layouts.
- Improved career statistics table presentation.
- Improved handling of wide statistical tables.
- Added horizontal scrolling safeguards.
- Improved Player Development Tracker chart containers.
- Reduced clipping of chart content on smaller screens.

### Changed — Analytics & Comparisons

- Improved responsive chart sizing.
- Improved mobile spacing.
- Added safeguards against chart overflow.
- Improved layout handling for comparison views.
- Preserved existing analytical calculations.

### Changed — Standings, Leaders & Form

- Preserved the three-tab interface.
- Maintained equal-width tab buttons.
- Improved mobile leaderboard layouts.
- Improved statistical category controls.
- Preserved the 10-game minimum leaderboard eligibility rule.
- Preserved the 5-, 10-, and 15-game Form Tracker.

### Preserved

- Existing player database
- Historical player statistics
- Player profiles
- Goaltender profiles
- Player comparisons
- Draft Year Central
- Player analytics
- Game Centre
- Game sharing
- Interactive shot maps
- Standings, Leaders & Form
- Membership authentication
- Administrator dashboard
- Game Export Studio
- Day and night themes
- League selection
- Data refresh indicators
- R data engine
- GitHub Actions workflows

### Notes

- Version numbering remains at v0.14.0 throughout the mobile refinement work.
- The desktop sidebar was not replaced with a horizontal top-navigation system.
- Teams is hidden from navigation rather than deleted from the application.
- Some detailed tables intentionally use horizontal scrolling on smaller screens.
- The underlying data-processing architecture remains unchanged.

---

## [0.13.0] — 2026-11

### Game Centre, Standings, Leaders & Form

Version 0.13.0 expands IceIndex's current-season functionality with improved game presentation, statistical leaderboards, and recent-performance tracking.

### Added — Standings, Leaders & Form

- Introduced a combined Standings, Leaders & Form page.
- Added three selectable views.
- Added tab-based switching without navigating to separate pages.
- Added mobile-friendly equal-width tab controls.

### Added — Standings

- Introduced the Standings interface.
- Added a Coming Soon placeholder.
- Established the interface for future official standings integration.

### Added — Statistical Leaders

- Introduced top-five player leaderboards.
- Added player headshots.
- Added team identification.
- Added links to individual player profiles.
- Added statistical category selection.

### Leaderboard Categories

- Points
- Goals
- Assists
- Points per game
- Power-play points
- Power-play assists
- Power-play goals
- Penalty minutes
- Shots
- Shooting percentage

### Changed — Leaderboard Eligibility

- Established a minimum requirement of 10 games played.
- Applied the eligibility requirement across all ten categories.
- Excluded players below the minimum threshold.

### Added — Form Tracker

- Introduced recent-performance rankings.
- Added selectable sample windows:
  - Last 5 games
  - Last 10 games
  - Last 15 games
- Added recent-performance leaderboards.
- Integrated available player game-log information.

### Form Tracker Categories

- Points
- Goals
- Assists
- Points per game
- Shots
- Shooting percentage

### Form Tracker Eligibility

- Preserved the minimum 10-game season eligibility requirement.
- Required sufficient recorded games for the selected sample window.

### Changed — Game Centre

- Refined the compact scoreboard layout.
- Improved game-date navigation.
- Improved game-card spacing.
- Reduced unnecessary interface elements.
- Improved team logo presentation.
- Improved mobile readability.

### Changed — Team Branding

- Added local logo support for selected OHL teams.
- Integrated custom Brampton Steelheads logo handling.
- Integrated custom Niagara IceDogs logo handling.
- Protected selected local logo assets from automated replacement.
- Preserved existing branding behaviour for other teams.

### Preserved

- Existing Game Centre functionality
- Player profiles
- Goaltender profiles
- Game sharing
- Shot maps
- Membership system
- Game Export Studio
- Historical player statistics
- Data refresh infrastructure

### Known Limitations

- Official standings data is not yet integrated.
- Form Tracker accuracy depends on available game-log records.
- Historical season leaderboards remain future development work.

---

## [0.12.0] — 2026-11-14

### Membership & Game Export Studio

Version 0.12.0 introduces the first membership infrastructure and downloadable game reporting tools.

This release establishes the foundation for future premium analytics and subscription-based services.

### Added — Member Authentication

- Integrated Supabase Authentication.
- Added member login functionality.
- Added authenticated session management.
- Added persistent login sessions.
- Added account status recognition.
- Added member account controls.
- Added sign-out functionality.
- Added membership interface to the existing website layout.

### Added — Manual Membership Access

- Introduced administrator-controlled membership access.
- Removed public account registration from the website interface.
- Added a Request Access option.
- Added membership inquiry email:
  noahcornish.github@gmail.com
- Added an email link with a prefilled membership request.
- Added a return-to-login option.
- Established a manual account creation and approval process.

### Added — Membership Database

- Added Supabase member profile integration.
- Added support for pending, approved, and rejected accounts.
- Added administrator account identification.
- Added approval status retrieval.
- Added membership state updates within the frontend.

### Added — Administrator Dashboard

- Added member account listings.
- Added membership status controls.
- Added account approval functionality.
- Added account rejection functionality.
- Added the ability to revoke membership approval.
- Added administrator-only access to membership management.
- Added protected approval operations through Supabase RPC.

### Security

- Enabled Row Level Security for membership profiles.
- Added administrator authorization checks.
- Added restricted approval functions.
- Prevented ordinary users from changing approval status through direct database access.
- Prevented browser-based changes to administrator privileges through the exposed approval function.
- Restricted self-approval through the administrator approval function.

### Added — Game Export Studio

- Introduced downloadable PNG reports for individual OHL games.
- Added member-only export controls to the Game Centre interface.
- Integrated export availability with membership approval status.
- Added game report generation using available published statistics.
- Added IceIndex branding to generated reports.

### Game Export Content

Reports can include:

- Game identification
- Team names and scores
- Game dates
- Venue information
- Period statistics
- Scoring plays
- Player statistics
- Goaltender statistics
- Penalty records
- Three stars
- Available shot data

Report content depends on the underlying game records.

### Preserved

- Existing Game Centre navigation
- Share Game functionality
- Direct game links
- Player profile navigation
- Goaltender profile navigation
- Interactive shot maps
- Player statistics
- Goaltender statistics
- League selection
- Mobile navigation
- Day and night themes
- Data refresh status indicators

### Known Limitations

- Game Export Studio report formatting requires additional refinement.
- Membership-based export restrictions currently operate through the browser interface.
- Published game datasets remain publicly accessible.
- Complete server-side protection of report generation is not yet implemented.
- Subscription billing is not implemented.
- Membership approval remains administrator-controlled.

### Future Development

- Improved PNG report layouts
- Protected server-side exports
- Subscription billing integration
- Expanded member-exclusive analytical tools
- Enhanced account administration

---

## [0.11.1] — 2026-11

### Game Sharing & Goaltender Navigation

### Added

- Added Share Game functionality.
- Added direct links to individual games.
- Added native sharing support on compatible devices.
- Added clipboard link copying as a fallback.
- Added support for opening a specific game through a shared URL.

### Fixed

- Updated goaltender links within the Game Centre.
- Routed goaltenders to dedicated goaltender profiles.
- Preserved existing skater profile navigation.

---

## [0.11.0] — 2026-11

### OHL Game Centre

### Added

- Introduced the OHL Game Centre.
- Added season schedule and results.
- Added game filtering.
- Added individual game pages.
- Added team scoreboards.
- Added period breakdowns.
- Added scoring timelines.
- Added player box scores.
- Added goaltender box scores.
- Added penalty information.
- Added three-star information.
- Added interactive shot maps.
- Added game metadata where available.

### Improved

- Mobile presentation of game statistics.
- Team branding and logos.
- Game-level navigation.
- Statistical tables and filtering.

---

## [0.10.x] — 2026

### Website Interface Improvements

### Improved

- IceIndex branding.
- Responsive navigation.
- League selection.
- Day and night themes.
- Player search.
- Game and statistical presentation.
- Data refresh indicators.

---

## [0.9.0] — 2026

### Condensed Overview

### Improved

- Condensed homepage layout.
- Reduced unnecessary interface spacing.
- Improved mobile presentation.
- Simplified navigation.
- Improved information density.

---

## [0.8.x] — 2026

### Data & Application Improvements

### Improved

- Data loading.
- Website functionality.
- Statistical presentation.
- Integration of processed hockey datasets.

---

## [0.7.0] — 2026

### Independent Data Infrastructure

### Development Focus

- Moving IceIndex toward independently generated datasets.
- Reducing reliance on external project data pipelines.
- Organizing data collection within the IceIndex repository.
- Improving automated data publishing.

---

## [0.6.0] — 2026

### Data Engine

### Added

- Centralized R refresh orchestration.
- Data processing script organization.
- Configuration management.
- Data collection task structure.
- GitHub Actions integration.

### Development Focus

- Automated data collection.
- Repeatable processing.
- Independent data management.

---

## [0.5.0] — 2026

### Homepage & Mobile Improvements

### Improved

- Condensed homepage.
- Responsive layout.
- League navigation.
- Status indicators.
- Mobile usability.

---

## [0.4.0] — 2026

### Multi-League Architecture

### Added

- Multi-league homepage structure.
- League selection interface.
- Foundation for additional CHL leagues.

### Preserved

- Existing OHL functionality.
- Player databases.
- Player profiles.
- Analytics and comparisons.

---

## [0.3.0] — 2026

### Player Analytics

### Added

- Player analytics interface.
- Percentile-based comparisons.
- Radar charts.
- Scatter plots.
- Player card generation.
- Expanded player comparison tools.

---

## [0.2.0] — 2026

### IceIndex Rebrand

### Changed

- Rebranded the project to IceIndex.
- Updated website identity.
- Improved mobile navigation.
- Refined player database layouts.

### Added

- Expanded player profiles.
- Career statistical summaries.
- Player comparison improvements.
- Draft-year tools.
- Team exploration improvements.

---

## [0.1.0] — 2026

### Initial Release

### Added

- Initial hockey data website.
- OHL player database.
- OHL team database.
- Player profiles.
- Basic player statistics.
- Search and filtering.
- Initial responsive website layout.

---

## Upcoming Development

### Near-Term Priorities

- Complete official OHL standings integration.
- Improve Game Export Studio report formatting.
- Refine responsive layouts.
- Expand historical season leaderboards.
- Introduce goaltender leaderboards.
- Improve Form Tracker functionality.
- Expand historical game data.

### Future Releases

Potential development areas:

- Protected server-side report generation
- Subscription management
- Premium analytical tools
- Expanded historical datasets
- WHL and QMJHL data integration
- Advanced player and team analytics
- Redesigned team profiles
- Expanded shot-map functionality
- Advanced player evaluation models

---

## Version Summary

| Version | Major Development |
|---|---|
| 0.14.0 | Mobile Experience & Navigation Overhaul |
| 0.13.0 | Game Centre, Standings, Leaders & Form |
| 0.12.0 | Membership & Game Export Studio |
| 0.11.1 | Game Sharing & Goaltender Navigation |
| 0.11.0 | OHL Game Centre |
| 0.10.x | Website Interface Improvements |
| 0.9.0 | Condensed Overview |
| 0.8.x | Data & Application Improvements |
| 0.7.0 | Independent Data Infrastructure |
| 0.6.0 | Data Engine |
| 0.5.0 | Homepage & Mobile Improvements |
| 0.4.0 | Multi-League Architecture |
| 0.3.0 | Player Analytics |
| 0.2.0 | IceIndex Rebrand |
| 0.1.0 | Initial Release |

---

**IceIndex — Hockey Data Intelligence**

**Current Version: v0.14.0**

*Every player. Every league. One index.*