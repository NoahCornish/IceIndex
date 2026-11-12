
# 🏒 IceIndex

### Hockey Data Intelligence

**Every player. Every league. One index.**

[![Version](https://img.shields.io/badge/version-0.7.0-58b8ff)](https://github.com/NoahCornish/IceIndex)
[![Platform](https://img.shields.io/badge/platform-GitHub%20Pages-07111d)](https://pages.github.com/)
[![Language](https://img.shields.io/badge/data%20engine-R-276DC3)](https://www.r-project.org/)
[![League](https://img.shields.io/badge/OHL-Available-22c55e)](https://ontariohockeyleague.com/)
[![License](https://img.shields.io/badge/license-See%20Repository-lightgrey)](https://github.com/NoahCornish/IceIndex)

**IceIndex** is an independent hockey statistics and analytics platform designed to organize, explore, and analyze player performance across junior hockey.

Built using R, JavaScript, HTML, and CSS, IceIndex combines automated data collection with a responsive web interface.

The platform currently supports the **Ontario Hockey League (OHL)**, with future expansion planned for additional leagues.

### 🌐 Live Website

**[Launch IceIndex](https://noahcornish.github.io/IceIndex/)**

**Repository:** [github.com/NoahCornish/IceIndex](https://github.com/NoahCornish/IceIndex)

---

## 📊 Features

### Hockey Data Dashboard

IceIndex provides a central interface for exploring hockey statistics and performance trends.

Features include:

- League overview dashboard
- Player production rankings
- Featured player statistics
- Player performance summaries
- Season-specific statistics
- Historical statistical exploration
- Responsive dashboard navigation

### Player Database

Explore OHL skaters through a searchable statistical database.

Available features include:

- Player identification and team information
- Season statistics
- Career statistics
- Player headshots where available
- Statistical rankings
- Individual player profiles
- Historical player records

### Player Profiles

Individual player pages provide detailed statistical information.

Profiles support:

- Player identification
- Team affiliations
- Season-by-season performance
- Career totals
- Historical statistical records
- Performance analysis

### Player Comparison

Compare player performance using available statistical records.

The comparison interface is designed to support direct evaluation of individual players across selected statistical categories.

### Draft Year Central

Explore players by draft-year groupings to support age-based statistical analysis and player discovery.

### Goaltender Database

IceIndex includes a dedicated goaltender statistics system.

Features include:

- Goaltender directory
- Season statistics
- Career statistics
- Individual goaltender profiles
- Goaltender comparisons
- Historical goaltending records

### Team Exploration

Explore OHL teams and their associated player statistics.

### Player Analytics

IceIndex includes an analytics section designed to support deeper evaluation of player performance.

---

## 🏆 Supported Leagues

| League | Status |
|---|---|
| Ontario Hockey League (OHL) | Available |
| Western Hockey League (WHL) | Planned |
| Quebec Maritimes Junior Hockey League (QMJHL) | Planned |

The OHL is the initial focus of IceIndex.

Additional league support will be introduced as new data collection and processing systems are developed.

---

## ⚙️ IceIndex Data Engine

IceIndex operates its own independent R-based data pipeline.

The data engine is responsible for:

1. Collecting hockey statistics.
2. Processing raw datasets.
3. Maintaining current and historical records.
4. Validating generated data.
5. Recording refresh activity.
6. Publishing updated datasets to the website.

The master orchestration script is:

```text
scripts/refresh.R
```

### OHL Data Collectors

The current pipeline includes five primary collectors.

| Collector | Script |
|---|---|
| OHL Seasons | `collect_seasons.R` |
| OHL Teams | `collect_teams.R` |
| OHL Players | `collect_players.R` |
| OHL Skater Statistics | `collect_skater_stats.R` |
| OHL Goaltender Statistics | `collect_goalie_stats.R` |

Collectors are located in:

```text
scripts/league/ohl/
```

### Data Processing

The OHL processing engine is located at:

```text
scripts/processing/ohl_process_all.R
```

The processing pipeline prepares statistical datasets used by the IceIndex website.

### Data Validation

The master refresh script performs checks including:

- Required project files
- Collector availability
- Directory accessibility
- Collector execution results
- CSV readability
- Critical statistical identifiers
- Missing required columns
- Unexpected empty datasets
- Processing failures

The pipeline records warnings, errors, execution times, and file changes.

---

## 🔄 Automated Data Refresh

IceIndex uses GitHub Actions to execute the data engine automatically.

The workflow is located at:

```text
.github/workflows/refresh.yml
```

### Daily Refresh Schedule

IceIndex is configured to target four refreshes each day in Ontario local time.

| Refresh | Eastern Time |
|---|---|
| Overnight | 3:06 AM |
| Midday | 12:02 PM |
| Evening | 6:03 PM |
| Night | 10:25 PM |

The workflow accounts for Eastern Standard Time and Eastern Daylight Time.

GitHub Actions may delay scheduled workflow execution, so these times are scheduling targets rather than guaranteed execution times.

Manual refreshes are also supported through GitHub Actions.

### Refresh Process

```text
GitHub Actions
      |
      v
Initialize R Environment
      |
      v
Verify Project Structure
      |
      v
Run scripts/refresh.R
      |
      v
Collect OHL Data
      |
      v
Process Skater and Goaltender Statistics
      |
      v
Validate Datasets
      |
      v
Generate Refresh Metadata
      |
      v
Commit Updated Data
      |
      v
GitHub Pages Website
```

### Last Updated Indicator

IceIndex displays the latest successful data refresh timestamp in the website sidebar.

The timestamp is sourced from:

```text
data/ohl/metadata/last_updated.json
```

The indicator displays the timestamp in Eastern Time.

The timestamp reflects the completion of a successful data pipeline refresh, not necessarily the arrival of new game statistics.

---

## 🗂️ Project Structure

```text
IceIndex/
|
|-- index.html
|
|-- css/
|   |-- style.css
|
|-- js/
|   |-- app.js
|   |-- ohl-data.js
|   |-- ohl-goalies.js
|   |-- ohl-analytics.js
|   |-- ohl-branding.js
|   |-- maintenance.js
|
|-- scripts/
|   |-- refresh.R
|   |-- config.R
|   |-- api_client.R
|   |
|   |-- league/
|   |   |-- ohl/
|   |       |-- collect_seasons.R
|   |       |-- collect_teams.R
|   |       |-- collect_players.R
|   |       |-- collect_skater_stats.R
|   |       |-- collect_goalie_stats.R
|   |
|   |-- processing/
|       |-- ohl_process_all.R
|
|-- data/
|   |-- raw/
|   |
|   |-- ohl/
|       |-- current/
|       |-- historical/
|       |-- metadata/
|           |-- refresh_log.csv
|           |-- last_updated.json
|
|-- .github/
|   |-- workflows/
|       |-- refresh.yml
|
|-- README.md
|-- CHANGELOG.md
```

This represents the primary project components. Additional generated data files and supporting scripts may be present.

---

## 💻 Technology Stack

| Technology | Purpose |
|---|---|
| R | Data collection and processing |
| JavaScript | Interactive website functionality |
| HTML5 | Website structure |
| CSS3 | Responsive design |
| GitHub Actions | Automated data refresh |
| GitHub Pages | Website hosting |
| CSV | Statistical data storage |
| JSON | Refresh metadata |

### R Dependencies

The automated workflow installs:

- `httr2`
- `jsonlite`

Additional dependencies may be required by individual collectors or processors.

---

## 🚀 Running the Data Engine

Clone the repository:

```bash
git clone https://github.com/NoahCornish/IceIndex.git
```

Navigate to the project:

```bash
cd IceIndex
```

Install the core R dependencies:

```r
install.packages(c("httr2", "jsonlite"))
```

Run the master refresh script from the repository root:

```bash
Rscript scripts/refresh.R
```

Alternatively, within R:

```r
source("scripts/refresh.R")
```

The pipeline will execute the registered OHL collectors, run processing, validate datasets, and record refresh results.

---

## 📈 Development Roadmap

### v0.7.0 — OHL Data Platform

- OHL skater database
- OHL goaltender database
- Individual player profiles
- Player comparison tools
- Team exploration
- Player analytics
- Automated R data collection
- Historical data processing
- Data quality validation
- GitHub Actions integration
- Sidebar refresh timestamp
- Responsive navigation

### v0.8.0 — Discovery and Usability

Potential development priorities:

- Global player search
- Shareable player profile URLs
- Improved sortable statistical tables
- CSV data exports
- Expanded statistical definitions
- Mobile interface improvements
- Enhanced data validation
- Historical performance visualizations

### Future Development

Long-term goals include:

- WHL data integration
- QMJHL data integration
- Multi-league player comparisons
- Expanded scouting analytics
- Advanced statistical models
- Broader historical coverage
- Additional hockey data products

Roadmap items are planned features and may change during development.

---

## ⚠️ Data Disclaimer

IceIndex is an independent hockey analytics project.

Statistical information is collected and processed from available hockey data sources.

Data accuracy, completeness, and update frequency depend on source availability and the successful operation of the data pipeline.

IceIndex is not presented as an official website of the Ontario Hockey League, Canadian Hockey League, or their member teams.

Team names, logos, and other associated trademarks remain the property of their respective owners.

---

## 👨‍💻 Development

**Created and maintained by Noah Cornish**

GitHub: [NoahCornish](https://github.com/NoahCornish)

Website: [IceIndex](https://noahcornish.github.io/IceIndex/)

---

**IceIndex v0.7.0**

*Every player. Every league. One index.*