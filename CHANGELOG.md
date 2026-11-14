
# IceIndex Changelog

All notable changes to IceIndex are documented in this file.

IceIndex follows a development-oriented version numbering system.

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
- Added support for pending, approved and rejected accounts.
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

### v0.12.1 — Game Export Studio Refinement

Planned improvements:

- Improved PNG report formatting.
- Better table alignment.
- Cleaner statistical presentation.
- Enhanced scoreboard design.
- Improved scoring and penalty layouts.
- More consistent report typography.
- Improved report spacing.
- Additional export quality checks.

### Future Releases

Potential development areas:

- Protected server-side report generation.
- Subscription management.
- Premium analytical tools.
- Expanded historical datasets.
- Additional league support.
- Advanced player and team analytics.

---

**IceIndex — Hockey Data Intelligence**

*Every player. Every league. One index.*