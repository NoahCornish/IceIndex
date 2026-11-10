
"use strict";

/* ============================================================
   ICEINDEX v0.1.0
   FILE 3 OF 5 — APPLICATION CONTROLLER

   Current statistics first.
   Historical archive in the background.
   PlayerID headshots.
   Career profiles and comparisons.
   Mobile navigation.
   ============================================================ */

(() => {

  const main = document.getElementById("main-content");
  const intro = document.getElementById("intro-overlay");
  const introProgress = document.getElementById("intro-progress");
  const introClose = document.getElementById("intro-close");

  const $ = id => document.getElementById(id);

  const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const fmt = value =>
    value == null || !Number.isFinite(Number(value))
      ? "—"
      : Number(value).toLocaleString("en-CA");

  const dec = (value, places = 2) =>
    value == null || !Number.isFinite(Number(value))
      ? "—"
      : Number(value).toFixed(places);

  const S = {
    current: [],
    history: [],
    people: [],
    byKey: new Map(),

    archive: null,
    archiveLoading: false,
    archivePromise: null,

    page: "overview",
    query: "",
    dbSeason: "all",
    dbTeam: "all",
    dbSort: "pts",
    dbLimit: 100,

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

    currentReady: false,
    currentYear: null
  };

  /* ==========================================================
     GENERAL HELPERS
     ========================================================== */

  function value(row, metric) {
    if (!row) return null;

    const gp = Number(row.gp) || 0;

    if (metric === "rate")
      return gp ? (Number(row.pts) || 0) / gp : null;

    if (metric === "goalsRate")
      return gp ? (Number(row.g) || 0) / gp : null;

    if (metric === "assistsRate")
      return gp ? (Number(row.a) || 0) / gp : null;

    if (metric === "pppRate")
      return gp ? (Number(row.ppp) || 0) / gp : null;

    return row[metric] ?? null;
  }

  function sortBy(rows, metric = "pts") {
    return [...rows].sort((a, b) =>
      (value(b, metric) ?? -Infinity) -
      (value(a, metric) ?? -Infinity) ||
      String(a.name).localeCompare(String(b.name))
    );
  }

  function heading(kicker, title, subtitle = "") {
    return `
      <div class="page-heading">
        <div class="eyebrow">${esc(kicker)}</div>
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
      <option value="${esc(value)}"
        ${String(value) === String(selected) ? "selected" : ""}>
        ${esc(label)}
      </option>
    `;
  }

  function notify(message) {
    return `<div class="notice">${esc(message)}</div>`;
  }

  /* ==========================================================
     INTRODUCTION WINDOW
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
  }

  introClose?.addEventListener("click", dismissIntro);

  introStatus("Loading current OHL statistics…");

  /* ==========================================================
     PLAYER IDENTITY AND HEADSHOTS
     ========================================================== */

  function playerID(player) {
    return String(
      player?.PlayerID ||
      player?.id ||
      ""
    ).trim();
  }

  function playerPhoto(player) {
    const direct = String(
      player?.photo ||
      player?.PhotoURL ||
      player?.HeadshotURL ||
      ""
    ).trim();

    if (/^https:\/\//i.test(direct)) {
      return direct;
    }

    const id = playerID(player);

    if (/^\d+$/.test(id)) {
      return (
        "https://assets.leaguestat.com/" +
        "ohl/240x240/" + id + ".jpg"
      );
    }

    return "";
  }

  function image(player, className = "avatar") {
    const name = String(player?.name || "OHL Player");

    const initials = name
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part[0] || "")
      .join("")
      .toUpperCase();

    const src = playerPhoto(player);

    return `
      <span class="${esc(className)}">
        <span>${esc(initials)}</span>
        ${src ? `
          <img
            src="${esc(src)}"
            alt="${esc(name)}"
            loading="lazy"
            decoding="async"
            onerror="this.onerror=null;this.remove()"
          >
        ` : ""}
      </span>
    `;
  }

  /* ==========================================================
     PLAYER IDENTITY
     ========================================================== */

  function normalizedName(name) {
    return String(name || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function identity(row) {
    if (row.key) return String(row.key);

    const id = playerID(row);

    if (id) return "id:" + id;

    const name = normalizedName(row.name);

    if (row.birth) {
      return "person:" + name + "|" + row.birth;
    }

    return "name:" + name;
  }

  function isAggregateTeam(team) {
    return /^(total|totals|combined|multiple teams|all teams|\d+ teams)$/i
      .test(String(team || "").trim());
  }

  const additiveStats = [
    "gp", "g", "a", "pts", "pim",
    "ppg", "ppa", "ppp",
    "shg", "sha", "shpts",
    "gwg", "eng", "shots"
  ];

  /* ==========================================================
     TRADED-PLAYER SEASON RECONCILIATION

     If an official combined row exists, use it.
     Otherwise combine separate team stints.

     ========================================================== */

  function combineSeason(rows) {
    if (rows.length === 1) {
      return { ...rows[0] };
    }

    const aggregateRows = rows.filter(row =>
      isAggregateTeam(row.team)
    );

    if (aggregateRows.length) {
      const best = sortBy(aggregateRows, "gp")[0];

      return {
        ...best,
        stints: rows.filter(row => row !== best)
      };
    }

    const unique = new Map();

    for (const row of rows) {
      const teamKey = normalizedName(row.team);
      const previous = unique.get(teamKey);

      if (
        !previous ||
        Number(row.gp) > Number(previous.gp) ||
        (
          Number(row.gp) === Number(previous.gp) &&
          Number(row.pts) > Number(previous.pts)
        )
      ) {
        unique.set(teamKey, row);
      }
    }

    const stints = [...unique.values()];

    if (stints.length === 1) {
      return { ...stints[0] };
    }

    const combined = {
      ...stints[0],
      team: stints.map(row => row.team).join(" / "),
      stints
    };

    for (const metric of additiveStats) {
      const available = stints
        .map(row => row[metric])
        .filter(v => v != null);

      combined[metric] = available.length
        ? available.reduce((sum, v) => sum + Number(v), 0)
        : null;
    }

    combined.plusMinus = stints.every(
      row => row.plusMinus != null
    )
      ? stints.reduce(
          (sum, row) => sum + Number(row.plusMinus),
          0
        )
      : null;

    return combined;
  }

  function aggregateCareer(seasons) {
    if (!seasons.length) return null;

    const result = {
      ...seasons[seasons.length - 1],
      season: "career",
      team: "OHL Career"
    };

    for (const metric of additiveStats) {
      const available = seasons
        .map(row => row[metric])
        .filter(v => v != null);

      result[metric] = available.length
        ? available.reduce((sum, v) => sum + Number(v), 0)
        : null;
    }

    result.plusMinus = seasons.every(
      row => row.plusMinus != null
    )
      ? seasons.reduce(
          (sum, row) => sum + Number(row.plusMinus),
          0
        )
      : null;

    return result;
  }

  function mergeData() {
    const grouped = new Map();

    for (const row of [...S.history, ...S.current]) {
      if (!row?.name) continue;

      const key = identity(row);

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }

      grouped.get(key).push({
        ...row,
        key
      });
    }

    const people = [];

    for (const [key, records] of grouped) {
      const years = new Map();

      for (const row of records) {
        const year = Number(row.endYear);

        if (!years.has(year)) {
          years.set(year, []);
        }

        years.get(year).push(row);
      }

      const seasons = [];

      for (const rows of years.values()) {
        const currentRows = rows.filter(
          row => row.source === "current"
        );

        const selected = currentRows.length
          ? currentRows
          : rows;

        seasons.push(combineSeason(selected));
      }

      seasons.sort((a, b) =>
        a.endYear - b.endYear
      );

      if (!seasons.length) continue;

      const latest = seasons[seasons.length - 1];

      const photo = seasons
        .slice()
        .reverse()
        .map(playerPhoto)
        .find(Boolean) || "";

      const person = {
        key,
        id: playerID(latest),
        PlayerID: playerID(latest),
        name: latest.name,
        birth: latest.birth,
        photo,
        position: latest.position,
        team: latest.team,
        latestYear: latest.endYear,
        seasons,
        career: aggregateCareer(seasons)
      };

      people.push(person);
    }

    S.people = people.sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    S.byKey = new Map(
      people.map(person => [person.key, person])
    );

    if (!S.profile || !S.byKey.has(S.profile)) {
      const currentPeople = people.filter(
        person => person.latestYear === S.currentYear
      );

      S.profile = sortBy(
        currentPeople.map(person => ({
          ...person,
          pts: person.seasons.at(-1)?.pts || 0
        }))
      )[0]?.key || people[0]?.key || null;
    }

    if (!S.compareA || !S.byKey.has(S.compareA)) {
      S.compareA = S.profile;
    }

    if (!S.compareB || !S.byKey.has(S.compareB)) {
      S.compareB = people.find(
        person => person.key !== S.compareA
      )?.key || S.compareA;
    }
  }

  function person(key) {
    return S.byKey.get(key) || S.people[0] || null;
  }

  function record(person, season = "career") {
    if (!person) return null;

    if (season === "career") {
      return person.career;
    }

    return person.seasons.find(
      row => String(row.season) === String(season)
    ) || null;
  }

  /* ==========================================================
     SELECT CONTROLS
     ========================================================== */

  function selectPerson(id, selected) {
    return `
      <select id="${esc(id)}"
              class="select"
              aria-label="Select player">
        ${S.people.map(person =>
          option(
            person.key,
            person.name +
              (person.birth ? " · " + person.birth : ""),
            selected
          )
        ).join("")}
      </select>
    `;
  }

  function selectSeason(id, person, selected) {
    return `
      <select id="${esc(id)}"
              class="select"
              aria-label="Select season">
        ${option(
          "career",
          "All loaded OHL seasons",
          selected
        )}
        ${(person?.seasons || []).map(row =>
          option(row.season, row.season, selected)
        ).join("")}
      </select>
    `;
  }

  /* ==========================================================
     STATISTICS TABLE
     ========================================================== */

  function table(rows) {
    if (!rows.length) {
      return `<div class="empty">No matching records.</div>`;
    }

    return `
      <div class="table-scroll">
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
            ${rows.map(row => {
              const p = S.byKey.get(identity(row)) || row;

              return `
                <tr>
                  <td>
                    <a href="#profile"
                       class="player-cell"
                       data-person="${esc(identity(row))}">
                      ${image(p)}
                      <span>
                        <strong>${esc(row.name)}</strong>
                        <small>${esc(row.position || "")}</small>
                      </span>
                    </a>
                  </td>
                  <td>${esc(row.season)}</td>
                  <td>${esc(row.team)}</td>
                  <td>${fmt(row.gp)}</td>
                  <td>${fmt(row.g)}</td>
                  <td>${fmt(row.a)}</td>
                  <td class="accent">${fmt(row.pts)}</td>
                  <td>${dec(value(row, "rate"))}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function archiveNotice() {
    if (S.archiveLoading) {
      return notify(
        "Historical OHL statistics are loading in the background. Current-season features are available."
      );
    }

    if (S.archive?.failed?.length) {
      return notify(
        `${S.archive.failed.length} historical seasons could not be loaded. Career statistics may be incomplete.`
      );
    }

    if (!S.archive) {
      return notify(
        "Career statistics currently reflect loaded seasons. Historical coverage is not yet complete."
      );
    }

    return "";
  }

  /* ==========================================================
     OVERVIEW
     ========================================================== */

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
        ? rows.filter(row => Number(row.gp) >= 5)
        : rows;

      const leader = sortBy(eligible, metric)[0];

      if (!leader) return "";

      return `
        <article class="leader-card">
          <span class="eyebrow">${label}</span>

          <div class="leader-content">
            ${image(
              S.byKey.get(identity(leader)) || leader,
              "leader-photo"
            )}

            <div>
              <div class="leader-value">
                ${metric === "rate"
                  ? dec(value(leader, metric))
                  : fmt(value(leader, metric))}
              </div>

              <a href="#profile"
                 data-person="${esc(identity(leader))}">
                ${esc(leader.name)}
              </a>

              <small>${esc(leader.team)}</small>
            </div>
          </div>
        </article>
      `;
    }).join("");

    const top = sortBy(
      rows.filter(row =>
        S.overviewMetric !== "rate" ||
        Number(row.gp) >= 5
      ),
      S.overviewMetric
    ).slice(0, 8);

    const max = Math.max(
      1,
      ...top.map(row =>
        Number(value(row, S.overviewMetric)) || 0
      )
    );

    main.innerHTML = `
      <section class="hero">
        <div class="eyebrow">OHL / LEAGUE INTELLIGENCE</div>

        <h1>The league, by the numbers.</h1>

        <p>
          Current OHL production, historical player
          development and draft-year insights —
          powered by OHLDataHub.
        </p>

        <div class="hero-meta">
          <span class="live-dot"></span>
          ${esc(S.current[0]?.season || "Current season")}
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
          <span>PLAYERS INDEXED</span>
          <b>${fmt(S.people.length)}</b>
        </div>

        <div class="kpi">
          <span>ARCHIVE SEASONS</span>
          <b>${fmt(S.archive?.loaded?.length ||
                    S.archive?.seasons?.length || 0)}</b>
        </div>

        <div class="kpi">
          <span>CURRENT GOALS</span>
          <b>${fmt(rows.reduce(
            (sum, row) => sum + (Number(row.g) || 0),
            0
          ))}</b>
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
                  class="btn ${S.overviewMetric === metric
                    ? "active" : ""}"
                  data-metric="${metric}">
                  ${label}
                </button>
              `).join("")}
            </div>

            ${top.map(row => `
              <div class="bar-row">
                <div>
                  <a href="#profile"
                     data-person="${esc(identity(row))}">
                    ${esc(row.name)}
                  </a>

                  <b>
                    ${S.overviewMetric === "rate"
                      ? dec(value(row, S.overviewMetric))
                      : fmt(value(row, S.overviewMetric))}
                  </b>
                </div>

                <span class="track">
                  <span style="width:${
                    100 *
                    (Number(value(row, S.overviewMetric)) || 0) /
                    max
                  }%"></span>
                </span>
              </div>
            `).join("")}
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

        <button class="btn primary" data-go="players">
          Explore the database →
        </button>
      </div>
    `;
  }

  /* ==========================================================
     PLAYER DATABASE
     ========================================================== */

  function databaseRows() {
    const query = S.query.trim().toLowerCase();

    return sortBy(
      [...S.history, ...S.current].filter(row => {
        const matchesQuery =
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

        return matchesQuery &&
          matchesSeason &&
          matchesTeam;
      }),
      S.dbSort
    );
  }

  function updateDatabase() {
    const output = $("db-results");
    if (!output) return;

    const rows = databaseRows();

    output.innerHTML = panel(
      `${fmt(rows.length)} season records`,
      `
        ${table(rows.slice(0, S.dbLimit))}

        ${rows.length > S.dbLimit ? `
          <div class="controls">
            <button class="btn" id="db-more">
              Show more players
            </button>
          </div>
        ` : ""}
      `
    );
  }

  function renderPlayers() {
    const all = [...S.history, ...S.current];

    const seasons = [...new Set(
      all.map(row => row.season)
    )].sort().reverse();

    const teams = [...new Set(
      all.map(row => row.team)
    )].filter(Boolean).sort();

    main.innerHTML = `
      ${heading(
        "HISTORICAL DATABASE",
        "OHL Player Database",
        "Search current and historical OHL statistics."
      )}

      ${archiveNotice()}

      <div class="controls">
        <input
          class="input"
          id="db-search"
          type="search"
          placeholder="Search any OHL player…"
          value="${esc(S.query)}"
          autocomplete="off"
        >

        <select class="select" id="db-season">
          ${option("all", "All seasons", S.dbSeason)}
          ${seasons.map(season =>
            option(season, season, S.dbSeason)
          ).join("")}
        </select>

        <select class="select" id="db-team">
          ${option("all", "All teams", S.dbTeam)}
          ${teams.map(team =>
            option(team, team, S.dbTeam)
          ).join("")}
        </select>

        <select class="select" id="db-sort">
          ${[
            ["pts", "Points"],
            ["rate", "P/GP"],
            ["g", "Goals"],
            ["a", "Assists"],
            ["gp", "Games"]
          ].map(([key, label]) =>
            option(key, label, S.dbSort)
          ).join("")}
        </select>

        <button class="btn" id="db-clear">
          Clear
        </button>
      </div>

      <div id="db-results"></div>
    `;

    updateDatabase();
  }

  /* ==========================================================
     PLAYER PROFILES
     ========================================================== */

  const statMetrics = [
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

  function statRows(row) {
    return statMetrics.map(([label, metric]) => {
      const result = value(row, metric);

      const display = [
        "rate",
        "goalsRate",
        "assistsRate"
      ].includes(metric)
        ? dec(result)
        : fmt(result);

      return `
        <div class="stat-row">
          <span>${esc(label)}</span>
          <strong>${display}</strong>
        </div>
      `;
    }).join("");
  }

  function development(person) {
    const max = Math.max(
      0.1,
      ...person.seasons.map(row =>
        value(row, "rate") || 0
      )
    );

    return `
      <div class="development">
        ${person.seasons.map(row => `
          <div class="development-col">
            <div class="development-number">
              ${dec(value(row, "rate"))}
            </div>

            <div class="development-track">
              <span style="height:${
                100 * (value(row, "rate") || 0) / max
              }%"></span>
            </div>

            <small>${esc(row.season)}</small>
          </div>
        `).join("")}
      </div>

      <p class="footnote">
        Points per game by season. Career rates are
        calculated using total points divided by
        total games played.
      </p>
    `;
  }

  function positionGroup(player) {
    return /^(D|LD|RD)$/i.test(player.position)
      ? "D" : "F";
  }

  function percentile(row, metric = "rate") {
    if (!row || Number(row.gp) < 5) {
      return null;
    }

    const score = value(row, metric);
    if (score == null) return null;

    const peers = [
      ...S.history,
      ...S.current
    ].filter(other =>
      other.season === row.season &&
      Number(other.gp) >= 5 &&
      positionGroup(other) === positionGroup(row) &&
      value(other, metric) != null
    );

    if (!peers.length) return null;

    const below = peers.filter(other =>
      value(other, metric) < score
    ).length;

    const tied = peers.filter(other =>
      value(other, metric) === score
    ).length;

    return Math.round(
      100 * (below + tied / 2) / peers.length
    );
  }

  function teamMark(name, className) {
    if (typeof window.teamLogo === "function") {
      return window.teamLogo(name, className);
    }

    return "";
  }

  function renderProfile() {
    const p = person(S.profile);
    if (!p) return;

    S.profile = p.key;

    const selected =
      record(p, S.profileSeason) || p.career;

    const latest = p.seasons.at(-1);

    main.innerHTML = `
      ${heading(
        "PLAYER INTELLIGENCE",
        "Player Profile",
        "Career statistics, individual seasons and development."
      )}

      ${archiveNotice()}

      <div class="controls">
        ${selectPerson("profile-player", p.key)}
        ${selectSeason(
          "profile-season",
          p,
          S.profileSeason
        )}
      </div>

      <section class="profile-hero">
        <div class="profile-head">
          ${image(p, "profile-photo")}

          <div>
            <div class="eyebrow">
              ${selected.season === "career"
                ? "OHL CAREER"
                : esc(selected.season + " SEASON")}
            </div>

            <h2>${esc(p.name)}</h2>

            <p>
              ${esc(latest.team)}
              · ${esc(latest.position)}
              · ${p.seasons.length} loaded seasons
            </p>

            <div class="profile-tags">
              ${p.birth ? `
                <span>Born ${esc(p.birth)}</span>
              ` : ""}

              <span>${esc(selected.team)}</span>
            </div>
          </div>

          ${teamMark(
            latest.team,
            "profile-team-logo"
          )}
        </div>

        <div class="profile-kpis">
          ${[
            ["GP", fmt(selected.gp)],
            ["GOALS", fmt(selected.g)],
            ["ASSISTS", fmt(selected.a)],
            ["POINTS", fmt(selected.pts)],
            ["P/GP", dec(value(selected, "rate"))]
          ].map(([label, result]) => `
            <div>
              <strong>${result}</strong>
              <span>${label}</span>
            </div>
          `).join("")}
        </div>
      </section>

      <div class="two-col">
        ${panel(
          "Career development",
          development(p)
        )}

        ${panel(
          "Complete statistical breakdown",
          `<div class="stat-list">
            ${statRows(selected)}
          </div>`
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
                ${p.seasons.map(row => `
                  <tr>
                    <td>
                      <button
                        class="text-button"
                        data-profile-season="${esc(row.season)}">
                        ${esc(row.season)}
                      </button>
                    </td>
                    <td>${esc(row.team)}</td>
                    <td>${fmt(row.gp)}</td>
                    <td>${fmt(row.g)}</td>
                    <td>${fmt(row.a)}</td>
                    <td class="accent">${fmt(row.pts)}</td>
                    <td>${dec(value(row, "rate"))}</td>
                    <td>${S.archive
                      ? percentile(row) ?? "—"
                      : "—"}</td>
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
            Percentiles compare skaters within the
            same season and position group, with
            a minimum of five games played.
            Rankings are available after historical
            coverage has loaded.
          </p>

          ${p.seasons.map(row => {
            const rank = S.archive
              ? percentile(row)
              : null;

            return `
              <div class="percentile-row">
                <span>${esc(row.season)}</span>

                <div class="track">
                  <span style="width:${rank ?? 0}%"></span>
                </div>

                <strong>
                  ${rank == null ? "—" : rank + "th"}
                </strong>
              </div>
            `;
          }).join("")}
        `
      )}

      <div class="callout">
        <div>
          <h2>Compare this player.</h2>
          <p>
            Compare career totals or individual OHL seasons.
          </p>
        </div>

        <button
          class="btn primary"
          data-compare-person="${esc(p.key)}">
          Compare →
        </button>
      </div>
    `;
  }

  /* ==========================================================
     PLAYER COMPARISONS
     ========================================================== */

  function compareCard(p, row) {
    return `
      <div class="compare-person">
        ${image(p, "compare-photo")}

        <h3>${esc(p.name)}</h3>

        <p>
          ${row?.season === "career"
            ? "OHL Career"
            : esc(row?.season || "No season")}
        </p>

        <small>${esc(row?.team || "")}</small>
      </div>
    `;
  }

  function renderCompare() {
    const a = person(S.compareA);
    const b = person(S.compareB);

    if (!a || !b) return;

    const x = record(a, S.compareSeasonA) || a.career;
    const y = record(b, S.compareSeasonB) || b.career;

    const metrics = [
      ["Games played", "gp"],
      ["Goals", "g"],
      ["Assists", "a"],
      ["Points", "pts"],
      ["Points / game", "rate"],
      ["Goals / game", "goalsRate"],
      ["Assists / game", "assistsRate"],
      ["Power-play goals", "ppg"],
      ["Power-play assists", "ppa"],
      ["Power-play points", "ppp"],
      ["Shorthanded goals", "shg"],
      ["Game-winning goals", "gwg"],
      ["Penalty minutes", "pim"],
      ["Shots", "shots"]
    ];

    main.innerHTML = `
      ${heading(
        "HISTORICAL ANALYTICS",
        "Compare Players",
        "Compare OHL careers or individual seasons."
      )}

      ${archiveNotice()}

      <div class="compare-controls">
        <div>
          ${selectPerson("compare-a", a.key)}
          ${selectSeason(
            "compare-season-a",
            a,
            S.compareSeasonA
          )}
        </div>

        <div>
          ${selectPerson("compare-b", b.key)}
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
            ${metrics.map(([label, metric]) => {
              const left = value(x, metric);
              const right = value(y, metric);

              const isRate = [
                "rate",
                "goalsRate",
                "assistsRate"
              ].includes(metric);

              const format = v =>
                isRate ? dec(v) : fmt(v);

              return `
                <div class="compare-stat">
                  <strong class="${
                    left != null &&
                    right != null &&
                    left > right
                      ? "winner"
                      : ""
                  }">
                    ${format(left)}
                  </strong>

                  <span>${esc(label)}</span>

                  <strong class="${
                    left != null &&
                    right != null &&
                    right > left
                      ? "winner"
                      : ""
                  }">
                    ${format(right)}
                  </strong>
                </div>
              `;
            }).join("")}
          </div>

          <p class="footnote">
            Raw totals depend on games played.
            Use per-game rates when comparing
            individual seasons.
          </p>
        `
      )}
    `;
  }

  /* ==========================================================
     NHL DRAFT-YEAR ANALYSIS
     ========================================================== */

  function estimatedDraftYear(birth) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth || "")) {
      return null;
    }

    const year = Number(birth.slice(0, 4));
    const monthDay = birth.slice(5);

    return year + (
      monthDay >= "09-16" ? 19 : 18
    );
  }

  function renderDraft() {
    const draftYear = S.draftYear || S.currentYear;

    const eligible = S.current.filter(row =>
      estimatedDraftYear(row.birth) === draftYear
    );

    const query = S.draftQuery.trim().toLowerCase();

    const rows = sortBy(
      eligible.filter(row =>
        !query ||
        `${row.name} ${row.team}`
          .toLowerCase()
          .includes(query)
      ),
      S.draftSort
    );

    main.innerHTML = `
      ${heading(
        "NHL DRAFT WATCH",
        "Draft Year Central",
        "Current OHL skaters grouped by estimated NHL draft eligibility."
      )}

      <div class="notice">
        <strong>Eligibility estimate only.</strong>
        Birthdate window:
        September 16, ${draftYear - 19}
        through September 15, ${draftYear - 18}.
        This is not an official NHL draft eligibility list.
      </div>

      <div class="controls">
        <select class="select" id="draft-year">
          ${[
            S.currentYear - 1,
            S.currentYear,
            S.currentYear + 1,
            S.currentYear + 2
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
          placeholder="Search draft-year players…"
          value="${esc(S.draftQuery)}"
        >

        <select class="select" id="draft-sort">
          ${[
            ["pts", "Points"],
            ["rate", "P/GP"],
            ["g", "Goals"],
            ["a", "Assists"]
          ].map(([key, label]) =>
            option(key, label, S.draftSort)
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
          <span>CURRENT SEASON</span>
          <b>${esc(S.current[0]?.season || "—")}</b>
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

  /* ==========================================================
     TEAM EXPLORER
     ========================================================== */

  function currentTeams() {
    const definitions = window.OHL_TEAMS || [];

    return definitions.map(team => {
      if (Array.isArray(team)) {
        return {
          name: team[0],
          code: team[1]
        };
      }

      return team;
    });
  }

  function renderTeams() {
    const teams = currentTeams();

    main.innerHTML = `
      ${heading(
        "OHL CLUBS",
        "Team Explorer",
        "Explore current Ontario Hockey League teams."
      )}

      <div class="team-grid">
        ${teams.map(team => {
          const roster = S.current.filter(row => {
            const resolved =
              typeof window.getOHLTeam === "function"
                ? window.getOHLTeam(row.team)
                : null;

            return resolved
              ? resolved.code === team.code
              : row.team === team.name;
          });

          return `
            <article class="team-card">
              ${teamMark(
                team.name,
                "team-grid-logo"
              )}

              <h2>${esc(team.name)}</h2>

              <p>
                ${fmt(roster.length)} current skaters
              </p>

              <button
                class="btn"
                data-team="${esc(
                  roster[0]?.team || team.name
                )}">
                View roster →
              </button>
            </article>
          `;
        }).join("")}
      </div>
    `;
  }

  /* ==========================================================
     NAVIGATION
     ========================================================== */

  const pages = {
    overview: renderOverview,
    players: renderPlayers,
    profile: renderProfile,
    compare: renderCompare,
    draft: renderDraft,
    teams: renderTeams
  };

  function closeMenu() {
    $("sidebar")?.classList.remove("open");

    if ($("scrim")) {
      $("scrim").hidden = true;
    }

    $("menu-toggle")?.setAttribute(
      "aria-expanded",
      "false"
    );
  }

  function toggleMenu() {
    const sidebar = $("sidebar");
    if (!sidebar) return;

    const open = sidebar.classList.toggle("open");

    if ($("scrim")) {
      $("scrim").hidden = !open;
    }

    $("menu-toggle")?.setAttribute(
      "aria-expanded",
      String(open)
    );
  }

  function render() {
    if (!S.currentReady) return;

    const hash = location.hash.slice(1);

    S.page = pages[hash] ? hash : "overview";

    document.querySelectorAll("[data-page]")
      .forEach(link => {
        const active = link.dataset.page === S.page;

        link.classList.toggle("active", active);

        if (active) {
          link.setAttribute("aria-current", "page");
        } else {
          link.removeAttribute("aria-current");
        }
      });

    pages[S.page]();

    closeMenu();
  }

  function go(page) {
    if (location.hash === "#" + page) {
      render();
    } else {
      location.hash = page;
    }
  }

  /* ==========================================================
     CLICK EVENTS
     ========================================================== */

  main.addEventListener("click", event => {
    const target = event.target;

    const playerLink = target.closest("[data-person]");

    if (playerLink) {
      event.preventDefault();

      S.profile = playerLink.dataset.person;
      S.profileSeason = "career";

      go("profile");
      return;
    }

    const navigation = target.closest("[data-go]");

    if (navigation) {
      go(navigation.dataset.go);
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
      S.dbSeason = S.current[0]?.season || "all";
      S.query = "";

      go("players");
      return;
    }

    const season = target.closest(
      "[data-profile-season]"
    );

    if (season) {
      S.profileSeason = season.dataset.profileSeason;
      renderProfile();
      return;
    }

    const comparePlayer = target.closest(
      "[data-compare-person]"
    );

    if (comparePlayer) {
      S.compareA = comparePlayer.dataset.comparePerson;

      if (S.compareA === S.compareB) {
        S.compareB = S.people.find(
          p => p.key !== S.compareA
        )?.key || S.compareA;
      }

      S.compareSeasonA = "career";
      S.compareSeasonB = "career";

      go("compare");
      return;
    }

    if (target.closest("#db-clear")) {
      S.query = "";
      S.dbSeason = "all";
      S.dbTeam = "all";
      S.dbSort = "pts";
      S.dbLimit = 100;

      renderPlayers();
      return;
    }

    if (target.closest("#db-more")) {
      S.dbLimit += 100;
      updateDatabase();
    }
  });

  /* ==========================================================
     INPUT EVENTS
     ========================================================== */

  main.addEventListener("input", event => {
    const target = event.target;

    if (target.id === "db-search") {
      S.query = target.value;
      S.dbLimit = 100;
      updateDatabase();
    }

    if (target.id === "draft-search") {
      S.draftQuery = target.value;

      clearTimeout(window.iceDraftTimer);

      window.iceDraftTimer = setTimeout(() => {
        const position = target.selectionStart;

        renderDraft();

        const input = $("draft-search");

        if (input) {
          input.focus();

          const end = Math.min(
            position ?? input.value.length,
            input.value.length
          );

          input.setSelectionRange(end, end);
        }
      }, 180);
    }
  });

  /* ==========================================================
     CHANGE EVENTS
     ========================================================== */

  main.addEventListener("change", event => {
    const id = event.target.id;
    const selected = event.target.value;

    switch (id) {

      case "db-season":
        S.dbSeason = selected;
        S.dbLimit = 100;
        updateDatabase();
        break;

      case "db-team":
        S.dbTeam = selected;
        S.dbLimit = 100;
        updateDatabase();
        break;

      case "db-sort":
        S.dbSort = selected;
        updateDatabase();
        break;

      case "profile-player":
        S.profile = selected;
        S.profileSeason = "career";
        renderProfile();
        break;

      case "profile-season":
        S.profileSeason = selected;
        renderProfile();
        break;

      case "compare-a":
        S.compareA = selected;
        S.compareSeasonA = "career";
        renderCompare();
        break;

      case "compare-b":
        S.compareB = selected;
        S.compareSeasonB = "career";
        renderCompare();
        break;

      case "compare-season-a":
        S.compareSeasonA = selected;
        renderCompare();
        break;

      case "compare-season-b":
        S.compareSeasonB = selected;
        renderCompare();
        break;

      case "draft-year":
        S.draftYear = Number(selected);
        renderDraft();
        break;

      case "draft-sort":
        S.draftSort = selected;
        renderDraft();
        break;
    }
  });

  /* ==========================================================
     MOBILE NAVIGATION EVENTS
     ========================================================== */

  $("menu-toggle")?.addEventListener(
    "click",
    toggleMenu
  );

  $("scrim")?.addEventListener(
    "click",
    closeMenu
  );

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeMenu();

      if (S.currentReady) {
        dismissIntro();
      }
    }
  });

  window.addEventListener(
    "hashchange",
    render
  );

  /* ==========================================================
     HISTORICAL ARCHIVE
     ========================================================== */

  async function loadArchive() {
    if (S.archivePromise) {
      return S.archivePromise;
    }

    S.archiveLoading = true;

    S.archivePromise = (async () => {
      try {
        const archive = await window.loadOHLHistory(
          progress => {
            if (!progress) return;

            const message =
              `Archive: ${
                progress.completed ?? progress.done ?? 0
              }/${
                progress.total ?? 0
              } seasons checked`;

            const status = $("archive-status");

            if (status) {
              status.textContent = message;
            }

            if (!intro?.hidden) {
              introStatus(message);
            }
          }
        );

        S.archive = archive;
        S.history = archive.records || [];
        S.archiveLoading = false;

        mergeData();

        const loaded =
          archive.loaded?.length ||
          archive.seasons?.length ||
          0;

        const status = $("archive-status");

        if (status) {
          status.textContent =
            `${loaded} historical seasons loaded`;
        }

        introStatus(
          "Historical archive ready. Explore IceIndex."
        );

        // Avoid interrupting a visitor who is typing.
        if (!document.activeElement?.matches(
          "input, select"
        )) {
          render();
        }

        return archive;

      } catch (error) {
        S.archiveLoading = false;
        S.archivePromise = null;

        console.warn(
          "[IceIndex] Historical archive unavailable",
          error
        );

        introStatus(
          "Current statistics ready. Historical data unavailable."
        );

        const status = $("archive-status");

        if (status) {
          status.textContent =
            "Historical archive unavailable";
        }

        return null;
      }
    })();

    return S.archivePromise;
  }

  /* ==========================================================
     INITIALIZATION

     1. Load current data.
     2. Render homepage.
     3. Enable introduction button.
     4. Load historical data separately.

     ========================================================== */

  async function init() {
    try {
      const data = await window.loadOHLCurrent();

      S.current = data.records || [];
      S.currentYear = data.endYear;
      S.draftYear = data.endYear;

      if (!S.current.length) {
        throw new Error(
          "Current OHL dataset contains no skaters."
        );
      }

      S.currentReady = true;

      mergeData();

      if ($("season-label")) {
        $("season-label").textContent =
          data.season;
      }

      if ($("data-status")) {
        $("data-status").innerHTML = `
          <span class="live-dot"></span>
          OHL data loaded
          <br>
          <small>
            ${fmt(S.current.length)} current skaters
            · ${esc(data.season)}
            <br>
            <span id="archive-status">
              Loading historical archive…
            </span>
          </small>
        `;
      }

      render();

      introStatus(
        "Current-season statistics ready. Historical data loading separately."
      );

      if (introClose) {
        introClose.textContent =
          "Explore IceIndex — Current Data Ready";
      }

      // Do not block current-season browsing.
      loadArchive();

    } catch (error) {
      console.error(
        "[IceIndex] Initialization failed",
        error
      );

      if ($("data-status")) {
        $("data-status").textContent =
          "OHL data unavailable";
      }

      main.innerHTML = `
        <section class="panel">
          <h2>Unable to load OHL statistics</h2>

          <p>${esc(error.message)}</p>

          <button class="btn primary"
                  id="retry-load">
            Retry
          </button>
        </section>
      `;

      $("retry-load")?.addEventListener(
        "click",
        () => location.reload()
      );

      introStatus(
        "Unable to connect to OHLDataHub. Please retry."
      );

      if (introClose) {
        introClose.textContent =
          "Close introduction";
      }
    }
  }

  /* ==========================================================
     DEBUG API
     ========================================================== */

  window.IceIndex = {
    version: "0.1.0",

    getState() {
      return {
        currentRecords: S.current.length,
        historicalRecords: S.history.length,
        indexedPlayers: S.people.length,
        archiveReady: Boolean(S.archive),
        archiveLoading: S.archiveLoading,
        page: S.page
      };
    },

    navigate: go,

    reload() {
      location.reload();
    }
  };

  init();

})();