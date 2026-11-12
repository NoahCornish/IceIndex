
"use strict";

/* ============================================================
   ICEINDEX
   VERSION 0.7.0
   FILE: js/ohl-data.js

   INDEPENDENT OHL SKATER DATA ENGINE

   Data sources:
     data/ohl/current/skater_stats.csv
     data/processed/ohl/player_directory.csv
     data/processed/ohl/player_seasons.csv

   Features:
     - Current regular-season statistics
     - Historical regular-season statistics
     - Historical playoff statistics
     - Player directory and headshots
     - Player identity reconciliation
     - Season normalization
     - Competition normalization
     - CSV caching and retry handling
     - Duplicate record protection

   Public API:
     window.loadOHLCurrent()
     window.loadOHLHistory(progressCallback)
     window.IceIndexData

   New playoff API:
     IceIndexData.loadPlayoffs()
     IceIndexData.loadAllHistory()
     IceIndexData.loadHistory({
       competition: "playoffs"
     })

   ============================================================ */

(function () {

  /* ============================================================
     01. CONFIGURATION
     ============================================================ */

  const CONFIG = Object.freeze({
    version: "0.7.0",

    repository: "NoahCornish/IceIndex",
    branch: "main",

    currentPath:
      "data/ohl/current/skater_stats.csv",

    directoryPath:
      "data/processed/ohl/player_directory.csv",

    historicalPath:
      "data/processed/ohl/player_seasons.csv",

    currentTimeout: 15000,
    directoryTimeout: 15000,
    historyTimeout: 45000,

    retryCount: 1,

    currentCacheMs: 5 * 60 * 1000,
    directoryCacheMs: 24 * 60 * 60 * 1000,
    historyCacheMs: 24 * 60 * 60 * 1000,

    cacheVersion: "iceindex-v0.7.0"
  });

  /* ============================================================
     02. DATA SOURCE
     ============================================================ */

  const CUSTOM_BASE =
    typeof window.ICEINDEX_DATA_BASE === "string"
      ? window.ICEINDEX_DATA_BASE.trim()
      : "";

  const DEFAULT_BASE = new URL(
    "../",
    document.currentScript?.src ||
      window.location.href
  ).href;

  const DATA_BASE = CUSTOM_BASE
    ? CUSTOM_BASE.replace(/\/+$/, "") + "/"
    : DEFAULT_BASE;

  function dataURL(path) {
    return DATA_BASE +
      String(path || "").replace(/^\/+/, "");
  }

  function currentURL() {
    return dataURL(CONFIG.currentPath);
  }

  function directoryURL() {
    return dataURL(CONFIG.directoryPath);
  }

  function archiveURL() {
    return dataURL(CONFIG.historicalPath);
  }

  function historicalURL() {
    return archiveURL();
  }

  /* ============================================================
     03. MEMORY CACHE
     ============================================================ */

  const memoryCache = new Map();
  const pendingRequests = new Map();

  function cacheKey(url) {
    return CONFIG.cacheVersion + ":" + url;
  }

  function readMemory(url, ttl) {
    const key = cacheKey(url);
    const entry = memoryCache.get(key);

    if (!entry) return null;

    if (Date.now() - entry.time > ttl) {
      memoryCache.delete(key);
      return null;
    }

    return entry.value;
  }

  function writeMemory(url, value) {
    memoryCache.set(cacheKey(url), {
      time: Date.now(),
      value
    });

    return value;
  }

  /* ============================================================
     04. FETCH WITH RETRY
     ============================================================ */

  function sleep(ms) {
    return new Promise(resolve =>
      setTimeout(resolve, ms)
    );
  }

  async function fetchTextOnce(url, timeout) {
    const controller = new AbortController();

    const timer = setTimeout(
      () => controller.abort(),
      timeout
    );

    try {
      const response = await fetch(url, {
        method: "GET",
        credentials: "omit",
        signal: controller.signal
      });

      if (!response.ok) {
        const error = new Error(
          "HTTP " + response.status + ": " + url
        );

        error.status = response.status;
        throw error;
      }

      return await response.text();

    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchText(
    url,
    {
      ttl = CONFIG.historyCacheMs,
      timeout = CONFIG.historyTimeout,
      retries = CONFIG.retryCount
    } = {}
  ) {
    const cached = readMemory(url, ttl);

    if (cached !== null) {
      return cached;
    }

    const key = cacheKey(url);

    if (pendingRequests.has(key)) {
      return pendingRequests.get(key);
    }

    const promise = (async () => {
      let lastError;

      for (
        let attempt = 0;
        attempt <= retries;
        attempt++
      ) {
        try {
          const text = await fetchTextOnce(
            url,
            timeout
          );

          return writeMemory(url, text);

        } catch (error) {
          lastError = error;

          if (error.status === 404) {
            break;
          }

          if (attempt < retries) {
            await sleep(
              250 * Math.pow(2, attempt)
            );
          }
        }
      }

      throw lastError;
    })();

    pendingRequests.set(key, promise);

    try {
      return await promise;

    } finally {
      pendingRequests.delete(key);
    }
  }

  /* ============================================================
     05. CSV PARSER
     ============================================================ */

  function parseCSV(text) {
    if (!text) return [];

    const source = String(text)
      .replace(/^\uFEFF/, "");

    const rows = [];

    let row = [];
    let fieldValue = "";
    let quoted = false;

    for (
      let i = 0;
      i < source.length;
      i++
    ) {
      const char = source[i];

      if (char === '"') {
        if (
          quoted &&
          source[i + 1] === '"'
        ) {
          fieldValue += '"';
          i++;
        } else {
          quoted = !quoted;
        }

        continue;
      }

      if (char === "," && !quoted) {
        row.push(fieldValue);
        fieldValue = "";
        continue;
      }

      if (
        (char === "\n" || char === "\r") &&
        !quoted
      ) {
        if (
          char === "\r" &&
          source[i + 1] === "\n"
        ) {
          i++;
        }

        row.push(fieldValue);

        if (
          row.some(
            value => value.trim() !== ""
          )
        ) {
          rows.push(row);
        }

        row = [];
        fieldValue = "";
        continue;
      }

      fieldValue += char;
    }

    row.push(fieldValue);

    if (
      row.some(
        value => value.trim() !== ""
      )
    ) {
      rows.push(row);
    }

    if (!rows.length) return [];

    const headers = rows.shift().map(
      value => value.trim()
    );

    return rows.map(values => {
      const result = {};

      headers.forEach(
        (header, index) => {
          result[header] =
            values[index] ?? "";
        }
      );

      return result;
    });
  }

  /* ============================================================
     06. FIELD UTILITIES
     ============================================================ */

  function normalizedFieldName(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function field(row, ...names) {
    if (!row) return "";

    for (const name of names) {
      const value = row[name];

      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
      ) {
        return value;
      }
    }

    const lookup = new Map();

    for (
      const [key, value]
      of Object.entries(row)
    ) {
      lookup.set(
        normalizedFieldName(key),
        value
      );
    }

    for (const name of names) {
      const value = lookup.get(
        normalizedFieldName(name)
      );

      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
      ) {
        return value;
      }
    }

    return "";
  }

  function number(value) {
    if (
      value === null ||
      value === undefined ||
      String(value).trim() === ""
    ) {
      return null;
    }

    const cleaned = String(value)
      .trim()
      .replace(/,/g, "");

    if (
      cleaned === "-" ||
      cleaned === "—" ||
      /^n\/a$/i.test(cleaned)
    ) {
      return null;
    }

    const result = Number(cleaned);

    return Number.isFinite(result)
      ? result
      : null;
  }

  /* ============================================================
     07. NAME NORMALIZATION
     ============================================================ */

  function normalizeName(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function displayName(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ");
  }

  /* ============================================================
     08. DATE NORMALIZATION
     ============================================================ */

  function validISODate(year, month, day) {
    if (
      year < 1900 ||
      year > 2100 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return "";
    }

    const date = new Date(
      Date.UTC(year, month - 1, day)
    );

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return "";
    }

    return [
      String(year).padStart(4, "0"),
      String(month).padStart(2, "0"),
      String(day).padStart(2, "0")
    ].join("-");
  }

  function normalizeBirth(value) {
    const input = String(
      value ?? ""
    ).trim();

    if (!input) return "";

    let match = input.match(
      /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/
    );

    if (match) {
      return validISODate(
        Number(match[1]),
        Number(match[2]),
        Number(match[3])
      );
    }

    match = input.match(
      /^(\d{4})(\d{2})(\d{2})$/
    );

    if (match) {
      return validISODate(
        Number(match[1]),
        Number(match[2]),
        Number(match[3])
      );
    }

    match = input.match(
      /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/
    );

    if (match) {
      const first = Number(match[1]);
      const second = Number(match[2]);

      return validISODate(
        Number(match[3]),
        first > 12 ? second : first,
        first > 12 ? first : second
      );
    }

    return "";
  }

  /* ============================================================
     09. PLAYER ID AND HEADSHOTS
     ============================================================ */

  function normalizePlayerID(value) {
    const id = String(
      value ?? ""
    ).trim();

    return /^\d+$/.test(id)
      ? id
      : "";
  }

  function hockeyTechPhoto(playerID) {
    const id = normalizePlayerID(
      playerID
    );

    if (!id) return "";

    return (
      "https://assets.leaguestat.com/ohl/240x240/" +
      id +
      ".jpg"
    );
  }

  function normalizePhoto(value, playerID) {
    const photo = String(
      value ?? ""
    ).trim();

    if (/^https:\/\//i.test(photo)) {
      return photo;
    }

    if (/^http:\/\//i.test(photo)) {
      return photo.replace(
        /^http:/i,
        "https:"
      );
    }

    if (photo.startsWith("//")) {
      return "https:" + photo;
    }

    return hockeyTechPhoto(playerID);
  }

  /* ============================================================
     10. PLAYER DIRECTORY
     ============================================================ */

  let directoryPromise = null;

  let directoryIndex = {
    byID: new Map(),
    byNameBirth: new Map(),
    byUniqueName: new Map(),
    count: 0
  };

  function nameBirthKey(name, birth) {
    const normalized = normalizeName(name);
    const date = normalizeBirth(birth);

    return normalized && date
      ? normalized + "|" + date
      : "";
  }

  function buildDirectory(rows) {
    const byID = new Map();
    const byNameBirth = new Map();
    const nameCandidates = new Map();

    for (const row of rows) {
      const id = normalizePlayerID(
        field(
          row,
          "PlayerID",
          "PlayerId",
          "ID"
        )
      );

      const name = displayName(
        field(
          row,
          "PlayerName",
          "Name",
          "FullName"
        )
      );

      const birth = normalizeBirth(
        field(
          row,
          "BirthDate",
          "BD",
          "DOB"
        )
      );

      const position = field(
        row,
        "Position",
        "Pos"
      );

      const photo = normalizePhoto(
        field(
          row,
          "PhotoURL",
          "HeadshotURL"
        ),
        id
      );

      if (!id && !name) {
        continue;
      }

      const entry = {
        id,
        name,
        birth,
        position,
        photo
      };

      if (id) {
        byID.set(id, entry);
      }

      const key = nameBirthKey(
        name,
        birth
      );

      if (key) {
        if (!byNameBirth.has(key)) {
          byNameBirth.set(
            key,
            entry
          );
        } else {
          const previous =
            byNameBirth.get(key);

          if (
            previous &&
            previous.id !== id
          ) {
            byNameBirth.set(
              key,
              null
            );
          }
        }
      }

      const normalized =
        normalizeName(name);

      if (normalized) {
        if (
          !nameCandidates.has(
            normalized
          )
        ) {
          nameCandidates.set(
            normalized,
            new Map()
          );
        }

        nameCandidates
          .get(normalized)
          .set(
            id || "birth:" + birth,
            entry
          );
      }
    }

    const byUniqueName = new Map();

    for (
      const [name, candidates]
      of nameCandidates
    ) {
      if (candidates.size === 1) {
        byUniqueName.set(
          name,
          [...candidates.values()][0]
        );
      }
    }

    directoryIndex = {
      byID,
      byNameBirth,
      byUniqueName,
      count: rows.length
    };

    return directoryIndex;
  }

  async function loadDirectory() {
    if (directoryPromise) {
      return directoryPromise;
    }

    directoryPromise = (async () => {
      try {
        const text = await fetchText(
          directoryURL(),
          {
            ttl: CONFIG.directoryCacheMs,
            timeout: CONFIG.directoryTimeout
          }
        );

        const rows = parseCSV(text);

        if (!rows.length) {
          throw new Error(
            "Player directory is empty."
          );
        }

        return buildDirectory(rows);

      } catch (error) {
        console.warn(
          "IceIndex: player directory unavailable.",
          error
        );

        return directoryIndex;
      }
    })();

    return directoryPromise;
  }

  function directoryMatch(
    name,
    birth,
    playerID
  ) {
    const id = normalizePlayerID(
      playerID
    );

    if (
      id &&
      directoryIndex.byID.has(id)
    ) {
      return directoryIndex.byID.get(id);
    }

    const key = nameBirthKey(
      name,
      birth
    );

    if (
      key &&
      directoryIndex.byNameBirth.has(key)
    ) {
      return directoryIndex.byNameBirth.get(key);
    }

    const candidate =
      directoryIndex.byUniqueName.get(
        normalizeName(name)
      );

    if (!candidate) return null;

    const normalizedDOB =
      normalizeBirth(birth);

    if (
      normalizedDOB &&
      candidate.birth &&
      normalizedDOB !== candidate.birth
    ) {
      return null;
    }

    return candidate;
  }

  function playerKey(
    name,
    birth,
    playerID
  ) {
    const id = normalizePlayerID(
      playerID
    );

    const matched = directoryMatch(
      name,
      birth,
      id
    );

    const canonicalName =
      normalizeName(
        matched?.name || name
      );

    const canonicalBirth =
      normalizeBirth(
        matched?.birth || birth
      );

    if (
      canonicalName &&
      canonicalBirth
    ) {
      return (
        "person:" +
        canonicalName +
        "|" +
        canonicalBirth
      );
    }

    if (matched?.id) {
      return "playerid:" + matched.id;
    }

    if (id) {
      return "playerid:" + id;
    }

    return "name:" + canonicalName;
  }

  /* ============================================================
     11. SEASON UTILITIES
     ============================================================ */

  function seasonString(endYear) {
    const start = endYear - 1;

    return (
      start +
      "-" +
      String(endYear).slice(-2)
    );
  }

  function parseSeason(value) {
    const input = String(
      value ?? ""
    ).trim();

    if (!input) return null;

    let match = input.match(
      /^(\d{4})\s+Season$/i
    );

    if (match) {
      const end = Number(match[1]);

      return {
        season: seasonString(end),
        endYear: end
      };
    }

    match = input.match(
      /^(\d{4})[-/](\d{2})$/
    );

    if (match) {
      const start = Number(match[1]);
      const shortEnd = Number(match[2]);

      let end =
        Math.floor(start / 100) * 100 +
        shortEnd;

      if (end <= start) {
        end += 100;
      }

      return {
        season: seasonString(end),
        endYear: end
      };
    }

    match = input.match(
      /^(\d{4})[-/](\d{4})$/
    );

    if (match) {
      const end = Number(match[2]);

      return {
        season: seasonString(end),
        endYear: end
      };
    }

    match = input.match(
      /^(\d{4})$/
    );

    if (match) {
      const end = Number(match[1]);

      return {
        season: seasonString(end),
        endYear: end
      };
    }

    return null;
  }

  function inferredCurrentEndYear() {
    const now = new Date();

    return now.getUTCMonth() >= 6
      ? now.getUTCFullYear() + 1
      : now.getUTCFullYear();
  }

  function normalizeTeam(value) {
    return String(value ?? "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function normalizePosition(value) {
    const position = String(value ?? "")
      .trim()
      .toUpperCase();

    const known = {
      "CENTER": "C",
      "CENTRE": "C",
      "LEFT WING": "LW",
      "RIGHT WING": "RW",
      "DEFENCE": "D",
      "DEFENSE": "D",
      "DEFENCEMAN": "D",
      "DEFENSEMAN": "D"
    };

    return known[position] || position;
  }

  /* ============================================================
     12. COMPETITION NORMALIZATION
     ============================================================ */

  function normalizeCompetition(value) {
    const input = String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");

    if (
      input.includes("playoff") ||
      input.includes("postseason") ||
      input.includes("post season")
    ) {
      return "playoffs";
    }

    if (
      input.includes("regular") ||
      input === "season" ||
      input === "reg" ||
      input === "rs"
    ) {
      return "regular";
    }

    return input;
  }

  /* ============================================================
     13. NORMALIZE STATISTICAL RECORD
     ============================================================ */

  function normalizeRecord(
    row,
    {
      endYear = null,
      source = "history"
    } = {}
  ) {
    if (!row) return null;

    const rawID = normalizePlayerID(
      field(
        row,
        "PlayerID",
        "PlayerId",
        "ID"
      )
    );

    const rawName = displayName(
      field(
        row,
        "PlayerName",
        "Name",
        "FullName",
        "Player",
        "Skater"
      )
    );

    const rawBirth = normalizeBirth(
      field(
        row,
        "BirthDate",
        "BD",
        "DOB"
      )
    );

    const matched = directoryMatch(
      rawName,
      rawBirth,
      rawID
    );

    const id =
      rawID ||
      matched?.id ||
      "";

    const name =
      rawName ||
      matched?.name ||
      "";

    if (!name) return null;

    const birth =
      rawBirth ||
      matched?.birth ||
      "";

    const photo = normalizePhoto(
      field(
        row,
        "PhotoURL",
        "HeadshotURL"
      ) ||
      matched?.photo ||
      "",
      id
    );

    const seasonField = parseSeason(
      field(
        row,
        "HockeySeason",
        "Season",
        "SeasonName",
        "SeasonLabel",
        "Year"
      )
    );

    const resolvedEndYear =
      Number(endYear) ||
      seasonField?.endYear ||
      inferredCurrentEndYear();

    const competition =
      normalizeCompetition(
        field(
          row,
          "Competition",
          "SeasonType",
          "Type"
        )
      ) ||
      (
        source === "current"
          ? "regular"
          : ""
      );

    const gp = number(
      field(
        row,
        "GamesPlayed",
        "GP",
        "Games"
      )
    );

    const g = number(
      field(
        row,
        "Goals",
        "G"
      )
    );

    const a = number(
      field(
        row,
        "Assists",
        "A"
      )
    );

    const rawPoints = number(
      field(
        row,
        "Points",
        "PTS",
        "P"
      )
    );

    const pts = rawPoints !== null
      ? rawPoints
      : g !== null && a !== null
        ? g + a
        : null;

    const ppg = number(
      field(
        row,
        "PowerPlayGoals",
        "PPG"
      )
    );

    const ppa = number(
      field(
        row,
        "PowerPlayAssists",
        "PPA"
      )
    );

    const rawPPP = number(
      field(
        row,
        "PowerPlayPoints",
        "PPP"
      )
    );

    const ppp = rawPPP !== null
      ? rawPPP
      : ppg !== null && ppa !== null
        ? ppg + ppa
        : null;

    const shg = number(
      field(
        row,
        "ShorthandedGoals",
        "ShortHandedGoals",
        "SHG"
      )
    );

    const sha = number(
      field(
        row,
        "ShorthandedAssists",
        "ShortHandedAssists",
        "SHA"
      )
    );

    const rawSHPTS = number(
      field(
        row,
        "ShorthandedPoints",
        "ShortHandedPoints",
        "SHPTS"
      )
    );

    const shpts = rawSHPTS !== null
      ? rawSHPTS
      : shg !== null && sha !== null
        ? shg + sha
        : null;

    const record = {
      key: playerKey(
        name,
        birth,
        id
      ),

      id,
      name,
      birth,
      photo,

      position: normalizePosition(
        field(
          row,
          "Position",
          "Pos"
        ) ||
        matched?.position ||
        ""
      ),

      team: normalizeTeam(
        field(
          row,
          "TeamName",
          "Team",
          "Club"
        )
      ),

      season: seasonString(
        resolvedEndYear
      ),

      endYear: resolvedEndYear,
      source,
      competition,

      gp,
      g,
      a,
      pts,

      plusMinus: number(
        field(
          row,
          "PlusMinus",
          "Plus/Minus",
          "+/-",
          "PM"
        )
      ),

      ppg,
      ppa,
      ppp,

      shg,
      sha,
      shpts,

      gwg: number(
        field(
          row,
          "GameWinningGoals",
          "GWG"
        )
      ),

      eng: number(
        field(
          row,
          "EmptyNetGoals",
          "ENG"
        )
      ),

      pim: number(
        field(
          row,
          "PIM",
          "PenaltyMinutes"
        )
      ),

      shots: number(
        field(
          row,
          "Shots",
          "SOG",
          "ShotsOnGoal"
        )
      )
    };

    Object.defineProperty(
      record,
      "_raw",
      {
        value: row,
        enumerable: false
      }
    );

    return record;
  }

  function normalizeRows(
    rows,
    options = {}
  ) {
    const output = [];

    for (const row of rows) {
      const record = normalizeRecord(
        row,
        options
      );

      if (record) {
        output.push(record);
      }
    }

    return output;
  }

  /* ============================================================
     14. RECORD RECONCILIATION
     ============================================================ */

  const STAT_FIELDS = [
    "gp",
    "g",
    "a",
    "pts",
    "plusMinus",
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

  function hasStatistics(record) {
    return STAT_FIELDS.some(
      key => record[key] !== null
    );
  }

  function completeness(record) {
    return STAT_FIELDS.reduce(
      (score, key) =>
        score + (
          record[key] !== null ? 1 : 0
        ),
      0
    );
  }

  function recordIdentity(record) {
    return [
      record.key,
      record.season,
      record.competition,
      normalizeName(record.team)
    ].join("|");
  }

  function statisticalGroup(record) {
    return [
      record.key,
      record.season,
      record.competition
    ].join("|");
  }

  function chooseRecord(previous, incoming) {
    if (!previous) return incoming;

    const oldScore =
      completeness(previous);

    const newScore =
      completeness(incoming);

    if (newScore > oldScore) {
      return incoming;
    }

    if (oldScore > newScore) {
      return previous;
    }

    if (
      incoming.source === "current" &&
      previous.source !== "current"
    ) {
      return incoming;
    }

    return previous;
  }

  function reconcileRecords(records) {
    const merged = new Map();

    for (const record of records) {
      if (
        !record ||
        !record.key ||
        !record.season ||
        !["regular", "playoffs"].includes(
          record.competition
        )
      ) {
        continue;
      }

      const key = recordIdentity(
        record
      );

      merged.set(
        key,
        chooseRecord(
          merged.get(key),
          record
        )
      );
    }

    let output = [...merged.values()];

    const populatedGroups = new Set(
      output
        .filter(hasStatistics)
        .map(statisticalGroup)
    );

    output = output.filter(record => {
      if (hasStatistics(record)) {
        return true;
      }

      return !populatedGroups.has(
        statisticalGroup(record)
      );
    });

    output = output.filter(
      hasStatistics
    );

    output.sort(
      (a, b) =>
        a.endYear - b.endYear ||
        a.name.localeCompare(b.name) ||
        a.competition.localeCompare(
          b.competition
        )
    );

    return output;
  }

  /* ============================================================
     15. CURRENT SEASON LOADER
     ============================================================ */

  let currentPromise = null;

  async function loadOHLCurrent() {
    if (currentPromise) {
      return currentPromise;
    }

    currentPromise = (async () => {
      const started = performance.now();

      const skatersTask = fetchText(
        currentURL(),
        {
          ttl: CONFIG.currentCacheMs,
          timeout: CONFIG.currentTimeout
        }
      );

      const directoryTask =
        loadDirectory();

      const text = await skatersTask;
      const rows = parseCSV(text);

      if (!rows.length) {
        throw new Error(
          "IceIndex current skater CSV is empty."
        );
      }

      await directoryTask;

      const detectedSeason = rows
        .map(row =>
          parseSeason(
            field(
              row,
              "HockeySeason",
              "Season",
              "SeasonName",
              "Year"
            )
          )
        )
        .find(Boolean);

      const endYear =
        detectedSeason?.endYear ||
        inferredCurrentEndYear();

      const records = normalizeRows(
        rows,
        {
          endYear,
          source: "current"
        }
      ).map(record => ({
        ...record,
        competition: "regular"
      }));

      if (!records.length) {
        throw new Error(
          "IceIndex could not normalize current skater records."
        );
      }

      const cleanedRecords =
        reconcileRecords(records);

      const elapsedMs = Math.round(
        performance.now() - started
      );

      console.info(
        "IceIndex: loaded " +
        cleanedRecords.length +
        " current skaters in " +
        elapsedMs +
        " ms."
      );

      return {
        season: seasonString(endYear),
        endYear,
        records: cleanedRecords,
        directoryCount:
          directoryIndex.count,
        elapsedMs,
        source: currentURL(),
        competition: "regular"
      };
    })();

    try {
      return await currentPromise;

    } catch (error) {
      currentPromise = null;
      throw error;
    }
  }

  /* ============================================================
     16. HISTORICAL DATABASE LOADER
     ============================================================ */

  let historyPromise = null;
  let allHistoryPromise = null;

  const historyListeners = new Set();

  function emitHistoryProgress(status) {
    for (
      const listener
      of historyListeners
    ) {
      try {
        listener(status);

      } catch (error) {
        console.warn(
          "IceIndex history progress callback error:",
          error
        );
      }
    }
  }

  function historicalYearsFromRecords(records) {
    return [
      ...new Set(
        records.map(
          record => record.endYear
        )
      )
    ].sort(
      (a, b) => a - b
    );
  }

  /* ============================================================
     17. ALL HISTORICAL COMPETITIONS
     ============================================================ */

  async function loadAllOHLHistory() {
    if (allHistoryPromise) {
      return allHistoryPromise;
    }

    allHistoryPromise = (async () => {
      const started = performance.now();

      await loadDirectory();

      const text = await fetchText(
        archiveURL(),
        {
          ttl: CONFIG.historyCacheMs,
          timeout: CONFIG.historyTimeout
        }
      );

      const rows = parseCSV(text);

      if (!rows.length) {
        throw new Error(
          "IceIndex historical player_seasons.csv is empty."
        );
      }

      const normalized = [];

      let invalidRecords = 0;
      let unknownCompetition = 0;

      for (const row of rows) {
        const season = parseSeason(
          field(
            row,
            "HockeySeason",
            "Season",
            "SeasonName",
            "SeasonLabel",
            "Year"
          )
        );

        if (!season) {
          invalidRecords++;
          continue;
        }

        const competition =
          normalizeCompetition(
            field(
              row,
              "Competition",
              "SeasonType",
              "Type"
            )
          );

        if (
          competition !== "regular" &&
          competition !== "playoffs"
        ) {
          unknownCompetition++;
          continue;
        }

        const record = normalizeRecord(
          row,
          {
            endYear: season.endYear,
            source: "history"
          }
        );

        if (!record) {
          invalidRecords++;
          continue;
        }

        record.competition =
          competition;

        normalized.push(record);
      }

      const records =
        reconcileRecords(normalized);

      const regularRecords =
        records.filter(
          record =>
            record.competition ===
            "regular"
        );

      const playoffRecords =
        records.filter(
          record =>
            record.competition ===
            "playoffs"
        );

      const loaded =
        historicalYearsFromRecords(
          records
        );

      const elapsedMs = Math.round(
        performance.now() - started
      );

      const result = {
        records,
        regularRecords,
        playoffRecords,

        loaded,
        failed: [],
        total: loaded.length,

        source:
          "iceindex-processed-csv",

        elapsedMs,

        counts: {
          regular:
            regularRecords.length,

          playoffs:
            playoffRecords.length,

          total:
            records.length,

          invalid:
            invalidRecords,

          unknownCompetition
        }
      };

      console.info(
        "IceIndex historical skater data loaded.",
        {
          regular:
            regularRecords.length,

          playoffs:
            playoffRecords.length,

          seasons:
            loaded.length,

          invalidRecords,
          unknownCompetition,
          elapsedMs
        }
      );

      return result;
    })();

    try {
      return await allHistoryPromise;

    } catch (error) {
      allHistoryPromise = null;
      throw error;
    }
  }

  /* ============================================================
     18. REGULAR-SEASON HISTORY
     ============================================================ */

  async function loadOHLHistory(
    progressCallback,
    options = {}
  ) {
    if (
      progressCallback &&
      typeof progressCallback === "object"
    ) {
      options = progressCallback;
      progressCallback = null;
    }

    const requested = String(
      options?.competition || "regular"
    ).trim().toLowerCase();

    const competition =
      requested === "all"
        ? "all"
        : normalizeCompetition(
            requested
          );

    if (
      ![
        "regular",
        "playoffs",
        "all"
      ].includes(competition)
    ) {
      throw new Error(
        "Invalid competition: " +
        requested
      );
    }

    if (
      typeof progressCallback ===
      "function"
    ) {
      historyListeners.add(
        progressCallback
      );
    }

    if (
      competition === "regular" &&
      historyPromise
    ) {
      return historyPromise;
    }

    const task = (async () => {
      const started = performance.now();

      emitHistoryProgress({
        total: 1,
        completed: 0,
        loaded: 0,
        failed: 0,
        records: 0
      });

      const all =
        await loadAllOHLHistory();

      /*
        Preserve the existing behavior:

        Current regular-season statistics
        come from the current CSV.

        Historical regular-season statistics
        exclude the current season.

        Playoff records remain available
        independently, including playoffs
        in the current season.
      */

      let records;

      if (competition === "playoffs") {
        records = all.playoffRecords;

      } else {
        const current =
          await loadOHLCurrent();

        const currentEndYear =
          current.endYear;

        const historicalRegular =
          all.regularRecords.filter(
            record =>
              record.endYear <
              currentEndYear
          );

        if (competition === "regular") {
          records = historicalRegular;

        } else {
          records = [
            ...historicalRegular,
            ...all.playoffRecords
          ];
        }
      }

      records = reconcileRecords(
        records
      );

      const loaded =
        historicalYearsFromRecords(
          records
        );

      const elapsedMs = Math.round(
        performance.now() - started
      );

      const result = {
        records,
        loaded,
        failed: [],
        source:
          "iceindex-processed-csv",
        total: loaded.length,
        elapsedMs,
        competition
      };

      emitHistoryProgress({
        total: loaded.length,
        completed: loaded.length,
        loaded: loaded.length,
        failed: 0,
        records: records.length
      });

      return result;
    })();

    if (competition === "regular") {
      historyPromise = task;
    }

    try {
      return await task;

    } catch (error) {
      if (competition === "regular") {
        historyPromise = null;
      }

      throw error;

    } finally {
      historyListeners.clear();
    }
  }

  /* ============================================================
     19. PLAYOFF HISTORY LOADER
     ============================================================ */

  async function loadOHLPlayoffs(
    progressCallback
  ) {
    return loadOHLHistory(
      progressCallback,
      {
        competition: "playoffs"
      }
    );
  }

  /* ============================================================
     20. PLAYER HISTORY HELPERS
     ============================================================ */

  function recordsForPlayer(
    records,
    identity
  ) {
    const requested = String(
      identity ?? ""
    ).trim();

    if (!requested) return [];

    const normalized =
      normalizeName(requested);

    return records.filter(
      record =>
        record.key === requested ||
        record.id === requested ||
        normalizeName(record.name) ===
          normalized
    );
  }

  function sumStat(records, key) {
    const values = records
      .map(record => record[key])
      .filter(
        value =>
          value !== null &&
          value !== undefined
      );

    if (!values.length) {
      return null;
    }

    return values.reduce(
      (total, value) =>
        total + value,
      0
    );
  }

  function aggregateStatistics(records) {
    if (!records.length) return null;

    const latest = [...records].sort(
      (a, b) =>
        b.endYear - a.endYear
    )[0];

    const result = {
      ...latest,

      season: "career",

      seasons: [
        ...new Set(
          records.map(
            record => record.season
          )
        )
      ],

      teams: [
        ...new Set(
          records
            .map(
              record => record.team
            )
            .filter(Boolean)
        )
      ]
    };

    for (const key of STAT_FIELDS) {
      result[key] = sumStat(
        records,
        key
      );
    }

    if (
      result.pts === null &&
      result.g !== null &&
      result.a !== null
    ) {
      result.pts =
        result.g + result.a;
    }

    if (
      result.ppp === null &&
      result.ppg !== null &&
      result.ppa !== null
    ) {
      result.ppp =
        result.ppg + result.ppa;
    }

    if (
      result.shpts === null &&
      result.shg !== null &&
      result.sha !== null
    ) {
      result.shpts =
        result.shg + result.sha;
    }

    result.pointsPerGame =
      result.gp > 0 &&
      result.pts !== null
        ? result.pts / result.gp
        : null;

    result.goalsPerGame =
      result.gp > 0 &&
      result.g !== null
        ? result.g / result.gp
        : null;

    return result;
  }

  /* ============================================================
     21. DEBUG AND INSPECTION
     ============================================================ */

  function inspect() {
    return {
      version: CONFIG.version,
      repository:
        CONFIG.repository,

      dataBase: DATA_BASE,

      currentURL:
        currentURL(),

      directoryURL:
        directoryURL(),

      archiveURL:
        archiveURL(),

      directoryPlayers:
        directoryIndex.count,

      directoryIDs:
        directoryIndex.byID.size,

      directoryNameBirth:
        directoryIndex.byNameBirth.size,

      directoryUniqueNames:
        directoryIndex.byUniqueName.size,

      cachedFiles:
        memoryCache.size,

      pendingRequests:
        pendingRequests.size,

      currentLoaded:
        currentPromise !== null,

      historyLoaded:
        historyPromise !== null,

      allHistoryLoaded:
        allHistoryPromise !== null
    };
  }

  /* ============================================================
     22. PUBLIC API
     ============================================================ */

  window.loadOHLCurrent =
    loadOHLCurrent;

  window.loadOHLHistory =
    loadOHLHistory;

  window.IceIndexData = Object.freeze({
    version: CONFIG.version,
    config: CONFIG,

    // Existing API
    loadCurrent: loadOHLCurrent,
    loadHistory: loadOHLHistory,
    loadDirectory,

    // New playoff API
    loadPlayoffs: loadOHLPlayoffs,
    loadAllHistory: loadAllOHLHistory,

    // Player statistics helpers
    recordsForPlayer,
    aggregateStatistics,

    // Parsing and normalization
    parseCSV,
    normalizeRecord,
    normalizeBirth,
    normalizeName,
    normalizePlayerID,
    normalizeCompetition,
    parseSeason,
    hockeyTechPhoto,
    playerKey,
    seasonString,

    // Data locations and inspection
    historicalURL,
    inspect
  });

  console.info(
    "IceIndex independent OHL data engine v0.7.0 ready — regular season and playoffs supported."
  );

})();

/* ============================================================
   END OF ICEINDEX v0.7.0
   FILE: js/ohl-data.js
   ============================================================ */