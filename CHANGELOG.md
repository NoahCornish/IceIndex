
# Changelog

Notable IceIndex changes are documented here. Version 0.5.0 focuses on navigation and interface structure; additional league integrations remain future work.

## [0.5.0] — 2026-11-10

### Interface and navigation refinement

#### Added

- Compact, expandable sidebar navigation with six primary destinations: **Home**, **League Directory**, **Overview**, **Players**, **Teams**, and **Analytics**.
- **Players** submenu for Player Database, Player Profiles, Player Comparison, and Draft Year Central.
- **Analytics** submenu for Player Analytics, with room for future tools.
- Automatic submenu expansion for direct links and active-route highlighting.
- Active-league dropdown showing **OHL** as available and **WHL/QMJHL** as coming soon.
- Small top-bar data-status indicator with loading, ready, and error visual states based on the application's status message.

#### Changed

- Consolidated navigation by removing multiple always-visible category headings.
- Reduced repetitive season and data-source labels in the top bar and sidebar footer.
- Simplified sidebar footer to version information and a GitHub link.
- Refined mobile navigation with a dedicated close control.
- Updated visible release labels and asset version query strings to **v0.5.0**.

#### Preserved

- Existing OHL routes: `#home`, `#leagues`, `#overview`, `#players`, `#profile`, `#compare`, `#draft`, `#teams`, and `#analytics`.
- Existing OHL data and analytics modules and application integration IDs.

#### Notes

- **OHL remains the only supported league.** WHL and QMJHL are interface placeholders, not live integrations.
- The status dot reflects messages reported by the application; it is not an independent uptime or data-integrity check.
- The updated HTML is intended to work with existing application files, but full browser/integration testing is still required.

## [0.4.0] — 2026-11-10

### Platform foundation

#### Added

- IceIndex-branded homepage and multi-league platform positioning.
- League directory with OHL available and WHL/QMJHL marked as planned.
- Featured OHL player content and navigation into the OHL workspace.

#### Changed

- Expanded the project's identity beyond an OHL-only presentation while retaining the OHL feature set.
- Refined homepage, sidebar, and shared interface branding.

#### Preserved

- OHL player database, player profiles, player comparisons, draft-year exploration, team explorer, and advanced player analytics.

## [0.3.0] — Earlier release

### Advanced player analytics

- Expanded player analytics with visual performance comparisons.
- Added percentile-based displays, radar/scatter visualizations, and downloadable player-card functionality.

---

**IceIndex** · *Every player. Every league. One index.*
