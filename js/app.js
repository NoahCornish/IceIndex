
"use strict";

/* ============================================================
   ICEINDEX v0.10.0
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
    playoffs: [],
    dbCompetition: "regular",
    profileCompetition: "regular",
    compareCompetitionA: "regular",
    compareCompetitionB: "regular",
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
    statsCompetition: "regular",
    statsSeason: "current",
    statsTeam: "all",
    statsMetric: "pts",
    statsMinGP: 0,
    statsQuery: "",
    statsPage: 1,
    statsPosition: "all",
    statsColumns: null,
    statsShowColumns: false,
    statsAdvancedFilters: false,
    statsFilterMetric: "pts",
    statsFilterMin: "",
    statsFilterMax: "",
    statsSortAscending: false,

    profile: null,
    profileSeason: "career",
    profileTrendMetric: "rate",
    profileTrendAxis: "draft",

    compareA: null,
    compareB: null,
    compareSeasonA: "career",
    compareSeasonB: "career",
    compareCount: 2,
    compareC: null,
    compareD: null,
    compareSeasonC: "career",
    compareSeasonD: "career",
    compareCompetitionC: "regular",
    compareCompetitionD: "regular",
    compareSortMetric: "pts",
    compareMinGP: 10,
    compareCohort: "all",
    compareRateOnly: false,
    compareFocus: "all",

    draftYear: null,
    draftQuery: "",
    draftSort: "pts",

    overviewMetric: "pts",
    overviewCompetition: "regular",

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
    return [...S.history, ...S.current].filter(r => competitionOf(r) === "regular");
  }

  function competitionOf(record) {
    const raw = String(record?.competition || record?.seasonType || "regular").toLowerCase();
    return /playoff|post.?season/.test(raw) ? "playoffs" : "regular";
  }

  function competitionRecords(type = "regular") {
    return type === "playoffs" ? S.playoffs : allRecords();
  }

  function uniqueSeasons(rows) {
    return [...new Set(rows.map(r => r.season).filter(Boolean))].sort().reverse();
  }

  function resolveRows(rows, type = "regular") {
    if (type === "regular" && A?.seasonRecords) return A.seasonRecords(rows);
    const map = new Map();
    for (const r of rows) {
      if (!r?.key || !r?.season) continue;
      const key = [r.key, r.season, competitionOf(r), String(r.team || "").trim().toLowerCase()].join("|");
      const old = map.get(key);
      const quality = x => [x.gp,x.g,x.a,x.pts,x.shots].filter(v => v != null).length + (x.team ? 1 : 0);
      if (!old || quality(r) > quality(old) || (quality(r) === quality(old) && r.source === "current")) map.set(key,r);
    }
    return [...map.values()].filter(r => r.gp != null || r.pts != null);
  }

  function recordsForPlayer(p, type = "regular") {
    return type === "playoffs" ? (p.playoffSeasons || []) : p.seasons;
  }

  function careerForPlayer(p, type = "regular") {
    return type === "playoffs" ? p.playoffCareer : p.career;
  }

  function competitionSelect(id, value) {
    return `<select id="${esc(id)}" class="select" aria-label="Competition">
      ${option("regular", "Regular Season", value)}
      ${option("playoffs", "Playoffs", value)}
    </select>`;
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
     v0.8.0 — GLOBAL PLAYER SEARCH
     Uses the existing merged S.people directory, so no extra
     CSV, API dependency, or refresh workflow changes are needed.
     ========================================================== */

  const globalQuery = document.querySelector("#ice-global-query");
  const globalResults = document.querySelector("#ice-global-results");
  let globalMatches = [];
  let globalActive = -1;

  function normalizeSearch(value) {
    return String(value || "").normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("en-CA").trim();
  }

  function closeGlobalSearch(clear = false) {
    if (!globalResults || !globalQuery) return;
    globalResults.hidden = true;
    globalQuery.setAttribute("aria-expanded", "false");
    globalQuery.removeAttribute("aria-activedescendant");
    globalActive = -1;
    if (clear) globalQuery.value = "";
  }

  function openGlobalPlayer(key) {
    if (!person(key)) return;
    S.profile = key;
    S.profileSeason = "career";
    S.profileCompetition = "regular";
    closeGlobalSearch(true);
    globalQuery?.blur();
    navigate("profile");
  }

  function refreshGlobalSearch() {
    if (!globalQuery || !globalResults) return;
    const query = normalizeSearch(globalQuery.value);
    if (!query) { closeGlobalSearch(); return; }
    const terms = query.split(/\s+/).filter(Boolean);
    globalMatches = S.people.map(p => {
      const name = normalizeSearch(p.name);
      const team = normalizeSearch(p.team);
      const position = normalizeSearch(p.position);
      const id = String(p.id || "");
      const haystack = `${name} ${team} ${position} ${id}`;
      if (!terms.every(term => haystack.includes(term))) return null;
      const rank = name === query ? 0 : name.startsWith(query) ? 1 :
        name.includes(query) ? 2 : 3;
      return { player: p, rank };
    }).filter(Boolean).sort((a,b) => a.rank-b.rank ||
      (b.player.latestYear || 0)-(a.player.latestYear || 0) ||
      a.player.name.localeCompare(b.player.name)).slice(0,12).map(x => x.player);
    globalActive = -1;
    globalResults.innerHTML = globalMatches.length ? globalMatches.map((p,i) => `
      <button type="button" class="ice-global-result" role="option"
        id="ice-global-option-${i}" aria-selected="false" data-global-player="${esc(p.key)}">
        ${image(p)}
        <span class="ice-global-result-info"><strong>${esc(p.name)}</strong>
          <small>${esc([p.position, p.team].filter(Boolean).join(" · ") || "OHL Player")}</small></span>
        <span class="ice-global-result-year">${esc(p.latestYear || "")}</span>
      </button>`).join("") : `<div class="ice-global-empty">${S.loading ? "No matches yet — historical records are still loading." : "No matching OHL players found."}</div>`;
    globalResults.hidden = false;
    globalQuery.setAttribute("aria-expanded", "true");
  }

  function updateGlobalActive(index) {
    if (!globalMatches.length) return;
    globalActive = (index + globalMatches.length) % globalMatches.length;
    globalResults.querySelectorAll(".ice-global-result").forEach((el,i) => {
      el.classList.toggle("is-active",i === globalActive);
      el.setAttribute("aria-selected",String(i === globalActive));
    });
    const selected = globalResults.querySelector(`#ice-global-option-${globalActive}`);
    globalQuery.setAttribute("aria-activedescendant",selected?.id || "");
    selected?.scrollIntoView({block:"nearest"});
  }

  globalQuery?.addEventListener("input",refreshGlobalSearch);
  globalQuery?.addEventListener("focus",() => {
    if (globalQuery.value.trim()) refreshGlobalSearch();
  });
  globalQuery?.addEventListener("keydown",event => {
    if (event.key === "Escape") { closeGlobalSearch(); globalQuery.blur(); }
    else if (event.key === "ArrowDown") { event.preventDefault(); updateGlobalActive(globalActive+1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); updateGlobalActive(globalActive-1); }
    else if (event.key === "Enter" && globalMatches.length) {
      event.preventDefault(); openGlobalPlayer(globalMatches[globalActive < 0 ? 0 : globalActive].key);
    }
  });
  globalResults?.addEventListener("click",event => {
    const target = event.target.closest("[data-global-player]");
    if (target) openGlobalPlayer(target.dataset.globalPlayer);
  });
  document.addEventListener("pointerdown",event => {
    if (!event.target.closest(".ice-global-search")) closeGlobalSearch();
  });
  document.addEventListener("keydown",event => {
    if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (event.target.closest("input,textarea,select,[contenteditable='true']")) return;
    event.preventDefault(); globalQuery?.focus();
  });

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

    for (const record of [...seasons, ...resolveRows(S.playoffs, "playoffs")]) {
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

      const playoffSeasons = resolveRows(S.playoffs.filter(r => r.key === key), "playoffs")
        .sort((a,b) => a.endYear - b.endYear);

      people.push({
        playoffSeasons,
        playoffCareer: aggregate(playoffSeasons),
        key,
        name: latest.name,
        id,
        birth,
        photo,
        position,
        team: latest.team,
        latestYear: latest.endYear,
        seasons: items.filter(r => competitionOf(r) === "regular"),
        career: aggregate(items.filter(r => competitionOf(r) === "regular"))
      });
    }

    S.people = people.sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    S.byKey = new Map(
      S.people.map(p => [p.key, p])
    );

    if (globalQuery?.value.trim()) refreshGlobalSearch();

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

    restoreCompareLink();

    if (!person(S.analyticsPlayer)) {
      S.analyticsPlayer = S.profile;
    }

    if (!person(S.analyticsCompare)) {
      S.analyticsCompare = S.compareB;
    }
  }

  function selectedRecord(player, season = "career", type = "regular") {
    if (!player) return null;
    const rows = recordsForPlayer(player, type);
    return season === "career"
      ? careerForPlayer(player, type)
      : rows.find(r => r.season === season) || null;
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

  // NHL draft-year age labels: DY-1 is the season ending in the player's
  // first eligible NHL draft year, DY+1 is the season ending one year later.
  // These are estimates from the same birthdate-based rule as Draft Year Central.
  function iceDraftYear(player) {
    if (!player?.birth || typeof A?.estimatedDraftYear !== "function") return null;
    const value = Number(A.estimatedDraftYear(player.birth));
    return Number.isInteger(value) && value > 1900 ? value : null;
  }

  function iceSeasonEnd(season) {
    const match = String(season || "").match(/(?:19|20)\d{2}\s*[-–/]\s*(\d{2,4})/);
    if (!match) return null;
    const start = Number(String(season).match(/(?:19|20)\d{2}/)?.[0]);
    if (!Number.isFinite(start)) return null;
    const tail = Number(match[1]);
    return match[1].length === 2 ? Math.floor(start / 100) * 100 + tail + (tail < start % 100 ? 100 : 0) : tail;
  }

  function iceDYLabel(player, season) {
    const draft = iceDraftYear(player), end = iceSeasonEnd(season);
    if (draft == null || end == null) return null;
    const offset = end - draft;
    return `DY${offset === 0 ? "" : offset > 0 ? `+${offset}` : offset}`;
  }

  function icePlayerSeasons(player, type = "regular") {
    const grouped = new Map();
    for (const record of recordsForPlayer(player, type)) {
      if (!record?.season) continue;
      if (!grouped.has(record.season)) grouped.set(record.season, []);
      grouped.get(record.season).push(record);
    }
    return [...grouped].map(([season, rows]) => {
      // A combined/TOT row already includes the individual team stints.
      const combined = rows.find(r => /^(tot|total|all teams|combined|multiple teams)$/i.test(String(r.team || "").trim()));
      const record = combined || (rows.length === 1 ? rows[0] : aggregate(rows));
      return {...record, season};
    }).sort((a,b) => (iceSeasonEnd(a.season) || 0) - (iceSeasonEnd(b.season) || 0));
  }

  function playerSeasonSelect(id, player, selected, career = true, type = "regular") {
    if (!player) return "";

    return `
      <select id="${id}" class="select">
        ${career
          ? option("career", "Complete OHL career", selected)
          : ""}
        ${icePlayerSeasons(player, type).map(r =>
          option(r.season, `${r.season}${iceDYLabel(player,r.season) ? ` · ${iceDYLabel(player,r.season)}` : ""}`, selected)
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
    const rows = S.overviewCompetition === "playoffs"
      ? resolveRows(S.playoffs, "playoffs").filter(r => r.endYear === currentYear())
      : S.current;

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
    ).slice(0, 6);

    const max = Math.max(
      1,
      ...top.map(r => valueOf(r, S.overviewMetric) || 0)
    );

    main.innerHTML = `
      <section class="hero ice-overview-hero">
        <div class="ice-overview-brand-row">
          <img class="ice-overview-logo" src="assets/branding/iceindex-logo.png" alt="IceIndex" width="88" height="80">
          <h1>OHL Overview</h1>
        </div>
        <div class="hero-meta">
          <span class="live-dot"></span>
          ${esc(currentSeason())}
          · ${fmt(rows.length)} skaters
        </div>
      </section>

      <section class="igc-daily-widget" id="igc-daily-widget" aria-label="Today’s OHL games"></section>

      <div class="section-title">
        
        <h2>Players setting the pace</h2>
      </div>

      <div class="leader-grid ice-overview-leaders">${cards}</div>

      <div class="ice-overview-rankings">
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

    `;
    window.IceIndexGameCentre?.renderDailyGames(main.querySelector("#igc-daily-widget"));
  }

  /* ==========================================================
     07. PLAYER DATABASE
     ========================================================== */

  function renderPlayers() {
    const records = competitionRecords(S.dbCompetition);
    const seasons = uniqueSeasons(records);
    const teams = [...new Set(records.map(r => r.team).filter(Boolean))].sort();

    main.innerHTML =
      heading(
        "OHL PLAYERS",
        "OHL Player Database",
        "Explore OHL skaters across seasons."
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

          ${competitionSelect("db-competition", S.dbCompetition)}

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

    let rows = resolveRows(
      competitionRecords(S.dbCompetition),
      S.dbCompetition
    );

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
    const pages = Math.max(
      1,
      Math.ceil(rows.length / pageSize)
    );

    S.dbPage = clamp(S.dbPage, 1, pages);

    const start = (S.dbPage - 1) * pageSize;
    const visible = rows.slice(
      start,
      start + pageSize
    );

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
     STATISTICS DATABASE — SEASON LEADERBOARDS
     ========================================================== */

  const STATS_DEFINITIONS = [
    {key:"gp",label:"GP",group:"Basics"},
    {key:"g",label:"G",group:"Basics"},
    {key:"a",label:"A",group:"Basics"},
    {key:"pts",label:"PTS",group:"Basics"},
    {key:"rate",label:"P/GP",group:"Basics",derived:true},
    {key:"goalsRate",label:"G/GP",group:"Basics",derived:true},
    {key:"assistsRate",label:"A/GP",group:"Basics",derived:true},
    {key:"plusMinus",label:"+/-",group:"Basics"},
    {key:"pim",label:"PIM",group:"Basics"},
    {key:"shots",label:"SOG",group:"Shooting"},
    {key:"shootingPct",label:"SH%",group:"Shooting",derived:true},
    {key:"shotsPerGame",label:"S/GP",group:"Shooting",derived:true},
    {key:"ppg",label:"PPG",group:"Power Play"},
    {key:"ppa",label:"PPA",group:"Power Play"},
    {key:"ppp",label:"PPP",group:"Power Play"},
    {key:"shg",label:"SHG",group:"Shorthanded"},
    {key:"sha",label:"SHA",group:"Shorthanded"},
    {key:"shpts",label:"SHPTS",group:"Shorthanded"},
    {key:"gwg",label:"GWG",group:"Situational"},
    {key:"eng",label:"ENG",group:"Situational"},
    {key:"nationality",label:"NAT",group:"Player"}
  ];
  const STATS_DEFAULT_COLUMNS = ["gp","g","a","pts","rate","plusMinus","pim","shots","shootingPct","ppg","ppa","ppp"];
  const STATS_TEXT_FIELDS = new Set(["position","nationality"]);
  const STATS_DERIVED_FIELDS = new Set(["rate","goalsRate","assistsRate","shootingPct","shotsPerGame"]);

  const ICE_TEAM_CODES = {
    "Barrie Colts":"BAR", "Brantford Bulldogs":"BFD", "Hamilton Bulldogs":"HAM",
    "Brampton Steelheads":"BRM", "Mississauga Steelheads":"MISS",
    "Erie Otters":"ER", "Flint Firebirds":"FLNT", "Guelph Storm":"GUE",
    "Kingston Frontenacs":"KGN", "Kitchener Rangers":"KIT", "London Knights":"LDN",
    "Niagara IceDogs":"NIAG", "North Bay Battalion":"NB", "Oshawa Generals":"OSH",
    "Ottawa 67's":"OTT", "Ottawa 67’s":"OTT", "Owen Sound Attack":"OS",
    "Peterborough Petes":"PBO", "Saginaw Spirit":"SAG", "Sarnia Sting":"SAR",
    "Soo Greyhounds":"SOO", "Sault Ste. Marie Greyhounds":"SOO",
    "Sudbury Wolves":"SBY", "Windsor Spitfires":"WSR"
  };
  function iceTeamAbbreviation(team) {
    const name=String(team||"").trim();
    if (!name || name==="—") return "—";
    if (/^[A-Z]{2,5}$/.test(name)) return name;
    if (ICE_TEAM_CODES[name]) return ICE_TEAM_CODES[name];
    const normalized=name.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]/g, "");
    const match=Object.entries(ICE_TEAM_CODES).find(([key])=>key.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]/g, "")===normalized);
    return match?match[1]:name.split(/\s+/).map(x=>x[0]).join("").toUpperCase().slice(0,4);
  }
  function iceTeamShortLabel(row) {
    const names=row.teamNames?.length?row.teamNames:[row.team];
    return [...new Set(names.map(iceTeamAbbreviation))].join("/");
  }

  function statsMetricValue(r,key) {
    if (key === "shootingPct") return r.shots > 0 && r.g != null ? r.g / r.shots * 100 : null;
    if (key === "shotsPerGame") return r.gp > 0 && r.shots != null ? r.shots / r.gp : null;
    if (key === "rate" || key === "goalsRate" || key === "assistsRate") return r[key];
    return r[key] ?? null;
  }

  function statsRows() {
    const base = resolveRows(competitionRecords(S.statsCompetition), S.statsCompetition);
    const season = S.statsSeason === "current" ? uniqueSeasons(base)[0] : S.statsSeason;
    const byPlayer = new Map();
    for (const r of base) {
      if (r.season !== season || !r.key) continue;
      if (!byPlayer.has(r.key)) byPlayer.set(r.key, []);
      byPlayer.get(r.key).push(r);
    }
    const rows=[];
    for (const [key,stints] of byPlayer) {
      const combined=stints.find(r=>/^(tot|total|all teams|multiple teams)$/i.test(String(r.team||"").trim()));
      const source=combined?[combined]:stints;
      const first=source[0];
      const teams=[...new Set(stints.map(r=>r.team).filter(t=>t&&!/^(tot|total|all teams|multiple teams)$/i.test(t)))];
      const row={...first,key,photo:stints.find(r=>r.photo)?.photo||first.photo,team:teams.join(" / ")||first.team||"—",teamNames:teams};
      const numericFields=STATS_DEFINITIONS.filter(d=>!d.derived&&!STATS_TEXT_FIELDS.has(d.key)).map(d=>d.key);
      for (const field of numericFields) {
        const values=source.map(r=>r[field]).filter(v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v)));
        if (!values.length) {row[field]=null;continue;}
        row[field]=values.reduce((s,v)=>s+Number(v),0);
      }
      row.rate=row.gp>0&&row.pts!=null?row.pts/row.gp:null;
      row.goalsRate=row.gp>0&&row.g!=null?row.g/row.gp:null;
      row.assistsRate=row.gp>0&&row.a!=null?row.a/row.gp:null;
      rows.push(row);
    }
    return rows;
  }

  function statsAvailableColumns(rows) {
    return STATS_DEFINITIONS.filter(d=>rows.some(r=>{
      const v=statsMetricValue(r,d.key);
      return v!==null&&v!==undefined&&v!==""&&(!STATS_DERIVED_FIELDS.has(d.key)||Number.isFinite(v));
    }));
  }

  function statsActiveColumns(available) {
    const keys=new Set(available.map(d=>d.key));
    if (!S.statsColumns) return STATS_DEFAULT_COLUMNS.filter(k=>keys.has(k));
    return S.statsColumns.filter(k=>keys.has(k));
  }

  function statsFormat(r,key) {
    const v=statsMetricValue(r,key);
    if (v===null||v===undefined||v==="") return "—";
    if (STATS_TEXT_FIELDS.has(key)) return esc(v);
    if (key==="shootingPct") return `${dec(v,1)}%`;
    if (STATS_DERIVED_FIELDS.has(key)) return dec(v,2);
    if (key==="plusMinus") return Number(v)>0?`+${fmt(v)}`:fmt(v);
    return fmt(v);
  }

  function statsFilteredRows() {
    const q=S.statsQuery.trim().toLowerCase();
    const min=S.statsFilterMin===""?null:Number(S.statsFilterMin);
    const max=S.statsFilterMax===""?null:Number(S.statsFilterMax);
    const metric=S.statsFilterMetric;
    return statsRows().filter(r=>{
      const position=String(r.position||"").toUpperCase();
      if (q&&!`${r.name} ${r.team} ${position}`.toLowerCase().includes(q)) return false;
      if (S.statsTeam!=="all"&&!r.teamNames.includes(S.statsTeam)) return false;
      if (S.statsPosition!=="all"&&position!==S.statsPosition) return false;
      if ((Number(r.gp)||0)<S.statsMinGP) return false;
      if (min!==null||max!==null) {
        const v=statsMetricValue(r,metric);
        if (v===null||v===undefined||!Number.isFinite(Number(v))) return false;
        if (min!==null&&Number(v)<min) return false;
        if (max!==null&&Number(v)>max) return false;
      }
      return true;
    });
  }

  function statsExportCSV() {
    const rows=statsSortedRows();
    const all=statsAvailableColumns(statsRows());
    const selected=statsActiveColumns(all);
    const defs=selected.map(k=>all.find(d=>d.key===k));
    const quote=v=>`"${String(v??"").replace(/"/g,'""')}"`;
    const lines=[["Player","Team","Season",...defs.map(d=>d.label)].map(quote).join(",")];
    for (const r of rows) lines.push([r.name,r.team,r.season,...selected.map(k=>statsMetricValue(r,k)??"")].map(quote).join(","));
    const blob=new Blob(["\ufeff",lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=`iceindex-${S.statsSeason}-${S.statsCompetition}.csv`;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function statsSortedRows() {
    const metric=S.statsMetric;
    return statsFilteredRows().sort((a,b)=>{
      const x=statsMetricValue(a,metric),y=statsMetricValue(b,metric);
      if (x==null&&y==null) return String(a.name).localeCompare(String(b.name));
      if (x==null) return 1;
      if (y==null) return -1;
      const result=typeof x==="string"?String(x).localeCompare(String(y)):Number(x)-Number(y);
      return (S.statsSortAscending?result:-result)||String(a.name).localeCompare(String(b.name));
    });
  }

  function renderStatistics() {
    const seasons=uniqueSeasons(competitionRecords(S.statsCompetition));
    if (!seasons.length) {
      main.innerHTML=heading("OHL STATISTICS","Statistics Database","Season-by-season skater leaderboards.")+empty("No statistics available.");
      return;
    }
    if (S.statsSeason!=="current"&&!seasons.includes(S.statsSeason)) S.statsSeason="current";
    const rows=statsRows();
    const teams=[...new Set(rows.flatMap(r=>r.teamNames))].sort();
    const positions=[...new Set(rows.map(r=>String(r.position||"").toUpperCase()).filter(Boolean))].sort();
    const available=statsAvailableColumns(rows);
    const selected=new Set(statsActiveColumns(available));
    const groups=[...new Set(available.map(d=>d.group))];
    main.innerHTML=heading("OHL STATISTICS","Statistics Database","Explore and compare OHL skater statistics.")+archiveNotice()+`
      <div class="ice-stats-toolbar">
        <label>Search<input id="stats-search" class="input" type="search" placeholder="Player or team…" value="${esc(S.statsQuery)}"></label>
        <label>Competition${competitionSelect("stats-competition",S.statsCompetition)}</label>
        <label>Season<select id="stats-season" class="select">${option("current",`Latest (${seasons[0]})`,S.statsSeason)}${seasons.map(s=>option(s,s,S.statsSeason)).join("")}</select></label>
      </div>
      <div class="ice-stats-actions ice-stats-primary-actions">
        <button type="button" class="btn" id="stats-filters-toggle" aria-controls="stats-filters-panel" aria-expanded="${S.statsAdvancedFilters}">All filters ${S.statsAdvancedFilters?"−":"+"}</button>
        <button type="button" class="btn" id="stats-columns-toggle" aria-controls="stats-columns-panel" aria-expanded="${S.statsShowColumns}">Columns (${selected.size} of ${available.length})</button>
        <button type="button" class="btn" id="stats-goalies">Goalie database ↗</button>
      </div>
      <section id="stats-filters-panel" class="ice-stats-config" ${S.statsAdvancedFilters?"":"hidden"}>
        <div class="ice-stats-toolbar ice-stats-extra-toolbar">
        <label>Team<select id="stats-team" class="select">${option("all","All teams",S.statsTeam)}${teams.map(t=>option(t,t,S.statsTeam)).join("")}</select></label>
        <label>Position<select id="stats-position" class="select">${option("all","All positions",S.statsPosition)}${positions.map(p=>option(p,p,S.statsPosition)).join("")}</select></label>
        <label>Sort by<select id="stats-metric" class="select">${available.map(d=>option(d.key,d.label,S.statsMetric)).join("")}</select></label>
        </div>
        <div class="ice-stats-toolbar">
          <label>Minimum GP<select id="stats-min-gp" class="select">${[[0,"Any GP"],[5,"5+ GP"],[10,"10+ GP"],[20,"20+ GP"],[40,"40+ GP"]].map(([k,v])=>option(k,v,S.statsMinGP)).join("")}</select></label>
          <label>Filter statistic<select id="stats-filter-metric" class="select">${available.filter(d=>!STATS_TEXT_FIELDS.has(d.key)).map(d=>option(d.key,d.label,S.statsFilterMetric)).join("")}</select></label>
          <label>Minimum value<input id="stats-filter-min" class="input" type="number" step="any" placeholder="No minimum" value="${esc(S.statsFilterMin)}"></label>
          <label>Maximum value<input id="stats-filter-max" class="input" type="number" step="any" placeholder="No maximum" value="${esc(S.statsFilterMax)}"></label>
        </div>
        <div class="ice-stats-actions ice-stats-secondary-actions">
          <button type="button" class="btn" id="stats-sort-direction">${S.statsSortAscending?"Ascending ↑":"Descending ↓"}</button>
          <button type="button" class="btn" id="stats-export">Download CSV</button>
          <button type="button" class="btn" id="stats-clear">Clear all filters</button>
        </div>
      </section>
      <section id="stats-columns-panel" class="ice-stats-config" ${S.statsShowColumns?"":"hidden"}>
        <div class="ice-stats-config-head"><strong>Choose visible statistics</strong><div>
          <button type="button" class="btn" id="stats-columns-all">Select all available</button>
          <button type="button" class="btn" id="stats-columns-default">Default</button>
          <button type="button" class="btn" id="stats-columns-none">Clear columns</button>
        </div></div>
        <div class="ice-stats-groups">${groups.map(group=>`<fieldset><legend>${esc(group)}</legend>${available.filter(d=>d.group===group).map(d=>`<label><input type="checkbox" data-stats-column="${esc(d.key)}" ${selected.has(d.key)?"checked":""}> ${esc(d.label)}</label>`).join("")}</fieldset>`).join("")}</div>
        
      </section>
      <div id="stats-results"></div>`;
    updateStatistics();
  }

  function statsShortName(fullName) {
    const parts=String(fullName||"").trim().split(/\s+/);
    return parts.length>1?`${parts[0].charAt(0)}. ${parts.slice(1).join(" ")}`:String(fullName||"");
  }

  function updateStatistics() {
    const el=document.querySelector("#stats-results");if(!el)return;
    const rows=statsSortedRows();
    const available=statsAvailableColumns(statsRows());
    const cols=statsActiveColumns(available);
    const defs=cols.map(k=>available.find(d=>d.key===k));
    const pageSize=50,pages=Math.max(1,Math.ceil(rows.length/pageSize));
    S.statsPage=clamp(S.statsPage,1,pages);
    const visible=rows.slice((S.statsPage-1)*pageSize,S.statsPage*pageSize);
    const season=S.statsSeason==="current"?uniqueSeasons(competitionRecords(S.statsCompetition))[0]:S.statsSeason;
    const grouped=[];
    for (const d of defs) {
      const last=grouped[grouped.length-1];
      if(last&&last.name===d.group)last.count++;
      else grouped.push({name:d.group,count:1});
    }
    el.innerHTML=`<div class="ice-stats-summary" aria-label="Statistics summary">${fmt(rows.length)} skaters <span aria-hidden="true">·</span> ${esc(season||"—")} <span aria-hidden="true">·</span> Sorted by ${esc(available.find(d=>d.key===S.statsMetric)?.label||S.statsMetric)} ${S.statsSortAscending?"↑":"↓"} <span aria-hidden="true">·</span> ${cols.length} columns</div>
    ${visible.length?`<div class="ice-stats-table-wrap" role="region" aria-label="Scrollable skater statistics" tabindex="0"><table class="ice-stats-table">
      <thead><tr><th>#</th><th>Player</th><th>Team</th>${defs.map(d=>`<th><button type="button" data-stats-sort="${esc(d.key)}" title="Sort by ${esc(d.label)}">${esc(d.label)}${S.statsMetric===d.key?(S.statsSortAscending?" ↑":" ↓"):""}</button></th>`).join("")}</tr></thead>
      <tbody>${visible.map((r,i)=>`<tr><td>${(S.statsPage-1)*pageSize+i+1}</td>
      <td><button class="ice-stats-player" type="button" data-stats-player="${esc(r.key)}">${image(r,"ice-stats-headshot")}<span class="ice-stats-name" title="${esc(r.name)}">${esc(statsShortName(r.name))}</span></button></td><td title="${esc(r.team)}">${esc(iceTeamShortLabel(r))}</td>
      ${cols.map(k=>`<td class="${k===S.statsMetric?"ice-stats-emphasis":""}">${statsFormat(r,k)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`:empty("No skaters match these filters.")}
    <div class="ice-pagination"><button class="btn" data-stats-page="prev" ${S.statsPage<=1?"disabled":""}>Previous</button><span>Page ${S.statsPage} of ${pages}</span><button class="btn" data-stats-page="next" ${S.statsPage>=pages?"disabled":""}>Next</button></div>`;
  }

  /* ==========================================================
     08. PLAYER PROFILE
     ========================================================== */


  /* v0.9.0: Shared analytics calculations for profile and comparison.
     Missing underlying data is never silently treated as zero. */
  const ADVANCED_METRICS = [
    ["Points / game", "rate", "P/GP"],
    ["Goals / game", "goalsRate", "G/GP"],
    ["Assists / game", "assistsRate", "A/GP"],
    ["Shots / game", "shotsRate", "S/GP"],
    ["Shooting percentage", "shootingPct", "SH%"],
    ["Points / shot", "pointsPerShot", "PTS/S"],
    ["Goals / assists", "goalsAssistsRatio", "G/A"]
  ];

  function advancedProfile(p, record, season, competition) {
    if (!record) return empty("No analytics available for this selection.");
    const isCareer = season === "career";
    const position = comparePosition(p, record);
    const cohort = isCareer ? [] : compareCohortRows(season, competition, "all", 10);
    const peers = position ? cohort.filter(row => comparePosition(person(row.key), row) === position) : [];
    const metrics = ADVANCED_METRICS.map(([label,key,short]) => {
      const value = compareMetric(record,key);
      const eligible = (compareMetric(record,"gp") ?? 0) >= 10;
      const percentile = !isCareer && eligible && value !== null
        ? comparePercentile(value,cohort.map(row => compareMetric(row,key))) : null;
      const positionPercentile = !isCareer && eligible && value !== null && position
        ? comparePercentile(value,peers.map(row => compareMetric(row,key))) : null;
      return {label,key,short,value,percentile,positionPercentile};
    }).filter(metric => metric.value !== null);
    if (!metrics.length) return empty("The source data does not contain enough information to calculate these metrics.");
    return `<details class="ice-advanced-panel" open>
      <summary>Advanced Analytics <span>${esc(season === "career" ? "Career" : season)} · ${competition === "playoffs" ? "Playoffs" : "Regular Season"}</span></summary>
      <div class="ice-advanced-body">
        <div class="ice-advanced-grid">${metrics.map(m=>`<article class="ice-advanced-card">
          <span>${esc(m.label)}</span><strong>${compareValue(m.value,m.key)}</strong>
          ${m.percentile !== null ? `<small>League: ${m.percentile}th percentile</small>` : ""}
          ${m.positionPercentile !== null ? `<small>${position === "D" ? "Defencemen" : "Forwards"}: ${m.positionPercentile}th percentile</small>` : ""}
        </article>`).join("")}</div>
        <p class="ice-advanced-note">Rates are calculated from recorded games, goals, assists and shots. Percentiles require a single season, at least 10 player games and at least five eligible peers. Comparisons use the selected competition; missing values are not zero. No ice-time or per-60 estimates are used.</p>
      </div>
    </details>`;
  }

  function renderProfile() {
    const p = person(S.profile);

    if (!p) {
      main.innerHTML = empty("Player not found.");
      return;
    }

    const competition = S.profileCompetition;
    const rows = recordsForPlayer(p, competition);
    const career = careerForPlayer(p, competition);

    const r = selectedRecord(
      p,
      S.profileSeason,
      competition
    );

    const stats = [
      ["GAMES", r?.gp],
      ["GOALS", r?.g],
      ["ASSISTS", r?.a],
      ["POINTS", r?.pts],
      ["POINTS / GP", valueOf(r, "rate"), 2],
      ["SHOTS", r?.shots],
      ["POWER-PLAY POINTS", r?.ppp],
      ["PENALTY MINUTES", r?.pim]
    ];

    const competitionLabel = competition === "playoffs"
      ? "OHL Playoffs"
      : "OHL Regular Season";

    const seasonLabel = S.profileSeason === "career"
      ? "Complete Career"
      : S.profileSeason;

    main.innerHTML =
      heading(
        "OHL PLAYERS",
        "Player Profile",
        "Career statistics, season performance and shot locations."
      ) +
      archiveNotice() +
      `
        <div class="controls">
          ${playerSelect("profile-player", p.key)}
          <button type="button" class="btn" data-open-game-logs="${esc(p.id)}">View Game Logs →</button>

          ${competitionSelect(
            "profile-competition",
            S.profileCompetition
          )}

          ${playerSeasonSelect(
            "profile-season",
            p,
            S.profileSeason,
            true,
            competition
          )}
        </div>

        <section class="panel">
          <div class="ice-player-header">
            ${image(p, "leader-photo")}

            <div>
              <div class="eyebrow">
                ${esc(p.position || "OHL SKATER")}
              </div>

              <h2>${esc(p.name)}</h2>

              <p>${esc(p.team || "")}</p>

              <small>
                ${p.birth
                  ? `Born ${esc(p.birth)}`
                  : "Birthdate unavailable"}
              </small>

              <div class="ice-scout-tags">
                <span>${esc(competitionLabel)}</span>
                <span>${esc(seasonLabel)}</span>
              </div>
            </div>

            ${logo(p.team)}
          </div>

          ${r ? `
            <div class="kpi-grid">
              ${stats.map(([label, value, digits]) => `
                <div class="kpi">
                  <span>${esc(label)}</span>
                  <b>
                    ${digits == null
                      ? fmt(value)
                      : dec(value, digits)}
                  </b>
                </div>
              `).join("")}
            </div>
          ` : empty(
            competition === "playoffs"
              ? "No playoff statistics are available for this player and season."
              : "No regular-season statistics are available for this selection."
          )}

          <div class="ice-actions">
            <button
              class="btn primary"
              data-analyze="${esc(p.key)}">
              Analyze Player
            </button>

            <button
              class="btn"
              data-compare-player="${esc(p.key)}">
              Compare Player
            </button>
          </div>
        </section>

        ${window.IceIndexShotMap?.markup(p, S.profileSeason, competition) || ""}

        ${panel("Advanced Analytics", advancedProfile(p, r, S.profileSeason, competition))}

        ${panel(
          "Career Highlights",
          careerHighlights(p)
        )}

        ${panel(
          "OHL Season Rankings",
          seasonRankings(p)
        )}

        ${panel(
          "OHL Career Timeline",
          careerTimeline(p, competition)
        )}

        ${panel(
          competition === "playoffs"
            ? "Playoff Season Statistics"
            : "Regular-Season Statistics",
          profileStatsTable(p, competition)
        )}

        ${panel(
          "Player Development Tracker",
          developmentChart(p, competition),
          `<div class="ice-development-controls">
            <label>Track statistic<select id="profile-trend-metric" class="select" aria-label="Development statistic">
              ${iceDevelopmentMetrics(p,competition).map(m => option(m.key,m.label,S.profileTrendMetric)).join("")}
            </select></label>
            <label>Season labels<select id="profile-trend-axis" class="select" aria-label="Development season labels">
              ${option("draft","Draft years (DY)",S.profileTrendAxis)}
              ${option("season","OHL seasons",S.profileTrendAxis)}
            </select></label>
          </div>`
        )}

        ${panel(
          "Career Summary",
          `
            <div class="kpi-grid">
              <div class="kpi">
                <span>COMPETITION</span>
                <b>${competition === "playoffs"
                  ? "Playoffs"
                  : "Regular"}</b>
              </div>

              <div class="kpi">
                <span>SEASONS</span>
                <b>${fmt(rows.length)}</b>
              </div>

              <div class="kpi">
                <span>CAREER GAMES</span>
                <b>${fmt(career?.gp)}</b>
              </div>

              <div class="kpi">
                <span>CAREER POINTS</span>
                <b>${fmt(career?.pts)}</b>
              </div>
            </div>
          `
        )}
      `;
    window.IceIndexShotMap?.mount(p, S.profileSeason, competition);
  }

  /* v0.8.0 — Automatically generated career highlights. */
  function careerHighlights(p) {
    const regular = recordsForPlayer(p, "regular") || [];
    const playoffs = careerForPlayer(p, "playoffs");
    const regularCareer = careerForPlayer(p, "regular");

    // One season per year, even if the player changed OHL teams.
    // Prefer a pre-aggregated season total when the source supplies one.
    const bySeason = new Map();
    for (const r of regular) {
      if (!r?.season) continue;
      if (!bySeason.has(r.season)) bySeason.set(r.season, []);
      bySeason.get(r.season).push(r);
    }
    const seasons = [...bySeason].map(([season, records]) => {
      const total = records.find(r => /^(total|all teams|combined)$/i.test(String(r.team || "").trim()));
      const r = total || (records.length === 1 ? records[0] : aggregate(records));
      return { ...r, season };
    });

    const best = (field, requireGP = false) => seasons
      .filter(r => Number.isFinite(Number(r[field])) && r[field] != null && (!requireGP || Number(r.gp) > 0))
      .sort((a, b) => Number(b[field]) - Number(a[field]) || Number(b.endYear || 0) - Number(a.endYear || 0))[0] || null;

    const bestPoints = best("pts");
    const mostGoals = best("g");
    const bestRate = seasons
      .filter(r => r.gp > 0 && r.pts != null && Number.isFinite(Number(r.pts / r.gp)))
      .sort((a, b) => b.pts / b.gp - a.pts / a.gp || Number(b.endYear || 0) - Number(a.endYear || 0))[0] || null;

    const cards = [
      { icon: "★", label: "BEST SEASON", value: bestPoints ? `${fmt(bestPoints.pts)} PTS` : "—", sub: bestPoints?.season || "No season data", season: bestPoints?.season },
      { icon: "◎", label: "MOST GOALS", value: mostGoals ? fmt(mostGoals.g) : "—", sub: mostGoals?.season || "No season data", season: mostGoals?.season },
      { icon: "↗", label: "BEST POINTS / GP", value: bestRate ? dec(bestRate.pts / bestRate.gp, 2) : "—", sub: bestRate?.season || "No eligible season", season: bestRate?.season },
      { icon: "▦", label: "SEASONS PLAYED", value: fmt(seasons.length), sub: "OHL regular season" },
      { icon: "◆", label: "CAREER POINTS", value: regularCareer?.pts != null ? fmt(regularCareer.pts) : "—", sub: "Regular season" },
      { icon: "✦", label: "PLAYOFF POINTS", value: playoffs?.pts != null ? fmt(playoffs.pts) : "—", sub: playoffs?.pts != null ? "OHL playoffs" : "Not available" }
    ];

    return `<div class="ice-highlights-grid">${cards.map(c => {
      const content = `<span class="ice-highlight-label"><span aria-hidden="true">${c.icon}</span>${esc(c.label)}</span>
        <strong class="ice-highlight-value">${esc(c.value)}</strong>
        <span class="ice-highlight-season">${esc(c.sub)}</span>`;
      return c.season
        ? `<button type="button" class="ice-highlight-card ice-highlight-clickable" data-highlight-season="${esc(c.season)}" title="View ${esc(c.season)} regular-season statistics">${content}</button>`
        : `<div class="ice-highlight-card">${content}</div>`;
    }).join("")}</div>
    <p class="ice-profile-note">Highlights are calculated from available IceIndex records. Season records are grouped by year; playoff totals are shown separately. Select a season highlight to view its regular-season statistics.</p>`;
  }

  /* v0.8.0 — Player season rankings, using the merged IceIndex archive. */
  function seasonRankings(p) {
    const season = S.profileSeason;
    if (season === "career") {
      return `<p class="ice-profile-note">Select a regular season above or in the career timeline to see how this player ranked against other OHL skaters.</p>`;
    }

    // Rankings are regular-season only, independent of the selected
    // profile competition. One entry per player/season, never per team.
    function seasonTotal(person) {
      const rows = recordsForPlayer(person, "regular").filter(r => r.season === season);
      if (!rows.length) return null;
      const total = rows.find(r => /^(total|all teams|combined)$/i.test(String(r.team || "").trim()));
      return total || (rows.length === 1 ? rows[0] : aggregate(rows));
    }

    const cohort = S.people.map(person => ({ person, record: seasonTotal(person) }))
      .filter(x => x.record && Number(x.record.gp) > 0 &&
        !/^(g|goalie|goaltender)$/i.test(String(x.person.position || "").trim()));
    const chosen = cohort.find(x => x.person.key === p.key);
    if (!chosen) return `<p class="ice-profile-note">No eligible regular-season skater record is available for ${esc(season)}.</p>`;

    const minimumGames = 10;
    const metrics = [
      { label: "POINTS", field: "pts", suffix: " PTS" },
      { label: "GOALS", field: "g", suffix: " G" },
      { label: "ASSISTS", field: "a", suffix: " A" },
      { label: "POINTS / GAME", field: "rate", suffix: " P/GP" }
    ];
    const cards = metrics.map(metric => {
      const eligible = cohort.filter(x => {
        const value = valueOf(x.record, metric.field);
        return value != null && Number.isFinite(Number(value)) &&
          (metric.field !== "rate" || Number(x.record.gp) >= minimumGames);
      });
      const value = valueOf(chosen.record, metric.field);
      const isEligible = eligible.some(x => x.person.key === p.key);
      const rank = isEligible ? 1 + eligible.filter(x =>
        Number(valueOf(x.record, metric.field)) > Number(value) + 1e-9).length : null;
      const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" :
        n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th");
      return `<div class="ice-ranking-card">
        <span class="ice-ranking-label">${esc(metric.label)}</span>
        <strong class="ice-ranking-position">${rank == null ? "—" : ordinal(rank)}</strong>
        <span class="ice-ranking-value">${value == null ? "—" : metric.field === "rate" ? dec(value, 2) + metric.suffix : fmt(value) + metric.suffix}</span>
        <small class="ice-ranking-cohort">${rank == null ? "Not eligible" : `of ${fmt(eligible.length)} ranked skaters`}</small>
      </div>`;
    });

    return `<div class="ice-ranking-header"><span>${esc(season)} · Regular Season</span>
      <span>${fmt(cohort.length)} skaters in available records</span></div>
      <div class="ice-rankings-grid">${cards.join("")}</div>
      <p class="ice-profile-note">Rankings are calculated from available IceIndex regular-season skater records, not independently verified complete league standings. Players with multiple team stints are counted once per season. Ties share a rank. Points/game requires at least ${minimumGames} games played. Rankings may change while historical data loads.</p>`;
  }

  function careerTimeline(p, competition = "regular") {
    const rows = [...recordsForPlayer(p, competition)].sort((a,b) =>
      a.endYear - b.endYear || String(a.team || "").localeCompare(String(b.team || ""))
    );
    if (!rows.length) return empty("No season history is available for this competition.");
    return `<div class="ice-career-timeline">
      ${rows.map(r => `<button type="button"
        class="ice-career-stop ${S.profileSeason === r.season ? "selected" : ""}"
        data-profile-timeline="${esc(r.season)}"
        aria-pressed="${S.profileSeason === r.season}">
        <span class="ice-career-year">${esc(r.season || "Season unavailable")}</span>
        <span class="ice-career-team">${logo(r.team)}<strong>${esc(r.team || "Unknown team")}</strong></span>
        <span class="ice-career-production">${fmt(r.gp)} GP · ${fmt(r.g)} G · ${fmt(r.a)} A · <b>${fmt(r.pts)} PTS</b></span>
      </button>`).join("")}
    </div><p class="ice-profile-note">Select a season to update the player statistics above. Team history reflects the available source records.</p>`;
  }

  function profileStatsTable(p, competition = "regular") {
    const rows = [...recordsForPlayer(p, competition)].sort((a,b) => a.endYear - b.endYear);
    if (!rows.length) return empty("No statistics are available for this competition.");
    const columns = [["gp","GP"],["g","G"],["a","A"],["pts","PTS"],["rate","P/GP"],["ppg","PPG"],["ppa","PPA"],["ppp","PPP"],["pim","PIM"],["shots","SOG"]];
    const renderCells = r => columns.map(([key]) => `<td>${key === "rate" ? dec(valueOf(r,key),2) : fmt(r?.[key])}</td>`).join("");
    const career = careerForPlayer(p, competition);
    return `<div class="table-scroll ice-profile-table-scroll"><table class="data-table ice-profile-stats-table">
      <thead><tr><th>SEASON</th><th>TEAM</th>${columns.map(([,label]) => `<th>${label}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(r => `<tr class="${S.profileSeason === r.season ? "ice-profile-selected-row" : ""}">
        <td><button type="button" class="ice-season-link" data-profile-timeline="${esc(r.season)}">${esc(r.season)}</button></td>
        <td>${esc(r.team || "—")}</td>${renderCells(r)}</tr>`).join("")}
        ${career ? `<tr class="ice-profile-total"><td><strong>CAREER</strong></td><td>All teams</td>${renderCells(career)}</tr>` : ""}
      </tbody></table></div>
      <p class="ice-profile-note">Totals and per-game rates use the existing IceIndex career aggregation. Missing statistics are shown as —.</p>`;
  }

  // Only show statistics backed by source data. Derived metrics use the
  // same formulas as Player Compare; no ice-time or per-60 calculations.
  const ICE_DEVELOPMENT_METRICS = [
    ["gp","Games played"],["g","Goals"],["a","Assists"],["pts","Points"],
    ["rate","Points / game"],["goalsRate","Goals / game"],
    ["assistsRate","Assists / game"],["shots","Shots on goal"],
    ["shotsRate","Shots / game"],["shootingPct","Shooting %"],
    ["pointsPerShot","Points / shot"],["goalsAssistsRatio","Goals / assists"],
    ["plusMinus","Plus / minus"],["pim","Penalty minutes"],
    ["ppg","Power-play goals"],["ppa","Power-play assists"],
    ["ppp","Power-play points"],["shg","Shorthanded goals"],
    ["sha","Shorthanded assists"],["shp","Shorthanded points"],
    ["gwg","Game-winning goals"],["eng","Empty-net goals"]
  ];

  function iceDevelopmentValue(record, metric) {
    if (!record) return null;
    const n = key => record[key] == null || record[key] === "" ? null : Number(record[key]);
    const ratio = (a,b) => a != null && b != null && b > 0 && Number.isFinite(a/b) ? a/b : null;
    const gp=n("gp"), goals=n("g"), assists=n("a"), points=n("pts"), shots=n("shots");
    const derived = {
      rate:()=>ratio(points,gp), goalsRate:()=>ratio(goals,gp),
      assistsRate:()=>ratio(assists,gp), shotsRate:()=>ratio(shots,gp),
      shootingPct:()=>{const v=ratio(goals,shots);return v==null?null:v*100;},
      pointsPerShot:()=>ratio(points,shots),goalsAssistsRatio:()=>ratio(goals,assists),
      shp:()=>n("shp") ?? n("shpts")
    };
    const value = derived[metric] ? derived[metric]() : n(metric);
    return value != null && Number.isFinite(value) ? value : null;
  }

  function iceDevelopmentMetrics(player,competition) {
    const rows=icePlayerSeasons(player,competition);
    return ICE_DEVELOPMENT_METRICS.filter(([key]) => rows.some(r => iceDevelopmentValue(r,key) != null))
      .map(([key,label])=>({key,label}));
  }

  function developmentChart(p, competition = "regular") {
    const rows = icePlayerSeasons(p, competition);
    if (!rows.length) return empty("No season development history is available.");
    const metrics = iceDevelopmentMetrics(p, competition);
    if (!metrics.length) return empty("No trackable statistics are available for these seasons.");
    const metric = metrics.some(m => m.key === S.profileTrendMetric) ? S.profileTrendMetric : metrics[0].key;
    const name = metrics.find(m => m.key === metric)?.label || metric;
    const values = rows.map(r => iceDevelopmentValue(r, metric));
    const fractional = ["rate","goalsRate","assistsRate","shotsRate","shootingPct","pointsPerShot","goalsAssistsRatio"].includes(metric);
    const format = v => v == null ? "—" : fractional ? `${dec(v,metric === "shootingPct" ? 1 : 2)}${metric === "shootingPct" ? "%" : ""}` : fmt(v);
    const axis = r => S.profileTrendAxis === "draft" ? (iceDYLabel(p,r.season) || r.season) : r.season;
    const latest = values.length > 1 ? values[values.length - 1] : null;
    const previous = values.length > 1 ? values[values.length - 2] : null;
    const delta = latest != null && previous != null ? latest - previous : null;
    const valid = values.filter(v => v != null);
    if (!valid.length) return empty("No values are available for this statistic.");

    // Plot to a responsive SVG viewBox; missing values break the line instead of becoming zero.
    const W = 960, H = 330, left = 66, right = 24, top = 36, bottom = 66;
    const plotW = W-left-right, plotH = H-top-bottom;
    let min = Math.min(0,...valid), max = Math.max(0,...valid);
    if (min === max) { min -= 1; max += 1; }
    const padding = (max-min)*0.09;
    min -= padding; max += padding;
    const x = i => left + (rows.length === 1 ? plotW/2 : i*plotW/(rows.length-1));
    const y = v => top + (max-v)*plotH/(max-min);
    const ticks = Array.from({length:5},(_,i)=>min+(max-min)*i/4);
    const grid = ticks.map(v=>`<g><line x1="${left}" x2="${W-right}" y1="${y(v).toFixed(2)}" y2="${y(v).toFixed(2)}" class="ice-dev-grid"/><text x="${left-12}" y="${(y(v)+4).toFixed(2)}" text-anchor="end" class="ice-dev-tick">${esc(format(v))}</text></g>`).join("");
    let segments = [], current = [];
    values.forEach((v,i)=>{
      if (v == null) { if(current.length) segments.push(current); current=[]; }
      else current.push([x(i),y(v)]);
    });
    if(current.length) segments.push(current);
    const lines = segments.filter(segment=>segment.length>1).map(segment=>`<polyline class="ice-dev-line" points="${segment.map(([px,py])=>`${px.toFixed(2)},${py.toFixed(2)}`).join(" ")}"/>`).join("");
    const points = rows.map((r,i)=>values[i]==null?"":`<g class="ice-dev-point" tabindex="0" role="img" aria-label="${esc(`${axis(r)}, ${r.season}, ${r.team||"OHL"}: ${format(values[i])}`)}"><title>${esc(`${axis(r)} · ${r.season}${r.team?` · ${r.team}`:""}: ${format(values[i])}`)}</title><circle cx="${x(i).toFixed(2)}" cy="${y(values[i]).toFixed(2)}" r="7"/><text x="${x(i).toFixed(2)}" y="${(y(values[i])-16).toFixed(2)}" text-anchor="middle" class="ice-dev-value">${esc(format(values[i]))}</text></g>`).join("");
    const labels = rows.map((r,i)=>`<g><text x="${x(i).toFixed(2)}" y="${H-bottom+28}" text-anchor="middle" class="ice-dev-axis-label">${esc(axis(r))}</text><text x="${x(i).toFixed(2)}" y="${H-bottom+45}" text-anchor="middle" class="ice-dev-season-label">${esc(r.season)}</text></g>`).join("");
    return `<div class="ice-development-head">
      <div><strong>${esc(name)}</strong><span>${esc(competition === "playoffs" ? "Playoffs" : "Regular season")} · ${rows.length} seasons</span></div>
      ${delta == null ? "" : `<span class="ice-development-delta">Latest change: ${delta>0?"+":""}${format(delta)}</span>`}
    </div>
    <div class="ice-dev-chart" role="group" aria-label="${esc(name)} development line graph">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(name)} by ${S.profileTrendAxis === "draft" ? "draft year" : "OHL season"}" preserveAspectRatio="xMidYMid meet">
        ${grid}${lines}${points}${labels}
      </svg>
    </div>
    <p class="ice-profile-note">DY labels are estimated from birthdate and NHL draft eligibility, not the player's actual selection. DY is the draft-year season; DY−1 is the preceding season. Seasons with multiple teams are counted once. Missing statistics are not treated as zero.</p>`;
  }

  /* ==========================================================
     09. PLAYER COMPARISON
     ========================================================== */

  const COMPARE_METRICS = [
    ["Games played", "gp", "Volume"], ["Goals", "g", "Scoring"],
    ["Assists", "a", "Scoring"], ["Points", "pts", "Scoring"],
    ["Points / game", "rate", "Efficiency"],
    ["Goals / game", "goalsRate", "Efficiency"],
    ["Assists / game", "assistsRate", "Efficiency"],
    ["Shots / game", "shotsRate", "Efficiency"],
    ["Points / shot", "pointsPerShot", "Efficiency"],
    ["Goals / assists", "goalsAssistsRatio", "Efficiency"],
    ["Plus / minus", "plusMinus", "Other"],
    ["Penalty minutes", "pim", "Other"],
    ["Shots on goal", "shots", "Shooting"],
    ["Shooting %", "shootingPct", "Shooting"],
    ["Power-play goals", "ppg", "Power play"],
    ["Power-play assists", "ppa", "Power play"],
    ["Power-play points", "ppp", "Power play"],
    ["Shorthanded goals", "shg", "Penalty kill"],
    ["Shorthanded assists", "sha", "Penalty kill"],
    ["Shorthanded points", "shp", "Penalty kill"]
  ];

  function compareMetric(record, key) {
    if (!record) return null;
    const n = field => {
      const raw = record[field];
      if (raw === null || raw === undefined || raw === "") return null;
      const v = Number(raw);
      return Number.isFinite(v) ? v : null;
    };
    const gp = n("gp");
    if (["rate", "goalsRate", "assistsRate", "shotsRate"].includes(key)) {
      const numerator = n(key === "rate" ? "pts" : key === "goalsRate" ? "g" : key === "assistsRate" ? "a" : "shots");
      return gp > 0 && numerator !== null ? numerator / gp : null;
    }
    if (key === "pointsPerShot") {
      const pts = n("pts"), shots = n("shots");
      return pts !== null && shots > 0 ? pts / shots : null;
    }
    if (key === "goalsAssistsRatio") {
      const g = n("g"), a = n("a");
      return g !== null && a > 0 ? g / a : null;
    }
    if (key === "shootingPct") {
      const g = n("g"), shots = n("shots");
      return g !== null && shots > 0 ? g / shots * 100 : null;
    }
    const aliases = {
      plusMinus:["plusMinus","plusminus","plus_minus","pm"],
      ppg:["ppg","powerPlayGoals"],
      ppa:["ppa","powerPlayAssists"],
      ppp:["ppp","powerPlayPoints"],
      shg:["shg","shortHandedGoals"],
      sha:["sha","shortHandedAssists"],
      shp:["shp","shortHandedPoints"]
    }[key] || [key];
    for (const alias of aliases) {
      const v = n(alias);
      if (v !== null) return v;
    }
    return null;
  }

  const COMPARE_RATE_METRICS = new Set(["rate","goalsRate","assistsRate","shotsRate","shootingPct","pointsPerShot","goalsAssistsRatio"]);
  const COMPARE_REVERSE_METRICS = new Set(); // no automatic scouting judgement on PIM or +/-.

  function comparePosition(p, record) {
    const raw = String(record?.position || p?.position || "").trim().toUpperCase();
    if (/^(D|LD|RD|DEFEN[CS]E|DEFEN[CS]EMAN)$/.test(raw)) return "D";
    if (/^(C|LW|RW|F|CF|LF|RF|FORWARD|CENTRE|CENTER|LEFT WING|RIGHT WING)$/.test(raw)) return "F";
    return "";
  }

  function compareCohortRows(season, competition, position, minGP) {
    if (!season || season === "career") return [];
    const raw = resolveRows(competitionRecords(competition), competition)
      .filter(r => r.season === season && r.key);
    const byKey = new Map();
    for (const row of raw) {
      const list = byKey.get(row.key) || [];
      list.push(row);
      byKey.set(row.key,list);
    }
    const result = [];
    for (const [key, records] of byKey) {
      const total = records.find(r=>/^(tot|total|all teams|multiple teams)$/i.test(String(r.team||"").trim()));
      const source = total ? [total] : records;
      const first = source[0];
      const numericFields = ["gp","g","a","pts","shots","pim","plusMinus","ppg","ppa","ppp","shg","sha","shp"];
      const merged = {...first};
      for (const field of numericFields) {
        const present = source.map(r=>compareMetric(r,field)).filter(v=>v!==null);
        if (present.length) merged[field] = present.reduce((a,b)=>a+b,0);
        else delete merged[field];
      }
      if ((compareMetric(merged,"gp") ?? 0) < minGP) continue;
      if (position !== "all" && comparePosition(person(key),merged) !== position) continue;
      result.push(merged);
    }
    return result;
  }

  function comparePercentile(value, values) {
    if (value === null) return null;
    const sorted = values.filter(v=>v!==null && Number.isFinite(v)).sort((a,b)=>a-b);
    if (sorted.length < 5) return null;
    const below = sorted.filter(v=>v<value).length;
    const equal = sorted.filter(v=>v===value).length;
    return Math.round(100*(below + equal/2)/sorted.length);
  }

  function comparePercentileFor(slot, key) {
    if (!slot.player || slot.season === "career") return null;
    const position = S.compareCohort === "same" ? comparePosition(slot.player,slot.record) : "all";
    if (S.compareCohort === "same" && !position) return null;
    const cohort = compareCohortRows(slot.season,slot.competition,position,S.compareMinGP);
    const value = compareMetric(slot.record,key);
    if ((compareMetric(slot.record,"gp") ?? 0) < S.compareMinGP) return null;
    const values = cohort.map(r=>compareMetric(r,key)).filter(v=>v!==null);
    const percentile = comparePercentile(value,values);
    return percentile === null ? null : {percentile, n:values.length};
  }

  function compareColorClass(p) {
    return p >= 90 ? "elite" : p >= 75 ? "high" : p >= 50 ? "mid" : "low";
  }

  function compareSlot(letter) {
    return {
      letter,
      player: person(S["compare" + letter]),
      season: S["compareSeason" + letter],
      competition: S["compareCompetition" + letter]
    };
  }

  function compareData() {
    const letters = ["A", "B", "C", "D"].slice(0, S.compareCount);
    const used = new Set();
    return letters.map(letter => {
      let slot = compareSlot(letter);
      if (!slot.player || used.has(slot.player.key)) {
        const replacement = S.people.find(p => !used.has(p.key));
        if (replacement) {
          S["compare" + letter] = replacement.key;
          slot = compareSlot(letter);
        }
      }
      if (slot.player) used.add(slot.player.key);
      return { ...slot, record: selectedRecord(slot.player, slot.season, slot.competition) };
    });
  }

  function compareValue(value, metric) {
    if (value == null || !Number.isFinite(value)) return "—";
    return ["rate","goalsRate","assistsRate","shotsRate","pointsPerShot","goalsAssistsRatio"].includes(metric)
      ? value.toFixed(3)
      : metric === "shootingPct" ? value.toFixed(1) + "%" : Number(value).toLocaleString("en-CA");
  }

  function renderCompare() {
    if (!S.people.length) {
      main.innerHTML = empty("No player records available.");
      return;
    }
    S.compareCount = clamp(Number(S.compareCount) || 2,2,4);
    const slots = compareData();
    const isSameSeason = slots.every(s=>s.season !== "career" &&
      s.season === slots[0].season && s.competition === slots[0].competition);
    const data = COMPARE_METRICS.map(([label,key,group]) => ({
      label,key,group,
      values:slots.map(s=>compareMetric(s.record,key)),
      percentiles:slots.map(s=>comparePercentileFor(s,key))
    }));
    const shown = data.filter(m =>
      m.values.some(v=>v!==null) &&
      (S.compareFocus==="all" || m.group===S.compareFocus) &&
      (!S.compareRateOnly || COMPARE_RATE_METRICS.has(m.key))
    );
    const availableGroups = [...new Set(COMPARE_METRICS.map(m=>m[2]))];
    const gp = slots.map(s=>compareMetric(s.record,"gp"));
    const goals = slots.map(s=>compareMetric(s.record,"g"));
    const points = slots.map(s=>compareMetric(s.record,"pts"));
    const seasonName = s=>s.season==="career"?"Career":s.season;
    main.innerHTML = heading(
      "PLAYER ANALYSIS",
      "Player Comparison",
      "Compare player performance side by side."
    ) + `
      <div class="ice-gm-toolbar">
        <label>Compare</label>
        <div class="ice-gm-count" role="group" aria-label="Number of players">
          ${[2,3,4].map(n=>`<button type="button" data-compare-count="${n}"
            class="btn ${S.compareCount===n?"primary":""}"
            aria-pressed="${S.compareCount===n}">${n} players</button>`).join("")}
        </div>
        <button class="btn" type="button" id="compare-sync">Match first player's season</button>
        <span class="ice-gm-hint">Choose independent seasons or align all players for a fairer comparison.</span>
      </div>
      <div class="ice-gm-selectors">
        ${slots.map((s,i)=>`
          <section class="ice-gm-selector">
            <div class="ice-gm-slot-label">PLAYER ${i+1}</div>
            ${playerSelect("compare-"+s.letter.toLowerCase(),s.player?.key)}
            <div class="ice-gm-selector-fields">
              <label><span>Competition</span>${competitionSelect("compare-competition-"+s.letter.toLowerCase(),s.competition)}</label>
              <label><span>Season</span>${playerSeasonSelect("compare-season-"+s.letter.toLowerCase(),s.player,s.season,true,s.competition)}</label>
            </div>
          </section>`).join("")}
      </div>
      <div class="ice-gm-context ${isSameSeason?"ice-gm-context-good":"ice-gm-context-caution"}">
        <strong>${isSameSeason?"Aligned comparison":"Different comparison windows"}</strong>
        <span>${isSameSeason
          ? `All selected players are being compared in ${esc(slots[0].season)} ${slots[0].competition==="playoffs"?"playoffs":"regular season"}.`
          : "Selections include different seasons, competitions or career totals. Use rates and league percentiles for context; raw totals may not be directly comparable."}</span>
      </div>
      <div class="ice-gm-kpi-grid">
        ${slots.map((s,i)=>`
          <article class="ice-gm-kpi">
            <div class="ice-gm-kpi-player">${image(s.player)}<div><strong>${esc(s.player?.name||"—")}</strong><small>${esc(seasonName(s))} · ${s.competition==="playoffs"?"Playoffs":"Regular"}</small></div></div>
            <div class="ice-gm-kpi-stats">
              <div><strong>${compareValue(gp[i],"gp")}</strong><small>GP</small></div>
              <div><strong>${compareValue(goals[i],"g")}</strong><small>G</small></div>
              <div><strong>${compareValue(points[i],"pts")}</strong><small>PTS</small></div>
              <div><strong>${compareValue(compareMetric(s.record,"rate"),"rate")}</strong><small>P/GP</small></div>
            </div>
          </article>`).join("")}
      </div>
      <section class="ice-gm-tools" aria-label="Comparison filters">
        <div class="ice-gm-tool"><label for="compare-min-gp">League percentile: minimum GP</label>
          <select id="compare-min-gp" class="select">
            ${[[0,"Any GP"],[5,"5+ GP"],[10,"10+ GP"],[20,"20+ GP"],[40,"40+ GP"]].map(([v,l])=>option(v,l,S.compareMinGP)).join("")}
          </select></div>
        <div class="ice-gm-tool"><label for="compare-cohort">League peer group</label>
          <select id="compare-cohort" class="select">
            ${option("all","All skaters",S.compareCohort)}
            ${option("same","Same position group (F/D)",S.compareCohort)}
          </select></div>
        <div class="ice-gm-tool"><label for="compare-focus">Statistic group</label>
          <select id="compare-focus" class="select">
            ${option("all","All statistics",S.compareFocus)}
            ${availableGroups.map(g=>option(g,g,S.compareFocus)).join("")}
          </select></div>
        <label class="ice-gm-rate-toggle"><input id="compare-rates-only" type="checkbox" ${S.compareRateOnly?"checked":""}> Rates only</label>
      </section>
      <div class="ice-gm-legend"><span class="ice-gm-percentile-pill elite">90th+</span> Top 10% of qualifying skaters
        <span class="ice-gm-percentile-pill high">75–89th</span> Upper quartile
        <span class="ice-gm-percentile-pill mid">50–74th</span> Above median
        <span class="ice-gm-hint">Percentiles are within each player's selected season, competition and peer group.</span>
      </div>
      <details class="ice-advanced-panel ice-compare-visual" open>
        <summary>Advanced Analytics — visual comparison <span>Rates and efficiency</span></summary>
        <div class="ice-advanced-body">
          <div class="ice-compare-visual-legend">${slots.map((slot,i)=>`<span><i class="ice-compare-swatch ice-compare-swatch-${i}"></i>${esc(slot.player?.name||"Player "+(i+1))}</span>`).join("")}</div>
          ${ADVANCED_METRICS.map(([label,key])=>{
            const values=slots.map(slot=>compareMetric(slot.record,key));
            const valid=values.filter(v=>v!==null && Number.isFinite(v));
            if (!valid.length) return "";
            const maximum=Math.max(...valid,0.000001);
            return `<div class="ice-compare-visual-row"><strong>${esc(label)}</strong>
              <div class="ice-compare-visual-bars">${values.map((v,i)=>`<div class="ice-compare-visual-item"><span class="ice-compare-visual-label">${esc(slots[i].player?.name||"Player "+(i+1))}</span><div class="ice-compare-track"><span class="ice-compare-fill ice-compare-fill-${i}" style="width:${v===null?0:clamp(v/maximum*100,0,100)}%"></span></div><b>${compareValue(v,key)}</b></div>`).join("")}</div></div>`;
          }).join("")}
          <p class="ice-advanced-note">Bars are scaled to the largest available value within each metric. Values are not adjusted for age, ice time, or strength of schedule.</p>
        </div>
      </details>
      <div class="ice-gm-section-heading">
        <div><h2>Scouting comparison matrix</h2>
          <p>Values plus league percentile where available. Highest raw value in each row is highlighted.</p></div>
        <div class="ice-gm-actions"><button type="button" class="btn" id="compare-copy-link">Copy comparison link</button>
          <button type="button" class="btn" id="compare-download-csv">Download CSV</button></div>
      </div>
      <div class="ice-gm-scroll" tabindex="0" aria-label="Horizontally scrollable player comparison matrix">
        <table class="ice-gm-table">
          <thead><tr><th class="ice-gm-metric-col" scope="col">Statistic</th>
            ${slots.map(s=>`<th scope="col" class="ice-gm-player-col">
              <div class="ice-gm-head">${image(s.player)}
                <div><strong>${esc(s.player?.name||"No player")}</strong>
                  <small>${esc(seasonName(s))} · ${s.competition==="playoffs"?"Playoffs":"Regular"}</small>
                </div>
              </div></th>`).join("")}</tr></thead>
          <tbody>${shown.map((m,i)=>{
            const vals = m.values.filter(v=>v!==null);
            const max = vals.length ? Math.max(...vals) : null;
            const previous = shown[i-1];
            const groupRow = !previous || previous.group!==m.group
              ? `<tr class="ice-gm-group"><th colspan="${slots.length+1}" scope="rowgroup">${esc(m.group)}</th></tr>`:"";
            return groupRow+`<tr><th scope="row" class="ice-gm-metric-col">${esc(m.label)}</th>
              ${m.values.map((v,j)=>{
                const pctile = m.percentiles[j];
                return `<td class="${v!==null&&v===max&&vals.length>1?"ice-gm-best":""}">
                  <div class="ice-gm-stat-number">${compareValue(v,m.key)}</div>
                  ${pctile ? `<div class="ice-gm-percentile-pill ${compareColorClass(pctile.percentile)}"
                     title="Percentile among ${pctile.n} eligible skaters">${pctile.percentile}th percentile</div>`:""}
                </td>`;
              }).join("")}</tr>`;
          }).join("")}</tbody>
        </table>
      </div>
      <p class="ice-gm-footnote">
        Percentiles use the midrank method and only show with at least five qualifying skaters.
        Career totals have no single-season percentile. Players below the minimum GP threshold have no percentile.
        A missing statistic is shown as —, not zero. The data reflects available IceIndex records and may not cover every OHL skater.
        High penalty minutes and plus/minus are descriptive, not automatically better scouting outcomes.
      </p>`;
  }

  function compareCSV() {
    const slots = compareData();
    const rows = [
      ["Statistic",...slots.map(s=>`${s.player?.name||"Player"} (${s.season}, ${s.competition})`)],
      ...COMPARE_METRICS.flatMap(([label,key])=>[
        [label,...slots.map(s=>compareMetric(s.record,key) ?? "")],
        [label + " (league percentile)",...slots.map(s=>comparePercentileFor(s,key)?.percentile ?? "")]
      ])
    ];
    const csv = rows.map(row=>row.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv],{type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download="iceindex-player-comparison.csv"; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
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
      S.draftYear =
        years.find(y => y <= new Date().getFullYear()) ||
        years[0] ||
        null;
    }

    let rows = withDraft.filter(
      r => r.draftYear === Number(S.draftYear)
    );

    const query = S.draftQuery.toLowerCase().trim();

    if (query) {
      rows = rows.filter(r =>
        `${r.name} ${r.team}`
          .toLowerCase()
          .includes(query)
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
              option(
                y,
                `${y} NHL Draft Class`,
                S.draftYear
              )
            ).join("")}
          </select>

          <input
            id="draft-search"
            class="input"
            type="search"
            value="${esc(S.draftQuery)}"
            placeholder="Search draft class…"
          >

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
        "Teams, rosters and performance."
      ) +
      `
        <div class="ice-team-grid">
          ${teams.map(([name, code]) => {
            const players = S.current.filter(r =>
              r.team === name ||
              window.getOHLTeam?.(r.team)?.name === name
            );

            return `
              <button
                class="ice-team-card"
                data-team="${esc(name)}">

                ${logo(name)}

                <strong>${esc(name)}</strong>

                <span>${esc(code)}</span>

                <small>
                  ${fmt(players.length)} skater records
                </small>
              </button>
            `;
          }).join("")}
        </div>
      `;
  }

  /* ==========================================================
     12. ANALYTICS DATA HELPERS
     ========================================================== */

  /*
    Analytics currently operate on regular-season
    statistics only.

    Playoff statistics are maintained separately
    through S.playoffs and must not enter the
    regular-season analytics cohort.

    This prevents postseason records from being
    mixed into regular-season percentile rankings.
  */

  function analyticsRecords() {
    if (!A) return [];

    const rows = A.seasonRecords(allRecords());

    if (S.analyticsSeason === "current") {
      return rows.filter(
        r => r.endYear === currentYear()
      );
    }

    if (S.analyticsSeason !== "all") {
      return rows.filter(
        r =>
          r.endYear === Number(S.analyticsSeason)
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
      options.season =
        Number(S.analyticsSeason);
    }

    if (S.analyticsAge !== "all") {
      options.age = Number(S.analyticsAge);
      options.ageWindow = 0;
    }

    return options;
  }

  function analyticsCohort() {
    if (!A) return [];

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
    if (!A) return "";

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
      "gp",
      "g",
      "a",
      "pts"
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

    const keys = new Set(
      rows.map(r => r.key)
    );

    const available = S.people.filter(p =>
      keys.has(p.key)
    );

    return available.map(p =>
      option(
        p.key,
        p.name,
        selected
      )
    ).join("");
  }

  function resolveAnalyticsSelections() {
    const cohort = analyticsCohort();

    if (!cohort.length) {
      S.analyticsPlayer = null;
      S.analyticsCompare = null;
      return;
    }

    if (!cohort.some(
      r => r.key === S.analyticsPlayer
    )) {
      S.analyticsPlayer =
        sortBy(cohort, "pts")[0].key;
    }

    if (
      !cohort.some(
        r => r.key === S.analyticsCompare
      ) ||
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
          <span>
            Insufficient comparable data
          </span>
        </div>
      `;
    }

    const value = result.percentile;

    const width = clamp(value, 0, 100);

    return `
      <div class="ice-percentile-row">

        <div class="ice-percentile-top">
          <span>${esc(result.label)}</span>

          <strong>
            ${dec(value, 1)}th
          </strong>
        </div>

        <div class="ice-percentile-track">
          <div
            class="ice-percentile-fill"
            style="width:${width}%">
          </div>
        </div>

        <div class="ice-percentile-meta">
          <span>
            ${dec(result.value, 2)}
          </span>

          <span>
            n = ${fmt(result.sampleSize)}
          </span>
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
          "OHL PLAYERS",
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
    ctx.textAlign="right";ctx.fillText("ICEINDEX · OHL",936,1233);ctx.textAlign="left";
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
     ICEINDEX PLATFORM HOME — v0.4.0
     Generic landing page, independent of OHL data availability.
     ========================================================== */


  const ICEINDEX_LEAGUES = Object.freeze([
    {id:"ohl",short:"OHL",name:"Ontario Hockey League",route:"overview",active:true,logo:"https://cdn.freebiesupply.com/logos/large/2x/ohl-logo-png-transparent.png"},
    {id:"whl",short:"WHL",name:"Western Hockey League",route:"whl-home",active:false,logo:"https://upload.wikimedia.org/wikipedia/en/a/af/Western_Hockey_League.svg"},
    {id:"qmjhl",short:"QMJHL",name:"Quebec Maritimes Junior Hockey League",route:"qmjhl-home",active:false,logo:"https://thumb.wikimedia.org/wikipedia/en/thumb/2/27/Quebec_Major_Junior_Hockey_League.svg/1280px-Quebec_Major_Junior_Hockey_League.svg.png"}
  ]);

  function leagueTiles() {
    return ICEINDEX_LEAGUES.map(league => `
      <article class="ice-league-tile ${league.active ? "is-live" : "is-upcoming"}">
        <div class="ice-league-monogram" aria-hidden="true"><img src="${esc(league.logo)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:contain;background:white;border-radius:8px;padding:4px"></div>
        <div class="ice-league-tile-body">
          <h3>${esc(league.name)}</h3>
          <p>${esc(league.short)} · ${league.active ? "Statistics & analytics available" : "Beta release coming soon"}</p>
        </div>
        <a class="btn ${league.active ? "primary" : "secondary"}" href="#${league.route}" data-page="${league.route}">${league.active ? "Explore OHL" : "Preview " + league.short} →</a>
      </article>
    `).join("");
  }

  function renderLeagueBeta(leagueId) {
    const league = ICEINDEX_LEAGUES.find(item => item.id === leagueId);
    if (!league) return;
    main.innerHTML = `
      <section class="ice-beta-home">
        <img class="ice-beta-home-logo" src="${esc(league.logo)}" alt="${esc(league.short)} league logo">
        <span class="ice-beta-label">IceIndex / ${esc(league.short)} / Beta preview</span>
        <h1>${esc(league.short)} Home</h1>
        <p>We're bringing ${esc(league.name)} statistics, player profiles, comparisons and analytics to IceIndex.</p>
        <h2>Beta release coming soon</h2>
        <p>We're aiming to launch this league in the next few weeks. The full database and Game Centre aren't available yet.</p>
        <div class="ice-beta-actions"><a href="#leagues" data-page="leagues" class="btn secondary">All leagues</a><a href="#overview" data-page="overview" class="btn primary">Explore OHL</a></div>
      </section>`;
  }

  function featuredPlayer() {
    const eligible = S.current.filter(row => Number(row.gp) > 0 && Number.isFinite(Number(row.pts)));
    const leader = sortBy(eligible, "pts")[0];

    if (!leader) {
      return `<div class="ice-feature-empty">
        <div class="ice-feature-placeholder" aria-hidden="true">★</div>
        <div>
          <span class="eyebrow">FEATURED PLAYER</span>
          <h3>Top performers, coming into focus.</h3>
          <p>${S.loading ? "Loading the latest OHL scoring leaders…" : "Current player statistics are temporarily unavailable."}</p>
          <a href="#overview" data-page="overview" class="btn secondary">Visit OHL Dashboard</a>
        </div>
      </div>`;
    }

    return `<div class="ice-feature-player">
      <div class="ice-feature-photo">${image(leader, "ice-feature-headshot")}</div>
      <div class="ice-feature-details">
        <span class="eyebrow">OHL · CURRENT POINTS LEADER</span>
        <h3>${esc(leader.name)}</h3>
        <p>${esc(leader.team || "Ontario Hockey League")} · ${esc(currentSeason())}</p>
        <div class="ice-feature-numbers">
          <div><strong>${fmt(leader.gp)}</strong><span>GP</span></div>
          <div><strong>${fmt(leader.g)}</strong><span>Goals</span></div>
          <div><strong>${fmt(leader.a)}</strong><span>Assists</span></div>
          <div><strong>${fmt(leader.pts)}</strong><span>Points</span></div>
        </div>
        <a class="btn secondary" href="#profile" data-person="${esc(leader.key)}">View Player Profile →</a>
      </div>
    </div>`;
  }

  function renderHome() {
    main.innerHTML = `
      <section class="ice-home-hero" aria-labelledby="ice-home-title">
        <div class="ice-home-copy">
          <span class="eyebrow">HOCKEY DATA INTELLIGENCE</span>
          <h1 id="ice-home-title">Every player.<br>Every league.<br><em>One index.</em></h1>
          <p>Discover standout talent, explore statistics and compare hockey players in one evolving analytics platform.</p>
          <div class="ice-home-actions">
            <a class="btn primary" href="#leagues" data-page="leagues">Select a League →</a>
            <a class="btn secondary" href="#players" data-page="players">Explore OHL Players</a>
          </div>
        </div>
        <div class="ice-home-hero-mark" aria-hidden="true">
          <img class="ice-home-brand-logo" src="assets/branding/iceindex-logo.png" alt="" width="240" height="220">
        </div>
      </section>

      <div class="ice-home-section-heading">
        <div><span class="eyebrow">THE SPOTLIGHT</span><h2>Featured player</h2></div>
        <span class="ice-home-tag">Powered by IceIndex</span>
      </div>

      <section class="ice-feature-panel" aria-label="Featured player">
        ${featuredPlayer()}
      </section>

      <div class="ice-home-section-heading">
        <div><span class="eyebrow">EXPLORE HOCKEY</span><h2>Choose your league</h2></div>
        <a href="#leagues" data-page="leagues" class="ice-text-link">All leagues →</a>
      </div>

      <div class="ice-league-grid">${leagueTiles()}</div>

      <section class="ice-home-bottom">
        <div>
          <span class="eyebrow">BUILT FOR THE GAME</span>
          <h2>From the numbers to the next big name.</h2>
          <p>Player databases, historical statistics, comparisons and scouting-style analytics — starting with the OHL, with room to grow.</p>
        </div>
        <a href="#analytics" data-page="analytics" class="btn secondary">Explore Analytics →</a>
      </section>
    `;
  }

  function renderLeagues() {
    main.innerHTML = `
      ${heading(
        "ICEINDEX / LEAGUES",
        "Select a league",
        "Choose an available hockey league to explore player statistics, teams and analytics."
      )}
      <div class="ice-league-grid ice-league-grid-page">
        ${leagueTiles()}
      </div>
      <section class="panel ice-leagues-note">
        <h2>More leagues are on the horizon.</h2>
        <p>IceIndex currently supports the Ontario Hockey League. WHL and QMJHL beta homepages are available now; full statistics and analytics are planned for the coming weeks.</p>
      </section>
    `;
  }

  /* ==========================================================
     19. PAGE ROUTER
     ========================================================== */

  const VALID_PAGES = new Set([
    /* "home", */ "leagues", "overview", "whl-home", "qmjhl-home", "players", "statistics",
    "profile", "game-logs", "game-centre", "compare", "draft", "teams",
    "analytics", "goalies", "goalie-profile",
    "goalie-compare"
  ]);

  function render() {
    if (S.page === "whl-home" || S.page === "qmjhl-home") {
      renderLeagueBeta(S.page === "whl-home" ? "whl" : "qmjhl");
      updateNavigation();
      return;
    }
    if (S.page === "leagues") {
      renderLeagues();
      updateNavigation();
      return;
    }

    if (["goalies", "goalie-profile", "goalie-compare"].includes(S.page)) {
      window.IceIndexGoalies?.render(S.page, main);
      updateNavigation();
      return;
    }

    if (!S.ready) {
      main.innerHTML = `<div class="empty">Loading current OHL statistics…</div>`;
      return;
    }

    switch (S.page) {
      case "players": renderPlayers(); break;
      case "statistics": renderStatistics(); break;
      case "profile": renderProfile(); break;
      case "game-logs": window.IceIndexGameLogs?.render(main, S.people, S.profile); break;
      case "game-centre": window.IceIndexGameCentre?.render(main); break;
      case "compare": renderCompare(); break;
      case "draft": renderDraft(); break;
      case "teams": renderTeams(); break;
      case "analytics": renderAnalytics(); break;
      default: renderOverview(); break;
    }

    updateNavigation();
  }

  function updateNavigation() {
    document.querySelectorAll('[data-page], .nav-link[href^="#"]')
      .forEach(element => {
        const target = element.dataset.page ||
          element.getAttribute("href")?.replace(/^#/, "");
        const active = target === S.page;
        element.classList.toggle("active", active);
        if (active) element.setAttribute("aria-current", "page");
        else element.removeAttribute("aria-current");
      });
  }

  function closeMenu() {
    sidebar?.classList.remove("open");
    scrim?.classList.remove("active");
    document.body.classList.remove("menu-open");
    menuToggle?.setAttribute("aria-expanded", "false");
  }

  function openMenu() {
    sidebar?.classList.add("open");
    scrim?.classList.add("active");
    document.body.classList.add("menu-open");
    menuToggle?.setAttribute("aria-expanded", "true");
  }

  function navigate(page) {
    const next = VALID_PAGES.has(page) ? page : "overview";
    S.page = next;

    if (location.hash !== `#${next}`) {
      location.hash = next;
    }

    closeMenu();
    render();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function restoreCompareLink() {
    if (!location.hash.startsWith("#compare?")) return;
    const params = new URLSearchParams(location.hash.split("?")[1] || "");
    const n = Number(params.get("n"));
    if ([2,3,4].includes(n)) S.compareCount = n;
    const minGP = Number(params.get("minGP"));
    if ([0,5,10,20,40].includes(minGP) && params.has("minGP")) S.compareMinGP = minGP;
    if (["all","same"].includes(params.get("cohort"))) S.compareCohort = params.get("cohort");
    if (["all","Volume","Scoring","Efficiency","Other","Shooting","Power play","Penalty kill"].includes(params.get("focus"))) S.compareFocus = params.get("focus");
    S.compareRateOnly = params.get("rates") === "1";
    for (const letter of ["A","B","C","D"]) {
      const key = params.get("p"+letter);
      const season = params.get("s"+letter);
      const competition = params.get("c"+letter);
      if (key && person(key)) S["compare"+letter] = key;
      if (season) S["compareSeason"+letter] = season;
      if (["regular","playoffs"].includes(competition)) S["compareCompetition"+letter] = competition;
    }
  }

  function handleHash() {
    const hash = location.hash.replace(/^#/, "").split("?")[0];
    if (hash === "compare" && location.hash.includes("?")) {
      restoreCompareLink();
      S.page = "compare";
      render();
      closeMenu();
      return;
    }
    const next = VALID_PAGES.has(hash) ? hash : "overview";

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
    const target = event.target;
    if (!(target instanceof Element)) return;

    const choice = target.closest("[data-picker-choice]");
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

    if (!target.closest("[data-picker]")) {
      document.querySelectorAll(".ice-player-picker-results")
        .forEach(el => el.hidden = true);
    }

    const highlight = target.closest("[data-highlight-season]");
    if (highlight) {
      S.profileCompetition = "regular";
      S.profileSeason = highlight.dataset.highlightSeason;
      renderProfile();
      return;
    }

    const timeline = target.closest("[data-profile-timeline]");
    if (timeline) {
      S.profileSeason = timeline.dataset.profileTimeline;
      renderProfile();
      return;
    }

    const trend = target.closest("[data-profile-trend]");
    if (trend) {
      S.profileTrendMetric = trend.dataset.profileTrend;
      renderProfile();
      return;
    }

    const logsLink = target.closest("[data-open-game-logs]");
    if (logsLink) {
      window.IceIndexGameLogs?.selectPlayer(logsLink.dataset.openGameLogs);
      navigate("game-logs");
      return;
    }

    const playerLink = target.closest("[data-person]");
    if (playerLink) {
      event.preventDefault();
      const requested = playerLink.dataset.person;
      const resolved = person(requested) || S.people.find(p => String(p.id) === String(requested));
      if (!resolved) return;
      S.profile = resolved.key;
      S.profileSeason = "career";
      navigate("profile");
      return;
    }

    if (target.closest("#compare-sync")) {
      const base = compareSlot("A");
      for (const letter of ["B","C","D"].slice(0,S.compareCount-1)) {
        S["compareCompetition"+letter] = base.competition;
        const other = person(S["compare"+letter]);
        const hasSeason = base.season === "career" ||
          recordsForPlayer(other,base.competition).some(r=>r.season===base.season);
        S["compareSeason"+letter] = hasSeason ? base.season : "career";
      }
      renderCompare();
      return;
    }
    const compareCount = target.closest("[data-compare-count]");
    if (compareCount) {
      S.compareCount = Number(compareCount.dataset.compareCount);
      renderCompare();
      return;
    }
    if (target.closest("#compare-download-csv")) {
      compareCSV();
      return;
    }
    if (target.closest("#compare-copy-link")) {
      const params = new URLSearchParams();
      params.set("n",String(S.compareCount));
      params.set("minGP",String(S.compareMinGP));
      params.set("cohort",S.compareCohort);
      params.set("focus",S.compareFocus);
      params.set("rates",S.compareRateOnly ? "1" : "0");
      for (const letter of ["A","B","C","D"].slice(0,S.compareCount)) {
        params.set("p"+letter,S["compare"+letter] || "");
        params.set("s"+letter,S["compareSeason"+letter]);
        params.set("c"+letter,S["compareCompetition"+letter]);
      }
      const link = location.href.split("#")[0] + "#compare?" + params.toString();
      navigator.clipboard?.writeText(link).then(()=>{
        const button = document.querySelector("#compare-copy-link");
        if (button) button.textContent = "Link copied";
      }).catch(()=>window.prompt("Copy comparison URL:",link));
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

    const statsSort=target.closest("[data-stats-sort]");
    if(statsSort) {
      const key=statsSort.dataset.statsSort;
      if(S.statsMetric===key) S.statsSortAscending=!S.statsSortAscending;
      else {S.statsMetric=key;S.statsSortAscending=false;}
      const metricSelect=document.querySelector("#stats-metric");if(metricSelect)metricSelect.value=key;
      const direction=document.querySelector("#stats-sort-direction");if(direction)direction.textContent=S.statsSortAscending?"Ascending ↑":"Descending ↓";
      S.statsPage=1;updateStatistics();return;
    }
    const statsColumn=target.closest("[data-stats-column]");
    if(statsColumn) {
      const checked=[...document.querySelectorAll("[data-stats-column]:checked")].map(x=>x.dataset.statsColumn);
      S.statsColumns=checked;S.statsPage=1;
      const button=document.querySelector("#stats-columns-toggle");
      if(button)button.textContent=`Columns (${checked.length} of ${document.querySelectorAll("[data-stats-column]").length})`;
      updateStatistics();return;
    }
    if(target.closest("#stats-columns-toggle")) {
      S.statsShowColumns=!S.statsShowColumns;
      const panel=document.querySelector("#stats-columns-panel");if(panel)panel.hidden=!S.statsShowColumns;
      target.closest("button").setAttribute("aria-expanded",String(S.statsShowColumns));return;
    }
    if(target.closest("#stats-filters-toggle")) {
      S.statsAdvancedFilters=!S.statsAdvancedFilters;
      const panel=document.querySelector("#stats-filters-panel");if(panel)panel.hidden=!S.statsAdvancedFilters;
      target.closest("button").setAttribute("aria-expanded",String(S.statsAdvancedFilters));target.closest("button").textContent=`All filters ${S.statsAdvancedFilters?"−":"+"}`;return;
    }
    if(target.closest("#stats-columns-all")) {S.statsColumns=statsAvailableColumns(statsRows()).map(d=>d.key);renderStatistics();return;}
    if(target.closest("#stats-columns-default")) {S.statsColumns=null;renderStatistics();return;}
    if(target.closest("#stats-columns-none")) {S.statsColumns=[];renderStatistics();return;}
    if(target.closest("#stats-sort-direction")) {S.statsSortAscending=!S.statsSortAscending;renderStatistics();return;}
    if(target.closest("#stats-export")) {statsExportCSV();return;}
    if(target.closest("#stats-goalies")) {navigate("goalies");return;}
    const statsPlayer = target.closest("[data-stats-player]");
    if (statsPlayer) {
      S.profile = statsPlayer.dataset.statsPlayer;
      S.profileSeason = "career";
      navigate("profile");
      return;
    }
    const statsPager = target.closest("[data-stats-page]");
    if (statsPager) {
      S.statsPage += statsPager.dataset.statsPage === "next" ? 1 : -1;
      updateStatistics();
      return;
    }
    if (target.closest("#stats-clear")) {
      S.statsCompetition = "regular";
      S.statsSeason = "current";
      S.statsTeam = "all";
      S.statsMetric = "pts";
      S.statsMinGP = 0;
      S.statsQuery = "";
      S.statsPage = 1;
      S.statsPosition="all";S.statsColumns=null;S.statsShowColumns=false;
      S.statsAdvancedFilters=false;S.statsFilterMetric="pts";
      S.statsFilterMin="";S.statsFilterMax="";S.statsSortAscending=false;
      renderStatistics();return;
    }

    const dbPage = target.closest("[data-db-page]");
    if (dbPage) {
      S.dbPage += dbPage.dataset.dbPage === "next" ? 1 : -1;
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

    const team = target.closest("[data-team]");
    if (team) {
      S.dbTeam = team.dataset.team;
      S.dbSeason = "all";
      S.dbPage = 1;
      navigate("players");
      return;
    }

    const scatter = target.closest("[data-scatter-player]");
    if (scatter) {
      S.profile = scatter.dataset.scatterPlayer;
      S.profileSeason = "career";
      navigate("profile");
      return;
    }

    if (target.closest("#download-player-card")) {
      downloadPlayerCard();
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
    if (event.key === "Escape") closeMenu();

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
        const query = element.value.trim().toLowerCase();

        const matches = [...select.options]
          .filter(o => o.textContent.toLowerCase().includes(query))
          .slice(0, 35);

        results.innerHTML = matches.map(o => `
          <button type="button" role="option"
            class="ice-player-picker-option"
            data-picker-choice="${esc(o.value)}"
            data-picker-label="${esc(o.textContent)}">
            ${esc(o.textContent)}
          </button>
        `).join("") ||
          '<div class="ice-player-picker-none">No matching players</div>';

        results.hidden = false;
      }
      return;
    }

    if (!(element instanceof HTMLElement)) return;

    if (element.matches?.("[data-stats-column]")) return;
    if (element.id === "stats-filter-min" || element.id === "stats-filter-max") {
      if(element.id === "stats-filter-min") S.statsFilterMin=element.value;
      else S.statsFilterMax=element.value;
      S.statsPage=1;updateStatistics();return;
    }
    if (element.id === "stats-search") {
      S.statsQuery = element.value;
      S.statsPage = 1;
      updateStatistics();
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

      const replacement = document.querySelector("#draft-search");
      replacement?.focus();

      if (start !== null && end !== null) {
        replacement?.setSelectionRange(start, end);
      }
    }
  });

  document.addEventListener("change", event => {
    const element = event.target;
    if (!(element instanceof HTMLElement)) return;

    const id = element.id;
    const value = element.value;

    if (id === "overview-competition") {
      S.overviewCompetition = value;
      renderOverview();
    }

    if (id === "compare-min-gp") { S.compareMinGP = Number(value); renderCompare(); return; }
    if (id === "compare-cohort") { S.compareCohort = value; renderCompare(); return; }
    if (id === "compare-focus") { S.compareFocus = value; renderCompare(); return; }
    if (id === "compare-rates-only") {
      S.compareRateOnly = !!element.checked; renderCompare(); return;
    }

    if (id.startsWith("stats-") && id !== "stats-search") {
      const keys = {
        "stats-competition":"statsCompetition",
        "stats-season":"statsSeason",
        "stats-team":"statsTeam",
        "stats-metric":"statsMetric",
        "stats-min-gp":"statsMinGP",
        "stats-position":"statsPosition",
        "stats-filter-metric":"statsFilterMetric"
      };
      if (keys[id]) {
        S[keys[id]] = id === "stats-min-gp" ? Number(value) : value;
        S.statsPage = 1;
        if (id === "stats-competition" || id === "stats-season") {
          S.statsTeam = "all";
          renderStatistics();
        } else {
          updateStatistics();
        }
      }
    }

    if (id === "db-competition") {
      S.dbCompetition = value;
      S.dbSeason = "all";
      S.dbTeam = "all";
      S.dbPage = 1;
      renderPlayers();
    }

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

    if (id === "profile-competition") {
      S.profileCompetition = value;
      S.profileSeason = "career";
      renderProfile();
    }

    if (id === "profile-trend-metric") {
      S.profileTrendMetric = value;
      renderProfile();
      return;
    }
    if (id === "profile-trend-axis") {
      S.profileTrendAxis = value;
      renderProfile();
      return;
    }

    if (id === "profile-season") {
      S.profileSeason = value;
      renderProfile();
    }

    const compareMatch = /^compare-(a|b|c|d)$/.exec(id);
    const competitionMatch = /^compare-competition-(a|b|c|d)$/.exec(id);
    const seasonMatch = /^compare-season-(a|b|c|d)$/.exec(id);
    if (compareMatch || competitionMatch || seasonMatch) {
      const letter = (compareMatch || competitionMatch || seasonMatch)[1].toUpperCase();
      if (compareMatch) {
        const duplicate = ["A","B","C","D"].some(other =>
          other !== letter && S["compare"+other] === value &&
          ["A","B","C","D"].indexOf(other) < S.compareCount);
        if (duplicate) {
          window.alert("Choose a different player for each comparison slot.");
          renderCompare();
          return;
        }
        S["compare"+letter] = value;
        S["compareSeason"+letter] = "career";
      } else if (competitionMatch) {
        S["compareCompetition"+letter] = value;
        S["compareSeason"+letter] = "career";
      } else {
        S["compareSeason"+letter] = value;
      }
      renderCompare();
      return;
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

    if (id === "compare-competition-a") {
      S.compareCompetitionA = value;
      S.compareSeasonA = "career";
      renderCompare();
    }

    if (id === "compare-competition-b") {
      S.compareCompetitionB = value;
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
      sessionStorage.setItem("iceindex-intro-dismissed", "1");
    } catch (_) {}
  }

  introClose?.addEventListener("click", dismissIntro);

  try {
    if (sessionStorage.getItem("iceindex-intro-dismissed") === "1") {
      dismissIntro();
    }
  } catch (_) {}

  /* ==========================================================
     22. DATA STATUS
     ========================================================== */

  function updateStatus(message) {
    const status = document.querySelector("#data-status");
    if (status) status.textContent = message;

    const season = document.querySelector("#season-label");
    if (season && S.current.length) {
      season.textContent = currentSeason();
    }
  }

  /* ==========================================================
     23. INITIAL DATA LOADING
     ========================================================== */

  async function initialize() {
    const initialPage = location.hash.replace(/^#/, "").split("?")[0];
    S.page = VALID_PAGES.has(initialPage) ? initialPage : "overview";
    if (initialPage === "home") history.replaceState(null, "", "#overview");

    introStatus("Loading current OHL statistics…");
    updateStatus("Loading current season");
    render();

    try {
      if (typeof window.loadOHLCurrent !== "function") {
        throw new Error("OHL data engine is not available.");
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
        }, { competition: "all" }).then(result => {
          S.history = result.regularRecords ||
            (result.records || []).filter(r =>
              competitionOf(r) === "regular"
            );

          S.playoffs = result.playoffRecords ||
            (result.records || []).filter(r =>
              competitionOf(r) === "playoffs"
            );

          S.archive = result;
          S.loading = false;

          mergeData();

          updateStatus(
            `${current.season} · Historical archive ready`
          );

          render();

        }).catch(error => {
          S.loading = false;
          console.warn("IceIndex historical archive:", error);

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

      introStatus("Current OHL statistics could not be loaded.");
      updateStatus("Data unavailable");
      S.loading = false;

      if (S.page === "leagues") {
        render();
      } else {
        main.innerHTML = `
          ${heading(
            "OHL DATA UNAVAILABLE",
            "Unable to load OHL statistics",
            "The league data source could not be reached."
          )}

          <div class="notice">
            ${esc(error.message || "Unknown loading error")}
          </div>

          <div class="ice-actions">
            <button class="btn primary" id="ice-retry">Retry</button>
            <a class="btn secondary" href="#overview" data-page="overview">
              OHL Overview
            </a>
          </div>
        `;

        document.querySelector("#ice-retry")
          ?.addEventListener("click", () => initialize());
      }
    }
  }

  /* ==========================================================
     24. START APPLICATION
     ========================================================== */

  initialize();

  console.info("IceIndex application v0.7.0 initialized.");

})();
