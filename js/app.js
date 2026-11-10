
"use strict";

/* ============================================================
   ICEINDEX v0.3.0
   FILE 2 — js/app.js

   APPLICATION + PLAYER ANALYTICS

   Requires:
     js/ohl-data.js
     js/ohl-branding.js
     js/ohl-analytics.js

   Existing pages:
     Overview
     Player Database
     Player Profiles
     Comparisons
     Draft Year Central
     Team Explorer

   New:
     Player Analytics
     Percentile Cards
     Radar Comparisons
     Scatter Plot Explorer
     Age / Position Cohorts
     Shareable SVG Player Cards

   ============================================================ */

(function () {

  /* ==========================================================
     01. APPLICATION STATE
     ========================================================== */

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

    overviewMetric: "pts",

    analyticsSeason: "current",
    analyticsPosition: "ALL",
    analyticsAge: "all",
    analyticsMinGP: 10,
    analyticsPlayer: null,
    analyticsCompare: null,
    analyticsX: "goalsPerGame",
    analyticsY: "assistsPerGame",
    analyticsSearch: "",

    historyProgress: null
  };

  const main = document.querySelector("#main-content");
  const intro = document.querySelector("#intro-overlay");
  const introProgress = document.querySelector("#intro-progress");
  const introClose = document.querySelector("#intro-close");
  const sidebar = document.querySelector("#sidebar");
  const scrim = document.querySelector("#scrim");
  const menuToggle = document.querySelector("#menu-toggle");

  const A = window.OHLAnalytics;

  const esc = window.escapeHTML || function (value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);
  };

  if (!main) {
    console.error("IceIndex: #main-content is missing.");
    return;
  }

  /* ==========================================================
     02. UTILITIES
     ========================================================== */

  const fmt = value =>
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(Number(value))
      ? "—"
      : Number(value).toLocaleString("en-CA");

  const dec = (value, digits = 2) =>
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(Number(value))
      ? "—"
      : Number(value).toFixed(digits);

  const pct = value =>
    value === null ||
    value === undefined
      ? "—"
      : `${dec(value, 1)}%`;

  const clamp = (n, min, max) =>
    Math.min(max, Math.max(min, n));

  function valueOf(record, metric) {
    if (!record) return null;

    if (metric === "rate") {
      return record.gp > 0 && record.pts != null
        ? record.pts / record.gp
        : null;
    }

    if (metric === "goalsRate") {
      return record.gp > 0 && record.g != null
        ? record.g / record.gp
        : null;
    }

    if (metric === "assistsRate") {
      return record.gp > 0 && record.a != null
        ? record.a / record.gp
        : null;
    }

    return record[metric] ?? null;
  }

  function sortBy(rows, metric = "pts") {
    return [...rows].sort((a, b) => {
      const x = valueOf(a, metric);
      const y = valueOf(b, metric);

      return (y ?? -Infinity) - (x ?? -Infinity) ||
        String(a.name).localeCompare(String(b.name));
    });
  }

  function option(value, label, selected) {
    return `<option value="${esc(value)}" ${
      String(value) === String(selected) ? "selected" : ""
    }>${esc(label)}</option>`;
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

  function panel(title, body, extra = "") {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>${esc(title)}</h2>
          ${extra}
        </div>
        ${body}
      </section>
    `;
  }

  function empty(message = "No matching records.") {
    return `<div class="empty">${esc(message)}</div>`;
  }

  function person(key) {
    return S.byKey.get(key) || null;
  }

  function currentYear() {
    return S.current[0]?.endYear || null;
  }

  function currentSeason() {
    return S.current[0]?.season || "Current season";
  }

  function allRecords() {
    return [...S.history, ...S.current];
  }

  function seasonList() {
    return [...new Set(
      allRecords().map(r => r.season).filter(Boolean)
    )].sort().reverse();
  }

  function image(player, className = "avatar") {
    const name = String(player?.name || "OHL");
    const initials = name
      .split(/\s+/)
      .slice(0, 2)
      .map(word => word[0] || "")
      .join("")
      .toUpperCase();

    const id = String(player?.id || "");
    const source = player?.photo ||
      (/^\d+$/.test(id)
        ? `https://assets.leaguestat.com/ohl/240x240/${id}.jpg`
        : "");

    return `
      <span class="${esc(className)}">
        <span>${esc(initials)}</span>
        ${/^https:\/\//i.test(source) ? `
          <img
            src="${esc(source)}"
            alt="${esc(name)}"
            loading="lazy"
            decoding="async"
            onerror="this.remove()"
          >
        ` : ""}
      </span>
    `;
  }

  function logo(team, className = "team-logo") {
    return typeof window.teamLogo === "function"
      ? window.teamLogo(team, className)
      : `<span class="logo-fallback">OHL</span>`;
  }

  function aggregate(records) {
    if (!records.length) return null;

    const latest = records[records.length - 1];
    const result = {
      ...latest,
      season: "career",
      team: [...new Set(records.map(r => r.team))]
        .filter(Boolean)
        .join(" / ")
    };

    const fields = [
      "gp", "g", "a", "pts",
      "ppg", "ppa", "ppp",
      "shg", "sha", "shpts",
      "gwg", "eng", "pim", "shots"
    ];

    for (const field of fields) {
      const values = records
        .map(r => r[field])
        .filter(v => v !== null && v !== undefined);

      result[field] = values.length
        ? values.reduce((sum, n) => sum + Number(n), 0)
        : null;
    }

    const plusMinus = records.map(r => r.plusMinus);

    result.plusMinus = plusMinus.every(v => v != null)
      ? plusMinus.reduce((sum, n) => sum + Number(n), 0)
      : null;

    return result;
  }

  /* ==========================================================
     03. PLAYER IDENTITY + SEASON MERGING
     ========================================================== */

  function mergeData() {
    const raw = allRecords();

    /*
      Prefer the analytics engine's season-stint
      resolution when available.

      Note: team-stint aggregation is only safe
      when input rows are genuinely separate stints.
      The source dataset still requires validation.
    */

    let seasons;

    if (A && typeof A.seasonRecords === "function") {
      seasons = A.seasonRecords(raw);
    } else {
      const map = new Map();

      for (const r of raw) {
        const key = `${r.key}|${r.endYear}`;
        const old = map.get(key);

        if (
          !old ||
          (r.source === "current" && old.source !== "current")
        ) {
          map.set(key, r);
        }
      }

      seasons = [...map.values()];
    }

    const groups = new Map();

    for (const record of seasons) {
      if (!groups.has(record.key)) {
        groups.set(record.key, []);
      }

      groups.get(record.key).push(record);
    }

    const people = [];

    for (const [key, items] of groups) {
      items.sort((a, b) => a.endYear - b.endYear);

      const latest = items[items.length - 1];

      const photo = [...items]
        .reverse()
        .map(r => r.photo)
        .find(Boolean) || "";

      const id = [...items]
        .reverse()
        .map(r => r.id)
        .find(Boolean) || "";

      const birth = [...items]
        .reverse()
        .map(r => r.birth)
        .find(Boolean) || "";

      const position = [...items]
        .reverse()
        .map(r => r.position)
        .find(Boolean) || "";

      people.push({
        key,
        name: latest.name,
        id,
        birth,
        photo,
        position,
        team: latest.team,
        latestYear: latest.endYear,
        seasons: items,
        career: aggregate(items)
      });
    }

    S.people = people.sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    S.byKey = new Map(
      S.people.map(p => [p.key, p])
    );

    const defaultPlayer = sortBy(
      S.current,
      "pts"
    )[0];

    if (!person(S.profile)) {
      S.profile = defaultPlayer?.key || S.people[0]?.key || null;
    }

    if (!person(S.compareA)) {
      S.compareA = S.profile;
    }

    if (!person(S.compareB)) {
      S.compareB = S.people.find(
        p => p.key !== S.compareA
      )?.key || null;
    }

    if (!person(S.analyticsPlayer)) {
      S.analyticsPlayer = S.profile;
    }

    if (!person(S.analyticsCompare)) {
      S.analyticsCompare = S.compareB;
    }
  }

  function selectedRecord(player, season = "career") {
    if (!player) return null;

    return season === "career"
      ? player.career
      : player.seasons.find(r => r.season === season) || null;
  }

  // Searchable player selector. Keeps the original select event contract.
  function searchablePlayerSelect(id, selected, people) {
    const chosen = people.find(p => String(p.key) === String(selected));
    return `
      <div class="ice-player-picker" data-picker="${esc(id)}">
        <input class="input ice-player-picker-search" type="search"
          aria-label="Search for a player" autocomplete="off"
          placeholder="Search player name..."
          value="${esc(chosen?.name || "")}">
        <div class="ice-player-picker-results" role="listbox" hidden></div>
        <select id="${esc(id)}" class="select ice-player-picker-native"
          aria-label="Selected player" tabindex="-1">
          ${people.map(p => option(p.key, p.name, selected)).join("")}
        </select>
      </div>`;
  }

  function playerSelect(id, selected) {
    return searchablePlayerSelect(id, selected, S.people);
  }

  function playerSeasonSelect(id, player, selected, career = true) {
    if (!player) return "";

    return `
      <select id="${id}" class="select">
        ${career
          ? option("career", "Complete OHL career", selected)
          : ""}
        ${player.seasons.map(r =>
          option(r.season, r.season, selected)
        ).join("")}
      </select>
    `;
  }

  /* ==========================================================
     04. RESPONSIVE PLAYER TABLES
     ========================================================== */

  function table(rows) {
    if (!rows.length) return empty();

    const desktop = `
      <div class="table-scroll desktop-stats">
        <table class="data-table">
          <thead>
            <tr>
              <th>PLAYER</th>
              <th>SEASON</th>
              <th>TEAM</th>
              <th>GP</th>
              <th>G</th>
              <th>A</th>
              <th>PTS</th>
              <th>P/GP</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => {
              const p = person(r.key) || r;

              return `
                <tr>
                  <td>
                    <a href="#profile"
                       class="player-cell"
                       data-person="${esc(r.key)}">
                      ${image(p)}
                      <span>
                        <strong>${esc(r.name)}</strong>
                        <small>${esc(r.position || "")}</small>
                      </span>
                    </a>
                  </td>
                  <td>${esc(r.season || "")}</td>
                  <td>${esc(r.team || "")}</td>
                  <td>${fmt(r.gp)}</td>
                  <td>${fmt(r.g)}</td>
                  <td>${fmt(r.a)}</td>
                  <td class="accent">${fmt(r.pts)}</td>
                  <td>${dec(valueOf(r, "rate"))}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;

    const mobile = `
      <div class="mobile-stats">
        <table class="data-table mobile-stats-table">
          <thead>
            <tr>
              <th>PLAYER</th>
              <th>GP</th>
              <th>G</th>
              <th>A</th>
              <th>PTS</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => {
              const p = person(r.key) || r;

              return `
                <tr>
                  <td>
                    <a href="#profile"
                       class="player-cell"
                       data-person="${esc(r.key)}">
                      ${image(p)}
                      <span>
                        <strong>${esc(r.name)}</strong>
                        <small>${esc(r.team || "")}</small>
                      </span>
                    </a>
                  </td>
                  <td>${fmt(r.gp)}</td>
                  <td>${fmt(r.g)}</td>
                  <td>${fmt(r.a)}</td>
                  <td class="accent">${fmt(r.pts)}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;

    return desktop + mobile;
  }

  /* ==========================================================
     05. ARCHIVE NOTICE
     ========================================================== */

  function archiveNotice() {
    if (S.loading) {
      const progress = S.historyProgress;

      const detail = progress
        ? ` ${progress.completed || 0}/${progress.total || 0} seasons checked.`
        : "";

      return `
        <div class="notice">
          Historical OHL statistics are loading in the background.
          ${esc(detail)}
        </div>
      `;
    }

    if (S.archive?.failed?.length) {
      return `
        <div class="notice">
          Historical coverage may be incomplete:
          ${fmt(S.archive.loaded?.length || 0)}
          seasons loaded.
        </div>
      `;
    }

    return "";
  }

  /* ==========================================================
     06. OVERVIEW
     ========================================================== */

  function renderOverview() {
    const rows = S.current;

    const leaders = [
      ["POINTS LEADER", "pts"],
      ["GOALS LEADER", "g"],
      ["ASSISTS LEADER", "a"],
      ["POINTS PER GAME", "rate"]
    ];

    const cards = leaders.map(([label, metric]) => {
      const eligible = metric === "rate"
        ? rows.filter(r => r.gp >= 5)
        : rows;

      const leader = sortBy(eligible, metric)[0];

      if (!leader) {
        return `<article class="leader-card">${esc(label)} —</article>`;
      }

      return `
        <article class="leader-card">
          <span class="eyebrow">${esc(label)}</span>
          <div class="leader-content">
            ${image(leader, "leader-photo")}
            <div>
              <div class="leader-value">
                ${metric === "rate"
                  ? dec(valueOf(leader, metric))
                  : fmt(valueOf(leader, metric))}
              </div>
              <a href="#profile"
                 data-person="${esc(leader.key)}">
                ${esc(leader.name)}
              </a>
              <small>${esc(leader.team)}</small>
            </div>
          </div>
        </article>
      `;
    }).join("");

    const top = sortBy(
      rows,
      S.overviewMetric
    ).slice(0, 8);

    const max = Math.max(
      1,
      ...top.map(r => valueOf(r, S.overviewMetric) || 0)
    );

    main.innerHTML = `
      <section class="hero">
        <div class="eyebrow">OHL / LEAGUE INTELLIGENCE</div>
        <h1>The league, by the numbers.</h1>
        <p>
          Current OHL production, historical player development,
          and advanced player analytics powered by OHLDataHub.
        </p>
        <div class="hero-meta">
          <span class="live-dot"></span>
          ${esc(currentSeason())}
          · ${fmt(rows.length)} skater records
        </div>
      </section>

      <div class="section-title">
        <span class="eyebrow">CURRENT SEASON</span>
        <h2>Players setting the pace</h2>
      </div>

      <div class="leader-grid">${cards}</div>

      <div class="kpi-grid">
        <div class="kpi">
          <span>CURRENT SKATERS</span>
          <b>${fmt(rows.length)}</b>
        </div>
        <div class="kpi">
          <span>PLAYER DIRECTORY</span>
          <b>${fmt(S.people.length)}</b>
        </div>
        <div class="kpi">
          <span>ARCHIVE SEASONS</span>
          <b>${fmt(S.archive?.loaded?.length || 0)}</b>
        </div>
        <div class="kpi">
          <span>CURRENT GOALS</span>
          <b>${fmt(rows.reduce((sum, r) => sum + (r.g || 0), 0))}</b>
        </div>
      </div>

      <div class="two-col">
        ${panel(
          "Scoring Leaders",
          table(sortBy(rows).slice(0, 10))
        )}

        ${panel(
          "Production Rankings",
          `
            <div class="tabs">
              ${[
                ["pts", "Points"],
                ["g", "Goals"],
                ["a", "Assists"],
                ["rate", "P/GP"]
              ].map(([key, label]) => `
                <button
                  class="btn ${S.overviewMetric === key ? "active" : ""}"
                  data-metric="${key}">
                  ${label}
                </button>
              `).join("")}
            </div>

            <div class="bars">
              ${top.map(r => `
                <div class="bar-row">
                  <div>
                    <a href="#profile"
                       data-person="${esc(r.key)}">
                      ${esc(r.name)}
                    </a>
                    <b>${S.overviewMetric === "rate"
                      ? dec(valueOf(r, S.overviewMetric))
                      : fmt(valueOf(r, S.overviewMetric))}
                    </b>
                  </div>
                  <span class="track">
                    <span style="width:${
                      clamp(
                        (valueOf(r, S.overviewMetric) || 0) /
                        max * 100,
                        0,
                        100
                      )
                    }%"></span>
                  </span>
                </div>
              `).join("")}
            </div>
          `
        )}
      </div>

      <div class="callout">
        <div>
          <h2>Go beyond the box score.</h2>
          <p>
            Explore percentile scouting cards,
            player comparisons, and interactive analytics.
          </p>
        </div>
        <button class="btn primary" data-go="analytics">
          Explore Player Analytics
        </button>
      </div>
    `;
  }

  /* ==========================================================
     07. PLAYER DATABASE
     ========================================================== */

  function renderPlayers() {
    const seasons = seasonList();

    const teams = [...new Set(
      allRecords().map(r => r.team).filter(Boolean)
    )].sort();

    main.innerHTML =
      heading(
        "HISTORICAL DATABASE",
        "OHL Player Database",
        "Search current and historical OHL skater statistics."
      ) +
      archiveNotice() +
      `
        <div class="controls">
          <input
            id="db-search"
            class="input"
            type="search"
            placeholder="Search OHL players…"
            value="${esc(S.query)}"
          >

          <select id="db-season" class="select">
            ${option("all", "All seasons", S.dbSeason)}
            ${seasons.map(s => option(s, s, S.dbSeason)).join("")}
          </select>

          <select id="db-team" class="select">
            ${option("all", "All teams", S.dbTeam)}
            ${teams.map(t => option(t, t, S.dbTeam)).join("")}
          </select>

          <select id="db-sort" class="select">
            ${[
              ["pts", "Points"],
              ["rate", "Points / Game"],
              ["g", "Goals"],
              ["a", "Assists"],
              ["gp", "Games"]
            ].map(([key, label]) =>
              option(key, label, S.dbSort)
            ).join("")}
          </select>

          <button class="btn" id="db-clear">Clear</button>
        </div>

        <div id="db-results"></div>
      `;

    updateDatabase();
  }

  function updateDatabase() {
    const container = document.querySelector("#db-results");
    if (!container) return;

    let rows = allRecords();

    if (A?.seasonRecords) {
      rows = A.seasonRecords(rows);
    }

    const query = S.query.trim().toLowerCase();

    if (query) {
      rows = rows.filter(r =>
        `${r.name} ${r.team} ${r.position}`
          .toLowerCase()
          .includes(query)
      );
    }

    if (S.dbSeason !== "all") {
      rows = rows.filter(r => r.season === S.dbSeason);
    }

    if (S.dbTeam !== "all") {
      rows = rows.filter(r => r.team === S.dbTeam);
    }

    rows = sortBy(rows, S.dbSort);

    const pageSize = 100;
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));

    S.dbPage = clamp(S.dbPage, 1, pages);

    const start = (S.dbPage - 1) * pageSize;
    const visible = rows.slice(start, start + pageSize);

    container.innerHTML = `
      <div class="results-meta">
        ${fmt(rows.length)} matching player-season records
      </div>

      ${table(visible)}

      <div class="ice-pagination">
        <button class="btn"
                data-db-page="prev"
                ${S.dbPage <= 1 ? "disabled" : ""}>
          Previous
        </button>

        <span>Page ${S.dbPage} of ${pages}</span>

        <button class="btn"
                data-db-page="next"
                ${S.dbPage >= pages ? "disabled" : ""}>
          Next
        </button>
      </div>
    `;
  }

  /* ==========================================================
     08. PLAYER PROFILE
     ========================================================== */

  function renderProfile() {
    const p = person(S.profile);

    if (!p) {
      main.innerHTML = empty("Player not found.");
      return;
    }

    const r = selectedRecord(p, S.profileSeason) || p.career;

    const stats = [
      ["GAMES", r.gp],
      ["GOALS", r.g],
      ["ASSISTS", r.a],
      ["POINTS", r.pts],
      ["POINTS / GP", valueOf(r, "rate"), 2],
      ["SHOTS", r.shots],
      ["POWER-PLAY POINTS", r.ppp],
      ["PENALTY MINUTES", r.pim]
    ];

    main.innerHTML =
      heading(
        "PLAYER INTELLIGENCE",
        "Player Profile",
        "Explore individual OHL careers and seasonal production."
      ) +
      archiveNotice() +
      `
        <div class="controls">
          ${playerSelect("profile-player", p.key)}
          ${playerSeasonSelect(
            "profile-season",
            p,
            S.profileSeason
          )}
        </div>

        <section class="panel">
          <div class="ice-player-header">
            ${image(p, "leader-photo")}
            <div>
              <div class="eyebrow">${esc(p.position || "OHL SKATER")}</div>
              <h2>${esc(p.name)}</h2>
              <p>${esc(p.team || "")}</p>
              <small>
                ${p.birth ? `Born ${esc(p.birth)}` : "Birthdate unavailable"}
              </small>
            </div>
            ${logo(p.team)}
          </div>

          <div class="kpi-grid">
            ${stats.map(([label, value, digits]) => `
              <div class="kpi">
                <span>${esc(label)}</span>
                <b>${digits == null ? fmt(value) : dec(value, digits)}</b>
              </div>
            `).join("")}
          </div>

          <div class="ice-actions">
            <button class="btn primary"
                    data-analyze="${esc(p.key)}">
              Analyze Player
            </button>

            <button class="btn"
                    data-compare-player="${esc(p.key)}">
              Compare Player
            </button>
          </div>
        </section>

        ${panel(
          "OHL Career History",
          table(p.seasons)
        )}

        ${panel(
          "Season Development",
          developmentChart(p)
        )}
      `;
  }

  function developmentChart(p) {
    const rows = p.seasons;

    if (!rows.length) return empty();

    const max = Math.max(
      1,
      ...rows.map(r => valueOf(r, "rate") || 0)
    );

    return `
      <div class="bars">
        ${rows.map(r => `
          <div class="bar-row">
            <div>
              <span>${esc(r.season)}</span>
              <b>${dec(valueOf(r, "rate"))} P/GP</b>
            </div>
            <span class="track">
              <span style="width:${
                clamp(
                  (valueOf(r, "rate") || 0) / max * 100,
                  0,
                  100
                )
              }%"></span>
            </span>
          </div>
        `).join("")}
      </div>
    `;
  }

  /* ==========================================================
     09. PLAYER COMPARISON
     ========================================================== */

  function renderCompare() {
    const p1 = person(S.compareA);
    const p2 = person(S.compareB);

    if (!p1 || !p2) {
      main.innerHTML = empty("Two players are required.");
      return;
    }

    const r1 = selectedRecord(p1, S.compareSeasonA);
    const r2 = selectedRecord(p2, S.compareSeasonB);

    const metrics = [
      ["Games Played", "gp"],
      ["Goals", "g"],
      ["Assists", "a"],
      ["Points", "pts"],
      ["Points / Game", "rate"],
      ["Goals / Game", "goalsRate"],
      ["Assists / Game", "assistsRate"],
      ["Power-Play Points", "ppp"],
      ["Shots", "shots"],
      ["Penalty Minutes", "pim"]
    ];

    main.innerHTML =
      heading(
        "HEAD-TO-HEAD",
        "Player Comparison",
        "Compare OHL players across careers and individual seasons."
      ) +
      `
        <div class="two-col">
          ${panel(
            "Player One",
            playerSelect("compare-a", p1.key) +
            playerSeasonSelect(
              "compare-season-a",
              p1,
              S.compareSeasonA
            )
          )}

          ${panel(
            "Player Two",
            playerSelect("compare-b", p2.key) +
            playerSeasonSelect(
              "compare-season-b",
              p2,
              S.compareSeasonB
            )
          )}
        </div>

        ${panel(
          "Statistical Comparison",
          `
            <div class="ice-compare-head">
              <div>${image(p1)} <strong>${esc(p1.name)}</strong></div>
              <span>VS</span>
              <div>${image(p2)} <strong>${esc(p2.name)}</strong></div>
            </div>

            <div class="ice-compare-table">
              ${metrics.map(([label, metric]) => {
                const a = valueOf(r1, metric);
                const b = valueOf(r2, metric);

                const digits = metric.endsWith("Rate") ||
                  metric === "rate" ? 3 : 0;

                return `
                  <div class="ice-compare-row">
                    <strong class="${a != null && b != null && a > b ? "ice-win" : ""}">
                      ${dec(a, digits)}
                    </strong>
                    <span>${esc(label)}</span>
                    <strong class="${a != null && b != null && b > a ? "ice-win" : ""}">
                      ${dec(b, digits)}
                    </strong>
                  </div>
                `;
              }).join("")}
            </div>

            <div class="ice-actions">
              <button class="btn primary" data-go="analytics">
                Advanced Radar Comparison
              </button>
            </div>
          `
        )}
      `;
  }

  /* ==========================================================
     10. DRAFT YEAR CENTRAL
     ========================================================== */

  function renderDraft() {
    if (!A) {
      main.innerHTML = empty("Analytics engine unavailable.");
      return;
    }

    const records = A.seasonRecords(allRecords());

    const withDraft = records
      .map(r => ({
        ...r,
        draftYear: A.estimatedDraftYear(r.birth)
      }))
      .filter(r => r.draftYear != null);

    const years = [...new Set(
      withDraft.map(r => r.draftYear)
    )].sort((a, b) => b - a);

    if (S.draftYear === null) {
      S.draftYear = years.find(y => y <= new Date().getFullYear()) ||
        years[0] || null;
    }

    let rows = withDraft.filter(
      r => r.draftYear === Number(S.draftYear)
    );

    const query = S.draftQuery.toLowerCase().trim();

    if (query) {
      rows = rows.filter(r =>
        `${r.name} ${r.team}`.toLowerCase().includes(query)
      );
    }

    rows = sortBy(rows, S.draftSort);

    main.innerHTML =
      heading(
        "DRAFT INTELLIGENCE",
        "Draft Year Central",
        "Explore estimated NHL draft-year cohorts using OHL player birthdates."
      ) +
      archiveNotice() +
      `
        <div class="notice">
          Draft-year groups are estimates based on birthdate.
          They are not official NHL eligibility lists.
        </div>

        <div class="controls">
          <select id="draft-year" class="select">
            ${years.map(y =>
              option(y, `${y} NHL Draft Class`, S.draftYear)
            ).join("")}
          </select>

          <input id="draft-search"
                 class="input"
                 type="search"
                 value="${esc(S.draftQuery)}"
                 placeholder="Search draft class…">

          <select id="draft-sort" class="select">
            ${[
              ["pts", "Points"],
              ["rate", "Points / Game"],
              ["g", "Goals"],
              ["a", "Assists"]
            ].map(([key, label]) =>
              option(key, label, S.draftSort)
            ).join("")}
          </select>
        </div>

        ${panel(
          `${S.draftYear} Draft Cohort`,
          table(rows.slice(0, 100))
        )}
      `;
  }

  /* ==========================================================
     11. TEAM EXPLORER
     ========================================================== */

  function renderTeams() {
    const teams = window.OHL_TEAMS || [];

    main.innerHTML =
      heading(
        "THE LEAGUE",
        "Team Explorer",
        "Explore the 20 current Ontario Hockey League clubs."
      ) +
      `
        <div class="ice-team-grid">
          ${teams.map(([name, code]) => {
            const players = S.current.filter(r =>
              r.team === name ||
              window.getOHLTeam?.(r.team)?.name === name
            );

            return `
              <button class="ice-team-card"
                      data-team="${esc(name)}">
                ${logo(name)}
                <strong>${esc(name)}</strong>
                <span>${esc(code)}</span>
                <small>${fmt(players.length)} skater records</small>
              </button>
            `;
          }).join("")}
        </div>
      `;
  }

  /* ==========================================================
     12. ANALYTICS DATA HELPERS
     ========================================================== */

  function analyticsRecords() {
    if (!A) return [];

    const rows = A.seasonRecords(allRecords());

    if (S.analyticsSeason === "current") {
      return rows.filter(r => r.endYear === currentYear());
    }

    if (S.analyticsSeason !== "all") {
      return rows.filter(
        r => r.endYear === Number(S.analyticsSeason)
      );
    }

    return rows;
  }

  function analyticsOptions() {
    const options = {
      position: S.analyticsPosition,
      minGP: S.analyticsMinGP
    };

    if (S.analyticsSeason === "current") {
      options.season = currentYear();
    } else if (S.analyticsSeason !== "all") {
      options.season = Number(S.analyticsSeason);
    }

    if (S.analyticsAge !== "all") {
      options.age = Number(S.analyticsAge);
      options.ageWindow = 0;
    }

    return options;
  }

  function analyticsCohort() {
    return A.buildCohort(
      analyticsRecords(),
      analyticsOptions()
    );
  }

  function analyticsPlayerRecord(key, season = null) {
    const p = person(key);

    if (!p) return null;

    const desiredYear = season ??
      (S.analyticsSeason === "current"
        ? currentYear()
        : S.analyticsSeason !== "all"
          ? Number(S.analyticsSeason)
          : null);

    if (desiredYear !== null) {
      return p.seasons.find(r =>
        r.endYear === desiredYear
      ) || null;
    }

    return [...p.seasons]
      .reverse()
      .find(r => r.gp >= S.analyticsMinGP) ||
      p.seasons.at(-1) ||
      null;
  }

  function analyticsMetricOptions(selected) {
    const allowed = [
      "pointsPerGame",
      "goalsPerGame",
      "assistsPerGame",
      "shotsPerGame",
      "shootingPct",
      "powerPlayPointsPerGame",
      "powerPlayShare",
      "goalShare",
      "pimPerGame",
      "plusMinusPerGame",
      "gp", "g", "a", "pts"
    ];

    return allowed.map(key =>
      option(
        key,
        A.metrics[key]?.label || key,
        selected
      )
    ).join("");
  }

  function analyticsPlayerOptions(selected) {
    const rows = analyticsCohort();

    const keys = new Set(rows.map(r => r.key));

    const available = S.people.filter(p =>
      keys.has(p.key)
    );

    return available.map(p =>
      option(p.key, p.name, selected)
    ).join("");
  }

  function resolveAnalyticsSelections() {
    const cohort = analyticsCohort();

    if (!cohort.length) {
      S.analyticsPlayer = null;
      S.analyticsCompare = null;
      return;
    }

    if (!cohort.some(r => r.key === S.analyticsPlayer)) {
      S.analyticsPlayer = sortBy(cohort, "pts")[0].key;
    }

    if (
      !cohort.some(r => r.key === S.analyticsCompare) ||
      S.analyticsCompare === S.analyticsPlayer
    ) {
      S.analyticsCompare = cohort.find(
        r => r.key !== S.analyticsPlayer
      )?.key || S.analyticsPlayer;
    }
  }

  /* ==========================================================
     13. ANALYTICS PERCENTILE BARS
     ========================================================== */

  function percentileBar(result) {
    if (!result) {
      return `
        <div class="ice-percentile-row">
          <span>Insufficient comparable data</span>
        </div>
      `;
    }

    const value = result.percentile;

    const width = clamp(value, 0, 100);

    return `
      <div class="ice-percentile-row">
        <div class="ice-percentile-top">
          <span>${esc(result.label)}</span>
          <strong>${dec(value, 1)}th</strong>
        </div>

        <div class="ice-percentile-track">
          <div class="ice-percentile-fill"
               style="width:${width}%"></div>
        </div>

        <div class="ice-percentile-meta">
          <span>${dec(result.value, 2)}</span>
          <span>n = ${fmt(result.sampleSize)}</span>
        </div>
      </div>
    `;
  }

  /* ==========================================================
     14. ANALYTICS PLAYER CARD
     ========================================================== */

  function renderAnalyticsCard(record, cohort) {
    if (!record) {
      return empty("Select an eligible player.");
    }

    const metrics = [
      "pointsPerGame",
      "goalsPerGame",
      "assistsPerGame",
      "shotsPerGame",
      "shootingPct",
      "powerPlayPointsPerGame"
    ];

    const rates = A.calculateRates(record);

    const details = metrics.map(metric =>
      A.metricPercentile(
        record,
        cohort,
        metric,
        analyticsOptions()
      )
    );

    const age = A.seasonAge(record);

    const draft = A.draftStatus(record);

    return `
      <div class="ice-scout-card" id="ice-scout-card">
        <div class="ice-scout-header">
          ${image(record, "ice-scout-photo")}

          <div>
            <div class="eyebrow">ICEINDEX PLAYER ANALYTICS</div>
            <h2>${esc(record.name)}</h2>
            <p>${esc(record.team)}</p>
            <div class="ice-scout-tags">
              <span>${esc(record.position || "SKATER")}</span>
              <span>${age ?? "—"} YEARS</span>
              <span>${esc(draft.label)}</span>
              <span>${esc(record.season)}</span>
            </div>
          </div>

          ${logo(record.team)}
        </div>

        <div class="ice-scout-stats">
          ${[
            ["GP", record.gp],
            ["G", record.g],
            ["A", record.a],
            ["PTS", record.pts],
            ["P/GP", rates.pointsPerGame, 2],
            ["SH%", rates.shootingPct, 1]
          ].map(([label, value, digits]) => `
            <div>
              <span>${label}</span>
              <strong>${digits == null
                ? fmt(value)
                : dec(value, digits)}
              </strong>
            </div>
          `).join("")}
        </div>

        <div class="ice-percentile-list">
          ${details.map((result, index) =>
            result
              ? percentileBar(result)
              : `
                <div class="ice-percentile-row">
                  <div class="ice-percentile-top">
                    <span>${esc(A.metrics[metrics[index]].label)}</span>
                    <strong>—</strong>
                  </div>
                  <small>Insufficient data</small>
                </div>
              `
          ).join("")}
        </div>

        <div class="ice-card-footer">
          ICEINDEX · OHL PLAYER INTELLIGENCE
          <span>Percentiles based on selected cohort</span>
        </div>
      </div>

      <div class="ice-actions">
        <button class="btn primary" id="download-player-card">
          Download PNG Card
        </button>

        <button class="btn"
                data-profile="${esc(record.key)}">
          View Full Profile
        </button>
      </div>
    `;
  }

  /* ==========================================================
     15. RADAR CHART SVG
     ========================================================== */

  function radarSVG(data) {
    const axes = data.axes || [];
    const datasets = data.datasets || [];

    if (axes.length < 3) {
      return empty("At least three metrics are required.");
    }

    const width = 600;
    const height = 440;
    const cx = 300;
    const cy = 205;
    const radius = 135;
    const count = axes.length;

    const point = (index, value) => {
      const angle = -Math.PI / 2 +
        index * 2 * Math.PI / count;

      const r = radius * clamp(value / 100, 0, 1);

      return [
        cx + Math.cos(angle) * r,
        cy + Math.sin(angle) * r
      ];
    };

    const polygon = values =>
      values.map((value, i) =>
        point(i, value).map(n => n.toFixed(1)).join(",")
      ).join(" ");

    const rings = [20, 40, 60, 80, 100].map(level => `
      <polygon
        points="${polygon(axes.map(() => level))}"
        fill="none"
        stroke="currentColor"
        stroke-opacity=".13"
        stroke-width="1"
      />
    `).join("");

    const lines = axes.map((axis, i) => {
      const [x, y] = point(i, 100);

      return `
        <line x1="${cx}" y1="${cy}"
              x2="${x}" y2="${y}"
              stroke="currentColor"
              stroke-opacity=".15"/>
      `;
    }).join("");

    const labels = axes.map((axis, i) => {
      const [x, y] = point(i, 122);

      return `
        <text x="${x}" y="${y}"
              text-anchor="middle"
              dominant-baseline="middle"
              font-size="11"
              fill="currentColor">
          ${esc(axis.short)}
        </text>
      `;
    }).join("");

    const colors = ["#58b8ff", "#ffad64", "#9de6ba"];

    const shapes = datasets.map((set, index) => {
      const values = axes.map(axis =>
        set.values[axis.key]
      );

      if (values.some(v => v == null)) {
        return "";
      }

      const color = colors[index % colors.length];

      return `
        <polygon
          points="${polygon(values)}"
          fill="${color}"
          fill-opacity=".14"
          stroke="${color}"
          stroke-width="2.5"
          stroke-linejoin="round"
        />
      `;
    }).join("");

    const legend = datasets.map((set, i) => `
      <span class="ice-chart-legend-item">
        <span style="background:${colors[i % colors.length]}"></span>
        ${esc(set.name)}
      </span>
    `).join("");

    return `
      <div class="ice-chart-wrap">
        <svg
          class="ice-radar-svg"
          viewBox="0 0 ${width} ${height}"
          role="img"
          aria-label="Player percentile radar comparison"
        >
          ${rings}
          ${lines}
          ${shapes}
          ${labels}
        </svg>

        <div class="ice-chart-legend">${legend}</div>
        <p class="ice-chart-note">
          Percentiles range from 0 to 100.
          Missing metrics are not estimated.
          Higher percentile indicates a higher
          statistical value, not necessarily
          better overall performance.
        </p>
      </div>
    `;
  }

  /* ==========================================================
     16. SCATTER PLOT SVG
     ========================================================== */

  function scatterSVG(data) {
    const points = data.points || [];

    if (!points.length) {
      return empty("No players meet the selected criteria.");
    }

    const width = 760;
    const height = 470;

    const left = 65;
    const right = 25;
    const top = 30;
    const bottom = 70;

    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;

    const xMax = Math.max(
      0.01,
      ...points.map(p => p.x)
    ) * 1.08;

    const yMax = Math.max(
      0.01,
      ...points.map(p => p.y)
    ) * 1.08;

    const xScale = x =>
      left + x / xMax * plotWidth;

    const yScale = y =>
      top + plotHeight -
      y / yMax * plotHeight;

    const grid = Array.from({ length: 6 }, (_, i) => {
      const fraction = i / 5;

      const x = left + fraction * plotWidth;
      const y = top + fraction * plotHeight;

      return `
        <line x1="${x}" y1="${top}"
              x2="${x}" y2="${top + plotHeight}"
              stroke="currentColor"
              stroke-opacity=".09"/>

        <line x1="${left}" y1="${y}"
              x2="${left + plotWidth}" y2="${y}"
              stroke="currentColor"
              stroke-opacity=".09"/>

        <text x="${x}" y="${top + plotHeight + 22}"
              text-anchor="middle"
              font-size="11"
              fill="currentColor">
          ${dec(fraction * xMax, 2)}
        </text>

        <text x="${left - 12}" y="${y + 4}"
              text-anchor="end"
              font-size="11"
              fill="currentColor">
          ${dec((1 - fraction) * yMax, 2)}
        </text>
      `;
    }).join("");

    const dots = points.map(p => {
      const x = xScale(p.x);
      const y = yScale(p.y);

      const title = `${p.name} — ${p.team}\n` +
        `${data.xLabel}: ${dec(p.x, 3)}\n` +
        `${data.yLabel}: ${dec(p.y, 3)}`;

      return `
        <circle
          class="ice-scatter-dot"
          cx="${x}"
          cy="${y}"
          r="5"
          fill="#58b8ff"
          fill-opacity=".75"
          stroke="#b9e5ff"
          stroke-width=".7"
          data-scatter-player="${esc(p.key)}"
          tabindex="0"
          role="button"
          aria-label="${esc(title)}"
        >
          <title>${esc(title)}</title>
        </circle>
      `;
    }).join("");

    return `
      <div class="ice-chart-wrap">
        <svg
          class="ice-scatter-svg"
          viewBox="0 0 ${width} ${height}"
          role="img"
          aria-label="${esc(data.yLabel)} versus ${esc(data.xLabel)}"
        >
          ${grid}
          ${dots}

          <text x="${left + plotWidth / 2}"
                y="${height - 15}"
                text-anchor="middle"
                fill="currentColor"
                font-size="13">
            ${esc(data.xLabel)}
          </text>

          <text
            x="18"
            y="${top + plotHeight / 2}"
            text-anchor="middle"
            transform="rotate(-90 18 ${top + plotHeight / 2})"
            fill="currentColor"
            font-size="13">
            ${esc(data.yLabel)}
          </text>
        </svg>

        <p class="ice-chart-note">
          ${fmt(points.length)} player-season records.
          Select a point to open the player's profile.
        </p>
      </div>
    `;
  }

  /* ==========================================================
     17. PLAYER ANALYTICS PAGE
     ========================================================== */

  function renderAnalytics() {
    if (!A) {
      main.innerHTML = `
        ${heading(
          "PLAYER INTELLIGENCE",
          "Player Analytics",
          "Advanced OHL player analysis."
        )}
        <div class="notice">
          The analytics engine has not loaded.
          Ensure js/ohl-analytics.js is included
          before js/app.js.
        </div>
      `;
      return;
    }

    resolveAnalyticsSelections();

    const records = analyticsRecords();
    const cohort = analyticsCohort();

    const primary = cohort.find(r =>
      r.key === S.analyticsPlayer
    ) || null;

    const secondary = cohort.find(r =>
      r.key === S.analyticsCompare
    ) || null;

    const radarPlayers = [primary, secondary].filter(Boolean);
    const preferredRadarMetrics = [
      "pointsPerGame", "goalsPerGame", "assistsPerGame",
      "shotsPerGame", "shootingPct", "powerPlayPointsPerGame",
      "powerPlayShare", "goalShare", "pimPerGame"
    ];
    const radarMetrics = preferredRadarMetrics.filter(metric =>
      radarPlayers.every(player =>
        A.metricPercentile(player, cohort, metric, analyticsOptions())?.percentile != null
      )
    ).slice(0, 7);
    const radar = A.radarData(
      radarPlayers,
      records,
      { ...analyticsOptions(), metrics: radarMetrics }
    );

    const scatter = A.scatterData(
      records,
      {
        ...analyticsOptions(),
        xMetric: S.analyticsX,
        yMetric: S.analyticsY
      }
    );

    const ages = [...new Set(
      records.map(r => A.seasonAge(r))
        .filter(v => v !== null)
    )].sort((a, b) => a - b);

    const seasons = seasonList();

    main.innerHTML =
      heading(
        "ICEINDEX / ADVANCED INTELLIGENCE",
        "Player Analytics",
        "Explore scouting percentiles, player comparisons, and interactive OHL production data."
      ) +
      archiveNotice() +
      `
        <div class="ice-analytics-intro">
          <div>
            <span class="eyebrow">NEW IN v0.3.0</span>
            <h2>Beyond the box score.</h2>
            <p>
              Compare players against their peers,
              identify production strengths, and
              discover statistical outliers.
            </p>
          </div>

          <div class="ice-analytics-count">
            <strong>${fmt(cohort.length)}</strong>
            <span>ELIGIBLE PLAYER-SEASONS</span>
          </div>
        </div>

        ${panel(
          "Analytics Filters",
          `
            <div class="ice-analytics-controls">
              <label>
                <span>SEASON</span>
                <select id="analytics-season" class="select">
                  ${option("current", "Current Season", S.analyticsSeason)}
                  ${option("all", "All Seasons", S.analyticsSeason)}
                  ${seasons.map(s => {
                    const year = recordsYearFromSeason(s);
                    return option(year, s, S.analyticsSeason);
                  }).join("")}
                </select>
              </label>

              <label>
                <span>POSITION</span>
                <select id="analytics-position" class="select">
                  ${option("ALL", "All Skaters", S.analyticsPosition)}
                  ${option("F", "Forwards", S.analyticsPosition)}
                  ${option("D", "Defencemen", S.analyticsPosition)}
                </select>
              </label>

              <label>
                <span>AGE</span>
                <select id="analytics-age" class="select">
                  ${option("all", "All Ages", S.analyticsAge)}
                  ${ages.map(age =>
                    option(age, `${age} Years`, S.analyticsAge)
                  ).join("")}
                </select>
              </label>

              <label>
                <span>MINIMUM GP</span>
                <select id="analytics-min-gp" class="select">
                  ${[1, 5, 10, 15, 20, 30, 40, 50]
                    .map(gp =>
                      option(gp, `${gp} Games`, S.analyticsMinGP)
                    ).join("")}
                </select>
              </label>
            </div>
          `
        )}

        <div class="ice-analytics-section-title">
          <div class="eyebrow">01 / PLAYER SCOUTING</div>
          <h2>Player Analytics Card</h2>
          <p>
            Percentile rankings against the selected comparison group.
          </p>
        </div>

        ${panel(
          "Select Player",
          `
            <div class="controls">
              ${searchablePlayerSelect("analytics-player", S.analyticsPlayer,
                S.people.filter(p => new Set(cohort.map(r => r.key)).has(p.key)))}
            </div>
          `
        )}

        ${renderAnalyticsCard(primary, cohort)}

        <div class="ice-analytics-section-title">
          <div class="eyebrow">02 / COMPARATIVE INTELLIGENCE</div>
          <h2>Radar Comparison</h2>
          <p>
            Compare scoring and shooting metrics
            using percentile-based rankings.
          </p>
        </div>

        ${panel(
          "Compare Players",
          `
            <div class="controls">
              ${searchablePlayerSelect("analytics-compare", S.analyticsCompare,
                S.people.filter(p => new Set(cohort.map(r => r.key)).has(p.key)))}
            </div>

            ${radarSVG(radar)}
          `
        )}

        <div class="ice-analytics-section-title">
          <div class="eyebrow">03 / LEAGUE EXPLORER</div>
          <h2>Interactive Scatter Plot</h2>
          <p>
            Find statistical outliers and explore
            player production across the league.
          </p>
        </div>

        ${panel(
          "Production Explorer",
          `
            <div class="ice-analytics-controls">
              <label>
                <span>X AXIS</span>
                <select id="analytics-x" class="select">
                  ${analyticsMetricOptions(S.analyticsX)}
                </select>
              </label>

              <label>
                <span>Y AXIS</span>
                <select id="analytics-y" class="select">
                  ${analyticsMetricOptions(S.analyticsY)}
                </select>
              </label>
            </div>

            ${scatterSVG(scatter)}
          `
        )}

        <div class="ice-analytics-section-title">
          <div class="eyebrow">04 / LEAGUE RANKINGS</div>
          <h2>Analytics Leaderboard</h2>
        </div>

        ${panel(
          "Points per Game Leaders",
          table(
            A.leaderboard(
              records,
              "pointsPerGame",
              {
                ...analyticsOptions(),
                limit: 25
              }
            )
          )
        )}

        <div class="notice">
          Percentiles describe statistical rank within
          the selected cohort. They are not scouting
          grades or projections of future NHL performance.
          Shot maps and expected goals will be added
          only after the source event data is validated.
        </div>
      `;
  }

  function recordsYearFromSeason(season) {
    const match = String(season).match(
      /^(\d{4})[-/](\d{2,4})$/
    );

    if (!match) return season;

    const start = Number(match[1]);
    let end = Number(match[2]);

    if (match[2].length === 2) {
      end += Math.floor(start / 100) * 100;

      if (end <= start) end += 100;
    }

    return end;
  }

  /* ==========================================================
     18. DOWNLOADABLE PLAYER CARD SVG

     Creates a clean, self-contained SVG.
     No canvas or third-party library required.

     ========================================================== */

  async function downloadPlayerCard() {
    if (!A) return;
    const record = analyticsPlayerRecord(S.analyticsPlayer);
    if (!record) return;
    const cohort = analyticsCohort();
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 1280;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const bg = ctx.createLinearGradient(0, 0, W, 1280);
    bg.addColorStop(0, "#122d46"); bg.addColorStop(1, "#07121f");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, 1280);
    ctx.fillStyle = "#58b8ff"; ctx.fillRect(0, 0, W, 12);
    ctx.font = "bold 30px Arial"; ctx.fillText("ICEINDEX", 64, 78);
    ctx.fillStyle = "#91a9bc"; ctx.font = "18px Arial";
    ctx.fillText("OHL PLAYER ANALYTICS · v0.3.0", 64, 111);

    const photo = record.photo || (/^\d+$/.test(String(record.id || ""))
      ? `https://assets.leaguestat.com/ohl/240x240/${record.id}.jpg` : "");
    const drawRemoteImage = (src, x, y, w, h) => new Promise(resolve => {
      if (!/^https:\/\//i.test(src || "")) return resolve(false);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 15); ctx.clip();
          ctx.drawImage(img, x, y, w, h); ctx.restore(); resolve(true);
        } catch (_) { ctx.restore(); resolve(false); }
      };
      img.onerror = () => resolve(false);
      img.src = src;
    });
    const hasPhoto = await drawRemoteImage(photo, 64, 153, 205, 235);
    if (!hasPhoto) {
      ctx.fillStyle = "#17354e"; ctx.fillRect(64, 153, 205, 235);
      ctx.fillStyle = "#92d5ff"; ctx.font = "bold 64px Arial";
      ctx.fillText(record.name.split(/\s+/).slice(0,2).map(x=>x[0]).join(""), 104, 288);
    }
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 39px Arial";
    const words = String(record.name).split(" ");
    ctx.fillText(words.slice(0, -1).join(" ") || words[0], 300, 223, 620);
    if (words.length > 1) ctx.fillText(words.at(-1), 300, 271, 620);
    ctx.fillStyle = "#a9c2d6"; ctx.font = "23px Arial";
    ctx.fillText(`${record.team || "OHL"}  ·  ${record.season || "Season"}`, 300, 319, 620);
    ctx.fillText(`${record.position || "Skater"}`, 300, 354);
    ctx.strokeStyle = "#29475f"; ctx.beginPath(); ctx.moveTo(64, 418); ctx.lineTo(936, 418); ctx.stroke();
    const stats = [["GP",record.gp],["G",record.g],["A",record.a],["PTS",record.pts]];
    stats.forEach(([label,value],i) => {
      const x=70+i*230;
      ctx.fillStyle="#8eaabe";ctx.font="bold 19px Arial";ctx.fillText(label,x,470);
      ctx.fillStyle=i===3?"#58b8ff":"#ffffff";ctx.font="bold 43px Arial";
      ctx.fillText(fmt(value),x,522);
    });
    ctx.fillStyle="#ffffff";ctx.font="bold 25px Arial";
    ctx.fillText("SCOUTING PERCENTILES",64,602);
    const metrics=["pointsPerGame","goalsPerGame","assistsPerGame","shotsPerGame","shootingPct","powerPlayPointsPerGame"];
    metrics.forEach((metric,i)=>{
      const y=658+i*83;
      const result=A.metricPercentile(record,cohort,metric,analyticsOptions());
      const score=result?.percentile;
      ctx.fillStyle="#d0e0ec";ctx.font="20px Arial";
      ctx.fillText(A.metrics[metric]?.label||metric,64,y);
      ctx.textAlign="right";ctx.fillStyle="#ffffff";ctx.font="bold 21px Arial";
      ctx.fillText(score==null?"N/A":`${dec(score,1)}th`,934,y);ctx.textAlign="left";
      ctx.fillStyle="#203e56";ctx.fillRect(64,y+16,870,13);
      if(score!=null){ctx.fillStyle="#58b8ff";ctx.fillRect(64,y+16,870*clamp(score/100,0,1),13);}
    });
    ctx.strokeStyle="#29475f";ctx.beginPath();ctx.moveTo(64,1195);ctx.lineTo(936,1195);ctx.stroke();
    ctx.fillStyle="#8eaabe";ctx.font="18px Arial";
    ctx.fillText(`Compared with ${cohort.length} eligible season records`,64,1233);
    ctx.textAlign="right";ctx.fillText("ICEINDEX · OHLDataHub",936,1233);ctx.textAlign="left";
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve,"image/png"));
      if (!blob) throw new Error("PNG encoding failed");
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");a.href=url;
      a.download=`iceindex-${String(record.name).toLowerCase().replace(/[^a-z0-9]+/g,"-")}-${record.endYear||"season"}.png`;
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),3000);
    } catch(err) {
      console.error("Card export failed",err);
      alert("PNG export was blocked by the browser or image source. Please try again.");
    }
  }

  /* ==========================================================
     19. PAGE ROUTER
     ========================================================== */

  const VALID_PAGES = new Set([
    "overview",
    "players",
    "profile",
    "compare",
    "draft",
    "teams",
    "analytics"
  ]);

  function render() {
    if (!S.ready) {
      main.innerHTML = `
        <div class="empty">
          Loading current OHL statistics…
        </div>
      `;
      return;
    }

    switch (S.page) {
      case "players":
        renderPlayers();
        break;

      case "profile":
        renderProfile();
        break;

      case "compare":
        renderCompare();
        break;

      case "draft":
        renderDraft();
        break;

      case "teams":
        renderTeams();
        break;

      case "analytics":
        renderAnalytics();
        break;

      default:
        renderOverview();
        break;
    }

    updateNavigation();
  }

  function updateNavigation() {
    document.querySelectorAll(
      '[data-page], .nav-link[href^="#"]'
    ).forEach(element => {
      const target = element.dataset.page ||
        element.getAttribute("href")?.replace(/^#/, "");

      const active = target === S.page;

      element.classList.toggle("active", active);

      if (active) {
        element.setAttribute("aria-current", "page");
      } else {
        element.removeAttribute("aria-current");
      }
    });
  }

  function closeMenu() {
    sidebar?.classList.remove("open");
    scrim?.classList.remove("active");
    document.body.classList.remove("menu-open");

    menuToggle?.setAttribute(
      "aria-expanded",
      "false"
    );
  }

  function openMenu() {
    sidebar?.classList.add("open");
    scrim?.classList.add("active");
    document.body.classList.add("menu-open");

    menuToggle?.setAttribute(
      "aria-expanded",
      "true"
    );
  }

  function navigate(page) {
    const next = VALID_PAGES.has(page)
      ? page
      : "overview";

    S.page = next;

    if (location.hash !== `#${next}`) {
      location.hash = next;
    }

    closeMenu();
    render();

    window.scrollTo({
      top: 0,
      behavior: "auto"
    });
  }

  function handleHash() {
    const hash = location.hash
      .replace(/^#/, "")
      .split("?")[0];

    const next = VALID_PAGES.has(hash)
      ? hash
      : "overview";

    if (next !== S.page) {
      S.page = next;
      render();
    }

    closeMenu();
  }

  /* ==========================================================
     20. EVENT HANDLING
     ========================================================== */

  document.addEventListener("click", event => {
    const choice = event.target.closest("[data-picker-choice]");
    if (choice) {
      const picker = choice.closest("[data-picker]");
      const select = picker?.querySelector("select");
      const input = picker?.querySelector(".ice-player-picker-search");
      if (select && input) {
        select.value = choice.dataset.pickerChoice;
        input.value = choice.dataset.pickerLabel || "";
        picker.querySelector(".ice-player-picker-results").hidden = true;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return;
    }
    if (!event.target.closest("[data-picker]")) {
      document.querySelectorAll(".ice-player-picker-results").forEach(el => el.hidden = true);
    }
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const playerLink = target.closest("[data-person]");

    if (playerLink) {
      event.preventDefault();
      S.profile = playerLink.dataset.person;
      S.profileSeason = "career";
      navigate("profile");
      return;
    }

    const go = target.closest("[data-go]");

    if (go) {
      event.preventDefault();
      navigate(go.dataset.go);
      return;
    }

    const profile = target.closest("[data-profile]");

    if (profile) {
      S.profile = profile.dataset.profile;
      S.profileSeason = "career";
      navigate("profile");
      return;
    }

    const analyze = target.closest("[data-analyze]");

    if (analyze) {
      S.analyticsPlayer = analyze.dataset.analyze;
      navigate("analytics");
      return;
    }

    const compare = target.closest("[data-compare-player]");

    if (compare) {
      S.compareA = compare.dataset.comparePlayer;
      S.compareSeasonA = "career";
      navigate("compare");
      return;
    }

    const metric = target.closest("[data-metric]");

    if (metric) {
      S.overviewMetric = metric.dataset.metric;
      renderOverview();
      return;
    }

    const team = target.closest("[data-team]");

    if (team) {
      S.dbTeam = team.dataset.team;
      S.dbSeason = currentSeason();
      S.dbPage = 1;
      navigate("players");
      return;
    }

    const pagination = target.closest("[data-db-page]");

    if (pagination) {
      S.dbPage += pagination.dataset.dbPage === "next" ? 1 : -1;
      updateDatabase();
      return;
    }

    if (target.closest("#db-clear")) {
      S.query = "";
      S.dbSeason = "all";
      S.dbTeam = "all";
      S.dbSort = "pts";
      S.dbPage = 1;
      renderPlayers();
      return;
    }

    if (target.closest("#download-player-card")) {
      downloadPlayerCard();
      return;
    }

    const dot = target.closest("[data-scatter-player]");

    if (dot) {
      S.profile = dot.dataset.scatterPlayer;
      S.profileSeason = "career";
      navigate("profile");
      return;
    }

    const navigation = target.closest(
      '[data-page], .nav-link[href^="#"]'
    );

    if (navigation) {
      const page = navigation.dataset.page ||
        navigation.getAttribute("href")?.replace(/^#/, "");

      if (VALID_PAGES.has(page)) {
        event.preventDefault();
        navigate(page);
      }
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeMenu();
    }

    if (
      (event.key === "Enter" || event.key === " ") &&
      event.target instanceof Element &&
      event.target.matches("[data-scatter-player]")
    ) {
      event.preventDefault();

      S.profile = event.target.dataset.scatterPlayer;
      navigate("profile");
    }
  });

  document.addEventListener("input", event => {
    const element = event.target;
    if (element?.matches?.(".ice-player-picker-search")) {
      const picker = element.closest("[data-picker]");
      const select = picker?.querySelector("select");
      const results = picker?.querySelector(".ice-player-picker-results");
      if (select && results) {
        const query = element.value.trim().toLocaleLowerCase();
        const matches = [...select.options].filter(o =>
          o.textContent.toLocaleLowerCase().includes(query)
        ).slice(0, 35);
        results.innerHTML = matches.map(o => `
          <button type="button" role="option" class="ice-player-picker-option"
            data-picker-choice="${esc(o.value)}"
            data-picker-label="${esc(o.textContent)}">${esc(o.textContent)}</button>
        `).join("") || '<div class="ice-player-picker-none">No matching players</div>';
        results.hidden = false;
      }
      return;
    }

    if (!(element instanceof HTMLElement)) {
      return;
    }

    if (element.id === "db-search") {
      S.query = element.value;
      S.dbPage = 1;
      updateDatabase();
    }

    if (element.id === "draft-search") {
      S.draftQuery = element.value;

      const start = element.selectionStart;
      const end = element.selectionEnd;

      renderDraft();

      const replacement =
        document.querySelector("#draft-search");

      replacement?.focus();

      if (
        start !== null &&
        end !== null
      ) {
        replacement?.setSelectionRange(start, end);
      }
    }
  });

  document.addEventListener("change", event => {
    const element = event.target;

    if (!(element instanceof HTMLElement)) {
      return;
    }

    const id = element.id;
    const value = element.value;

    if (id === "db-season") {
      S.dbSeason = value;
      S.dbPage = 1;
      updateDatabase();
    }

    if (id === "db-team") {
      S.dbTeam = value;
      S.dbPage = 1;
      updateDatabase();
    }

    if (id === "db-sort") {
      S.dbSort = value;
      S.dbPage = 1;
      updateDatabase();
    }

    if (id === "profile-player") {
      S.profile = value;
      S.profileSeason = "career";
      renderProfile();
    }

    if (id === "profile-season") {
      S.profileSeason = value;
      renderProfile();
    }

    if (id === "compare-a") {
      S.compareA = value;
      S.compareSeasonA = "career";
      renderCompare();
    }

    if (id === "compare-b") {
      S.compareB = value;
      S.compareSeasonB = "career";
      renderCompare();
    }

    if (id === "compare-season-a") {
      S.compareSeasonA = value;
      renderCompare();
    }

    if (id === "compare-season-b") {
      S.compareSeasonB = value;
      renderCompare();
    }

    if (id === "draft-year") {
      S.draftYear = Number(value);
      renderDraft();
    }

    if (id === "draft-sort") {
      S.draftSort = value;
      renderDraft();
    }

    const analyticsControls = {
      "analytics-season": () => {
        S.analyticsSeason = value;
      },
      "analytics-position": () => {
        S.analyticsPosition = value;
      },
      "analytics-age": () => {
        S.analyticsAge = value;
      },
      "analytics-min-gp": () => {
        S.analyticsMinGP = Number(value);
      },
      "analytics-player": () => {
        S.analyticsPlayer = value;
      },
      "analytics-compare": () => {
        S.analyticsCompare = value;
      },
      "analytics-x": () => {
        S.analyticsX = value;
      },
      "analytics-y": () => {
        S.analyticsY = value;
      }
    };

    if (analyticsControls[id]) {
      analyticsControls[id]();
      renderAnalytics();
    }
  });

  menuToggle?.addEventListener("click", () => {
    if (sidebar?.classList.contains("open")) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  scrim?.addEventListener("click", closeMenu);

  window.addEventListener("hashchange", handleHash);

  /* ==========================================================
     21. LOADING POPUP
     ========================================================== */

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
    } catch (_) {}
  }

  introClose?.addEventListener("click", dismissIntro);

  try {
    if (
      sessionStorage.getItem("iceindex-intro-dismissed") === "1"
    ) {
      dismissIntro();
    }
  } catch (_) {}

  /* ==========================================================
     22. DATA STATUS
     ========================================================== */

  function updateStatus(message) {
    const status = document.querySelector("#data-status");

    if (status) {
      status.textContent = message;
    }

    const season = document.querySelector("#season-label");

    if (season && S.current.length) {
      season.textContent = currentSeason();
    }
  }

  /* ==========================================================
     23. INITIAL DATA LOADING
     ========================================================== */

  async function initialize() {
    S.page = VALID_PAGES.has(
      location.hash.replace(/^#/, "")
    )
      ? location.hash.replace(/^#/, "")
      : "overview";

    introStatus("Loading current OHL statistics…");

    updateStatus("Loading current season");

    render();

    try {
      if (typeof window.loadOHLCurrent !== "function") {
        throw new Error(
          "OHL data engine is not available."
        );
      }

      const current = await window.loadOHLCurrent();

      S.current = current.records || [];
      S.ready = true;

      mergeData();

      updateStatus(
        `${current.season} · ${fmt(S.current.length)} skaters`
      );

      introStatus("Current season ready.");

      render();

      /*
        The current season is now available.
        Historical data loads separately.
      */

      if (typeof window.loadOHLHistory === "function") {
        S.loading = true;

        window.loadOHLHistory(progress => {
          S.historyProgress = progress;

          const progressElement =
            document.querySelector("#history-progress");

          if (progressElement) {
            progressElement.textContent =
              `${progress.completed}/${progress.total}`;
          }
        }).then(result => {
          S.history = result.records || [];
          S.archive = result;
          S.loading = false;

          mergeData();

          updateStatus(
            `${current.season} · Historical archive ready`
          );

          render();

        }).catch(error => {
          S.loading = false;

          console.warn(
            "IceIndex historical archive:",
            error
          );

          updateStatus(
            "Current season ready · Historical archive unavailable"
          );

          render();
        });
      } else {
        S.loading = false;
      }

    } catch (error) {
      console.error("IceIndex initialization failed:", error);

      introStatus(
        "Current OHL statistics could not be loaded."
      );

      updateStatus("Data unavailable");

      main.innerHTML = `
        ${heading(
          "CONNECTION ERROR",
          "Unable to load OHL statistics",
          "Please check your connection and try again."
        )}

        <div class="notice">
          ${esc(error.message || "Unknown loading error")}
        </div>

        <button class="btn primary" id="ice-retry">
          Retry
        </button>
      `;

      document.querySelector("#ice-retry")
        ?.addEventListener("click", () => {
          initialize();
        });
    }
  }

  /* ==========================================================
     24. START APPLICATION
     ========================================================== */

  initialize();

  console.info(
    "IceIndex application v0.3.0 initialized."
  );

})();

/* ============================================================
   END — ICEINDEX v0.3.0 js/app.js
   ============================================================ */