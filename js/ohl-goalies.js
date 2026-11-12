
"use strict";

/* ============================================================
   ICEINDEX v0.7.0 BETA
   FILE: js/ohl-goalies.js

   Independent OHL Goaltender Database

   Pages:
     #goalies
     #goalie-profile
     #goalie-compare

   Data:
     data/ohl/current/goalie_stats.csv
     data/processed/ohl/goalie_directory.csv
     data/processed/ohl/goalie_seasons.csv

   Features:
     - Searchable goalie database
     - Searchable goalie profiles
     - Searchable goalie comparisons
     - Season normalization
     - Current and historical data reconciliation
     - Duplicate empty-record removal
     - Career and season statistics
     - Goaltender headshots
     - Responsive layouts
   ============================================================ */

(function () {

  /* ============================================================
     01. CONFIGURATION
     ============================================================ */

  const paths = {
    current: "data/ohl/current/goalie_stats.csv",
    directory: "data/processed/ohl/goalie_directory.csv",
    seasons: "data/processed/ohl/goalie_seasons.csv"
  };

  const PAGE_SIZE = 75;

  const state = {
    status: "idle",
    error: null,

    records: [],
    people: [],
    byID: new Map(),

    currentSeason: "",

    query: "",
    season: "current",
    competition: "Regular Season",
    team: "all",
    sort: "sv",
    page: 1,

    profile: null,
    profileSeason: "career",

    compareA: null,
    compareB: null,
    compareSeasonA: "career",
    compareSeasonB: "career"
  };

  let pending = null;

  /* ============================================================
     02. UTILITIES
     ============================================================ */

  function esc(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[character])
    );
  }

  function val(row, ...keys) {
    for (const key of keys) {
      if (
        row &&
        row[key] !== undefined &&
        row[key] !== null &&
        String(row[key]).trim() !== ""
      ) {
        return row[key];
      }
    }

    return "";
  }

  function n(value) {
    if (value == null || String(value).trim() === "") {
      return null;
    }

    const number = Number(
      String(value).replace(/,/g, "")
    );

    return Number.isFinite(number)
      ? number
      : null;
  }

  function num(row, ...keys) {
    return n(val(row, ...keys));
  }

  function fmt(value) {
    return value == null
      ? "—"
      : Number(value).toLocaleString("en-CA");
  }

  function fixed(value, digits = 2) {
    return value == null ||
      !Number.isFinite(Number(value))
      ? "—"
      : Number(value).toFixed(digits);
  }

  function percent(value) {
    if (value == null) return "—";

    const number = Number(value);

    if (!Number.isFinite(number)) return "—";

    return (
      number > 1 ? number / 100 : number
    ).toFixed(3).replace(/^0/, "");
  }

  function svValue(value) {
    if (value == null) return null;

    return value > 1
      ? value / 100
      : value;
  }

  function normalizeCompetition(value) {
    return /playoff|post.?season/i.test(
      String(value || "")
    )
      ? "Playoffs"
      : "Regular Season";
  }

  function cleanText(value) {
    return String(value ?? "").trim();
  }

  function searchText(value) {
    return cleanText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  /* ============================================================
     03. SEASON NORMALIZATION
     ============================================================ */

  function normalizeGoalieSeason(value) {

    const text = cleanText(value);

    if (!text) return "";

    let match = text.match(
      /^(\d{4})\s+Season$/i
    );

    if (match) {
      const end = Number(match[1]);

      return (
        `${end - 1}-` +
        String(end).slice(-2)
      );
    }

    match = text.match(
      /^(\d{4})[-/](\d{4})$/
    );

    if (match) {
      return (
        `${match[1]}-` +
        match[2].slice(-2)
      );
    }

    match = text.match(
      /^(\d{4})[-/](\d{2})$/
    );

    if (match) {
      return `${match[1]}-${match[2]}`;
    }

    match = text.match(/^(\d{4})$/);

    if (match) {
      const end = Number(match[1]);

      return (
        `${end - 1}-` +
        String(end).slice(-2)
      );
    }

    return text;
  }

  function seasonEnd(value) {

    const season = normalizeGoalieSeason(value);

    const match = season.match(
      /^(\d{4})-(\d{2})$/
    );

    if (!match) return 0;

    const start = Number(match[1]);

    let end =
      Math.floor(start / 100) * 100 +
      Number(match[2]);

    if (end <= start) {
      end += 100;
    }

    return end;
  }

  function currentOHLSeason() {

    const now = new Date();

    const year = now.getUTCFullYear();

    const endYear =
      now.getUTCMonth() >= 6
        ? year + 1
        : year;

    return normalizeGoalieSeason(
      String(endYear)
    );
  }

  /* ============================================================
     04. NORMALIZE GOALTENDER RECORD
     ============================================================ */

  function normalize(row, directory, source) {

    const id = cleanText(
      val(
        row,
        "PlayerID",
        "player_id",
        "playerId",
        "PersonID"
      )
    );

    const info = directory.get(id) || {};

    const first = val(
      row,
      "FirstName"
    ) || val(info, "FirstName");

    const last = val(
      row,
      "LastName"
    ) || val(info, "LastName");

    const name = cleanText(
      val(row, "PlayerName", "Name") ||
      val(info, "PlayerName", "Name") ||
      [first, last].filter(Boolean).join(" ") ||
      `Goalie ${id}`
    );

    const season = normalizeGoalieSeason(
      val(
        row,
        "HockeySeason",
        "Season",
        "SeasonName"
      )
    );

    const gp = num(
      row,
      "GamesPlayed",
      "GP"
    );

    const saves = num(
      row,
      "Saves"
    );

    const ga = num(
      row,
      "GoalsAgainst",
      "GA"
    );

    const shots =
      num(row, "ShotsAgainst") ??
      (
        saves != null && ga != null
          ? saves + ga
          : null
      );

    const seconds = num(
      row,
      "SecondsPlayed"
    );

    const minutes = num(
      row,
      "MinutesPlayed"
    );

    const played =
      seconds != null
        ? seconds
        : minutes != null
          ? minutes * 60
          : null;

    const sv =
      shots > 0 && saves != null
        ? saves / shots
        : svValue(
            num(
              row,
              "SavePercentage",
              "SVPercentage",
              "SVPct"
            )
          );

    const gaa =
      played > 0 && ga != null
        ? ga * 3600 / played
        : num(
            row,
            "GoalsAgainstAverage",
            "GAA"
          );

    const photo =
      val(row, "PhotoURL") ||
      val(info, "PhotoURL") ||
      (
        /^\d+$/.test(id)
          ? `https://assets.leaguestat.com/ohl/240x240/${id}.jpg`
          : ""
      );

    return {
      id,
      key: id,
      name,

      season,
      endYear: seasonEnd(season),

      competition: normalizeCompetition(
        val(
          row,
          "Competition",
          "SeasonType"
        )
      ),

      team: cleanText(
        val(
          row,
          "TeamName",
          "Team"
        )
      ),

      gp,
      gs: num(row, "GamesStarted"),

      w: num(row, "Wins"),
      l: num(row, "Losses"),

      otl: num(row, "OvertimeLosses"),
      sol: num(row, "ShootoutLosses"),

      so: num(row, "Shutouts"),

      ga,
      shots,
      saves,
      played,
      sv,
      gaa,

      photo,

      catching:
        val(info, "Catches", "CatchingHand") ||
        val(row, "Catches"),

      birth:
        val(info, "BirthDate") ||
        val(row, "BirthDate"),

      height: val(info, "Height"),
      weight: val(info, "Weight"),

      hometown: val(info, "Hometown"),
      province: val(info, "HomeProvince"),
      country: val(info, "HomeCountry"),

      source
    };
  }

  /* ============================================================
     05. RECORD QUALITY
     ============================================================ */

  const STAT_FIELDS = [
    "gp",
    "gs",
    "w",
    "l",
    "otl",
    "sol",
    "so",
    "ga",
    "shots",
    "saves",
    "played"
  ];

  function hasStats(row) {
    return STAT_FIELDS.some(
      key => row[key] != null
    );
  }

  function completeness(row) {
    return STAT_FIELDS.reduce(
      (score, key) =>
        score + (
          row[key] != null ? 1 : 0
        ),
      0
    );
  }

  function recordKey(row) {
    return [
      row.id,
      row.season,
      row.competition,
      searchText(row.team)
    ].join("|");
  }

  function groupKey(row) {
    return [
      row.id,
      row.season,
      row.competition
    ].join("|");
  }

  function chooseBetter(a, b) {

    if (!a) return b;
    if (!b) return a;

    const qualityA = completeness(a);
    const qualityB = completeness(b);

    if (qualityB > qualityA) return b;
    if (qualityA > qualityB) return a;

    if (
      b.source === "current" &&
      a.source !== "current"
    ) {
      return b;
    }

    return a;
  }

  /* ============================================================
     06. RECONCILE CURRENT AND HISTORICAL DATA
     ============================================================ */

  function reconcileRecords(historical, active) {

    const merged = new Map();

    for (const row of historical) {
      const key = recordKey(row);

      merged.set(
        key,
        chooseBetter(merged.get(key), row)
      );
    }

    for (const row of active) {
      const key = recordKey(row);

      const existing = merged.get(key);

      if (!existing) {
        merged.set(key, row);
        continue;
      }

      const preferred = chooseBetter(
        existing,
        row
      );

      merged.set(key, {
        ...existing,
        ...preferred,
        team: preferred.team || existing.team,
        photo: preferred.photo || existing.photo
      });
    }

    let records = [...merged.values()];

    // Remove empty rows when populated rows exist
    // for the same goalie, season and competition.

    const populatedGroups = new Set(
      records
        .filter(hasStats)
        .map(groupKey)
    );

    records = records.filter(row => {
      if (hasStats(row)) return true;

      return !populatedGroups.has(
        groupKey(row)
      );
    });

    // Exclude completely empty statistical rows.
    records = records.filter(hasStats);

    return records.sort(
      (a, b) =>
        b.endYear - a.endYear ||
        a.name.localeCompare(b.name)
    );
  }

  /* ============================================================
     07. CAREER STATISTICS
     ============================================================ */

  function career(rows) {

    if (!rows.length) return null;

    const latest = [...rows].sort(
      (a, b) =>
        b.endYear - a.endYear ||
        (b.gp || 0) - (a.gp || 0)
    )[0];

    const sum = key =>
      rows.every(row => row[key] == null)
        ? null
        : rows.reduce(
            (total, row) =>
              total + (row[key] || 0),
            0
          );

    const result = {
      ...latest,

      season: "career",

      team: [
        ...new Set(
          rows
            .map(row => row.team)
            .filter(Boolean)
        )
      ].join(" / ")
    };

    for (const key of STAT_FIELDS) {
      result[key] = sum(key);
    }

    result.sv =
      result.shots > 0 &&
      result.saves != null
        ? result.saves / result.shots
        : null;

    result.gaa =
      result.played > 0 &&
      result.ga != null
        ? result.ga * 3600 / result.played
        : null;

    return result;
  }

  /* ============================================================
     08. FETCH CSV DATA
     ============================================================ */

  async function fetchCSV(path) {

    const controller = new AbortController();

    const timer = setTimeout(
      () => controller.abort(),
      20000
    );

    try {

      const response = await fetch(path, {
        signal: controller.signal,
        cache: "no-cache"
      });

      if (!response.ok) {
        throw new Error(
          `${path}: HTTP ${response.status}`
        );
      }

      const text = await response.text();

      const parser =
        window.IceIndexData?.parseCSV;

      if (typeof parser !== "function") {
        throw new Error(
          "IceIndex CSV parser unavailable. Load ohl-data.js first."
        );
      }

      return parser(text);

    } finally {

      clearTimeout(timer);

    }
  }

  /* ============================================================
     09. LOAD GOALTENDER DATABASE
     ============================================================ */

  function load() {

    if (pending) return pending;

    state.status = "loading";

    pending = (async () => {

      const [
        current,
        directory,
        seasons
      ] = await Promise.all([
        fetchCSV(paths.current),
        fetchCSV(paths.directory),
        fetchCSV(paths.seasons)
      ]);

      const byDirectory = new Map();

      for (const row of directory) {
        const id = cleanText(
          val(
            row,
            "PlayerID",
            "PersonID"
          )
        );

        if (id) {
          byDirectory.set(id, row);
        }
      }

      const historical = seasons
        .map(row =>
          normalize(
            row,
            byDirectory,
            "historical"
          )
        )
        .filter(row =>
          row.id &&
          row.season &&
          row.endYear > 0
        );

      const active = current
        .map(row =>
          normalize(
            row,
            byDirectory,
            "current"
          )
        )
        .filter(row => row.id);

      const fallbackSeason =
        currentOHLSeason();

      for (const row of active) {
        if (!row.season || !row.endYear) {
          row.season = fallbackSeason;
          row.endYear = seasonEnd(
            fallbackSeason
          );
        }
      }

      state.records = reconcileRecords(
        historical,
        active
      );

      const groups = new Map();

      for (const row of state.records) {
        if (!groups.has(row.id)) {
          groups.set(row.id, []);
        }

        groups.get(row.id).push(row);
      }

      state.people = [...groups].map(
        ([id, records]) => {

          records.sort(
            (a, b) =>
              a.endYear - b.endYear ||
              a.competition.localeCompare(
                b.competition
              )
          );

          const latest = [...records].sort(
            (a, b) =>
              b.endYear - a.endYear ||
              Number(Boolean(b.team)) -
              Number(Boolean(a.team)) ||
              (b.gp || 0) - (a.gp || 0)
          )[0];

          const regular = records.filter(
            row =>
              row.competition ===
              "Regular Season"
          );

          const playoffs = records.filter(
            row =>
              row.competition ===
              "Playoffs"
          );

          return {
            ...latest,

            id,
            key: id,

            seasons: records,
            regular,
            playoffs,

            career: career(regular),
            playoffCareer: career(playoffs)
          };
        }
      ).sort(
        (a, b) =>
          a.name.localeCompare(b.name)
      );

      state.byID = new Map(
        state.people.map(person => [
          person.id,
          person
        ])
      );

      const currentYear = Math.max(
        0,
        ...active.map(row => row.endYear)
      );

      state.currentSeason =
        active.find(
          row => row.endYear === currentYear
        )?.season ||
        fallbackSeason;

      if (
        !state.profile ||
        !state.byID.has(state.profile)
      ) {
        state.profile =
          state.people[0]?.id || null;
      }

      if (
        !state.compareA ||
        !state.byID.has(state.compareA)
      ) {
        state.compareA =
          state.people[0]?.id || null;
      }

      if (
        !state.compareB ||
        !state.byID.has(state.compareB)
      ) {
        state.compareB =
          state.people.find(
            person =>
              person.id !== state.compareA
          )?.id || null;
      }

      state.status = "ready";
      state.error = null;

      console.info(
        "IceIndex goalie database loaded",
        {
          records: state.records.length,
          goalies: state.people.length,
          currentSeason:
            state.currentSeason
        }
      );

      return state;

    })().catch(error => {

      state.status = "error";
      state.error = error;
      pending = null;

      console.error(
        "IceIndex goalie database error:",
        error
      );

      throw error;
    });

    return pending;
  }

  /* ============================================================
     10. SEARCH PICKER STYLES
     ============================================================ */

  if (
    !document.getElementById(
      "ice-goalie-picker-styles"
    )
  ) {

    const style =
      document.createElement("style");

    style.id =
      "ice-goalie-picker-styles";

    style.textContent = `
      .ice-goalie-picker {
        position: relative;
        min-width: 0;
        width: 100%;
        flex: 1;
      }

      .ice-goalie-picker .input {
        width: 100%;
        box-sizing: border-box;
        margin-top: 7px;
      }

      .ice-goalie-picker-results {
        position: absolute;
        z-index: 100;
        top: 100%;
        left: 0;
        right: 0;
        max-height: 320px;
        overflow-y: auto;
        background: #102337;
        color: #edf5fc;
        border: 1px solid #355571;
        border-radius: 10px;
        box-shadow: 0 16px 36px #0008;
      }

      .ice-goalie-picker-results[hidden] {
        display: none;
      }

      .ice-goalie-picker-option {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 11px 13px;
        background: transparent;
        border: 0;
        border-bottom: 1px solid #ffffff14;
        color: inherit;
        text-align: left;
        cursor: pointer;
        font: inherit;
      }

      .ice-goalie-picker-option:hover,
      .ice-goalie-picker-option:focus-visible {
        background: #1c3b57;
      }

      .ice-goalie-picker-option .avatar {
        width: 36px;
        height: 36px;
        flex-shrink: 0;
      }

      .ice-goalie-picker-option-name {
        display: block;
        font-weight: 700;
      }

      .ice-goalie-picker-option-meta {
        display: block;
        margin-top: 2px;
        font-size: .75rem;
        opacity: .7;
      }

      .ice-goalie-picker-empty {
        padding: 14px;
        font-size: .85rem;
        color: #a5b7c7;
      }

      .ice-goalie-picker-row {
        display: flex;
        align-items: end;
        gap: 12px;
        width: 100%;
      }

      .ice-goalie-picker-row > * {
        min-width: 0;
      }

      .ice-goalie-season-control {
        width: 100%;
        min-width: 0;
      }

      .ice-goalie-season-control .select {
        width: 100%;
      }

      .ice-goalie-profile-controls {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 14px;
        align-items: end;
        margin-bottom: 22px;
      }

      .ice-goalie-compare-controls {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 14px;
      }

      .ice-goalie-compare-controls .select {
        width: 100%;
      }

      .ice-goalie-picker-label {
        display: block;
        margin-bottom: 2px;
      }

      .ice-goalie-selected-caption {
        margin-top: 8px;
        color: #8ca5ba;
        font-size: .78rem;
      }

      .ice-goalie-compare-head {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 16px;
        padding: 16px 0;
      }

      .ice-goalie-compare-head > div {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .ice-goalie-compare-head > div:last-child {
        justify-content: flex-end;
        text-align: right;
      }

      .ice-goalie-compare-head .avatar {
        width: 48px;
        height: 48px;
        flex-shrink: 0;
      }

      .ice-goalie-compare-head > span {
        font-weight: 800;
        color: #65c1ff;
      }

      .ice-goalie-compare-table {
        display: grid;
        gap: 0;
      }

      .ice-goalie-compare-row {
        display: grid;
        grid-template-columns: 1fr 1.3fr 1fr;
        align-items: center;
        gap: 10px;
        padding: 14px 8px;
        border-bottom: 1px solid #ffffff15;
      }

      .ice-goalie-compare-row > :first-child {
        text-align: left;
      }

      .ice-goalie-compare-row > :nth-child(2) {
        text-align: center;
        color: #90a8ba;
        font-size: .82rem;
      }

      .ice-goalie-compare-row > :last-child {
        text-align: right;
      }

      .ice-goalie-win {
        color: #65c1ff;
      }

      .ice-goalie-pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        flex-wrap: wrap;
        margin: 20px 0;
      }

      .ice-goalie-pagination span {
        color: #91a8bb;
        font-size: .85rem;
      }

      @media (max-width: 700px) {
        .ice-goalie-profile-controls {
          grid-template-columns: 1fr;
        }

        .ice-goalie-compare-head {
          gap: 8px;
        }

        .ice-goalie-compare-head .avatar {
          width: 36px;
          height: 36px;
        }

        .ice-goalie-compare-head strong {
          font-size: .85rem;
        }

        .ice-goalie-compare-row {
          grid-template-columns: 1fr 1fr 1fr;
          gap: 6px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /* ============================================================
     11. HTML COMPONENTS
     ============================================================ */

  function option(value, label, selected) {
    return `
      <option
        value="${esc(value)}"
        ${
          String(value) === String(selected)
            ? "selected"
            : ""
        }
      >
        ${esc(label)}
      </option>
    `;
  }

  function photo(person) {

    const name = person?.name || "";

    const initials = name
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part[0] || "")
      .join("");

    return `
      <span class="avatar">
        <span>${esc(initials)}</span>

        ${
          /^https:\/\//.test(
            person?.photo || ""
          )
            ? `
              <img
                src="${esc(person.photo)}"
                alt="${esc(name)}"
                loading="lazy"
                onerror="this.remove()"
              >
            `
            : ""
        }
      </span>
    `;
  }

  function heading(name, description) {
    return `
      <div class="page-heading">
        <div class="eyebrow">
          OHL / GOALTENDER INTELLIGENCE
        </div>

        <h1>${esc(name)}</h1>
        <p>${esc(description)}</p>
      </div>
    `;
  }

  function panel(name, content) {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>${esc(name)}</h2>
        </div>

        ${content}
      </section>
    `;
  }

  function metric(row, key) {
    return row?.[key] ?? null;
  }

  function display(row, key) {

    const value = metric(row, key);

    if (key === "sv") {
      return percent(value);
    }

    if (key === "gaa") {
      return fixed(value);
    }

    return fmt(value);
  }

  /* ============================================================
     12. SEARCHABLE GOALTENDER PICKER
     ============================================================ */

  function picker(id, chosen) {

    const person = state.byID.get(chosen);

    return `
      <div
        class="ice-goalie-picker"
        data-goalie-picker="${esc(id)}"
      >
        <label
          for="${esc(id)}"
          class="eyebrow ice-goalie-picker-label"
        >
          SEARCH GOALTENDERS
        </label>

        <input
          id="${esc(id)}"
          class="input"
          type="search"
          value="${esc(person?.name || "")}"
          placeholder="Search goaltenders by name..."
          autocomplete="off"
          aria-controls="${esc(id)}-results"
          aria-expanded="false"
        >

        <div
          id="${esc(id)}-results"
          class="ice-goalie-picker-results"
          role="listbox"
          hidden
        ></div>
      </div>
    `;
  }

  function updatePicker(input) {

    const wrapper = input.closest(
      "[data-goalie-picker]"
    );

    const list = wrapper?.querySelector(
      ".ice-goalie-picker-results"
    );

    if (!list) return;

    const query = searchText(input.value);

    const matches = state.people
      .filter(person =>
        !query ||
        searchText(person.name).includes(query)
      )
      .slice(0, 30);

    if (!matches.length) {
      list.innerHTML = `
        <div class="ice-goalie-picker-empty">
          No matching goaltenders.
        </div>
      `;
    } else {
      list.innerHTML = matches.map(person => `
        <button
          type="button"
          class="ice-goalie-picker-option"
          role="option"
          data-goalie-pick="${esc(person.id)}"
          data-goalie-target="${esc(input.id)}"
        >
          ${photo(person)}

          <span>
            <span class="ice-goalie-picker-option-name">
              ${esc(person.name)}
            </span>

            <span class="ice-goalie-picker-option-meta">
              ${esc(person.team || "OHL Goaltender")}
            </span>
          </span>
        </button>
      `).join("");
    }

    list.hidden = false;

    input.setAttribute(
      "aria-expanded",
      "true"
    );
  }

  function closePickers(except = null) {

    document.querySelectorAll(
      ".ice-goalie-picker"
    ).forEach(wrapper => {

      if (
        except &&
        wrapper.contains(except)
      ) {
        return;
      }

      const list = wrapper.querySelector(
        ".ice-goalie-picker-results"
      );

      const input = wrapper.querySelector(
        "input"
      );

      if (list) {
        list.hidden = true;
      }

      if (input) {
        input.setAttribute(
          "aria-expanded",
          "false"
        );
      }
    });
  }

  function restorePicker(input) {

    const selectedKey = {
      "goalie-profile-select": "profile",
      "goalie-compare-a": "compareA",
      "goalie-compare-b": "compareB"
    }[input.id];

    if (!selectedKey) return;

    const person = state.byID.get(
      state[selectedKey]
    );

    input.value = person?.name || "";
  }

  /* ============================================================
     13. STATISTICS TABLE
     ============================================================ */

  function table(rows) {

    if (!rows || !rows.length) {
      return `
        <div class="empty">
          No matching goaltender records.
        </div>
      `;
    }

    return `
      <div class="table-scroll">
        <table class="data-table">

          <thead>
            <tr>
              <th>GOALTENDER</th>
              <th>SEASON</th>
              <th>TEAM</th>
              <th>GP</th>
              <th>W</th>
              <th>L</th>
              <th>SV%</th>
              <th>GAA</th>
              <th>SO</th>
            </tr>
          </thead>

          <tbody>
            ${rows.map(row => `
              <tr>
                <td>
                  <a
                    href="#goalie-profile"
                    data-goalie-id="${esc(row.id)}"
                    class="player-cell"
                  >
                    ${photo(row)}
                    <strong>${esc(row.name)}</strong>
                  </a>
                </td>

                <td>${esc(row.season)}</td>

                <td>
                  ${esc(row.team || "—")}
                </td>

                <td>${display(row, "gp")}</td>
                <td>${display(row, "w")}</td>
                <td>${display(row, "l")}</td>

                <td class="accent">
                  ${display(row, "sv")}
                </td>

                <td>${display(row, "gaa")}</td>
                <td>${display(row, "so")}</td>
              </tr>
            `).join("")}
          </tbody>

        </table>
      </div>
    `;
  }

  /* ============================================================
     14. DATABASE FILTERING
     ============================================================ */

  function rowsForDatabase() {

    let rows = state.records.filter(
      row =>
        row.competition ===
        state.competition
    );

    if (state.season === "current") {
      rows = rows.filter(
        row =>
          row.season ===
          state.currentSeason
      );
    } else if (state.season !== "all") {
      rows = rows.filter(
        row =>
          row.season === state.season
      );
    }

    if (state.team !== "all") {
      rows = rows.filter(
        row =>
          row.team === state.team
      );
    }

    const query = searchText(
      state.query
    );

    if (query) {
      rows = rows.filter(row =>
        searchText(
          `${row.name} ${row.team}`
        ).includes(query)
      );
    }

    const descending =
      state.sort !== "gaa";

    rows.sort((a, b) => {

      const x = metric(a, state.sort);
      const y = metric(b, state.sort);

      if (x == null && y == null) {
        return a.name.localeCompare(
          b.name
        );
      }

      if (x == null) return 1;
      if (y == null) return -1;

      return (
        (
          descending
            ? y - x
            : x - y
        ) ||
        a.name.localeCompare(b.name)
      );
    });

    return rows;
  }

  /* ============================================================
     15. PAGINATION
     ============================================================ */

  function results() {

    const element = document.querySelector(
      "#goalie-results"
    );

    if (!element) return;

    const rows = rowsForDatabase();

    const pages = Math.max(
      1,
      Math.ceil(
        rows.length / PAGE_SIZE
      )
    );

    state.page = Math.min(
      Math.max(state.page, 1),
      pages
    );

    const start =
      (state.page - 1) * PAGE_SIZE;

    const end =
      state.page * PAGE_SIZE;

    element.innerHTML = `
      <div class="results-meta">
        ${fmt(rows.length)}
        matching goaltender-season records
      </div>

      ${table(rows.slice(start, end))}

      <div class="ice-goalie-pagination">

        <button
          class="btn"
          data-goalie-page="prev"
          ${
            state.page === 1
              ? "disabled"
              : ""
          }
        >
          Previous
        </button>

        <span>
          Page ${state.page} of ${pages}
        </span>

        <button
          class="btn"
          data-goalie-page="next"
          ${
            state.page === pages
              ? "disabled"
              : ""
          }
        >
          Next
        </button>

      </div>
    `;
  }

  /* ============================================================
     16. GOALTENDER DATABASE PAGE
     ============================================================ */

  function database(main) {

    const seasons = [
      ...new Set(
        state.records
          .map(row => row.season)
          .filter(season =>
            season &&
            seasonEnd(season) > 0
          )
      )
    ].sort(
      (a, b) =>
        seasonEnd(b) -
        seasonEnd(a)
    );

    const teams = [
      ...new Set(
        state.records
          .map(row => row.team)
          .filter(Boolean)
      )
    ].sort();

    main.innerHTML =
      heading(
        "OHL Goaltender Database",
        "Search regular-season and playoff goaltender statistics across OHL history."
      ) +
      `
      <div class="controls">

        <input
          id="goalie-search"
          class="input"
          type="search"
          placeholder="Search goalies..."
          value="${esc(state.query)}"
        >

        <select
          id="goalie-season"
          class="select"
        >
          ${option(
            "current",
            "Current season",
            state.season
          )}

          ${option(
            "all",
            "All seasons",
            state.season
          )}

          ${seasons.map(season =>
            option(
              season,
              season,
              state.season
            )
          ).join("")}
        </select>

        <select
          id="goalie-competition"
          class="select"
        >
          ${option(
            "Regular Season",
            "Regular season",
            state.competition
          )}

          ${option(
            "Playoffs",
            "Playoffs",
            state.competition
          )}
        </select>

        <select
          id="goalie-team"
          class="select"
        >
          ${option(
            "all",
            "All teams",
            state.team
          )}

          ${teams.map(team =>
            option(
              team,
              team,
              state.team
            )
          ).join("")}
        </select>

        <select
          id="goalie-sort"
          class="select"
        >
          ${[
            ["sv", "Save %"],
            ["gaa", "GAA (lowest)"],
            ["w", "Wins"],
            ["so", "Shutouts"],
            ["gp", "Games played"],
            ["saves", "Saves"]
          ].map(([value, label]) =>
            option(
              value,
              label,
              state.sort
            )
          ).join("")}
        </select>

        <button
          class="btn"
          id="goalie-clear"
        >
          Clear
        </button>

      </div>

      <div id="goalie-results"></div>

      <div class="notice">
        Save percentage and GAA are calculated
        from available statistics. Missing
        values are not estimated.
      </div>
    `;

    results();
  }

  /* ============================================================
     17. PROFILE AND COMPARISON SEASON OPTIONS
     ============================================================ */

  function seasonOptions(
    id,
    person,
    selectedValue
  ) {

    const unique = new Map();

    for (const row of person.seasons) {

      const key =
        `${row.season}|${row.competition}`;

      if (!unique.has(key)) {
        unique.set(key, row);
      }
    }

    const seasons = [
      ...unique.values()
    ].sort(
      (a, b) =>
        b.endYear - a.endYear ||
        a.competition.localeCompare(
          b.competition
        )
    );

    return `
      <div class="ice-goalie-season-control">

        <label
          for="${esc(id)}"
          class="eyebrow"
        >
          STATISTICS PERIOD
        </label>

        <select
          id="${esc(id)}"
          class="select"
        >

          ${option(
            "career",
            "Regular-season career",
            selectedValue
          )}

          ${
            person.playoffCareer
              ? option(
                  "playoff-career",
                  "Playoff career",
                  selectedValue
                )
              : ""
          }

          ${seasons.map(row =>
            option(
              `${row.season}|${row.competition}`,
              `${row.season} · ${row.competition}`,
              selectedValue
            )
          ).join("")}

        </select>
      </div>
    `;
  }

  function selected(person, choice) {

    if (!person) return null;

    if (choice === "career") {
      return person.career;
    }

    if (choice === "playoff-career") {
      return person.playoffCareer;
    }

    const [
      season,
      competition
    ] = String(choice).split("|");

    const rows = person.seasons.filter(
      row =>
        row.season === season &&
        row.competition === competition
    );

    if (!rows.length) return null;

    if (rows.length === 1) {
      return rows[0];
    }

    // Multiple legitimate teams in one season.
    // Combine their statistics for the season.
    return career(rows);
  }

  /* ============================================================
     18. GOALTENDER STAT CARDS
     ============================================================ */

  function stats(row) {

    const metrics = [
      ["GAMES", "gp"],
      ["WINS", "w"],
      ["LOSSES", "l"],
      ["SAVE %", "sv"],
      ["GAA", "gaa"],
      ["SHUTOUTS", "so"],
      ["SAVES", "saves"],
      ["SHOTS AGAINST", "shots"]
    ];

    return `
      <div class="kpi-grid">

        ${metrics.map(([label, key]) => `
          <div class="kpi">
            <span>${label}</span>

            <b>
              ${display(row, key)}
            </b>
          </div>
        `).join("")}

      </div>
    `;
  }

  /* ============================================================
     19. GOALTENDER PROFILE PAGE
     ============================================================ */

  function profile(main) {

    const person = state.byID.get(
      state.profile
    );

    if (!person) {
      main.innerHTML = heading(
        "Goaltender Profile",
        "No goaltender selected."
      );

      return;
    }

    const row =
      selected(
        person,
        state.profileSeason
      ) ||
      person.career ||
      person.playoffCareer;

    main.innerHTML =
      heading(
        "Goaltender Profile",
        "Explore individual goaltender careers, regular seasons and playoffs."
      ) +
      `
      <div class="ice-goalie-profile-controls">

        ${picker(
          "goalie-profile-select",
          person.id
        )}

        ${seasonOptions(
          "goalie-profile-season",
          person,
          state.profileSeason
        )}

      </div>
      ` +
      panel(
        "Goaltender Overview",
        `
        <div class="ice-player-header">

          ${photo(person)}

          <div>
            <div class="eyebrow">
              OHL GOALTENDER
            </div>

            <h2>${esc(person.name)}</h2>

            ${
              person.team
                ? `<p>${esc(person.team)}</p>`
                : ""
            }

            <small>
              ${[
                person.birth &&
                  `Born ${person.birth}`,

                person.catching &&
                  `Catches ${person.catching}`,

                person.hometown,
                person.province
              ]
                .filter(Boolean)
                .map(esc)
                .join(" · ")}
            </small>
          </div>
        </div>

        ${stats(row)}

        <div class="ice-actions">
          <button
            class="btn primary"
            data-goalie-compare="${esc(person.id)}"
          >
            Compare Goaltender
          </button>
        </div>
        `
      ) +
      panel(
        "Regular Season History",
        table(person.regular)
      ) +
      panel(
        "Playoff History",
        table(person.playoffs)
      );
  }

  /* ============================================================
     20. GOALTENDER COMPARISON PAGE
     ============================================================ */

  function comparison(main) {

    const a = state.byID.get(
      state.compareA
    );

    const b = state.byID.get(
      state.compareB
    );

    if (!a || !b) {
      main.innerHTML = heading(
        "Goaltender Comparison",
        "At least two goaltenders are required."
      );

      return;
    }

    const x =
      selected(
        a,
        state.compareSeasonA
      ) ||
      a.career ||
      a.playoffCareer;

    const y =
      selected(
        b,
        state.compareSeasonB
      ) ||
      b.career ||
      b.playoffCareer;

    const metrics = [
      ["Games Played", "gp", true],
      ["Wins", "w", true],
      ["Losses", "l", false],
      ["Save Percentage", "sv", true],
      ["Goals Against Average", "gaa", false],
      ["Shutouts", "so", true],
      ["Saves", "saves", true],
      ["Shots Against", "shots", null]
    ];

    main.innerHTML =
      heading(
        "Goaltender Comparison",
        "Compare regular-season and playoff goaltender statistics."
      ) +
      `
      <div class="two-col">

        ${panel(
          "Goaltender One",
          `
          <div class="ice-goalie-compare-controls">

            ${picker(
              "goalie-compare-a",
              a.id
            )}

            ${seasonOptions(
              "goalie-compare-season-a",
              a,
              state.compareSeasonA
            )}

          </div>
          `
        )}

        ${panel(
          "Goaltender Two",
          `
          <div class="ice-goalie-compare-controls">

            ${picker(
              "goalie-compare-b",
              b.id
            )}

            ${seasonOptions(
              "goalie-compare-season-b",
              b,
              state.compareSeasonB
            )}

          </div>
          `
        )}

      </div>
      ` +
      panel(
        "Statistical Comparison",
        `
        <div class="ice-goalie-compare-head">

          <div>
            ${photo(a)}
            <strong>${esc(a.name)}</strong>
          </div>

          <span>VS</span>

          <div>
            ${photo(b)}
            <strong>${esc(b.name)}</strong>
          </div>

        </div>

        <div class="ice-goalie-compare-table">

          ${metrics.map(
            ([label, key, higher]) => {

              const av = metric(x, key);
              const bv = metric(y, key);

              const aw =
                higher !== null &&
                av != null &&
                bv != null &&
                (
                  higher
                    ? av > bv
                    : av < bv
                );

              const bw =
                higher !== null &&
                av != null &&
                bv != null &&
                (
                  higher
                    ? bv > av
                    : bv < av
                );

              return `
                <div class="ice-goalie-compare-row">

                  <strong class="${
                    aw ? "ice-goalie-win" : ""
                  }">
                    ${display(x, key)}
                  </strong>

                  <span>
                    ${esc(label)}
                  </span>

                  <strong class="${
                    bw ? "ice-goalie-win" : ""
                  }">
                    ${display(y, key)}
                  </strong>

                </div>
              `;
            }
          ).join("")}

        </div>

        <div class="notice">
          Comparisons are descriptive.
          Save percentage and GAA should
          be interpreted alongside workload,
          team context and sample size.
        </div>
        `
      );
  }

  /* ============================================================
     21. PAGE RENDERER
     ============================================================ */

  async function render(page, main) {

    if (!main) return;

    if (state.status !== "ready") {

      main.innerHTML =
        heading(
          "OHL Goaltenders",
          "Loading IceIndex goaltender records..."
        ) +
        `
        <div
          class="loading-spinner"
          aria-hidden="true"
        ></div>
        `;

      try {
        await load();
      } catch (error) {

        if (
          location.hash.slice(1) !== page
        ) {
          return;
        }

        main.innerHTML =
          heading(
            "Goaltender Data Unavailable",
            "Unable to load IceIndex goalie CSVs."
          ) +
          `
          <div class="notice">
            ${esc(error.message)}
          </div>

          <button
            class="btn primary"
            id="goalie-retry"
          >
            Retry
          </button>
          `;

        return;
      }

      if (
        location.hash.slice(1) !== page
      ) {
        return;
      }
    }

    if (page === "goalies") {
      database(main);
    } else if (
      page === "goalie-profile"
    ) {
      profile(main);
    } else if (
      page === "goalie-compare"
    ) {
      comparison(main);
    }
  }

  /* ============================================================
     22. SEARCH INPUT EVENTS
     ============================================================ */

  document.addEventListener(
    "input",
    event => {

      const input = event.target;

      if ([
        "goalie-profile-select",
        "goalie-compare-a",
        "goalie-compare-b"
      ].includes(input.id)) {

        updatePicker(input);
        return;
      }

      if (
        input.id === "goalie-search"
      ) {
        state.query = input.value;
        state.page = 1;
        results();
      }
    }
  );

  /* ============================================================
     23. PICKER FOCUS EVENTS
     ============================================================ */

  document.addEventListener(
    "focusin",
    event => {

      const input = event.target;

      if (![
        "goalie-profile-select",
        "goalie-compare-a",
        "goalie-compare-b"
      ].includes(input.id)) {
        return;
      }

      closePickers(input);

      input.select();

      updatePicker(input);
    }
  );

  document.addEventListener(
    "focusout",
    event => {

      const input = event.target;

      if (![
        "goalie-profile-select",
        "goalie-compare-a",
        "goalie-compare-b"
      ].includes(input.id)) {
        return;
      }

      // Delay until the next task so clicking
      // a search result can finish first.
      setTimeout(() => {

        if (!input.isConnected) return;

        const wrapper = input.closest(
          "[data-goalie-picker]"
        );

        if (
          wrapper?.contains(
            document.activeElement
          )
        ) {
          return;
        }

        restorePicker(input);
        closePickers();

      }, 100);
    }
  );

  /* ============================================================
     24. KEYBOARD EVENTS
     ============================================================ */

  document.addEventListener(
    "keydown",
    event => {

      const input = event.target;

      if (![
        "goalie-profile-select",
        "goalie-compare-a",
        "goalie-compare-b"
      ].includes(input.id)) {
        return;
      }

      if (event.key === "Escape") {
        restorePicker(input);
        closePickers();
        input.blur();
      }

      if (event.key === "Enter") {

        const wrapper = input.closest(
          "[data-goalie-picker]"
        );

        const first = wrapper?.querySelector(
          ".ice-goalie-picker-option"
        );

        const list = wrapper?.querySelector(
          ".ice-goalie-picker-results"
        );

        if (
          first &&
          list &&
          !list.hidden
        ) {
          event.preventDefault();
          first.click();
        }
      }
    }
  );

  /* ============================================================
     25. CLICK EVENTS
     ============================================================ */

  document.addEventListener(
    "click",
    event => {

      const target = event.target.closest?.(
        [
          "[data-goalie-id]",
          "[data-goalie-compare]",
          "[data-goalie-page]",
          "[data-goalie-pick]",
          "#goalie-clear",
          "#goalie-retry"
        ].join(", ")
      );

      if (!target) {

        if (
          !event.target.closest?.(
            "[data-goalie-picker]"
          )
        ) {
          closePickers();
        }

        return;
      }

      /* --------------------------------------------------------
         SELECT SEARCH RESULT
         -------------------------------------------------------- */

      if (
        target.dataset.goaliePick
      ) {

        event.preventDefault();

        const key = {
          "goalie-profile-select": "profile",
          "goalie-compare-a": "compareA",
          "goalie-compare-b": "compareB"
        }[target.dataset.goalieTarget];

        if (!key) return;

        state[key] =
          target.dataset.goaliePick;

        if (key === "profile") {
          state.profileSeason = "career";
        }

        if (key === "compareA") {
          state.compareSeasonA = "career";
        }

        if (key === "compareB") {
          state.compareSeasonB = "career";
        }

        closePickers();

        render(
          location.hash.slice(1),
          document.querySelector(
            "#main-content"
          )
        );

        return;
      }

      /* --------------------------------------------------------
         OPEN GOALTENDER PROFILE
         -------------------------------------------------------- */

      if (
        target.dataset.goalieId
      ) {

        event.preventDefault();

        state.profile =
          target.dataset.goalieId;

        state.profileSeason = "career";

        location.hash =
          "#goalie-profile";

        render(
          "goalie-profile",
          document.querySelector(
            "#main-content"
          )
        );

        return;
      }

      /* --------------------------------------------------------
         COMPARE GOALTENDER
         -------------------------------------------------------- */

      if (
        target.dataset.goalieCompare
      ) {

        event.preventDefault();

        state.compareA =
          target.dataset.goalieCompare;

        state.compareSeasonA = "career";

        if (
          state.compareB === state.compareA
        ) {
          state.compareB =
            state.people.find(
              person =>
                person.id !==
                state.compareA
            )?.id || null;
        }

        location.hash =
          "#goalie-compare";

        render(
          "goalie-compare",
          document.querySelector(
            "#main-content"
          )
        );

        return;
      }

      /* --------------------------------------------------------
         PAGINATION
         -------------------------------------------------------- */

      if (
        target.dataset.goaliePage
      ) {

        state.page +=
          target.dataset.goaliePage ===
          "next"
            ? 1
            : -1;

        results();
        return;
      }

      /* --------------------------------------------------------
         CLEAR DATABASE FILTERS
         -------------------------------------------------------- */

      if (
        target.id === "goalie-clear"
      ) {

        Object.assign(state, {
          query: "",
          season: "current",
          competition: "Regular Season",
          team: "all",
          sort: "sv",
          page: 1
        });

        database(
          document.querySelector(
            "#main-content"
          )
        );

        return;
      }

      /* --------------------------------------------------------
         RETRY DATA LOAD
         -------------------------------------------------------- */

      if (
        target.id === "goalie-retry"
      ) {

        pending = null;
        state.status = "idle";

        render(
          location.hash.slice(1),
          document.querySelector(
            "#main-content"
          )
        );
      }
    }
  );

  /* ============================================================
     26. FILTER CHANGE EVENTS
     ============================================================ */

  document.addEventListener(
    "change",
    event => {

      const keys = {
        "goalie-season": "season",
        "goalie-competition": "competition",
        "goalie-team": "team",
        "goalie-sort": "sort",

        "goalie-profile-season":
          "profileSeason",

        "goalie-compare-season-a":
          "compareSeasonA",

        "goalie-compare-season-b":
          "compareSeasonB"
      };

      const key = keys[
        event.target.id
      ];

      if (!key) return;

      state[key] =
        event.target.value;

      const page =
        location.hash.slice(1);

      if (page === "goalies") {

        state.page = 1;
        results();

      } else {

        render(
          page,
          document.querySelector(
            "#main-content"
          )
        );
      }
    }
  );

  /* ============================================================
     27. PUBLIC API
     ============================================================ */

  window.IceIndexGoalies = {

    load,

    render,

    inspect: () => ({
      status: state.status,
      goalies: state.people.length,
      records: state.records.length,
      currentSeason: state.currentSeason,
      selectedProfile: state.profile,
      compareA: state.compareA,
      compareB: state.compareB
    })
  };

  console.info(
    "IceIndex independent OHL goaltender engine v0.7.0 beta ready."
  );

})();

/* ============================================================
   END OF FILE
   js/ohl-goalies.js
   ============================================================ */