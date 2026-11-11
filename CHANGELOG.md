
# Changelog

Notable changes to **IceIndex** are documented here.

This changelog establishes **v0.6.0** as the current documented baseline. Earlier releases are not reconstructed without verified release records.

## [Unreleased]

### Planned for v0.7.0

- Migrate the website's data-loading layer from legacy OHLDataHub paths to IceIndex's own processed OHL datasets.
- Validate current-season and historical loading against the independent CSV structure.
- Preserve existing website functionality while verifying player identities, headshots, and competition filters.

> These items are **not included in the v0.6.0 release**. A locally tested replacement JavaScript file does not constitute a published release.

## [0.6.0] — 2026-11-11

### Added

- Centralized R refresh orchestration using `scripts/refresh.R`.
- OHL collectors for seasons, teams, player rosters, skater statistics, and goalie statistics.
- Current and historical OHL data storage with collection metadata.
- Processed skater datasets: player directory, season statistics, career statistics, and team history.
- Processed goalie datasets: goalie directory, season statistics, career statistics, and team history.
- Consolidated processing workflow using `scripts/processing/ohl_process_all.R`.
- Refresh history reporting in `data/ohl/metadata/refresh_log.csv`.

### Improved

- Player and goalie identity validation, duplicate detection, and career-statistic reconciliation.
- Data-quality reporting that distinguishes critical CSV problems from optional missing values and intentionally empty audit files.
- Final refresh summary showing collector outcomes, processing results, file changes, and system health.

### Verified

A local refresh on **November 11, 2026** reported:

- **6/6** refresh tasks successful.
- **0** recorded errors and **0** recorded warnings in the master refresh summary.
- **162** CSV files inspected and **0** CSV read failures.
- **0** critical CSV issues.
- **8,132** skater profiles and **662** goalie profiles.
- **25,081** processed skater season records and **2,305** processed goalie season records.
- **10,122** skater career records and **1,037** goalie career records.
- **516** current-season skater records and **52** current-season goalie records collected.

These figures are a dated local validation snapshot, not permanent dataset totals.

### Known Limitations

- The production website's transition to the independent IceIndex processed-data source is reserved for **v0.7.0**.
- The goalie processing log indicates that career save percentage was unavailable where the required saves/shots-against inputs were missing; career goals-against average was calculated.
- The player collector still listed **14 previously tracked historical roster failures**, despite reporting no new failures during the validation run.
- Some optional source metadata fields are blank; these are not automatically treated as critical data failures.

---

## Versioning

IceIndex uses `MAJOR.MINOR.PATCH` release labels. The project version is **v0.6.0** until the maintainer explicitly publishes a new release. Script maintenance and local experiments do not automatically change the project version.