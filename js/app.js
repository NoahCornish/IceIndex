
"use strict";

/* ============================================================
   ICEINDEX
   VERSION 0.2.0
   FILE 3 OF 7 — js/app.js

   OHL player analytics application.

   Dependencies:
     js/ohl-data.js
     js/ohl-branding.js

   Required HTML IDs:
     main-content
     sidebar
     scrim
     menu-toggle
     season-label
     data-status
     intro-overlay
     intro-progress
     intro-close

   ============================================================ */


/* ============================================================
   01. APPLICATION STATE
   ============================================================ */

const S = {
  current: [],
  history: [],
  people: [],
  byKey: new Map(),

  archive: null,
  loading: true,
  ready: false,

  page: "overview",

  query: "",
  dbSeason: "all",
  dbTeam: "all",
  dbSort: "pts",
  dbPage: 1,

  profile: null,
  profileSeason: "career",

  compareA: null,
  compareB: null,
  compareSeasonA: "career",
  compareSeasonB: "career",

  draftYear: null,
  draftQuery: "",
  draftSort: "pts",

  overviewMetric: "pts"
};

const DB_PAGE_SIZE = 100;

const main = document.querySelector("#main-content");
const intro = document.querySelector("#intro-overlay");
const introProgress = document.querySelector("#intro-progress");

const $ = selector => document.querySelector(selector);

