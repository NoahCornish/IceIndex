
# Changelog

All notable changes to IceIndex are documented in this file.

Version numbering follows the project's development milestones.

---

## [0.10.0] - 2026-11-13

### Major Release: Interactive Shot Maps & Interface Refinement

Version 0.10.0 introduces interactive shot-location analytics, enhanced player-event information, and a new day/night appearance system.

This release focuses on improving player profiles, event visualization, and overall website presentation.

### Added

#### Interactive Shot Maps

- Added player shot and goal location maps.
- Added recorded event markers.
- Added separate visual identification for shots and goals.
- Added Dots and Zones visualization modes.
- Added shot-event type filtering.
- Added period filtering.
- Added event counts and shot/goal summaries.
- Added interactive event-detail panels.
- Added desktop hover interactions.
- Added click-to-open event information.
- Added mobile tap interactions.
- Added keyboard-accessible marker interactions.
- Added support for available event-level metadata.
- Added attacking-half rink visualization.

#### Event Information

- Added game-date information to event details.
- Added opposing-team information where available.
- Added period and game-clock information when recorded.
- Added game-score information when available.
- Added support for goalie information where recorded.
- Added support for goal-assist information where recorded.
- Added clearer identification of goals versus shots.
- Added readable event-information layouts.

#### Shot-Location Processing

- Added processing support for shot and goal event coordinates.
- Added normalization of attacking direction.
- Added team/game-based attacking-direction inference.
- Added support for retaining original event coordinates.
- Added processed player shot-location CSV output.
- Added support for event metadata in the shot-location pipeline.

#### Day/Night Appearance

- Added automatic theme switching based on Eastern Time.
- Added the original Navy & Ice Blue daytime theme.
- Added the Amber & Graphite nighttime theme.
- Added a manual sun/moon theme control.
- Added automatic daytime activation at 7:00 AM.
- Added automatic nighttime activation at 5:00 PM.
- Added coordinated nighttime styling for shot maps and controls.

### Changed

#### Shot-Map Presentation

- Reworked the initial shot-coordinate visualization.
- Improved rink-coordinate scaling and positioning.
- Replaced the original full-rink display with an attacking-half presentation.
- Updated rink proportions and visual styling.
- Improved shot and goal marker contrast.
- Improved marker-information panel readability.
- Updated shot-map styling for both themes.
- Reduced unnecessary technical information displayed to users.
- Added disclosure for events outside the visible rink area.

#### Player Profiles

- Simplified player-profile descriptions.
- Improved the visual hierarchy of profile information.
- Reduced redundant explanatory text.
- Improved integration between player statistics and shot maps.

#### Website Interface

- Simplified page headings and introductory descriptions.
- Removed unnecessary development-oriented text.
- Reduced redundant labels.
- Improved spacing and consistency.
- Refined navigation presentation.
- Improved consistency between statistical panels.
- Preserved responsive desktop and mobile layouts.

#### Status Indicator

- Improved the refresh-status information panel.
- Adjusted panel positioning to avoid overlapping content.
- Improved readability of refresh timestamps.
- Integrated the theme switch beside the status indicator.

### Fixed

- Corrected earlier shot-map coordinate placement issues.
- Improved alignment between event markers and rink geometry.
- Corrected several attacking-direction visualization problems.
- Improved consistency between Dots and Zones modes.
- Improved handling of events outside the attacking-half display.
- Improved marker interaction behaviour on smaller screens.
- Improved event-detail panel positioning.
- Removed unexplained numeric shot-type codes from the visible event panel.
- Improved separation between final game scores and event-specific information.

### Data Integrity

- Original recorded event coordinates are retained in the source data.
- Events excluded from the half-rink visualization are not deleted from the dataset.
- Displayed shot and goal counts should distinguish visible events from total available events.
- Event details are populated only when corresponding data fields are available.
- No expected-goals values are generated without an underlying statistical model.

### Known Limitations

- Shot-map coverage currently focuses on 2026–27.
- Historical shot-map support is not yet complete.
- Event metadata availability varies between games.
- Goalie and assist information may be missing.
- Shot-type codes require verified mappings.
- Some attacking directions are inferred.
- Events outside the displayed attacking half are not plotted.
- Full end-to-end browser and dataset validation remains necessary before final release.

---

## [0.9.0] - Previous Development Release

### Changed

- Introduced the condensed IceIndex overview layout.
- Refined the website's multi-page navigation.
- Improved the organization of OHL statistics and player exploration.
- Established the condensed overview as the baseline for subsequent development.

---

## [0.8.0] - Previous Development Release

### Added

- Independent OHL data-loading infrastructure.
- Historical player-statistics support.
- Regular-season and playoff data handling.
- Expanded goalie statistics infrastructure.
- Team-branding and historical franchise support.
- Maintenance controller functionality.

---

## [0.7.0] - Previous Development Release

### Changed

- Transitioned website data sourcing toward IceIndex's independent processed CSV infrastructure.
- Reduced architectural dependence on external project data pipelines.

---

## Future Development

### Planned

- Historical shot-map expansion
- Additional OHL season support
- Verified shot-type descriptions
- Richer game-event information
- Improved goalie attribution
- More complete goal-assist attribution
- Expanded player analytics
- Team-level shot maps
- Additional league coverage
- Improved automated data maintenance

---

**IceIndex — Independent Hockey Data & Analytics**