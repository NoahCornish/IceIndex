
"use strict";

/* ============================================================
   ICEINDEX v0.10.0
   FILE 5 — js/ohl-branding.js

   OHL TEAM BRANDING ENGINE

   Features:
   - All 20 current OHL teams
   - Existing HockeyTech logo filenames
   - Historical team and franchise recognition
   - Team abbreviation matching
   - Safe HTML output
   - Graceful missing-logo fallback
   - Compatibility with IceIndex app.js
   - No external JavaScript dependencies

   IMPORTANT:
   Current-team logo filenames are preserved from
   the original IceIndex branding file.

   Historical teams without verified logo filenames
   receive a clean text fallback rather than an
   incorrect modern franchise logo.
   ============================================================ */

(function () {

  /* ==========================================================
     01. CONFIGURATION
     ========================================================== */

  const LOGO_BASE =
    "https://assets.leaguestat.com/ohl/logos/";

  const FALLBACK_LABEL = "OHL";


  /* ==========================================================
     02. CURRENT OHL TEAMS

     Keep this array format for compatibility:

       [team name, abbreviation, logo filename]

     Do not change the current logo filenames
     without verifying the replacement image.

     ========================================================== */

  const OHL_TEAMS = [

    [
      "Barrie Colts",
      "BAR",
      "7.png"
    ],

    [
      "Brampton Steelheads",
      "BRAM",
      "18.jpg"
    ],

    [
      "Brantford Bulldogs",
      "BFD",
      "1.png"
    ],

    [
      "Erie Otters",
      "ER",
      "8.png"
    ],

    [
      "Flint Firebirds",
      "FLNT",
      "13.png"
    ],

    [
      "Guelph Storm",
      "GUE",
      "9.png"
    ],

    [
      "Kingston Frontenacs",
      "KGN",
      "2.png"
    ],

    [
      "Kitchener Rangers",
      "KIT",
      "10.png"
    ],

    [
      "London Knights",
      "LDN",
      "14.png"
    ],

    [
      "Niagara IceDogs",
      "NIAG",
      "20.jpg"
    ],

    [
      "North Bay Battalion",
      "NB",
      "19.png"
    ],

    [
      "Oshawa Generals",
      "OSH",
      "4.png"
    ],

    [
      "Ottawa 67's",
      "OTT",
      "5_88.png"
    ],

    [
      "Owen Sound Attack",
      "OS",
      "11.png"
    ],

    [
      "Peterborough Petes",
      "PBO",
      "6.png"
    ],

    [
      "Saginaw Spirit",
      "SAG",
      "34.png"
    ],

    [
      "Sarnia Sting",
      "SAR",
      "15.png"
    ],

    [
      "Soo Greyhounds",
      "SOO",
      "16.png"
    ],

    [
      "Sudbury Wolves",
      "SBY",
      "12.png"
    ],

    [
      "Windsor Spitfires",
      "WSR",
      "17.png"
    ]

  ];


  /* ==========================================================
     03. HISTORICAL OHL FRANCHISES

     Historical clubs retain their own identities.

     A historical team is not automatically
     assigned the logo of its modern successor.

     Logo filename:
       null = historical logo not yet verified.

     ========================================================== */

  const OHL_HISTORICAL_TEAMS = [

    {
      name: "Mississauga Steelheads",
      code: "MISS",
      logoFile: null,
      successor: "Brampton Steelheads"
    },

    {
      name: "Hamilton Bulldogs",
      code: "HAM",
      logoFile: null,
      successor: "Brantford Bulldogs"
    },

    {
      name: "Belleville Bulls",
      code: "BEL",
      logoFile: null,
      successor: "Hamilton Bulldogs"
    },

    {
      name: "Plymouth Whalers",
      code: "PLY",
      logoFile: null,
      successor: "Flint Firebirds"
    },

    {
      name: "Brampton Battalion",
      code: "BRA",
      logoFile: null,
      successor: "North Bay Battalion"
    },

    {
      name: "Mississauga St. Michael's Majors",
      code: "MSM",
      logoFile: null,
      successor: "Mississauga Steelheads"
    },

    {
      name: "Toronto St. Michael's Majors",
      code: "TSM",
      logoFile: null,
      successor: "Mississauga St. Michael's Majors"
    },

    {
      name: "Toronto St. Michael's",
      code: "STM",
      logoFile: null,
      successor: "Toronto St. Michael's Majors"
    },

    {
      name: "Mississauga IceDogs",
      code: "MISI",
      logoFile: null,
      successor: "Niagara IceDogs"
    },

    {
      name: "Owen Sound Platers",
      code: "OSP",
      logoFile: null,
      successor: "Owen Sound Attack"
    },

    {
      name: "Detroit Whalers",
      code: "DET",
      logoFile: null,
      successor: "Plymouth Whalers"
    },

    {
      name: "Detroit Junior Red Wings",
      code: "DJR",
      logoFile: null,
      successor: "Detroit Whalers"
    },

    {
      name: "Saginaw Gears",
      code: "SGE",
      logoFile: null,
      successor: null
    },

    {
      name: "Newmarket Royals",
      code: "NEW",
      logoFile: null,
      successor: "Sarnia Sting"
    },

    {
      name: "Cornwall Royals",
      code: "COR",
      logoFile: null,
      successor: "Newmarket Royals"
    },

    {
      name: "Guelph Platers",
      code: "GPL",
      logoFile: null,
      successor: "Owen Sound Platers"
    },

    {
      name: "Niagara Falls Thunder",
      code: "NFT",
      logoFile: null,
      successor: "Erie Otters"
    },

    {
      name: "Niagara Falls Flyers",
      code: "NFF",
      logoFile: null,
      successor: "North Bay Centennials"
    },

    {
      name: "North Bay Centennials",
      code: "NBC",
      logoFile: null,
      successor: "Saginaw Spirit"
    },

    {
      name: "Toronto Marlboros",
      code: "TOR",
      logoFile: null,
      successor: "Guelph Storm"
    },

    {
      name: "Dukes of Hamilton",
      code: "DUK",
      logoFile: null,
      successor: "Guelph Storm"
    },

    {
      name: "Hamilton Steelhawks",
      code: "HST",
      logoFile: null,
      successor: "Niagara Falls Thunder"
    },

    {
      name: "Brantford Alexanders",
      code: "BAL",
      logoFile: null,
      successor: "Hamilton Steelhawks"
    },

    {
      name: "Windsor Bulldogs",
      code: "WBD",
      logoFile: null,
      successor: null
    },

    {
      name: "St. Catharines Black Hawks",
      code: "SCB",
      logoFile: null,
      successor: "Niagara Falls Flyers"
    },

    {
      name: "St. Catharines Falcons",
      code: "SCF",
      logoFile: null,
      successor: "St. Catharines Black Hawks"
    },

    {
      name: "St. Catharines Teepees",
      code: "SCT",
      logoFile: null,
      successor: "St. Catharines Black Hawks"
    },

    {
      name: "Kitchener-Waterloo Rangers",
      code: "KWR",
      logoFile: null,
      successor: "Kitchener Rangers"
    },

    {
      name: "Oshawa Green Gaels",
      code: "OGG",
      logoFile: null,
      successor: null
    },

    {
      name: "Montreal Junior Canadiens",
      code: "MJC",
      logoFile: null,
      successor: null
    }

  ];


  /* ==========================================================
     04. HTML ESCAPING

     Prevents unsafe markup when names or
     team values originate from CSV data.

     ========================================================== */

  function escapeHTML(value) {

    return String(value ?? "")
      .replace(
        /[&<>"']/g,
        character => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        })[character]
      );

  }


  /* ==========================================================
     05. TEAM NAME NORMALIZATION
     ========================================================== */

  function normalizeTeam(value) {

    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]/g, "");

  }


  /* ==========================================================
     06. LOGO URL VALIDATION
     ========================================================== */

  function logoURL(filename) {

    if (
      !filename ||
      typeof filename !== "string"
    ) {
      return "";
    }

    const clean = filename.trim();

    if (!clean) {
      return "";
    }

    /*
      Accept only expected asset filenames.

      Do not allow arbitrary external URLs
      from untrusted team data.
    */

    if (
      !/^[a-z0-9_.-]+\.(png|jpg|jpeg|webp)$/i
        .test(clean)
    ) {
      return "";
    }

    return LOGO_BASE + clean;

  }


  /* ==========================================================
     07. TEAM REGISTRY
     ========================================================== */

  const OHL_TEAM_MAP = new Map();

  const CURRENT_TEAMS = [];

  const HISTORICAL_TEAMS = [];

  function registerTeam(team) {

    const key = normalizeTeam(
      team.name
    );

    if (!key) {
      return;
    }

    OHL_TEAM_MAP.set(
      key,
      team
    );

    /*
      Register codes only when they are
      unambiguous.

      Historical codes can overlap with
      current franchise abbreviations.
    */

    const codeKey = normalizeTeam(
      team.code
    );

    if (
      codeKey &&
      !OHL_TEAM_MAP.has(codeKey)
    ) {
      OHL_TEAM_MAP.set(
        codeKey,
        team
      );
    }

  }


  /* ==========================================================
     08. REGISTER CURRENT TEAMS
     ========================================================== */

  for (
    const [name, code, filename]
    of OHL_TEAMS
  ) {

    const team = {

      name,
      code,

      logo: logoURL(
        filename
      ),

      logoFile: filename,

      current: true,
      historical: false,

      successor: null

    };

    CURRENT_TEAMS.push(
      team
    );

    registerTeam(
      team
    );

  }


  /* ==========================================================
     09. REGISTER HISTORICAL TEAMS
     ========================================================== */

  for (
    const historical
    of OHL_HISTORICAL_TEAMS
  ) {

    const team = {

      name: historical.name,

      code: historical.code,

      logo: logoURL(
        historical.logoFile
      ),

      logoFile:
        historical.logoFile,

      current: false,
      historical: true,

      successor:
        historical.successor

    };

    HISTORICAL_TEAMS.push(
      team
    );

    registerTeam(
      team
    );

  }


  /* ==========================================================
     10. ALIASES

     These aliases resolve spelling variants
     without changing a team's historical
     identity.

     ========================================================== */

  const TEAM_ALIASES = {

    /*
      Current teams
    */

    barrie:
      "Barrie Colts",

    brampton:
      "Brampton Steelheads",

    brantford:
      "Brantford Bulldogs",

    erie:
      "Erie Otters",

    flint:
      "Flint Firebirds",

    guelph:
      "Guelph Storm",

    kingston:
      "Kingston Frontenacs",

    kitchener:
      "Kitchener Rangers",

    london:
      "London Knights",

    niagara:
      "Niagara IceDogs",

    northbay:
      "North Bay Battalion",

    oshawa:
      "Oshawa Generals",

    ottawa:
      "Ottawa 67's",

    owensound:
      "Owen Sound Attack",

    peterborough:
      "Peterborough Petes",

    saginaw:
      "Saginaw Spirit",

    sarnia:
      "Sarnia Sting",

    sudbury:
      "Sudbury Wolves",

    windsor:
      "Windsor Spitfires",

    /*
      Alternate official names
    */

    saultstemariegreyhounds:
      "Soo Greyhounds",

    saultstemarie:
      "Soo Greyhounds",

    ssmgreyhounds:
      "Soo Greyhounds",

    ssm:
      "Soo Greyhounds",

    saultgreyhounds:
      "Soo Greyhounds",

    ottawa67s:
      "Ottawa 67's",

    ottawa67:
      "Ottawa 67's",

    ottawa67ers:
      "Ottawa 67's",

    niagaraicedogs:
      "Niagara IceDogs",

    mississaugasteelheads:
      "Mississauga Steelheads",

    mississaugastmichaelsmajors:
      "Mississauga St. Michael's Majors",

    torontostmichaelsmajors:
      "Toronto St. Michael's Majors",

    mississaugaicedogs:
      "Mississauga IceDogs",

    /*
      Historical spelling variants
    */

    northbaycentennials:
      "North Bay Centennials",

    niagarafallsthunder:
      "Niagara Falls Thunder",

    niagarafallsflyers:
      "Niagara Falls Flyers",

    plymouthwhalers:
      "Plymouth Whalers",

    detroitjuniorredwings:
      "Detroit Junior Red Wings",

    detroitjrredwings:
      "Detroit Junior Red Wings",

    owensoundplaters:
      "Owen Sound Platers",

    guelphplaters:
      "Guelph Platers",

    bramptonbattalion:
      "Brampton Battalion",

    bellevillebulls:
      "Belleville Bulls",

    hamiltonbulldogs:
      "Hamilton Bulldogs",

    cornwallroyals:
      "Cornwall Royals",

    newmarketroyals:
      "Newmarket Royals",

    torontomarlboros:
      "Toronto Marlboros",

    kitchenerwaterloorangers:
      "Kitchener-Waterloo Rangers"

  };


  /* ==========================================================
     11. TEAM LOOKUP

     Returns:
       {
         name,
         code,
         logo,
         logoFile,
         current,
         historical,
         successor
       }

     Returns null when the team is unknown.

     ========================================================== */

  function getOHLTeam(value) {

    if (
      value === null ||
      value === undefined
    ) {
      return null;
    }

    const key = normalizeTeam(
      value
    );

    if (!key) {
      return null;
    }

    /*
      Direct lookup.
    */

    const direct =
      OHL_TEAM_MAP.get(key);

    if (direct) {
      return direct;
    }

    /*
      Alias lookup.
    */

    const alias =
      TEAM_ALIASES[key];

    if (alias) {
      return (
        OHL_TEAM_MAP.get(
          normalizeTeam(alias)
        ) || null
      );
    }

    return null;

  }


  /* ==========================================================
     12. TEAM NAME HELPER
     ========================================================== */

  function teamName(value) {

    const team =
      getOHLTeam(value);

    return team
      ? team.name
      : String(value ?? "").trim();

  }


  /* ==========================================================
     13. TEAM ABBREVIATION HELPER
     ========================================================== */

  function teamCode(value) {

    const team =
      getOHLTeam(value);

    if (team) {
      return team.code;
    }

    const input = String(
      value ?? ""
    ).trim();

    if (!input) {
      return "OHL";
    }

    const words = input
      .split(/\s+/)
      .filter(Boolean);

    if (words.length === 1) {
      return words[0]
        .slice(0, 4)
        .toUpperCase();
    }

    return words
      .map(word => word[0])
      .join("")
      .slice(0, 4)
      .toUpperCase();

  }


  /* ==========================================================
     14. TEAM LOGO HELPER

     Compatible with existing app.js:

       teamLogo(teamName)

       teamLogo(
         teamName,
         "team-logo"
       )

     Returns HTML, not a DOM node.

     ========================================================== */

  function teamLogo(
    value,
    className = "team-logo"
  ) {

    const team =
      getOHLTeam(value);

    const safeClass =
      escapeHTML(
        className || "team-logo"
      );

    /*
      No known team.
    */

    if (!team) {

      return (
        `<span class="${safeClass} logo-fallback" ` +
        `aria-label="Unknown OHL team">` +
        `${FALLBACK_LABEL}` +
        `</span>`
      );

    }

    /*
      Historical team without a verified
      historical logo.

      Show its own abbreviation, not a
      successor franchise's logo.
    */

    if (!team.logo) {

      return (
        `<span class="${safeClass} logo-fallback" ` +
        `role="img" ` +
        `aria-label="${escapeHTML(team.name)}">` +
        `${escapeHTML(team.code)}` +
        `</span>`
      );

    }

    /*
      Current team with a logo.

      The fallback span becomes visible
      only if the image fails.

      No white square or coloured logo
      background is introduced here.
    */

    return (
      `<span class="ohl-logo-wrap">` +

        `<img ` +
          `class="${safeClass}" ` +
          `src="${escapeHTML(team.logo)}" ` +
          `alt="${escapeHTML(team.name)} logo" ` +
          `loading="lazy" ` +
          `decoding="async" ` +
          `onerror="this.hidden=true;` +
          `this.nextElementSibling.hidden=false"` +
        `>` +

        `<span ` +
          `class="logo-fallback" ` +
          `hidden ` +
          `aria-hidden="true">` +
          `${escapeHTML(team.code)}` +
        `</span>` +

      `</span>`
    );

  }


  /* ==========================================================
     15. TEAM LOGO URL HELPER
     ========================================================== */

  function getOHLLogoURL(value) {

    const team =
      getOHLTeam(value);

    return team?.logo || "";

  }


  /* ==========================================================
     16. CURRENT TEAM LIST

     Returns a copy so callers cannot
     accidentally mutate the registry.

     ========================================================== */

  function getCurrentOHLTeams() {

    return CURRENT_TEAMS.map(
      team => ({ ...team })
    );

  }


  /* ==========================================================
     17. HISTORICAL TEAM LIST
     ========================================================== */

  function getHistoricalOHLTeams() {

    return HISTORICAL_TEAMS.map(
      team => ({ ...team })
    );

  }


  /* ==========================================================
     18. FRANCHISE HISTORY

     Resolve a historical club's successor
     chain without changing its own branding.

     ========================================================== */

  function getOHLFranchiseHistory(value) {

    const first =
      getOHLTeam(value);

    if (!first) {
      return [];
    }

    const history = [];
    const visited = new Set();

    let current = first;

    while (current) {

      const key = normalizeTeam(
        current.name
      );

      if (visited.has(key)) {
        break;
      }

      visited.add(key);

      history.push({
        ...current
      });

      if (!current.successor) {
        break;
      }

      current = getOHLTeam(
        current.successor
      );

    }

    return history;

  }


  /* ==========================================================
     19. CURRENT TEAM CHECK
     ========================================================== */

  function isCurrentOHLTeam(value) {

    const team =
      getOHLTeam(value);

    return Boolean(
      team && team.current
    );

  }


  /* ==========================================================
     20. SAFE TEAM LABEL
     ========================================================== */

  function teamLabel(value) {

    const name =
      teamName(value);

    return escapeHTML(name);

  }


  /* ==========================================================
     21. BRANDING DIAGNOSTICS
     ========================================================== */

  function inspectOHLBranding() {

    return {

      version:
        "0.2.0",

      currentTeams:
        CURRENT_TEAMS.length,

      historicalTeams:
        HISTORICAL_TEAMS.length,

      currentWithLogos:
        CURRENT_TEAMS.filter(
          team => Boolean(team.logo)
        ).length,

      historicalWithVerifiedLogos:
        HISTORICAL_TEAMS.filter(
          team => Boolean(team.logo)
        ).length,

      logoBase:
        LOGO_BASE

    };

  }


  /* ==========================================================
     22. PUBLIC API

     Existing app.js compatibility:
       OHL_TEAMS
       getOHLTeam()
       teamLogo()
       escapeHTML()

     Additional helpers are available
     without changing the existing UI.

     ========================================================== */

  Object.assign(window, {

    OHL_TEAMS,

    OHL_HISTORICAL_TEAMS,

    OHL_TEAM_MAP,

    getOHLTeam,

    teamLogo,

    escapeHTML,

    normalizeTeam,

    teamName,

    teamCode,

    teamLabel,

    getOHLLogoURL,

    getCurrentOHLTeams,

    getHistoricalOHLTeams,

    getOHLFranchiseHistory,

    isCurrentOHLTeam,

    inspectOHLBranding

  });


  /* ==========================================================
     23. INITIALIZATION
     ========================================================== */

  console.info(
    "IceIndex branding v0.2.0 ready.",
    `${CURRENT_TEAMS.length} current teams,`,
    `${HISTORICAL_TEAMS.length} historical teams.`
  );

})();

/* ============================================================
   END OF ICEINDEX v0.8.0
   js/ohl-branding.js
   ============================================================ */