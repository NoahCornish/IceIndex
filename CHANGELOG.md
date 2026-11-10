
# IceIndex — Changelog

All notable changes to IceIndex are documented here.

This project follows a version-based release structure as it develops into a multi-league hockey analytics platform.

---

## [0.4.0] — 2026-11-10

### Major Release: IceIndex Platform Foundation

Version 0.4.0 represents a major step in the development of IceIndex, transitioning the website from an OHL-focused statistics application toward a broader hockey analytics platform.

### Added

#### New Platform Homepage

- Introduced a dedicated IceIndex landing page.
- Added the headline: *Every player. Every league. One index.*
- Added a featured player spotlight highlighting the current OHL points leader.
- Added direct navigation to league selection, OHL players, and analytics.
- Introduced a platform-wide identity independent of any individual league.

#### League Selection

- Added a dedicated league selection page.
- Introduced league cards for the OHL, WHL, and QMJHL.
- Enabled direct access to the OHL statistics dashboard.
- Added Coming Soon indicators for leagues not yet supported.

#### Platform Navigation

- Added Home and Leagues routes.
- Updated application routing to support platform-level pages alongside OHL-specific pages.
- Added navigation handling for the new sections.

### Changed

#### Branding and Design

- Expanded IceIndex branding beyond the Ontario Hockey League.
- Updated website styling to support the new homepage and league cards.
- Introduced new visual elements for featured players and platform navigation.
- Improved consistency between the main platform and existing OHL analytics sections.

#### Application Architecture

- Extended the existing JavaScript application to support a multi-league interface.
- Separated general IceIndex platform pages from OHL-specific data views.
- Preserved the existing OHL statistics and analytics functionality.
- Allowed platform-level pages to render independently of OHL data availability.

### Maintained

- OHL player database and statistical filtering.
- Individual player profiles.
- Player comparison tools.
- Team Explorer.
- Draft Year Central.
- Player Analytics dashboard.
- Percentile-based scouting cards.
- Radar and scatter plot visualizations.
- Downloadable player analytics cards.
- Current-season and historical OHL data loading.

### Known Limitations

- Only the OHL is currently supported.
- WHL and QMJHL data integrations have not been implemented.
- Featured player statistics depend on current OHL data availability.
- Advanced analytics are limited by the available statistical data.
- Expected goals and shot-map analytics require validated event-level data.

---

## [0.3.0] — Previous Release

### Player Analytics

- Introduced advanced OHL player analytics.
- Added percentile-based player evaluation.
- Added peer-group filtering.
- Added player comparison radar charts.
- Added interactive statistical scatter plots.
- Added analytics leaderboards.
- Added downloadable player analytics cards.

---

## Upcoming Development

### v0.5.0 — Proposed

Potential priorities include:

- Mobile interface refinements.
- Improved player search and discovery.
- Expanded player profile functionality.
- Performance and accessibility improvements.
- Preparation for additional league integrations.

These are proposed development priorities, not confirmed features.

---

**IceIndex**

*Every player. Every league. One index.*