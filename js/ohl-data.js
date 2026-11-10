
"use strict";

/* ============================================================
   ICEINDEX
   VERSION 0.2.0
   FILE 4 OF 7 — js/ohl-data.js

   OHL DATA ENGINE

   Compatible with:
     js/app.js — IceIndex v0.2.0
     js/ohl-branding.js

   OHLDataHub source:
     https://github.com/NoahCornish/OHLDataHub

   Data files:
     data/current/skaters.csv
     data/player_directory.csv

     data/historical/YYYY-season/skaters.csv

   Optional optimized archive:
     data/iceindex/archive.json

   Public API:
     window.loadOHLCurrent()
     window.loadOHLHistory(progressCallback)

   ============================================================ */

(function () {

  /* ==========================================================
     01. CONFIGURATION
     ========================================================== */

  const CONFIG = Object.freeze({

    repository:
      "NoahCornish/OHLDataHub",

    branch:
      "main",

    currentPath:
      "data/current/skaters.csv",

    directoryPath:
      "data/player_directory.csv",

    archivePath:
      "data/iceindex/archive.json",

    historicalRoot:
      "data/historical",

    historicalStartYear:
      1997,

    historicalEndYear:
      null,

    historyConcurrency:
      4,

    currentTimeout:
      10000,

    directoryTimeout:
      8000,

    historyTimeout:
      12000,

    retryCount:
      1,

    cacheVersion:
      "iceindex-v0.2.0",

    /*
      Current statistics use a short cache window.

      Historical statistics are substantially
      more stable and can remain cached longer.
    */

    currentCacheMs:
      5 * 60 * 1000,

    directoryCacheMs:
      24 * 60 * 60 * 1000,

    historyCacheMs:
      7 * 24 * 60 * 60 * 1000

  });


  /* ==========================================================
     02. DATA SOURCE URLS
     ========================================================== */

  const RAW_BASE =
    `https://raw.githubusercontent.com/` +
    `${CONFIG.repository}/` +
    `${CONFIG.branch}/`;

  /*
    GitHub Pages and local deployment support.

    If IceIndex is hosted on the same origin as
    the data files, relative URLs can be used.

    Otherwise the public OHLDataHub repository
    is used.

    Set window.ICEINDEX_DATA_BASE before this
    script loads to override the data source.
  */

  const CUSTOM_BASE =
    typeof window.ICEINDEX_DATA_BASE === "string"
      ? window.ICEINDEX_DATA_BASE.trim()
      : "";

  const DATA_BASE =
    CUSTOM_BASE
      ? CUSTOM_BASE.replace(/\/+$/, "") + "/"
      : RAW_BASE;

  function dataURL(path) {
    return (
      DATA_BASE +
      String(path || "").replace(/^\/+/, "")
    );
  }

  function currentURL() {
    return dataURL(CONFIG.currentPath);
  }

  function directoryURL() {
    return dataURL(CONFIG.directoryPath);
  }

  function archiveURL() {
    return dataURL(CONFIG.archivePath);
  }

  function historicalURL(endYear) {
    return dataURL(
      `${CONFIG.historicalRoot}/` +
      `${endYear}-season/skaters.csv`
    );
  }


  /* ==========================================================
     03. SHARED MEMORY CACHE
     ========================================================== */

  const memoryCache = new Map();

  /*
    Pending requests are shared so that two
    consumers requesting the same file do not
    generate duplicate network downloads.
  */

  const pendingRequests = new Map();

  function cacheKey(url) {
    return `${CONFIG.cacheVersion}:${url}`;
  }

  function readMemory(url, ttl) {
    const entry = memoryCache.get(
      cacheKey(url)
    );

    if (!entry) return null;

    if (Date.now() - entry.time > ttl) {
      memoryCache.delete(cacheKey(url));
      return null;
    }

    return entry.value;
  }

  function writeMemory(url, value) {
    memoryCache.set(
      cacheKey(url),
      {
        time: Date.now(),
        value
      }
    );

    return value;
  }


  /* ==========================================================
     04. FETCH WITH TIMEOUT AND RETRY
     ========================================================== */

  function sleep(ms) {
    return new Promise(resolve =>
      setTimeout(resolve, ms)
    );
  }

  async function fetchTextOnce(url, timeout) {
    const controller =
      new AbortController();

    const timer = setTimeout(
      () => controller.abort(),
      timeout
    );

    try {
      const response = await fetch(url, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        signal: controller.signal
      });

      if (!response.ok) {
        const error = new Error(
          `HTTP ${response.status}: ${url}`
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

      let lastError = null;

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

          /*
            A missing historical season is not
            transient. Do not repeatedly request
            a confirmed HTTP 404.
          */

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


  /* ==========================================================
     05. CSV PARSER

     Handles:
       Quoted fields
       Embedded commas
       Escaped quotation marks
       CRLF and LF
       Quoted multiline values
       UTF-8 BOM

     ========================================================== */

  function parseCSV(text) {
    if (!text) return [];

    const source = String(text)
      .replace(/^\uFEFF/, "");

    const rows = [];

    let row = [];
    let field = "";
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
          field += '"';
          i++;
        } else {
          quoted = !quoted;
        }

        continue;
      }

      if (
        char === "," &&
        !quoted
      ) {
        row.push(field);
        field = "";
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

        row.push(field);

        if (
          row.some(value =>
            String(value).trim() !== ""
          )
        ) {
          rows.push(row);
        }

        row = [];
        field = "";

        continue;
      }

      field += char;
    }

    row.push(field);

    if (
      row.some(value =>
        String(value).trim() !== ""
      )
    ) {
      rows.push(row);
    }

    if (!rows.length) {
      return [];
    }

    const headers = rows.shift().map(
      header => String(header).trim()
    );

    return rows.map(values => {
      const result = {};

      headers.forEach((header, index) => {
        result[header] =
          values[index] ?? "";
      });

      return result;
    });
  }


  /* ==========================================================
     06. FIELD NAME NORMALIZATION
     ========================================================== */

  function normalizedFieldName(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function field(row, ...names) {
    if (!row) return "";

    /*
      Try exact names first.
    */

    for (const name of names) {
      if (
        Object.prototype.hasOwnProperty.call(
          row,
          name
        )
      ) {
        const value = row[name];

        if (
          value !== null &&
          value !== undefined &&
          String(value).trim() !== ""
        ) {
          return value;
        }
      }
    }

    /*
      Then match case-insensitively and ignore
      spaces, underscores and punctuation.
    */

    const lookup = new Map();

    for (const [key, value] of
      Object.entries(row)
    ) {
      const normalized =
        normalizedFieldName(key);

      if (!lookup.has(normalized)) {
        lookup.set(normalized, value);
      }
    }

    for (const name of names) {
      const value = lookup.get(
        normalizedFieldName(name)
      );

      if (
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
      ) {
        return value;
      }
    }

    return "";
  }


  /* ==========================================================
     07. NUMBER CONVERSION
     ========================================================== */

  function number(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    const cleaned = String(value)
      .trim()
      .replace(/,/g, "");

    if (
      cleaned === "" ||
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


  /* ==========================================================
     08. NAME NORMALIZATION
     ========================================================== */

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


  /* ==========================================================
     09. BIRTHDATE NORMALIZATION

     Supported examples:
       2007-02-15
       2007/02/15
       02/15/2007
       15/02/2007
       20070215
       ISO datetime
       YYYY-MM-DDT00:00:00

     Ambiguous slash dates use month/day/year
     unless the first component exceeds 12.

     ========================================================== */

  function validDate(year, month, day) {
    if (
      year < 1900 ||
      year > 2100 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return false;
    }

    const date = new Date(
      Date.UTC(year, month - 1, day)
    );

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }

  function isoDate(year, month, day) {
    if (!validDate(year, month, day)) {
      return "";
    }

    return [
      String(year).padStart(4, "0"),
      String(month).padStart(2, "0"),
      String(day).padStart(2, "0")
    ].join("-");
  }

  function normalizeBirth(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    const input = String(value).trim();

    if (!input) return "";

    /*
      YYYY-MM-DD, YYYY/MM/DD,
      or an ISO timestamp.
    */

    let match = input.match(
      /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/
    );

    if (match) {
      return isoDate(
        Number(match[1]),
        Number(match[2]),
        Number(match[3])
      );
    }

    /*
      YYYYMMDD
    */

    match = input.match(
      /^(\d{4})(\d{2})(\d{2})$/
    );

    if (match) {
      return isoDate(
        Number(match[1]),
        Number(match[2]),
        Number(match[3])
      );
    }

    /*
      MM/DD/YYYY or DD/MM/YYYY.
    */

    match = input.match(
      /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/
    );

    if (match) {
      const first = Number(match[1]);
      const second = Number(match[2]);
      const year = Number(match[3]);

      const dayFirst = first > 12;

      return isoDate(
        year,
        dayFirst ? second : first,
        dayFirst ? first : second
      );
    }

    /*
      Do not guess unsupported formats.
      A guessed birthdate can incorrectly
      merge two different players.
    */

    return "";
  }


  /* ==========================================================
     10. PLAYER ID NORMALIZATION
     ========================================================== */

  function normalizePlayerID(value) {
    const id = String(
      value ?? ""
    ).trim();

    if (!id) return "";

    /*
      HockeyTech PlayerIDs are numeric.
      Avoid accepting arbitrary text IDs.
    */

    return /^\d+$/.test(id)
      ? id
      : "";
  }


  /* ==========================================================
     11. HEADSHOT URLS
     ========================================================== */

  function hockeyTechPhoto(playerID) {
    const id = normalizePlayerID(
      playerID
    );

    if (!id) return "";

    return (
      "https://assets.leaguestat.com/" +
      `ohl/240x240/${id}.jpg`
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
      return `https:${photo}`;
    }

    /*
      If PhotoURL is missing or malformed,
      use the numeric PlayerID.
    */

    return hockeyTechPhoto(playerID);
  }


  /* ==========================================================
     12. PLAYER DIRECTORY INDEX

     Three lookup methods:

       PlayerID
       normalized name + birthdate
       unique normalized name

     Name-only matching is allowed only
     when the name is unambiguous.

     ========================================================== */

  let directoryPromise = null;

  let directoryIndex = {
    byID: new Map(),
    byNameBirth: new Map(),
    byUniqueName: new Map(),
    count: 0
  };

  function nameBirthKey(name, birth) {
    const normalizedName =
      normalizeName(name);

    const normalizedDOB =
      normalizeBirth(birth);

    if (
      !normalizedName ||
      !normalizedDOB
    ) {
      return "";
    }

    return (
      normalizedName +
      "|" +
      normalizedDOB
    );
  }

  function buildDirectory(rows) {
    const byID = new Map();
    const byNameBirth = new Map();
    const nameCandidates = new Map();

    for (const row of rows) {
      const name = displayName(
        field(
          row,
          "Name",
          "PlayerName",
          "Player",
          "FullName"
        )
      );

      const id = normalizePlayerID(
        field(
          row,
          "PlayerID",
          "PlayerId",
          "player_id",
          "ID"
        )
      );

      const birth = normalizeBirth(
        field(
          row,
          "BD",
          "BirthDate",
          "Birthdate",
          "DateOfBirth",
          "DOB",
          "Birth"
        )
      );

      const rawPhoto = field(
        row,
        "PhotoURL",
        "PhotoUrl",
        "Photo",
        "Headshot",
        "HeadshotURL",
        "ImageURL"
      );

      if (!name && !id) {
        continue;
      }

      const entry = {
        name,
        id,
        birth,
        photo: normalizePhoto(
          rawPhoto,
          id
        )
      };

      if (id) {
        const existing = byID.get(id);

        if (
          !existing ||
          (
            !existing.photo &&
            entry.photo
          )
        ) {
          byID.set(id, entry);
        }
      }

      const key = nameBirthKey(
        name,
        birth
      );

      if (key) {
        const existing =
          byNameBirth.get(key);

        if (!existing) {
          byNameBirth.set(
            key,
            entry
          );
        } else if (
          existing.id !== entry.id
        ) {
          /*
            Multiple IDs for the same
            name and birthdate are ambiguous.
          */

          byNameBirth.set(
            key,
            null
          );
        }
      }

      const normalized =
        normalizeName(name);

      if (normalized) {
        if (
          !nameCandidates.has(normalized)
        ) {
          nameCandidates.set(
            normalized,
            new Map()
          );
        }

        const candidates =
          nameCandidates.get(normalized);

        const identity =
          id || `birth:${birth}`;

        candidates.set(
          identity,
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
            timeout: CONFIG.directoryTimeout,
            retries: 1
          }
        );

        return buildDirectory(
          parseCSV(text)
        );

      } catch (error) {
        console.warn(
          "IceIndex: player directory unavailable.",
          error
        );

        /*
          Current statistics must still load
          even if the headshot directory fails.
        */

        return directoryIndex;
      }
    })();

    return directoryPromise;
  }


  /* ==========================================================
     13. RESOLVE PLAYER IDENTITY
     ========================================================== */

  function directoryMatch(
    name,
    birth,
    playerID
  ) {
    const id = normalizePlayerID(
      playerID
    );

    const normalizedDOB =
      normalizeBirth(birth);

    const normalizedName =
      normalizeName(name);

    /*
      1. Direct PlayerID match.
    */

    if (
      id &&
      directoryIndex.byID.has(id)
    ) {
      return directoryIndex.byID.get(id);
    }

    /*
      2. Name + birthdate match.
    */

    const combinedKey =
      nameBirthKey(
        name,
        normalizedDOB
      );

    if (
      combinedKey &&
      directoryIndex.byNameBirth.has(
        combinedKey
      )
    ) {
      return (
        directoryIndex.byNameBirth.get(
          combinedKey
        ) || null
      );
    }

    /*
      3. Unique name fallback.

      If the historical record has a DOB,
      reject a directory candidate whose
      DOB explicitly conflicts.
    */

    const candidate =
      directoryIndex.byUniqueName.get(
        normalizedName
      );

    if (!candidate) {
      return null;
    }

    if (
      normalizedDOB &&
      candidate.birth &&
      normalizedDOB !== candidate.birth
    ) {
      return null;
    }

    return candidate;
  }


  /* ==========================================================
     14. STABLE PLAYER KEYS

     Prefer:
       PlayerID-backed canonical identity
       name + DOB
       name-only fallback

     Directory resolution is shared across
     current and historical records.

     ========================================================== */

  function playerKey(
    name,
    birth,
    playerID
  ) {
    const normalizedName =
      normalizeName(name);

    const normalizedDOB =
      normalizeBirth(birth);

    const id = normalizePlayerID(
      playerID
    );

    /*
      Use the directory's canonical name
      and birthdate when possible.

      This allows older records without IDs
      to join the current player career.
    */

    const matched = directoryMatch(
      name,
      normalizedDOB,
      id
    );

    const canonicalName =
      normalizeName(
        matched?.name || name
      );

    const canonicalBirth =
      matched?.birth ||
      normalizedDOB;

    if (
      canonicalName &&
      canonicalBirth
    ) {
      return (
        `person:${canonicalName}|` +
        canonicalBirth
      );
    }

    if (matched?.id) {
      return `playerid:${matched.id}`;
    }

    if (id) {
      return `playerid:${id}`;
    }

    /*
      A name-only key is a last resort.
      It may not uniquely identify a player.
    */

    return `name:${normalizedName}`;
  }


  /* ==========================================================
     15. SEASON UTILITIES
     ========================================================== */

  function seasonString(endYear) {
    const start = endYear - 1;

    return (
      `${start}-` +
      String(endYear).slice(-2)
    );
  }

  function parseSeason(value) {
    const input = String(
      value ?? ""
    ).trim();

    if (!input) return null;

    /*
      2026-27
      2026/27
    */

    let match = input.match(
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

    /*
      2026-2027
    */

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

    /*
      2027
      Interpreted as ending year.
    */

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

    /*
      OHL seasons generally begin in fall.

      July through December:
        ending year = next calendar year

      January through June:
        ending year = current calendar year
    */

    return (
      now.getUTCMonth() >= 6
        ? now.getUTCFullYear() + 1
        : now.getUTCFullYear()
    );
  }


  /* ==========================================================
     16. TEAM AND POSITION NORMALIZATION
     ========================================================== */

  function normalizeTeam(value) {
    return String(
      value ?? ""
    )
      .trim()
      .replace(/\s+/g, " ");
  }

  function normalizePosition(value) {
    const position = String(
      value ?? ""
    )
      .trim()
      .toUpperCase();

    if (!position) return "";

    const known = {
      "CENTER": "C",
      "CENTRE": "C",
      "LEFT WING": "LW",
      "LEFT WINGER": "LW",
      "RIGHT WING": "RW",
      "RIGHT WINGER": "RW",
      "DEFENCE": "D",
      "DEFENSE": "D",
      "DEFENCEMAN": "D",
      "DEFENSEMAN": "D"
    };

    return known[position] ||
      position;
  }


  /* ==========================================================
     17. NORMALIZE STATISTICAL RECORD

     Public record shape expected by app.js:

       key
       id
       name
       birth
       photo
       position
       team
       season
       endYear
       source

       gp, g, a, pts
       ppg, ppa, ppp
       shg, sha, shpts
       gwg, eng
       pim, shots
       plusMinus

     ========================================================== */

  function normalizeRecord(
    row,
    {
      endYear,
      source = "history"
    } = {}
  ) {
    if (!row) return null;

    const name = displayName(
      field(
        row,
        "Name",
        "PlayerName",
        "Player",
        "FullName",
        "Skater"
      )
    );

    if (!name) return null;

    const rawID = normalizePlayerID(
      field(
        row,
        "PlayerID",
        "PlayerId",
        "player_id",
        "ID"
      )
    );

    const rawBirth = normalizeBirth(
      field(
        row,
        "BD",
        "BirthDate",
        "Birthdate",
        "DateOfBirth",
        "DOB",
        "Birth"
      )
    );

    const matched = directoryMatch(
      name,
      rawBirth,
      rawID
    );

    const id =
      rawID ||
      matched?.id ||
      "";

    const birth =
      rawBirth ||
      matched?.birth ||
      "";

    const rawPhoto = field(
      row,
      "PhotoURL",
      "PhotoUrl",
      "Photo",
      "Headshot",
      "HeadshotURL",
      "ImageURL"
    );

    const photo = normalizePhoto(
      rawPhoto ||
      matched?.photo ||
      "",
      id
    );

    const seasonField = parseSeason(
      field(
        row,
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

    const gp = number(
      field(
        row,
        "GP",
        "GamesPlayed",
        "Games"
      )
    );

    const g = number(
      field(
        row,
        "G",
        "Goals"
      )
    );

    const a = number(
      field(
        row,
        "A",
        "Assists"
      )
    );

    const rawPoints = number(
      field(
        row,
        "PTS",
        "Points",
        "P"
      )
    );

    const pts =
      rawPoints !== null
        ? rawPoints
        : (
            g !== null &&
            a !== null
              ? g + a
              : null
          );

    const ppg = number(
      field(
        row,
        "PPG",
        "PowerPlayGoals",
        "PowerplayGoals"
      )
    );

    const ppa = number(
      field(
        row,
        "PPA",
        "PowerPlayAssists",
        "PowerplayAssists"
      )
    );

    const rawPPP = number(
      field(
        row,
        "PPP",
        "PowerPlayPoints",
        "PowerplayPoints"
      )
    );

    const ppp =
      rawPPP !== null
        ? rawPPP
        : (
            ppg !== null &&
            ppa !== null
              ? ppg + ppa
              : null
          );

    const shg = number(
      field(
        row,
        "SHG",
        "ShortHandedGoals",
        "ShorthandedGoals"
      )
    );

    const sha = number(
      field(
        row,
        "SHA",
        "ShortHandedAssists",
        "ShorthandedAssists"
      )
    );

    const rawSHPTS = number(
      field(
        row,
        "SHPTS",
        "SHP",
        "ShortHandedPoints",
        "ShorthandedPoints"
      )
    );

    const shpts =
      rawSHPTS !== null
        ? rawSHPTS
        : (
            shg !== null &&
            sha !== null
              ? shg + sha
              : null
          );

    const normalized = {
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
        )
      ),

      team: normalizeTeam(
        field(
          row,
          "Team",
          "TeamName",
          "Club"
        )
      ),

      season: seasonString(
        resolvedEndYear
      ),

      endYear: resolvedEndYear,

      source,

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
          "GWG",
          "GameWinningGoals"
        )
      ),

      eng: number(
        field(
          row,
          "ENG",
          "EmptyNetGoals"
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

    /*
      Preserve the raw source row for
      future debugging and data extensions.
    */

    Object.defineProperty(
      normalized,
      "_raw",
      {
        value: row,
        enumerable: false
      }
    );

    return normalized;
  }


  /* ==========================================================
     18. NORMALIZE COMPLETE DATASET
     ========================================================== */

  function normalizeRows(
    rows,
    options
  ) {
    const output = [];

    for (const row of rows) {
      const normalized =
        normalizeRecord(
          row,
          options
        );

      if (normalized) {
        output.push(normalized);
      }
    }

    return output;
  }


  /* ==========================================================
     19. CURRENT-SEASON DATA LOADING

     Performance priorities:

       1. Begin skater CSV download immediately.
       2. Begin player directory concurrently.
       3. Share both requests across callers.
       4. Avoid downloading historical CSVs
          before current-season data is ready.
       5. Return normalized records to app.js.

     ========================================================== */

  let currentPromise = null;

  async function loadOHLCurrent() {
    if (currentPromise) {
      return currentPromise;
    }

    currentPromise = (async () => {

      const started =
        performance.now();

      /*
        Start both requests concurrently.
      */

      const skatersPromise = fetchText(
        currentURL(),
        {
          ttl: CONFIG.currentCacheMs,
          timeout: CONFIG.currentTimeout,
          retries: 1
        }
      );

      const directoryTask =
        loadDirectory();

      /*
        Current statistics are required.
        Directory enrichment is optional.
      */

      const text =
        await skatersPromise;

      const rawRows =
        parseCSV(text);

      if (!rawRows.length) {
        throw new Error(
          "Current OHL skater CSV is empty."
        );
      }

      /*
        Directory loading has a separate,
        bounded timeout. Waiting for it allows
        stable PlayerID, DOB and photo matching.
      */

      await directoryTask;

      const csvSeason =
        rawRows
          .map(row =>
            parseSeason(
              field(
                row,
                "Season",
                "SeasonName",
                "SeasonLabel",
                "Year"
              )
            )
          )
          .find(Boolean);

      const endYear =
        csvSeason?.endYear ||
        inferredCurrentEndYear();

      const records = normalizeRows(
        rawRows,
        {
          endYear,
          source: "current"
        }
      );

      const elapsed =
        Math.round(
          performance.now() - started
        );

      console.info(
        `IceIndex: loaded ${records.length} ` +
        `current skaters in ${elapsed} ms.`
      );

      return {
        season: seasonString(
          endYear
        ),

        endYear,
        records,

        directoryCount:
          directoryIndex.count,

        elapsedMs:
          elapsed,

        source:
          currentURL()
      };

    })();

    try {
      return await currentPromise;

    } catch (error) {
      /*
        Allow the application to retry
        after a transient loading failure.
      */

      currentPromise = null;

      throw error;
    }
  }


  /* ==========================================================
     20. HISTORICAL SEASON RANGE

     Historical directory naming:

       1997-season/skaters.csv
       1998-season/skaters.csv
       ...
       2026-season/skaters.csv

     Do not include the current season here.
     That avoids duplicate current-year rows.

     ========================================================== */

  function historicalYears() {
    const current =
      inferredCurrentEndYear();

    const finalYear =
      CONFIG.historicalEndYear ||
      current - 1;

    const years = [];

    for (
      let year =
        CONFIG.historicalStartYear;
      year <= finalYear;
      year++
    ) {
      years.push(year);
    }

    return years;
  }


  /* ==========================================================
     21. LOAD ONE HISTORICAL SEASON
     ========================================================== */

  async function loadHistoricalSeason(
    endYear
  ) {
    const url =
      historicalURL(endYear);

    const text = await fetchText(
      url,
      {
        ttl: CONFIG.historyCacheMs,
        timeout: CONFIG.historyTimeout,
        retries: 1
      }
    );

    const rows =
      parseCSV(text);

    if (!rows.length) {
      throw new Error(
        `Historical season ${endYear} is empty.`
      );
    }

    return normalizeRows(
      rows,
      {
        endYear,
        source: "history"
      }
    );
  }


  /* ==========================================================
     22. ARCHIVE PROGRESS CALLBACK
     ========================================================== */

  function emitProgress(
    callback,
    state
  ) {
    if (
      typeof callback !== "function"
    ) {
      return;
    }

    try {
      callback({
        total: state.total,
        completed: state.completed,
        loaded: state.loaded.length,
        failed: state.failed.length,
        records: state.records.length
      });

    } catch (error) {
      /*
        A UI callback should never break
        the underlying data download.
      */

      console.warn(
        "IceIndex progress callback error:",
        error
      );
    }
  }


  /* ==========================================================
     23. OPTIONAL PREBUILT ARCHIVE

     Supported JSON formats:

     A. Array of normalized or raw rows.

     B. Object:
          {
            "records": [...],
            "loaded": [1998, 1999],
            "failed": []
          }

     C. Object:
          {
            "seasons": {
              "1998": [...],
              "1999": [...]
            }
          }

     This archive is optional.

     If unavailable, the loader falls back
     to individual historical CSV files.

     ========================================================== */

  function normalizeArchiveJSON(
    payload
  ) {
    if (!payload) {
      return null;
    }

    const records = [];
    const loaded = [];
    const failed = [];

    if (Array.isArray(payload)) {
      for (const row of payload) {
        const season = parseSeason(
          field(
            row,
            "Season",
            "season",
            "Year",
            "endYear"
          )
        );

        const endYear =
          Number(row.endYear) ||
          season?.endYear;

        if (!endYear) continue;

        const normalized =
          normalizeRecord(
            row,
            {
              endYear,
              source: "history"
            }
          );

        if (normalized) {
          records.push(normalized);
        }

        loaded.push(endYear);
      }

    } else if (
      Array.isArray(payload.records)
    ) {
      for (const row of payload.records) {
        const season = parseSeason(
          field(
            row,
            "Season",
            "season",
            "Year",
            "endYear"
          )
        );

        const endYear =
          Number(row.endYear) ||
          season?.endYear;

        if (!endYear) continue;

        const normalized =
          normalizeRecord(
            row,
            {
              endYear,
              source: "history"
            }
          );

        if (normalized) {
          records.push(normalized);
        }
      }

      if (
        Array.isArray(payload.loaded)
      ) {
        loaded.push(
          ...payload.loaded
        );
      }

      if (
        Array.isArray(payload.failed)
      ) {
        failed.push(
          ...payload.failed
        );
      }

    } else if (
      payload.seasons &&
      typeof payload.seasons === "object"
    ) {
      for (
        const [year, rows]
        of Object.entries(
          payload.seasons
        )
      ) {
        const endYear =
          Number(year);

        if (
          !Number.isInteger(endYear) ||
          !Array.isArray(rows)
        ) {
          continue;
        }

        const normalized =
          normalizeRows(
            rows,
            {
              endYear,
              source: "history"
            }
          );

        records.push(
          ...normalized
        );

        loaded.push(
          endYear
        );
      }

    } else {
      return null;
    }

    if (!records.length) {
      return null;
    }

    if (!loaded.length) {
      loaded.push(
        ...new Set(
          records.map(
            record => record.endYear
          )
        )
      );
    }

    return {
      records,
      loaded: [
        ...new Set(
          loaded.map(Number)
        )
      ].sort((a, b) => a - b),

      failed,

      source: "archive-json"
    };
  }

  async function tryPrebuiltArchive() {
    const url =
      archiveURL();

    try {
      const text = await fetchText(
        url,
        {
          ttl: CONFIG.historyCacheMs,
          timeout: CONFIG.historyTimeout,
          retries: 0
        }
      );

      const payload =
        JSON.parse(text);

      return normalizeArchiveJSON(
        payload
      );

    } catch (error) {
      /*
        Missing archive is expected when
        the optional build process has
        not been configured.
      */

      if (error.status !== 404) {
        console.info(
          "IceIndex: prebuilt archive unavailable; " +
          "using historical CSVs."
        );
      }

      return null;
    }
  }


  /* ==========================================================
     24. HISTORICAL CSV WORKER POOL

     Limits simultaneous downloads to
     avoid overwhelming the browser and
     the GitHub raw-content endpoint.

     ========================================================== */

  async function loadCSVArchive(
    callback
  ) {
    const years =
      historicalYears();

    const state = {
      total: years.length,
      completed: 0,
      loaded: [],
      failed: [],
      records: []
    };

    let nextIndex = 0;

    emitProgress(
      callback,
      state
    );

    async function worker() {
      while (true) {
        const index =
          nextIndex++;

        if (
          index >= years.length
        ) {
          return;
        }

        const year =
          years[index];

        try {
          const records =
            await loadHistoricalSeason(
              year
            );

          state.records.push(
            ...records
          );

          state.loaded.push(
            year
          );

        } catch (error) {
          state.failed.push(
            {
              year,
              reason:
                error.message ||
                "Unknown error"
            }
          );

          console.warn(
            `IceIndex: historical season ` +
            `${year} unavailable.`,
            error
          );
        }

        state.completed++;

        emitProgress(
          callback,
          state
        );
      }
    }

    const workerCount =
      Math.min(
        CONFIG.historyConcurrency,
        years.length
      );

    await Promise.all(
      Array.from(
        {
          length: workerCount
        },
        () => worker()
      )
    );

    state.records.sort(
      (a, b) =>
        a.endYear - b.endYear ||
        a.name.localeCompare(
          b.name
        )
    );

    state.loaded.sort(
      (a, b) => a - b
    );

    state.failed.sort(
      (a, b) =>
        a.year - b.year
    );

    return {
      records:
        state.records,

      loaded:
        state.loaded,

      failed:
        state.failed,

      source:
        "historical-csv",

      total:
        state.total
    };
  }


  /* ==========================================================
     25. HISTORICAL ARCHIVE PUBLIC LOADER

     1. Wait for player directory.
     2. Try prebuilt JSON archive.
     3. Fall back to historical CSV files.
     4. Report progress.
     5. Share a single in-flight request.

     ========================================================== */

  let historyPromise = null;

  const historyListeners =
    new Set();

  function broadcastHistoryProgress(
    progress
  ) {
    for (
      const listener
      of historyListeners
    ) {
      try {
        listener(progress);

      } catch (error) {
        console.warn(
          "IceIndex history listener error:",
          error
        );
      }
    }
  }

  async function loadOHLHistory(
    progressCallback
  ) {
    if (
      typeof progressCallback === "function"
    ) {
      historyListeners.add(
        progressCallback
      );
    }

    if (historyPromise) {
      return historyPromise;
    }

    historyPromise = (async () => {

      const started =
        performance.now();

      await loadDirectory();

      /*
        Prefer a single prebuilt archive.
      */

      const prebuilt =
        await tryPrebuiltArchive();

      if (prebuilt) {
        const result = {
          ...prebuilt,

          elapsedMs:
            Math.round(
              performance.now() -
              started
            )
        };

        broadcastHistoryProgress({
          total:
            result.loaded.length,

          completed:
            result.loaded.length,

          loaded:
            result.loaded.length,

          failed:
            result.failed.length,

          records:
            result.records.length
        });

        console.info(
          "IceIndex: historical archive loaded " +
          `from JSON (${result.records.length} records).`
        );

        return result;
      }

      /*
        Fallback:
        Load the historical CSV collection.
      */

      const result =
        await loadCSVArchive(
          broadcastHistoryProgress
        );

      result.elapsedMs =
        Math.round(
          performance.now() -
          started
        );

      console.info(
        "IceIndex: historical CSV archive loaded.",
        {
          records:
            result.records.length,

          seasons:
            result.loaded.length,

          failed:
            result.failed.length,

          elapsedMs:
            result.elapsedMs
        }
      );

      return result;

    })();

    try {
      return await historyPromise;

    } catch (error) {
      historyPromise = null;

      throw error;

    } finally {
      /*
        Avoid retaining page callbacks
        unnecessarily after completion.
      */

      historyListeners.clear();
    }
  }


  /* ==========================================================
     26. PUBLIC DEBUG UTILITIES

     These functions are intentionally
     exposed for troubleshooting.

     Example:
       IceIndexData.inspect()

     ========================================================== */

  function inspect() {
    return {
      version:
        "0.2.0",

      repository:
        CONFIG.repository,

      dataBase:
        DATA_BASE,

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
        pendingRequests.size
    };
  }


  /* ==========================================================
     27. EXPOSE PUBLIC API

     Required by js/app.js:

       loadOHLCurrent()
       loadOHLHistory(callback)

     ========================================================== */

  window.loadOHLCurrent =
    loadOHLCurrent;

  window.loadOHLHistory =
    loadOHLHistory;

  window.IceIndexData = Object.freeze({
    version:
      "0.2.0",

    config:
      CONFIG,

    loadCurrent:
      loadOHLCurrent,

    loadHistory:
      loadOHLHistory,

    loadDirectory:
      loadDirectory,

    parseCSV,
    normalizeRecord,
    normalizeBirth,
    normalizeName,
    normalizePlayerID,
    hockeyTechPhoto,
    playerKey,
    seasonString,
    historicalURL,
    inspect
  });

  console.info(
    "IceIndex data engine v0.2.0 ready."
  );

})();

/* ============================================================
   END OF ICEINDEX v0.2.0 ohl-data.js
   ============================================================ */