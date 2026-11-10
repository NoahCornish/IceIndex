
"use strict";

/* ============================================================
   ICEINDEX v0.1.0
   FILE 4 OF 5 — OHL DATA ENGINE

   FEATURES
   ------------------------------------------------------------
   - Fast current-season loading
   - PlayerID-based identity
   - Player directory enrichment
   - BD / BirthDate normalization
   - HockeyTech headshot URLs
   - Historical season discovery
   - Parallel historical downloads
   - Session caching
   - Duplicate-request prevention
   - Compatibility with js/app.js (File 3)

   DATA SOURCE
   ------------------------------------------------------------
   github.com/NoahCornish/OHLDataHub

   ============================================================ */

(() => {

  const VERSION = "0.1.0";

  const REPO =
    "https://raw.githubusercontent.com/" +
    "NoahCornish/OHLDataHub/main/data/";

  const PHOTO_BASE =
    "https://assets.leaguestat.com/" +
    "ohl/240x240/";

  const CURRENT_URL =
    REPO + "current/skaters.csv";

  const DIRECTORY_URL =
    REPO + "player_directory.csv";

  const CACHE_PREFIX =
    "iceindex-v010:";

  const CURRENT_CACHE_MS =
    5 * 60 * 1000;

  const DIRECTORY_CACHE_MS =
    24 * 60 * 60 * 1000;

  const HISTORY_CACHE_MS =
    7 * 24 * 60 * 60 * 1000;

  const HISTORY_CONCURRENCY = 6;

  const FIRST_HISTORY_YEAR = 1998;

  const requestCache = new Map();

  let directoryPromise = null;
  let currentPromise = null;
  let historyPromise = null;

  let currentData = null;
  let directoryIndex = null;

  /* ============================================================
     BASIC HELPERS
     ============================================================ */

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clean(value) {
    return String(value ?? "").trim();
  }

  function normalizedName(value) {
    return clean(value)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function normalizedHeader(value) {
    return clean(value)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function numeric(value) {
    if (
      value === null ||
      value === undefined ||
      clean(value) === ""
    ) {
      return null;
    }

    const number = Number(
      String(value).replace(/,/g, "")
    );

    return Number.isFinite(number)
      ? number
      : null;
  }

  function integer(value, fallback = 0) {
    return numeric(value) ?? fallback;
  }

  function safePlayerID(value) {
    const id = clean(value);

    return /^\d+$/.test(id) ? id : "";
  }

  function photoURL(id) {
    const playerID = safePlayerID(id);

    return playerID
      ? PHOTO_BASE + playerID + ".jpg"
      : "";
  }

  function safePhotoURL(value) {
    const url = clean(value);

    if (!url) return "";

    try {
      const parsed = new URL(url);

      if (
        parsed.protocol === "https:" &&
        parsed.hostname === "assets.leaguestat.com"
      ) {
        return parsed.href;
      }
    } catch (_) {
      // Invalid URL.
    }

    return "";
  }

  /* ============================================================
     BIRTHDATE NORMALIZATION

     Supported formats:
       2008-10-21
       Oct 21, 2008
       Oct  1, 2008
       10/21/2008

     Returns YYYY-MM-DD.
     ============================================================ */

  function normalizeBirthDate(value) {
    const raw = clean(value);

    if (!raw) return "";

    const iso = raw.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})/
    );

    if (iso) {
      const year = iso[1];
      const month = iso[2].padStart(2, "0");
      const day = iso[3].padStart(2, "0");

      return `${year}-${month}-${day}`;
    }

    const numericDate = raw.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    );

    if (numericDate) {
      return (
        numericDate[3] + "-" +
        numericDate[1].padStart(2, "0") + "-" +
        numericDate[2].padStart(2, "0")
      );
    }

    const months = {
      jan: 1,
      feb: 2,
      mar: 3,
      apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      aug: 8,
      sep: 9,
      oct: 10,
      nov: 11,
      dec: 12
    };

    const match = raw.match(
      /^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})$/
    );

    if (match) {
      const month = months[
        match[1].toLowerCase()
      ];

      if (month) {
        return (
          match[3] + "-" +
          String(month).padStart(2, "0") + "-" +
          match[2].padStart(2, "0")
        );
      }
    }

    return "";
  }

  /* ============================================================
     CSV PARSER

     Handles:
       - Quoted fields
       - Commas inside quotes
       - Escaped quotes
       - CRLF and LF
       - UTF-8 BOM

     ============================================================ */

  function parseCSV(text) {
    if (!text) return [];

    const source = String(text).replace(
      /^\uFEFF/,
      ""
    );

    const rows = [];

    let row = [];
    let field = "";
    let quoted = false;

    for (let i = 0; i < source.length; i++) {
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

      if (!quoted && char === ",") {
        row.push(field);
        field = "";
        continue;
      }

      if (
        !quoted &&
        (char === "\n" || char === "\r")
      ) {
        if (
          char === "\r" &&
          source[i + 1] === "\n"
        ) {
          i++;
        }

        row.push(field);

        if (row.some(value => value !== "")) {
          rows.push(row);
        }

        row = [];
        field = "";
        continue;
      }

      field += char;
    }

    if (field || row.length) {
      row.push(field);

      if (row.some(value => value !== "")) {
        rows.push(row);
      }
    }

    if (!rows.length) return [];

    const headers = rows.shift().map(
      normalizedHeader
    );

    return rows.map(values => {
      const result = {};

      for (
        let i = 0;
        i < headers.length;
        i++
      ) {
        result[headers[i]] =
          values[i] ?? "";
      }

      return result;
    });
  }

  /* ============================================================
     FETCH + CACHE

     Session storage is best-effort.
     Large historical files may exceed browser storage limits.

     ============================================================ */

  function readCache(key, maxAge) {
    try {
      const raw = sessionStorage.getItem(
        CACHE_PREFIX + key
      );

      if (!raw) return null;

      const item = JSON.parse(raw);

      if (
        !item ||
        typeof item.time !== "number" ||
        Date.now() - item.time > maxAge
      ) {
        return null;
      }

      return item.data ?? null;

    } catch (_) {
      return null;
    }
  }

  function writeCache(key, data) {
    try {
      sessionStorage.setItem(
        CACHE_PREFIX + key,
        JSON.stringify({
          time: Date.now(),
          data
        })
      );
    } catch (_) {
      // Storage quota exceeded.
      // The site continues using memory caching.
    }
  }

  async function fetchText(
    url,
    {
      cacheKey = url,
      maxAge = HISTORY_CACHE_MS,
      timeout = 12000
    } = {}
  ) {

    const cached = readCache(
      cacheKey,
      maxAge
    );

    if (cached !== null) {
      return cached;
    }

    if (requestCache.has(url)) {
      return requestCache.get(url);
    }

    const request = (async () => {
      const controller =
        new AbortController();

      const timer = setTimeout(
        () => controller.abort(),
        timeout
      );

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          cache: "default"
        });

        if (!response.ok) {
          const error = new Error(
            `HTTP ${response.status}: ${url}`
          );

          error.status = response.status;

          throw error;
        }

        const text = await response.text();

        if (!text.trim()) {
          throw new Error(
            `Empty dataset: ${url}`
          );
        }

        writeCache(cacheKey, text);

        return text;

      } finally {
        clearTimeout(timer);
      }
    })();

    requestCache.set(url, request);

    try {
      return await request;
    } catch (error) {
      requestCache.delete(url);
      throw error;
    }
  }

  /* ============================================================
     DIRECTORY INDEX

     player_directory.csv schema:
       PlayerID
       Name
       FirstName
       LastName
       Team
       Position
       BirthDate
       Season
       SeasonID
       HeadshotURL

     ============================================================ */

  function directoryEntry(row) {
    const id = safePlayerID(
      row.playerid || row.id
    );

    const name = clean(row.name);

    const birth = normalizeBirthDate(
      row.birthdate ||
      row.bd ||
      row.birth
    );

    const photo =
      safePhotoURL(
        row.headshoturl ||
        row.photourl
      ) ||
      photoURL(id);

    return {
      id,
      name,
      birth,
      team: clean(row.team),
      position: clean(row.position),
      season: clean(row.season),
      photo
    };
  }

  function buildDirectoryIndex(rows) {
    const byID = new Map();
    const byNameBirth = new Map();
    const byName = new Map();

    const uniquePlayers = new Map();

    for (const row of rows) {
      const entry = directoryEntry(row);

      if (!entry.id || !entry.name) {
        continue;
      }

      // Directory contains repeated player-season entries.
      // Retain one canonical identity per PlayerID.
      if (!uniquePlayers.has(entry.id)) {
        uniquePlayers.set(
          entry.id,
          entry
        );
      } else {
        const existing =
          uniquePlayers.get(entry.id);

        if (!existing.birth && entry.birth) {
          existing.birth = entry.birth;
        }

        if (!existing.photo && entry.photo) {
          existing.photo = entry.photo;
        }

        if (
          !existing.position &&
          entry.position
        ) {
          existing.position =
            entry.position;
        }
      }
    }

    for (const entry of uniquePlayers.values()) {
      byID.set(entry.id, entry);

      const nameKey =
        normalizedName(entry.name);

      if (!byName.has(nameKey)) {
        byName.set(nameKey, []);
      }

      byName.get(nameKey).push(entry);

      if (entry.birth) {
        const key =
          nameKey + "|" + entry.birth;

        if (!byNameBirth.has(key)) {
          byNameBirth.set(key, []);
        }

        byNameBirth.get(key).push(entry);
      }
    }

    return {
      byID,
      byNameBirth,
      byName,
      count: uniquePlayers.size
    };
  }

  async function loadPlayerDirectory() {
    if (directoryIndex) {
      return directoryIndex;
    }

    if (directoryPromise) {
      return directoryPromise;
    }

    directoryPromise = (async () => {
      const text = await fetchText(
        DIRECTORY_URL,
        {
          cacheKey: "player-directory",
          maxAge: DIRECTORY_CACHE_MS,
          timeout: 20000
        }
      );

      const rows = parseCSV(text);

      directoryIndex =
        buildDirectoryIndex(rows);

      console.info(
        "[IceIndex] Player directory:",
        directoryIndex.count,
        "unique PlayerIDs"
      );

      return directoryIndex;
    })();

    try {
      return await directoryPromise;
    } catch (error) {
      directoryPromise = null;
      throw error;
    }
  }

  /* ============================================================
     SAFE DIRECTORY MATCHING

     Priority:
       1. Exact PlayerID
       2. Exact name + birthdate
       3. Unique exact name when birthdate is absent

     Ambiguous names are not guessed.

     ============================================================ */

  function matchDirectory(row, directory) {
    if (!directory) return null;

    const id = safePlayerID(
      row.PlayerID || row.id
    );

    if (id && directory.byID.has(id)) {
      return directory.byID.get(id);
    }

    const nameKey =
      normalizedName(row.name);

    if (!nameKey) return null;

    const birth = normalizeBirthDate(
      row.birth
    );

    if (birth) {
      const matches =
        directory.byNameBirth.get(
          nameKey + "|" + birth
        ) || [];

      return matches.length === 1
        ? matches[0]
        : null;
    }

    const matches =
      directory.byName.get(nameKey) || [];

    return matches.length === 1
      ? matches[0]
      : null;
  }

  /* ============================================================
     ROW NORMALIZATION

     Current CSV:
       Name, PlayerID, PhotoURL, BD, Pos,
       Team, GP, G, A, PTS, +/-, etc.

     ============================================================ */

  function normalizeRecord(
    raw,
    {
      endYear,
      source = "historical",
      directory = null
    } = {}
  ) {

    const field = (...names) => {
      for (const name of names) {
        const key = normalizedHeader(name);

        if (
          raw[key] !== undefined &&
          clean(raw[key]) !== ""
        ) {
          return raw[key];
        }
      }

      return "";
    };

    const name = clean(
      field("Name", "Player")
    );

    if (!name) return null;

    let id = safePlayerID(
      field("PlayerID", "Player ID", "ID")
    );

    let birth = normalizeBirthDate(
      field(
        "BD",
        "BirthDate",
        "Birth Date",
        "DOB"
      )
    );

    let photo = safePhotoURL(
      field(
        "PhotoURL",
        "HeadshotURL",
        "Photo"
      )
    );

    const row = {
      name,
      PlayerID: id,
      id,
      birth,
      photo,

      position: clean(
        field("Pos", "Position")
      ),

      team: clean(
        field("Team", "TeamName")
      ),

      gp: numeric(field("GP")),
      g: numeric(field("G")),
      a: numeric(field("A")),
      pts: numeric(field("PTS", "Points")),
      pim: numeric(field("PIM")),

      ppg: numeric(field("PPG")),
      ppa: numeric(field("PPA")),
      ppp: numeric(field("PPP")),

      shg: numeric(field("SHG")),
      sha: numeric(field("SHA")),
      shpts: numeric(field("SHPTS")),

      gwg: numeric(field("GWG")),
      eng: numeric(field("ENG")),

      shots: numeric(
        field("Shots", "SOG")
      ),

      plusMinus: numeric(
        field("+/-", "PlusMinus")
      ),

      rookie: clean(field("Rookie")),
      jersey: clean(field("JN", "Number")),

      height: clean(field("Hgt", "Height")),
      weight: clean(field("Wgt", "Weight")),

      active: clean(field("Active")),

      endYear: Number(endYear),

      season:
        `${Number(endYear) - 1}-` +
        String(endYear).slice(-2),

      source
    };

    if (!row.pts && row.pts !== 0) {
      if (
        row.g !== null &&
        row.a !== null
      ) {
        row.pts = row.g + row.a;
      }
    }

    if (!row.ppp && row.ppp !== 0) {
      if (
        row.ppg !== null &&
        row.ppa !== null
      ) {
        row.ppp = row.ppg + row.ppa;
      }
    }

    if (
      row.shpts === null &&
      row.shg !== null &&
      row.sha !== null
    ) {
      row.shpts = row.shg + row.sha;
    }

    const match = matchDirectory(
      row,
      directory
    );

    if (match) {
      if (!id) id = match.id;

      if (!birth) {
        birth = match.birth;
      }

      if (!photo) {
        photo = match.photo;
      }

      if (!row.position) {
        row.position = match.position;
      }
    }

    if (!photo && id) {
      photo = photoURL(id);
    }

    row.PlayerID = id;
    row.id = id;
    row.birth = birth;
    row.photo = photo;

    // File 3 app.js checks row.key first.
    // PlayerID is the canonical identity.
    row.key = id
      ? "id:" + id
      : birth
        ? "person:" +
          normalizedName(name) +
          "|" + birth
        : "name:" +
          normalizedName(name);

    return row;
  }

  function normalizeRows(
    rows,
    options
  ) {
    return rows
      .map(row =>
        normalizeRecord(row, options)
      )
      .filter(Boolean);
  }

  /* ============================================================
     CURRENT SEASON

     Current data loads without waiting for
     the player directory.

     ============================================================ */

  function currentSeasonEndYear() {
    const now = new Date();

    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();

    // OHL seasons normally begin in the fall
    // and finish the following calendar year.
    return month >= 6
      ? year + 1
      : year;
  }

  async function loadOHLCurrent() {
    if (currentData) {
      return currentData;
    }

    if (currentPromise) {
      return currentPromise;
    }

    currentPromise = (async () => {

      const started = performance.now();

      // Start directory download concurrently.
      // It must not block current statistics.
      const backgroundDirectory =
        loadPlayerDirectory().catch(error => {
          console.warn(
            "[IceIndex] Directory delayed:",
            error.message
          );

          return null;
        });

      const text = await fetchText(
        CURRENT_URL,
        {
          cacheKey: "current-skaters",
          maxAge: CURRENT_CACHE_MS,
          timeout: 15000
        }
      );

      const raw = parseCSV(text);

      const endYear =
        currentSeasonEndYear();

      const records = normalizeRows(
        raw,
        {
          endYear,
          source: "current"
        }
      );

      if (!records.length) {
        throw new Error(
          "Current OHL skater data is empty."
        );
      }

      currentData = {
        records,
        endYear,
        season:
          `${endYear - 1}-` +
          String(endYear).slice(-2),
        count: records.length,
        source: CURRENT_URL
      };

      console.info(
        "[IceIndex] Current season loaded:",
        records.length,
        "records in",
        Math.round(
          performance.now() - started
        ),
        "ms"
      );

      // Update identities in place once the directory
      // arrives. Existing references remain valid.
      backgroundDirectory.then(directory => {
        if (!directory) return;

        for (const record of records) {
          const enriched = normalizeRecord(
            {
              name: record.name,
              playerid: record.PlayerID,
              photourl: record.photo,
              bd: record.birth,
              pos: record.position,
              team: record.team,
              gp: record.gp,
              g: record.g,
              a: record.a,
              pts: record.pts,
              pim: record.pim,
              ppg: record.ppg,
              ppa: record.ppa,
              ppp: record.ppp,
              shg: record.shg,
              sha: record.sha,
              shpts: record.shpts,
              gwg: record.gwg,
              eng: record.eng,
              shots: record.shots,
              plusminus: record.plusMinus
            },
            {
              endYear,
              source: "current",
              directory
            }
          );

          if (enriched) {
            Object.assign(
              record,
              enriched
            );
          }
        }

        window.dispatchEvent(
          new CustomEvent(
            "iceindex:directory-ready",
            {
              detail: {
                count: directory.count
              }
            }
          )
        );
      });

      return currentData;
    })();

    try {
      return await currentPromise;
    } catch (error) {
      currentPromise = null;
      throw error;
    }
  }

  /* ============================================================
     HISTORICAL URL DISCOVERY

     Supports:
       data/historical/YYYY-season/skaters.csv
       data/YYYY-season/skaters.csv
       data/historical/YYYY/skaters.csv
       data/YYYY/skaters.csv

     The loader remembers the successful layout.

     ============================================================ */

  let preferredHistoryLayout = null;

  function historicalURLs(endYear) {
    const year = Number(endYear);

    const layouts = [
      `historical/${year}-season/skaters.csv`,
      `${year}-season/skaters.csv`,
      `historical/${year}/skaters.csv`,
      `${year}/skaters.csv`
    ];

    if (preferredHistoryLayout !== null) {
      const preferred =
        layouts.splice(
          preferredHistoryLayout,
          1
        )[0];

      layouts.unshift(preferred);
    }

    return layouts.map(path =>
      REPO + path
    );
  }

  async function loadHistoricalSeason(
    endYear,
    directory
  ) {
    const year = Number(endYear);

    if (
      !Number.isInteger(year) ||
      year < FIRST_HISTORY_YEAR
    ) {
      throw new Error(
        "Invalid historical season: " + endYear
      );
    }

    const urls = historicalURLs(year);

    let lastError = null;

    for (const url of urls) {
      try {
        const text = await fetchText(
          url,
          {
            cacheKey:
              "history:" + year,
            maxAge: HISTORY_CACHE_MS,
            timeout: 12000
          }
        );

        const rows = parseCSV(text);

        const records = normalizeRows(
          rows,
          {
            endYear: year,
            source: "historical",
            directory
          }
        );

        if (!records.length) {
          throw new Error(
            "Empty historical season"
          );
        }

        const layout = [
          `historical/${year}-season/skaters.csv`,
          `${year}-season/skaters.csv`,
          `historical/${year}/skaters.csv`,
          `${year}/skaters.csv`
        ];

        const matched =
          layout.findIndex(path =>
            url === REPO + path
          );

        if (matched !== -1) {
          preferredHistoryLayout = matched;
        }

        return {
          endYear: year,
          records,
          url
        };

      } catch (error) {
        lastError = error;

        // Missing file: try next layout.
        if (error.status === 404) {
          continue;
        }

        // Other failures may be transient.
        // Continue to the next candidate.
      }
    }

    throw lastError || new Error(
      `Historical season ${year} unavailable`
    );
  }

  /* ============================================================
     PARALLEL WORKER QUEUE

     Downloads multiple seasons simultaneously
     without launching every request at once.

     ============================================================ */

  async function parallelMap(
    items,
    worker,
    concurrency,
    progress
  ) {
    const results =
      new Array(items.length);

    let nextIndex = 0;
    let completed = 0;

    async function runWorker() {
      while (true) {
        const index = nextIndex++;

        if (index >= items.length) {
          return;
        }

        try {
          results[index] = await worker(
            items[index],
            index
          );
        } catch (error) {
          results[index] = {
            error,
            endYear: items[index]
          };
        }

        completed++;

        if (
          typeof progress === "function"
        ) {
          progress({
            completed,
            done: completed,
            total: items.length,
            year: items[index]
          });
        }
      }
    }

    const workers = Array.from(
      {
        length: Math.min(
          concurrency,
          items.length
        )
      },
      () => runWorker()
    );

    await Promise.all(workers);

    return results;
  }

  /* ============================================================
     COMPLETE HISTORICAL ARCHIVE

     File 3 app.js expects:
       {
         records: [],
         loaded: [],
         failed: []
       }

     ============================================================ */

  async function loadOHLHistory(
    onProgress = null
  ) {
    if (historyPromise) {
      return historyPromise;
    }

    historyPromise = (async () => {
      const started = performance.now();

      const directory =
        await loadPlayerDirectory()
          .catch(error => {
            console.warn(
              "[IceIndex] Historical directory fallback:",
              error.message
            );

            return null;
          });

      const currentYear =
        currentData?.endYear ||
        currentSeasonEndYear();

      const years = [];

      for (
        let year = currentYear - 1;
        year >= FIRST_HISTORY_YEAR;
        year--
      ) {
        years.push(year);
      }

      const results = await parallelMap(
        years,
        year =>
          loadHistoricalSeason(
            year,
            directory
          ),
        HISTORY_CONCURRENCY,
        onProgress
      );

      const loaded = [];
      const failed = [];
      const records = [];

      for (const result of results) {
        if (!result) continue;

        if (result.error) {
          failed.push({
            endYear: result.endYear,
            message: result.error.message
          });

          continue;
        }

        loaded.push(result.endYear);

        records.push(
          ...result.records
        );
      }

      const archive = {
        records,
        loaded,
        seasons: loaded,
        failed,
        count: records.length,
        complete: failed.length === 0,
        elapsedMs: Math.round(
          performance.now() - started
        )
      };

      console.info(
        "[IceIndex] Historical archive:",
        loaded.length,
        "seasons,",
        records.length,
        "records,",
        failed.length,
        "failed,",
        archive.elapsedMs,
        "ms"
      );

      return archive;
    })();

    try {
      return await historyPromise;
    } catch (error) {
      historyPromise = null;
      throw error;
    }
  }

  /* ============================================================
     OPTIONAL INDIVIDUAL SEASON API

     Useful for future lazy-loaded pages.

     ============================================================ */

  async function loadOHLSeason(endYear) {
    const directory =
      await loadPlayerDirectory()
        .catch(() => null);

    return loadHistoricalSeason(
      endYear,
      directory
    );
  }

  /* ============================================================
     DEBUG / PUBLIC API
     ============================================================ */

  const IceIndexData = {
    version: VERSION,

    baseURL: REPO,

    parseCSV,
    normalizeRecord,
    normalizeRows,
    normalizeBirthDate,

    normalizedName,
    escapeHTML,

    photoURL,

    loadCurrent: loadOHLCurrent,
    loadHistory: loadOHLHistory,
    loadSeason: loadOHLSeason,
    loadDirectory: loadPlayerDirectory,

    getDirectory() {
      return directoryIndex;
    },

    getCurrent() {
      return currentData;
    },

    getStatus() {
      return {
        currentReady:
          Boolean(currentData),

        directoryReady:
          Boolean(directoryIndex),

        directoryPlayers:
          directoryIndex?.count || 0,

        historyRequested:
          Boolean(historyPromise),

        currentRecords:
          currentData?.records.length || 0
      };
    }
  };

  Object.assign(window, {
    IceIndexData,

    loadOHLCurrent,
    loadOHLHistory,
    loadOHLSeason,
    loadPlayerDirectory,

    escapeHTML
  });

  console.info(
    "[IceIndex] Data engine v" +
    VERSION +
    " initialized"
  );

})();