const esc = window.escapeHTML || function (value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const fmt = value => {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return Number(value).toLocaleString("en-CA");
};

const dec = (value, digits = 2) => {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return Number(value).toFixed(digits);
};


/* ============================================================
   02. GENERAL UTILITIES
   ============================================================ */

function val(record, metric) {
  if (!record) return null;

  const gp = Number(record.gp);

  if (metric === "rate") {
    return gp > 0 && record.pts != null
      ? Number(record.pts) / gp
      : null;
  }

  if (metric === "goalsRate") {
    return gp > 0 && record.g != null
      ? Number(record.g) / gp
      : null;
  }

  if (metric === "assistsRate") {
    return gp > 0 && record.a != null
      ? Number(record.a) / gp
      : null;
  }

  if (metric === "pppRate") {
    return gp > 0 && record.ppp != null
      ? Number(record.ppp) / gp
      : null;
  }

  return record[metric] ?? null;
}

function sortBy(records, metric = "pts") {
  return [...records].sort((a, b) => {
    const av = val(a, metric);
    const bv = val(b, metric);

    const aNumber = av == null ? -Infinity : Number(av);
    const bNumber = bv == null ? -Infinity : Number(bv);

    return (
      bNumber - aNumber ||
      String(a.name || "").localeCompare(
        String(b.name || "")
      )
    );
  });
}

function heading(eyebrow, title, subtitle) {
  return `
    <div class="page-heading">
      <div class="eyebrow">${esc(eyebrow)}</div>
      <h1>${esc(title)}</h1>
      <p>${esc(subtitle)}</p>
    </div>
  `;
}

function panel(title, content, extra = "") {
  return `
    <section class="panel">
      <div class="panel-head">
        <h2>${esc(title)}</h2>
        ${extra}
      </div>
      ${content}
    </section>
  `;
}

function option(value, label, selected) {
  return `
    <option
      value="${esc(value)}"
      ${String(value) === String(selected) ? "selected" : ""}
    >
      ${esc(label)}
    </option>
  `;
}

function seasonLabel(record) {
  return record?.season || "—";
}

function shortTeam(team) {
  const found =
    typeof getOHLTeam === "function"
      ? getOHLTeam(team)
      : null;

  if (found?.code) return found.code;

  return String(team || "OHL")
    .split(/\s+/)
    .map(word => word[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function currentSeason() {
  return S.current[0]?.season || "Current";
}

function currentEndYear() {
  return S.current[0]?.endYear ||
    new Date().getFullYear() + 1;
}

function uniqueRows(records) {
  const map = new Map();

  for (const record of records) {
    if (!record) continue;

    const identity = [
      record.key,
      record.endYear,
      String(record.team || "").toLowerCase()
    ].join("|");

    const existing = map.get(identity);

    if (!existing) {
      map.set(identity, record);
      continue;
    }

    if (
      record.source === "current" &&
      existing.source !== "current"
    ) {
      map.set(identity, record);
    }
  }

  return [...map.values()];
}

function allRecords() {
  return uniqueRows([
    ...S.history,
    ...S.current
  ]);
}


/* ============================================================
   03. PLAYER HEADSHOTS

   Prefer directory PhotoURL.
   Fall back to HockeyTech PlayerID.
   Show initials if neither image works.

   ============================================================ */

function image(player, className = "avatar") {
  const name = String(player?.name || "OHL Player");

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();

  const playerID =
    player?.id ||
    player?.playerId ||
    player?.PlayerID ||
    "";

  const directoryPhoto = String(
    player?.photo ||
    player?.PhotoURL ||
    ""
  );

  const fallbackPhoto =
    /^\d+$/.test(String(playerID))
      ? `https://assets.leaguestat.com/ohl/240x240/${playerID}.jpg`
      : "";

  const primaryPhoto =
    /^https:\/\//i.test(directoryPhoto)
      ? directoryPhoto
      : fallbackPhoto;

  const secondaryPhoto =
    fallbackPhoto &&
    fallbackPhoto !== primaryPhoto
      ? fallbackPhoto
      : "";

  const img = primaryPhoto
    ? `
      <img
        src="${esc(primaryPhoto)}"
        alt="${esc(name)}"
        loading="lazy"
        decoding="async"
        ${secondaryPhoto
          ? `data-fallback="${esc(secondaryPhoto)}"`
          : ""}
      >
    `
    : "";

  return `
    <span class="${esc(className)}">
      <span aria-hidden="true">${esc(initials)}</span>
      ${img}
    </span>
  `;
}

/*
   One delegated image error handler.

   This avoids inserting inline JavaScript
   into every player image.
*/

document.addEventListener(
  "error",
  event => {
    const img = event.target;

    if (!(img instanceof HTMLImageElement)) return;

    const fallback = img.dataset.fallback;

    if (
      fallback &&
      img.src !== fallback &&
      !img.dataset.fallbackAttempted
    ) {
      img.dataset.fallbackAttempted = "1";
      img.src = fallback;
      return;
    }

    img.remove();
  },
  true
);


/* ============================================================
   04. CAREER AGGREGATION

   Each player has:
     seasons[]
     career{}

   One season should contribute once to career totals.

   ============================================================ */

const ADDITIVE_STATS = [
  "gp",
  "g",
  "a",
  "pts",
  "ppg",
  "ppa",
  "ppp",
  "shg",
  "sha",
  "shpts",
  "gwg",
  "eng",
  "pim",
  "shots"
];

function aggregate(records) {
  if (!records.length) return null;

  const latest = records[records.length - 1];

  const result = {
    ...latest,
    season: "career",
    team: [
      ...new Set(
        records.map(r => r.team).filter(Boolean)
      )
    ].join(" / ")
  };

  for (const stat of ADDITIVE_STATS) {
    const numbers = records
      .map(r => r[stat])
      .filter(value =>
        value !== null &&
        value !== undefined &&
        Number.isFinite(Number(value))
      )
      .map(Number);

    result[stat] = numbers.length
      ? numbers.reduce((sum, value) => sum + value, 0)
      : null;
  }

  const plusMinus = records.map(r => r.plusMinus);

  result.plusMinus = plusMinus.every(
    value =>
      value !== null &&
      value !== undefined &&
      Number.isFinite(Number(value))
  )
    ? plusMinus.reduce(
        (sum, value) => sum + Number(value),
        0
      )
    : null;

  return result;
}

function mergeData() {
  const groups = new Map();

  for (const record of allRecords()) {
    if (!record?.key) continue;

    if (!groups.has(record.key)) {
      groups.set(record.key, []);
    }

    groups.get(record.key).push(record);
  }

  const people = [];

  for (const [key, records] of groups) {
    const years = new Map();

    for (const record of records) {
      const year = record.endYear;
      const existing = years.get(year);

      if (!existing) {
        years.set(year, record);
        continue;
      }

      /*
        Prefer current data when a season appears
        in both the current and historical feeds.

        For multiple team stints, prefer a row
        explicitly identified as a season total,
        otherwise retain the highest-GP record.

        Do not add potentially duplicated
        aggregate and team-stint rows together.
      */

      const existingTotal =
        /total|all teams|combined/i.test(
          String(existing.team || "")
        );

      const recordTotal =
        /total|all teams|combined/i.test(
          String(record.team || "")
        );

      if (
        record.source === "current" &&
        existing.source !== "current"
      ) {
        years.set(year, record);
      } else if (
        recordTotal &&
        !existingTotal
      ) {
        years.set(year, record);
      } else if (
        !existingTotal &&
        !recordTotal &&
        Number(record.gp || 0) >
          Number(existing.gp || 0)
      ) {
        years.set(year, record);
      }
    }

    const seasons = [...years.values()]
      .sort((a, b) => a.endYear - b.endYear);

    if (!seasons.length) continue;

    const latest = seasons[seasons.length - 1];

    const photoRecord = [...seasons]
      .reverse()
      .find(record => record.photo);

    const idRecord = [...seasons]
      .reverse()
      .find(record => /^\d+$/.test(
        String(record.id || "")
      ));

    people.push({
      key,
      name: latest.name,
      birth: latest.birth ||
        seasons.find(r => r.birth)?.birth ||
        "",
      id: idRecord?.id || latest.id || "",
      photo: photoRecord?.photo || "",
      position: latest.position ||
        seasons.find(r => r.position)?.position ||
        "",
      team: latest.team,
      latestYear: latest.endYear,
      seasons,
      career: aggregate(seasons)
    });
  }

  S.people = people.sort(
    (a, b) => a.name.localeCompare(b.name)
  );

  S.byKey = new Map(
    S.people.map(player => [
      player.key,
      player
    ])
  );

  if (!S.profile || !S.byKey.has(S.profile)) {
    const topCurrent = sortBy(S.current)[0];

    S.profile =
      topCurrent?.key ||
      S.people[0]?.key ||
      null;
  }

  if (!S.compareA || !S.byKey.has(S.compareA)) {
    S.compareA = S.profile;
  }

  if (!S.compareB || !S.byKey.has(S.compareB)) {
    S.compareB =
      S.people.find(
        player => player.key !== S.compareA
      )?.key || S.compareA;
  }
}

function person(key) {
  return S.byKey.get(key) || S.people[0] || null;
}

function record(player, season = "career") {
  if (!player) return null;

  if (season === "career") {
    return player.career;
  }

  return player.seasons.find(
    item => item.season === season
  ) || null;
}


/* ============================================================
   05. SELECT CONTROLS
   ============================================================ */

function selectPerson(id, selectedKey) {
  return `
    <select
      id="${esc(id)}"
      class="select"
      aria-label="Select player"
    >
      ${S.people.map(player =>
        option(
          player.key,
          `${player.name} · ${
            player.birth || "DOB unavailable"
          }`,
          selectedKey
        )
      ).join("")}
    </select>
  `;
}

function selectSeason(
  id,
  player,
  selected,
  includeCareer = true
) {
  return `
    <select
      id="${esc(id)}"
      class="select"
      aria-label="Select season"
    >
      ${
        includeCareer
          ? option(
              "career",
              "All OHL seasons combined",
              selected
            )
          : ""
      }

      ${player.seasons.map(item =>
        option(
          item.season,
          item.season,
          selected
        )
      ).join("")}
    </select>
  `;
}


/* ============================================================
   06. STATISTICS TABLES

   DESKTOP:
     Player
     Season
     Team
     GP
     G
     A
     PTS
     P/GP

   MOBILE:
     Player
     GP
     G
     A
     PTS

   ============================================================ */

function playerLink(row, compact = false) {
  const player = S.byKey.get(row.key) || row;

  const details = compact
    ? `${shortTeam(row.team)} · ${seasonLabel(row)}`
    : row.position || "OHL";

  return `
    <a
      href="#profile"
      class="player-cell"
      data-person="${esc(row.key)}"
      aria-label="View ${esc(row.name)} profile"
    >
      ${image(player)}

      <span>
        <strong>${esc(row.name)}</strong>
        <small>${esc(details)}</small>
      </span>
    </a>
  `;
}

function desktopTable(rows) {
  return `
    <div class="table-scroll desktop-stats">
      <table class="data-table">
        <thead>
          <tr>
            <th scope="col">PLAYER</th>
            <th scope="col">SEASON</th>
            <th scope="col">TEAM</th>
            <th scope="col">GP</th>
            <th scope="col">G</th>
            <th scope="col">A</th>
            <th scope="col">PTS</th>
            <th scope="col">P/GP</th>
          </tr>
        </thead>

        <tbody>
          ${rows.map(row => `
            <tr>
              <td>${playerLink(row)}</td>
              <td>${esc(seasonLabel(row))}</td>
              <td>${esc(row.team)}</td>
              <td>${fmt(row.gp)}</td>
              <td>${fmt(row.g)}</td>
              <td>${fmt(row.a)}</td>
              <td class="accent">${fmt(row.pts)}</td>
              <td>${dec(val(row, "rate"))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function mobileTable(rows) {
  return `
    <div class="mobile-stats">
      <table class="mobile-stats-table">
        <thead>
          <tr>
            <th scope="col">PLAYER</th>
            <th scope="col">GP</th>
            <th scope="col">G</th>
            <th scope="col">A</th>
            <th scope="col">PTS</th>
          </tr>
        </thead>

        <tbody>
          ${rows.map(row => `
            <tr>
              <td>${playerLink(row, true)}</td>
              <td>${fmt(row.gp)}</td>
              <td>${fmt(row.g)}</td>
              <td>${fmt(row.a)}</td>
              <td>${fmt(row.pts)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function table(rows) {
  if (!rows.length) {
    return `
      <div class="empty">
        No matching player records.
      </div>
    `;
  }

  return `
    ${desktopTable(rows)}
    ${mobileTable(rows)}
  `;
}


/* ============================================================
   07. HISTORICAL DATA NOTICE
   ============================================================ */

function notice() {
  if (S.loading) {
    return `
      <div class="notice">
        Loading historical OHL seasons in the
        background. Current-season statistics
        are available now.
        <span id="history-progress"></span>
      </div>
    `;
  }

  const failed = S.archive?.failed?.length || 0;

  if (failed > 0) {
    return `
      <div class="notice">
        ${fmt(failed)} historical season${
          failed === 1 ? "" : "s"
        } could not be loaded.
        Career statistics may be incomplete.
      </div>
    `;
  }

  return "";
}


/* ============================================================
   08. OVERVIEW DASHBOARD
   ============================================================ */

function renderOverview() {
  const rows = S.current;

  const leaders = [
    ["POINTS LEADER", "pts"],
    ["GOALS LEADER", "g"],
    ["ASSISTS LEADER", "a"],
    ["POINTS / GAME · MIN 5 GP", "rate"]
  ];

  const cards = leaders.map(([label, metric]) => {
    const eligible = metric === "rate"
      ? rows.filter(row => row.gp >= 5)
      : rows;

    const top = sortBy(
      eligible.filter(row => val(row, metric) != null),
      metric
    )[0];

    if (!top) {
      return `
        <article class="leader-card">
          <span class="eyebrow">${label}</span>
          <div class="leader-value">—</div>
        </article>
      `;
    }

    return `
      <article class="leader-card">
        <span class="eyebrow">${label}</span>

        <div class="leader-content">
          ${image(
            S.byKey.get(top.key) || top,
            "leader-photo"
          )}

          <div>
            <div class="leader-value">
              ${
                metric === "rate"
                  ? dec(val(top, metric))
                  : fmt(val(top, metric))
              }
            </div>

            <a
              href="#profile"
              data-person="${esc(top.key)}"
            >
              ${esc(top.name)}
            </a>

            <small>${esc(top.team)}</small>
          </div>
        </div>
      </article>
    `;
  }).join("");

  const ranked = sortBy(
    S.overviewMetric === "rate"
      ? rows.filter(row => row.gp >= 5)
      : rows,
    S.overviewMetric
  ).slice(0, 8);

  const max = Math.max(
    1,
    ...ranked.map(row =>
      Number(val(row, S.overviewMetric) || 0)
    )
  );

  const bars = ranked.map(row => {
    const value = Number(
      val(row, S.overviewMetric) || 0
    );

    return `
      <div class="bar-row">
        <div>
          <a
            href="#profile"
            data-person="${esc(row.key)}"
          >
            ${esc(row.name)}
          </a>

          <b>
            ${
              S.overviewMetric === "rate"
                ? dec(value)
                : fmt(value)
            }
          </b>
        </div>

        <span class="track">
          <span
            style="width:${
              Math.min(100, 100 * value / max)
            }%"
          ></span>
        </span>
      </div>
    `;
  }).join("");

  const totalGoals = rows.reduce(
    (sum, row) => sum + Number(row.g || 0),
    0
  );

  main.innerHTML = `
    <section class="hero">
      <div class="eyebrow">
        OHL / LEAGUE INTELLIGENCE
      </div>

      <h1>The league, by the numbers.</h1>

      <p>
        Current OHL production, historical player
        development and draft-year insights —
        powered by OHLDataHub.
      </p>

      <div class="hero-meta">
        <span class="live-dot"></span>
        ${esc(currentSeason())}
        · ${fmt(rows.length)} skaters
        · 20 clubs
      </div>
    </section>

    <div class="section-title">
      <span class="eyebrow">CURRENT SEASON</span>
      <h2>Players setting the pace</h2>
    </div>

    <div class="leader-grid">
      ${cards}
    </div>

    <div class="kpi-grid">
      <div class="kpi">
        <span>CURRENT SKATERS</span>
        <b>${fmt(rows.length)}</b>
      </div>

      <div class="kpi">
        <span>DATABASE PLAYERS</span>
        <b>${fmt(S.people.length)}</b>
      </div>

      <div class="kpi">
        <span>ARCHIVE SEASONS</span>
        <b>${fmt(S.archive?.loaded?.length || 0)}</b>
      </div>

      <div class="kpi">
        <span>CURRENT GOALS</span>
        <b>${fmt(totalGoals)}</b>
      </div>
    </div>

    <div class="two-col">
      ${panel(
        "Scoring leaders",
        table(sortBy(rows).slice(0, 10))
      )}

      ${panel(
        "Production rankings",
        `
          <div class="tabs">
            ${[
              ["pts", "Points"],
              ["g", "Goals"],
              ["a", "Assists"],
              ["rate", "P/GP"]
            ].map(([metric, label]) => `
              <button
                type="button"
                class="btn ${
                  S.overviewMetric === metric
                    ? "active"
                    : ""
                }"
                data-metric="${metric}"
              >
                ${label}
              </button>
            `).join("")}
          </div>

          <div class="bars">${bars}</div>
        `
      )}
    </div>

    <div class="callout">
      <div>
        <h2>Explore the full OHL story.</h2>
        <p>
          Search historical careers, track player
          development and explore draft-year cohorts.
        </p>
      </div>

      <button
        type="button"
        class="btn primary"
        data-go="players"
      >
        Explore the database →
      </button>
    </div>
  `;
}


/* ============================================================
   09. PLAYER DATABASE
   ============================================================ */

function renderPlayers() {
  const records = allRecords();

  const seasons = [
    ...new Set(records.map(row => row.season))
  ].filter(Boolean).sort().reverse();

  const teams = [
    ...new Set(records.map(row => row.team))
  ].filter(Boolean).sort();

  main.innerHTML = `
    ${heading(
      "HISTORICAL DATABASE",
      "OHL Player Database",
      "Search current and historical OHL statistics."
    )}

    ${notice()}

    <div class="controls">
      <input
        class="input"
        id="db-search"
        type="search"
        placeholder="Search any OHL player..."
        value="${esc(S.query)}"
        aria-label="Search OHL players"
        autocomplete="off"
      >

      <select
        class="select"
        id="db-season"
        aria-label="Filter by season"
      >
        ${option("all", "All seasons", S.dbSeason)}

        ${seasons.map(season =>
          option(season, season, S.dbSeason)
        ).join("")}
      </select>

      <select
        class="select"
        id="db-team"
        aria-label="Filter by team"
      >
        ${option("all", "All teams", S.dbTeam)}

        ${teams.map(team =>
          option(team, team, S.dbTeam)
        ).join("")}
      </select>

      <select
        class="select"
        id="db-sort"
        aria-label="Sort player statistics"
      >
        ${[
          ["pts", "Points"],
          ["rate", "P/GP"],
          ["g", "Goals"],
          ["a", "Assists"],
          ["gp", "Games"]
        ].map(([metric, label]) =>
          option(metric, label, S.dbSort)
        ).join("")}
      </select>

      <button
        type="button"
        class="btn"
        id="db-clear"
      >
        Clear
      </button>
    </div>

    <div id="db-results"></div>
  `;

  updateDb();
}

function filteredDatabase() {
  const query = S.query
    .trim()
    .toLowerCase();

  return allRecords().filter(row => {
    const matchesSearch =
      !query ||
      `${row.name} ${row.team}`
        .toLowerCase()
        .includes(query);

    const matchesSeason =
      S.dbSeason === "all" ||
      row.season === S.dbSeason;

    const matchesTeam =
      S.dbTeam === "all" ||
      row.team === S.dbTeam;

    return (
      matchesSearch &&
      matchesSeason &&
      matchesTeam
    );
  });
}

function updateDb() {
  const output = $("#db-results");

  if (!output) return;

  const sorted = sortBy(
    filteredDatabase(),
    S.dbSort
  );

  const totalPages = Math.max(
    1,
    Math.ceil(sorted.length / DB_PAGE_SIZE)
  );

  S.dbPage = Math.min(
    Math.max(1, S.dbPage),
    totalPages
  );

  const start =
    (S.dbPage - 1) * DB_PAGE_SIZE;

  const visible = sorted.slice(
    start,
    start + DB_PAGE_SIZE
  );

  const uniquePlayers = new Set(
    sorted.map(row => row.key)
  ).size;

  const pagination = totalPages > 1
    ? `
      <div class="ice-pagination">
        <button
          type="button"
          class="btn"
          data-db-page="prev"
          ${S.dbPage === 1 ? "disabled" : ""}
        >
          ← Previous
        </button>

        <span>
          Page ${fmt(S.dbPage)}
          of ${fmt(totalPages)}
        </span>

        <button
          type="button"
          class="btn"
          data-db-page="next"
          ${
            S.dbPage === totalPages
              ? "disabled"
              : ""
          }
        >
          Next →
        </button>
      </div>
    `
    : "";

  output.innerHTML = panel(
    `${fmt(sorted.length)} season records`,
    `
      <p class="footnote">
        ${fmt(uniquePlayers)} players
        · Showing ${
          sorted.length
            ? `${fmt(start + 1)}–${fmt(
                Math.min(
                  start + DB_PAGE_SIZE,
                  sorted.length
                )
              )}`
            : "0"
        } of ${fmt(sorted.length)}
      </p>

      ${table(visible)}
      ${pagination}
    `
  );
}


/* ============================================================
   10. POSITION AND PERCENTILES
   ============================================================ */

function positionGroup(player) {
  return /^(D|LD|RD)$/i.test(
    String(player?.position || "")
  )
    ? "D"
    : "F";
}

function percentile(row, metric) {
  if (
    !row ||
    Number(row.gp) < 5 ||
    val(row, metric) == null
  ) {
    return null;
  }

  const peers = allRecords().filter(candidate =>
    candidate.season === row.season &&
    Number(candidate.gp) >= 5 &&
    positionGroup(candidate) ===
      positionGroup(row) &&
    val(candidate, metric) != null
  );

  if (!peers.length) return null;

  const value = Number(val(row, metric));

  const below = peers.filter(
    candidate =>
      Number(val(candidate, metric)) < value
  ).length;

  const equal = peers.filter(
    candidate =>
      Number(val(candidate, metric)) === value
  ).length;

  return Math.round(
    100 * (below + equal / 2) / peers.length
  );
}


/* ============================================================
   11. COMPLETE STATISTICAL BREAKDOWN
   ============================================================ */

function statRows(row) {
  const metrics = [
    ["Games played", "gp"],
    ["Goals", "g"],
    ["Assists", "a"],
    ["Points", "pts"],
    ["Points / game", "rate"],
    ["Goals / game", "goalsRate"],
    ["Assists / game", "assistsRate"],
    ["Plus / minus", "plusMinus"],
    ["Power-play goals", "ppg"],
    ["Power-play assists", "ppa"],
    ["Power-play points", "ppp"],
    ["Shorthanded goals", "shg"],
    ["Shorthanded assists", "sha"],
    ["Shorthanded points", "shpts"],
    ["Game-winning goals", "gwg"],
    ["Empty-net goals", "eng"],
    ["Penalty minutes", "pim"],
    ["Shots", "shots"]
  ];

  return metrics.map(([label, metric]) => {
    const value = val(row, metric);

    const display = [
      "rate",
      "goalsRate",
      "assistsRate"
    ].includes(metric)
      ? dec(value)
      : fmt(value);

    return `
      <div class="stat-row">
        <span>${label}</span>
        <strong>${display}</strong>
      </div>
    `;
  }).join("");
}


/* ============================================================
   12. PLAYER DEVELOPMENT
   ============================================================ */

function development(player) {
  const seasons = player.seasons;

  const max = Math.max(
    0.1,
    ...seasons.map(row =>
      Number(val(row, "rate") || 0)
    )
  );

  const columns = seasons.map(row => {
    const rate = Number(
      val(row, "rate") || 0
    );

    return `
      <div class="development-col">
        <div class="development-number">
          ${dec(val(row, "rate"))}
        </div>

        <div class="development-track">
          <span
            style="height:${
              Math.min(100, rate / max * 100)
            }%"
          ></span>
        </div>

        <small>${esc(row.season)}</small>
      </div>
    `;
  }).join("");

  return `
    <div class="development">
      ${columns}
    </div>

    <p class="footnote">
      Points per game by OHL season.
      Career P/GP uses total points divided
      by total games played.
    </p>
  `;
}


/* ============================================================
   13. PLAYER PROFILE
   ============================================================ */

function renderProfile() {
  const player = person(S.profile);

  if (!player) {
    main.innerHTML = panel(
      "Player unavailable",
      "<p>No player record was found.</p>"
    );
    return;
  }

  S.profile = player.key;

  const selected =
    record(player, S.profileSeason) ||
    player.career;

  const latest =
    player.seasons[player.seasons.length - 1];

  const years = player.seasons.length;

  const percentileRows = player.seasons.map(
    row => ({
      row,
      rank: percentile(row, "rate")
    })
  );

  const logo =
    typeof teamLogo === "function"
      ? teamLogo(
          latest.team,
          "profile-team-logo"
        )
      : "";

  const kpis = [
    ["GP", selected.gp],
    ["GOALS", selected.g],
    ["ASSISTS", selected.a],
    ["POINTS", selected.pts],
    ["P/GP", dec(val(selected, "rate"))]
  ];

  main.innerHTML = `
    ${heading(
      "PLAYER INTELLIGENCE",
      "Player Profile",
      "OHL career statistics and season-by-season development."
    )}

    ${notice()}

    <div class="controls">
      ${selectPerson(
        "profile-player",
        player.key
      )}

      ${selectSeason(
        "profile-season",
        player,
        S.profileSeason
      )}
    </div>

    <section class="profile-hero">
      <div class="profile-head">
        ${image(player, "profile-photo")}

        <div>
          <div class="eyebrow">
            ${
              selected.season === "career"
                ? "OHL CAREER"
                : `${esc(selected.season)} SEASON`
            }
          </div>

          <h2>${esc(player.name)}</h2>

          <p>
            ${esc(latest.team)}
            · ${esc(latest.position || "OHL")}
            · ${years} recorded season${
              years === 1 ? "" : "s"
            }
          </p>

          <div class="profile-tags">
            ${
              player.birth
                ? `<span>Born ${
                    esc(player.birth)
                  }</span>`
                : ""
            }

            <span>${esc(selected.team)}</span>
          </div>
        </div>

        ${logo}
      </div>

      <div class="profile-kpis">
        ${kpis.map(([label, value]) => `
          <div>
            <strong>${fmt(value)}</strong>
            <span>${label}</span>
          </div>
        `).join("")}
      </div>
    </section>

    <div class="two-col">
      ${panel(
        "Career development",
        development(player)
      )}

      ${panel(
        "Complete statistical breakdown",
        `
          <div class="stat-list">
            ${statRows(selected)}
          </div>
        `
      )}
    </div>

    ${panel(
      "Season-by-season history",
      `
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>SEASON</th>
                <th>TEAM</th>
                <th>GP</th>
                <th>G</th>
                <th>A</th>
                <th>PTS</th>
                <th>P/GP</th>
                <th>PCTL</th>
              </tr>
            </thead>

            <tbody>
              ${player.seasons.map(row => `
                <tr>
                  <td>
                    <button
                      type="button"
                      class="text-button"
                      data-profile-season="${
                        esc(row.season)
                      }"
                    >
                      ${esc(row.season)}
                    </button>
                  </td>

                  <td>${esc(row.team)}</td>
                  <td>${fmt(row.gp)}</td>
                  <td>${fmt(row.g)}</td>
                  <td>${fmt(row.a)}</td>

                  <td class="accent">
                    ${fmt(row.pts)}
                  </td>

                  <td>
                    ${dec(val(row, "rate"))}
                  </td>

                  <td>
                    ${percentile(row, "rate") ?? "—"}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `
    )}

    ${panel(
      "Production percentiles",
      `
        <p class="footnote">
          Points-per-game percentile compared
          with OHL forwards or defencemen
          in the same season, minimum 5 GP.
          Percentiles are unavailable for
          incomplete season samples.
        </p>

        <div class="percentile-list">
          ${percentileRows.map(
            ({ row, rank }) => `
              <div class="percentile-row">
                <span>${esc(row.season)}</span>

                <div class="track">
                  <span
                    style="width:${
                      rank ?? 0
                    }%"
                  ></span>
                </div>

                <strong>
                  ${
                    rank == null
                      ? "N/A"
                      : `${rank}th`
                  }
                </strong>
              </div>
            `
          ).join("")}
        </div>
      `
    )}

    <div class="callout">
      <div>
        <h2>Compare this player</h2>

        <p>
          Compare career statistics or
          individual OHL seasons.
        </p>
      </div>

      <button
        type="button"
        class="btn primary"
        data-compare-person="${esc(player.key)}"
      >
        Compare →
      </button>
    </div>
  `;
}


/* ============================================================
   14. PLAYER COMPARISONS
   ============================================================ */

function compareCard(player, selected) {
  return `
    <div class="compare-person">
      ${image(player, "compare-photo")}

      <h3>${esc(player.name)}</h3>

      <p>
        ${
          selected?.season === "career"
            ? "OHL career"
            : esc(selected?.season || "No season")
        }
      </p>

      <small>
        ${esc(selected?.team || "")}
      </small>
    </div>
  `;
}

function renderCompare() {
  const a = person(S.compareA);
  const b = person(S.compareB);

  if (!a || !b) {
    main.innerHTML = panel(
      "Comparison unavailable",
      "<p>Player data has not loaded.</p>"
    );
    return;
  }

  const x =
    record(a, S.compareSeasonA) ||
    a.career;

  const y =
    record(b, S.compareSeasonB) ||
    b.career;

  const metrics = [
    ["Games played", "gp"],
    ["Goals", "g"],
    ["Assists", "a"],
    ["Points", "pts"],
    ["Points / game", "rate"],
    ["Goals / game", "goalsRate"],
    ["Assists / game", "assistsRate"],
    ["Power-play points", "ppp"],
    ["Penalty minutes", "pim"]
  ];

  const rows = metrics.map(([label, metric]) => {
    const av = val(x, metric);
    const bv = val(y, metric);

    const rate = [
      "rate",
      "goalsRate",
      "assistsRate"
    ].includes(metric);

    const display = value =>
      rate ? dec(value) : fmt(value);

    const aWins =
      av != null &&
      bv != null &&
      Number(av) > Number(bv);

    const bWins =
      av != null &&
      bv != null &&
      Number(bv) > Number(av);

    return `
      <div class="compare-stat">
        <strong class="${aWins ? "winner" : ""}">
          ${display(av)}
        </strong>

        <span>${label}</span>

        <strong class="${bWins ? "winner" : ""}">
          ${display(bv)}
        </strong>
      </div>
    `;
  }).join("");

  main.innerHTML = `
    ${heading(
      "HISTORICAL ANALYTICS",
      "Compare Players",
      "Compare OHL careers or individual seasons."
    )}

    ${notice()}

    <div class="compare-controls">
      <div>
        ${selectPerson(
          "compare-a",
          a.key
        )}

        ${selectSeason(
          "compare-season-a",
          a,
          S.compareSeasonA
        )}
      </div>

      <div>
        ${selectPerson(
          "compare-b",
          b.key
        )}

        ${selectSeason(
          "compare-season-b",
          b,
          S.compareSeasonB
        )}
      </div>
    </div>

    ${panel(
      "Head-to-head",
      `
        <div class="compare-people">
          ${compareCard(a, x)}
          <span>VS</span>
          ${compareCard(b, y)}
        </div>

        <div class="stat-list">
          ${rows}
        </div>

        <p class="footnote">
          Totals depend on games played.
          Per-game rates are useful when
          comparing different seasons.
        </p>
      `
    )}
  `;
}


/* ============================================================
   15. DRAFT YEAR CENTRAL

   Estimated first NHL draft eligibility:
   September 16 of year - 19
   through September 15 of year - 18.

   Not a verified NHL eligibility list.

   ============================================================ */

function estimatedDraftYear(birth) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      String(birth || "")
    )
  ) {
    return null;
  }

  const year = Number(birth.slice(0, 4));
  const monthDay = birth.slice(5);

  return year + (
    monthDay >= "09-16" ? 19 : 18
  );
}

function renderDraft() {
  const endYear = currentEndYear();

  const draftYear =
    S.draftYear || endYear;

  S.draftYear = draftYear;

  const eligible = S.current.filter(
    row =>
      estimatedDraftYear(row.birth) ===
      draftYear
  );

  const query = S.draftQuery
    .trim()
    .toLowerCase();

  const filtered = eligible.filter(row =>
    !query ||
    `${row.name} ${row.team}`
      .toLowerCase()
      .includes(query)
  );

  const rows = sortBy(
    filtered,
    S.draftSort
  );

  main.innerHTML = `
    ${heading(
      "NHL DRAFT WATCH",
      "Draft Year Central",
      "Explore estimated first-year NHL draft-eligible OHL skaters."
    )}

    <div class="notice">
      <strong>
        Estimated eligibility only.
      </strong>

      Birthdate window:
      September 16, ${draftYear - 19}
      through September 15, ${draftYear - 18}.

      Previous draft status, exceptions,
      re-entry rules and other eligibility
      factors have not been verified.
    </div>

    <div class="controls">
      <select
        class="select"
        id="draft-year"
        aria-label="Draft year"
      >
        ${[
          endYear - 1,
          endYear,
          endYear + 1,
          endYear + 2
        ].map(year =>
          option(
            year,
            `${year} NHL Draft`,
            draftYear
          )
        ).join("")}
      </select>

      <input
        class="input"
        id="draft-search"
        type="search"
        placeholder="Search draft-year players..."
        value="${esc(S.draftQuery)}"
      >

      <select
        class="select"
        id="draft-sort"
        aria-label="Sort draft players"
      >
        ${[
          ["pts", "Points"],
          ["rate", "P/GP"],
          ["g", "Goals"],
          ["a", "Assists"]
        ].map(([metric, label]) =>
          option(
            metric,
            label,
            S.draftSort
          )
        ).join("")}
      </select>
    </div>

    <div class="kpi-grid">
      <div class="kpi">
        <span>ESTIMATED COHORT</span>
        <b>${fmt(eligible.length)}</b>
      </div>

      <div class="kpi">
        <span>DRAFT YEAR</span>
        <b>${draftYear}</b>
      </div>

      <div class="kpi">
        <span>OHL SEASON</span>
        <b>${esc(currentSeason())}</b>
      </div>

      <div class="kpi">
        <span>TOP POINTS</span>
        <b>${fmt(sortBy(eligible)[0]?.pts)}</b>
      </div>
    </div>

    ${panel(
      `${fmt(rows.length)} draft-year skaters`,
      table(rows)
    )}
  `;
}


/* ============================================================
   16. TEAM EXPLORER
   ============================================================ */

function renderTeams() {
  const teams =
    typeof OHL_TEAMS !== "undefined"
      ? OHL_TEAMS
      : [];

  const cards = teams.map(team => {
    const name = team[0];
    const code = team[1];

    const roster = S.current.filter(row => {
      const found =
        typeof getOHLTeam === "function"
          ? getOHLTeam(row.team)
          : null;

      return found?.code === code;
    });

    const logo =
      typeof teamLogo === "function"
        ? teamLogo(
            name,
            "team-grid-logo"
          )
        : "";

    return `
      <article class="team-card">
        ${logo}

        <h2>${esc(name)}</h2>

        <p>
          ${fmt(roster.length)}
          current skaters
        </p>

        <button
          type="button"
          class="btn"
          data-team="${esc(
            roster[0]?.team || name
          )}"
        >
          View roster →
        </button>
      </article>
    `;
  }).join("");

  main.innerHTML = `
    ${heading(
      "OHL CLUBS",
      "Team Explorer",
      "Explore current Ontario Hockey League teams."
    )}

    <div class="team-grid">
      ${cards}
    </div>
  `;
}


/* ============================================================
   17. PAGE ROUTER
   ============================================================ */

const pages = {
  overview: renderOverview,
  players: renderPlayers,
  profile: renderProfile,
  compare: renderCompare,
  draft: renderDraft,
  teams: renderTeams
};

function closeMenu() {
  const sidebar = $("#sidebar");
  const scrim = $("#scrim");
  const toggle = $("#menu-toggle");

  sidebar?.classList.remove("open");

  if (scrim) scrim.hidden = true;

  toggle?.setAttribute(
    "aria-expanded",
    "false"
  );

  toggle?.setAttribute(
    "aria-label",
    "Open navigation"
  );
}

function render() {
  if (!main) return;

  const requested =
    location.hash.slice(1);

  S.page = pages[requested]
    ? requested
    : "overview";

  document.querySelectorAll(
    "[data-page]"
  ).forEach(link => {
    const active =
      link.dataset.page === S.page;

    link.classList.toggle(
      "active",
      active
    );

    if (active) {
      link.setAttribute(
        "aria-current",
        "page"
      );
    } else {
      link.removeAttribute(
        "aria-current"
      );
    }
  });

  pages[S.page]();

  closeMenu();
}

function go(page) {
  if (location.hash === `#${page}`) {
    render();
  } else {
    location.hash = page;
  }
}


/* ============================================================
   18. CLICK HANDLERS
   ============================================================ */

main?.addEventListener("click", event => {
  const playerLinkElement =
    event.target.closest("[data-person]");

  if (playerLinkElement) {
    event.preventDefault();

    S.profile =
      playerLinkElement.dataset.person;

    S.profileSeason = "career";

    go("profile");
    return;
  }

  const navigation =
    event.target.closest("[data-go]");

  if (navigation) {
    go(navigation.dataset.go);
    return;
  }

  const metric =
    event.target.closest("[data-metric]");

  if (metric) {
    S.overviewMetric =
      metric.dataset.metric;

    renderOverview();
    return;
  }

  const team =
    event.target.closest("[data-team]");

  if (team) {
    S.dbTeam = team.dataset.team;
    S.dbSeason = currentSeason();
    S.query = "";
    S.dbPage = 1;

    go("players");
    return;
  }

  const season =
    event.target.closest(
      "[data-profile-season]"
    );

  if (season) {
    S.profileSeason =
      season.dataset.profileSeason;

    renderProfile();
    return;
  }

  const compare =
    event.target.closest(
      "[data-compare-person]"
    );

  if (compare) {
    S.compareA =
      compare.dataset.comparePerson;

    S.compareSeasonA = "career";

    const alternative = S.people.find(
      player =>
        player.key !== S.compareA
    );

    S.compareB =
      alternative?.key || S.compareA;

    S.compareSeasonB = "career";

    go("compare");
    return;
  }

  const pageButton =
    event.target.closest(
      "[data-db-page]"
    );

  if (pageButton) {
    const direction =
      pageButton.dataset.dbPage;

    S.dbPage +=
      direction === "next" ? 1 : -1;

    updateDb();

    $("#db-results")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    return;
  }

  if (event.target.id === "db-clear") {
    S.query = "";
    S.dbSeason = "all";
    S.dbTeam = "all";
    S.dbSort = "pts";
    S.dbPage = 1;

    renderPlayers();
  }
});


/* ============================================================
   19. LIVE SEARCH
   ============================================================ */

main?.addEventListener("input", event => {
  const target = event.target;

  if (target.id === "db-search") {
    S.query = target.value;
    S.dbPage = 1;

    updateDb();
    return;
  }

  if (target.id === "draft-search") {
    S.draftQuery = target.value;

    const position =
      target.selectionStart;

    renderDraft();

    const input = $("#draft-search");

    if (input) {
      input.focus();

      if (position != null) {
        input.setSelectionRange(
          position,
          position
        );
      }
    }
  }
});


/* ============================================================
   20. SELECT CHANGES
   ============================================================ */

main?.addEventListener("change", event => {
  const id = event.target.id;
  const value = event.target.value;

  if (id === "db-season") {
    S.dbSeason = value;
    S.dbPage = 1;
    updateDb();
    return;
  }

  if (id === "db-team") {
    S.dbTeam = value;
    S.dbPage = 1;
    updateDb();
    return;
  }

  if (id === "db-sort") {
    S.dbSort = value;
    S.dbPage = 1;
    updateDb();
    return;
  }

  if (id === "profile-player") {
    S.profile = value;
    S.profileSeason = "career";
    renderProfile();
    return;
  }

  if (id === "profile-season") {
    S.profileSeason = value;
    renderProfile();
    return;
  }

  if (id === "compare-a") {
    S.compareA = value;
    S.compareSeasonA = "career";
    renderCompare();
    return;
  }

  if (id === "compare-b") {
    S.compareB = value;
    S.compareSeasonB = "career";
    renderCompare();
    return;
  }

  if (id === "compare-season-a") {
    S.compareSeasonA = value;
    renderCompare();
    return;
  }

  if (id === "compare-season-b") {
    S.compareSeasonB = value;
    renderCompare();
    return;
  }

  if (id === "draft-year") {
    S.draftYear = Number(value);
    renderDraft();
    return;
  }

  if (id === "draft-sort") {
    S.draftSort = value;
    renderDraft();
  }
});


/* ============================================================
   21. MOBILE NAVIGATION
   ============================================================ */

$("#menu-toggle")?.addEventListener(
  "click",
  () => {
    const sidebar = $("#sidebar");
    const scrim = $("#scrim");
    const toggle = $("#menu-toggle");

    if (!sidebar) return;

    const open =
      sidebar.classList.toggle("open");

    if (scrim) {
      scrim.hidden = !open;
    }

    toggle?.setAttribute(
      "aria-expanded",
      String(open)
    );

    toggle?.setAttribute(
      "aria-label",
      open
        ? "Close navigation"
        : "Open navigation"
    );
  }
);

$("#scrim")?.addEventListener(
  "click",
  closeMenu
);

document.addEventListener(
  "keydown",
  event => {
    if (event.key === "Escape") {
      closeMenu();
    }
  }
);

document.querySelectorAll(
  "[data-page]"
).forEach(link => {
  link.addEventListener(
    "click",
    closeMenu
  );
});

window.addEventListener(
  "hashchange",
  () => {
    if (S.ready) render();
  }
);


/* ============================================================
   22. INTRODUCTION POPUP
   ============================================================ */

function introStatus(message) {
  if (introProgress) {
    introProgress.textContent = message;
  }
}

function dismissIntro() {
  if (!intro) return;

  intro.hidden = true;

  document.body.style.overflow = "";

  try {
    sessionStorage.setItem(
      "iceindex-intro-dismissed",
      "1"
    );
  } catch (_) {
    // Storage may be unavailable.
  }
}

$("#intro-close")?.addEventListener(
  "click",
  dismissIntro
);

function introWasDismissed() {
  try {
    return sessionStorage.getItem(
      "iceindex-intro-dismissed"
    ) === "1";
  } catch (_) {
    return false;
  }
}

if (introWasDismissed()) {
  dismissIntro();
} else if (intro) {
  document.body.style.overflow = "hidden";
}

introStatus(
  "Loading current OHL statistics…"
);


/* ============================================================
   23. HISTORICAL ARCHIVE LOADING
   ============================================================ */

function updateArchiveStatus(message) {
  const status = $("#archive-status");
  const progress = $("#history-progress");

  if (status) {
    status.textContent = message;
  }

  if (progress) {
    progress.textContent = message;
  }
}

function refreshAfterArchive() {
  /*
    Do not destroy a search field while
    the visitor is typing.

    The results are refreshed when possible.
  */

  const active = document.activeElement;

  if (
    active &&
    active.matches("input, select, textarea")
  ) {
    if (S.page === "players") {
      updateDb();
    }

    return;
  }

  render();
}

async function loadArchiveInBackground() {
  if (
    typeof window.loadOHLHistory !== "function"
  ) {
    S.loading = false;
    return;
  }

  try {
    const archive = await window.loadOHLHistory(
      progress => {
        const message = `
          Archive:
          ${progress.completed}/${progress.total}
          checked · ${progress.loaded} loaded
        `.replace(/\s+/g, " ").trim();

        updateArchiveStatus(message);
      }
    );

    S.archive = archive;
    S.history = archive.records || [];
    S.loading = false;

    mergeData();

    const message = `
      ${archive.loaded?.length || 0}
      historical seasons ·
      ${fmt(S.people.length)} players
    `.replace(/\s+/g, " ").trim();

    updateArchiveStatus(message);

    introStatus(
      "Historical archive ready."
    );

    refreshAfterArchive();

  } catch (error) {
    console.warn(
      "IceIndex historical archive unavailable:",
      error
    );

    S.loading = false;

    introStatus(
      "Current data ready. Historical data unavailable."
    );

    refreshAfterArchive();
  }
}


/* ============================================================
   24. INITIALIZATION
   ============================================================ */

async function init() {
  if (!main) return;

  try {
    if (
      typeof window.loadOHLCurrent !== "function"
    ) {
      throw new Error(
        "OHL data loader is missing."
      );
    }

    introStatus(
      "Connecting to OHLDataHub…"
    );

    const data =
      await window.loadOHLCurrent();

    S.current = data.records || [];
    S.draftYear = data.endYear;

    if (!S.current.length) {
      throw new Error(
        "No current-season skater records were returned."
      );
    }

    mergeData();

    S.ready = true;

    const seasonElement =
      $("#season-label");

    if (seasonElement) {
      seasonElement.textContent =
        data.season;
    }

    const dataStatus =
      $("#data-status");

    if (dataStatus) {
      dataStatus.innerHTML = `
        <span class="live-dot"></span>
        OHL data loaded

        <br>

        <small>
          ${fmt(S.current.length)}
          current skaters ·
          ${esc(data.season)}

          <br>

          <span id="archive-status">
            Loading historical archive…
          </span>
        </small>
      `;
    }

    render();

    introStatus(
      "Current-season data ready. Historical records loading."
    );

    const closeButton =
      $("#intro-close");

    if (closeButton) {
      closeButton.textContent =
        "Explore IceIndex";
    }

    /*
      Start archive loading without blocking
      the current-season website.
    */

    loadArchiveInBackground();

  } catch (error) {
    console.error(
      "IceIndex initialization failed:",
      error
    );

    S.loading = false;

    introStatus(
      "Unable to load current statistics."
    );

    main.innerHTML = `
      <section class="panel">
        <h2>Unable to load OHL data</h2>

        <p>
          ${esc(error.message)}
        </p>

        <p class="footnote">
          Please check your connection
          and try again.
        </p>

        <button
          type="button"
          class="btn primary"
          id="retry"
        >
          Retry
        </button>
      </section>
    `;

    $("#retry")?.addEventListener(
      "click",
      () => location.reload()
    );

    /*
      Allow the visitor to dismiss the popup
      and see the error message.
    */

    const closeButton =
      $("#intro-close");

    if (closeButton) {
      closeButton.textContent =
        "View loading error";
    }
  }
}


/* ============================================================
   25. START ICEINDEX
   ============================================================ */

init();

/* ============================================================
   END OF ICEINDEX v0.2.0 app.js
   ============================================================ */