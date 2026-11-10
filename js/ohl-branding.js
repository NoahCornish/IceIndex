
"use strict";

/* ============================================================
   ICEINDEX v0.1.0 — OHL BRANDING
   Restored original OHLDataHub logo mappings
   Compact Team Explorer compatibility
   ============================================================ */

(() => {
  const LOGO_BASE =
    "https://assets.leaguestat.com/ohl/logos/";

  const OHL_TEAMS = [
    ["Barrie Colts", "BAR", "7.png"],
    ["Brampton Steelheads", "BRAM", "18.jpg"],
    ["Brantford Bulldogs", "BFD", "1.png"],
    ["Erie Otters", "ER", "8.png"],
    ["Flint Firebirds", "FLNT", "13.png"],
    ["Guelph Storm", "GUE", "9.png"],
    ["Kingston Frontenacs", "KGN", "2.png"],
    ["Kitchener Rangers", "KIT", "10.png"],
    ["London Knights", "LDN", "14.png"],
    ["Niagara IceDogs", "NIAG", "20.jpg"],
    ["North Bay Battalion", "NB", "19.png"],
    ["Oshawa Generals", "OSH", "4.png"],
    ["Ottawa 67's", "OTT", "5_88.png"],
    ["Owen Sound Attack", "OS", "11.png"],
    ["Peterborough Petes", "PBO", "6.png"],
    ["Saginaw Spirit", "SAG", "34.png"],
    ["Sarnia Sting", "SAR", "15.png"],
    ["Soo Greyhounds", "SOO", "16.png"],
    ["Sudbury Wolves", "SBY", "12.png"],
    ["Windsor Spitfires", "WSR", "17.png"]
  ];

  const HISTORICAL_TEAMS = [
    ["Mississauga Steelheads", "MISS", "BRAM"],
    ["Hamilton Bulldogs", "HAM", "BFD"],
    ["Belleville Bulls", "BEL", "BFD"],
    ["Plymouth Whalers", "PLY", "FLNT"],
    ["Detroit Whalers", "DET", "FLNT"],
    ["Detroit Junior Red Wings", "DJRW", "FLNT"],
    ["Mississauga IceDogs", "MID", "NIAG"],
    ["Brampton Battalion", "BB", "NB"],
    ["Owen Sound Platers", "OSP", "OS"],
    ["North Bay Centennials", "NBC", "SAG"],
    ["Newmarket Royals", "NMR", "SAR"],
    ["Cornwall Royals", "COR", "SAR"],
    ["Toronto St. Michael's Majors", "TSM", "BRAM"],
    ["Mississauga St. Michael's Majors", "MSM", "BRAM"],
    ["Toronto Marlboros", "TML", ""],
    ["Hamilton Steelhawks", "HS", ""],
    ["Dukes of Hamilton", "DOH", ""],
    ["Niagara Falls Thunder", "NFT", ""],
    ["Niagara Falls Flyers", "NFF", ""],
    ["St. Catharines Black Hawks", "SCB", ""],
    ["Guelph Platers", "GPL", ""],
    ["Kitchener-Waterloo Rangers", "KWR", "KIT"]
  ];

  function escapeHTML(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]
    );
  }

  function normalizeTeam(value) {
    return String(value ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  const currentByCode = new Map();
  const currentByName = new Map();
  const historicalByName = new Map();

  for (const [name, code, filename] of OHL_TEAMS) {
    const team = {
      name,
      code,
      filename,
      logo: LOGO_BASE + filename,
      historical: false
    };

    currentByCode.set(code, team);
    currentByName.set(normalizeTeam(name), team);
    currentByName.set(normalizeTeam(code), team);
  }

  for (const [name, code, currentCode] of HISTORICAL_TEAMS) {
    historicalByName.set(normalizeTeam(name), {
      name,
      code,
      currentCode,
      historical: true,
      logo: ""
    });
  }

  const ALIASES = {
    barrie: "barriecolts",
    brampton: "bramptonsteelheads",
    brantford: "brantfordbulldogs",
    erie: "erieotters",
    flint: "flintfirebirds",
    guelph: "guelphstorm",
    kingston: "kingstonfrontenacs",
    kitchener: "kitchenerrangers",
    london: "londonknights",
    niagara: "niagaraicedogs",
    northbay: "northbaybattalion",
    oshawa: "oshawagenerals",
    ottawa: "ottawa67s",
    owensound: "owensoundattack",
    peterborough: "peterboroughpetes",
    saginaw: "saginawspirit",
    sarnia: "sarniasting",
    soo: "soogreyhounds",
    saultstemariegreyhounds: "soogreyhounds",
    saultstemarie: "soogreyhounds",
    sudbury: "sudburywolves",
    windsor: "windsorspitfires"
  };

  function getOHLTeam(value) {
    if (!value) return null;

    if (typeof value === "object") {
      return getOHLTeam(value.name || value.code);
    }

    const key = normalizeTeam(value);
    const canonical = ALIASES[key] || key;

    // Preserve historical identities.
    return (
      historicalByName.get(canonical) ||
      currentByName.get(canonical) ||
      null
    );
  }

  function getOHLFranchise(value) {
    const team = getOHLTeam(value);

    if (!team) return null;
    if (!team.historical) return team;

    return currentByCode.get(team.currentCode) || null;
  }

  function getOHLTeamName(value) {
    return getOHLTeam(value)?.name || String(value || "");
  }

  function getOHLTeamLogo(value) {
    const team = getOHLTeam(value);
    return team?.logo || "";
  }

  function initials(name) {
    const words = String(name || "")
      .trim()
      .split(/\s+/);

    return words
      .slice(0, 2)
      .map(word => word[0]?.toUpperCase() || "")
      .join("");
  }

  function teamLogo(
    value,
    className = "team-grid-logo"
  ) {
    const team = getOHLTeam(value);
    const name = team?.name || String(value || "OHL");
    const url = getOHLTeamLogo(value);

    const fallback = `
      <span class="team-logo-fallback">
        ${escapeHTML(initials(name))}
      </span>
    `;

    if (!url) {
      return `
        <span class="ice-team-logo ${escapeHTML(className)}"
              role="img"
              aria-label="${escapeHTML(name)}">
          ${fallback}
        </span>
      `;
    }

    return `
      <span class="ice-team-logo ${escapeHTML(className)}">
        ${fallback}
        <img
          src="${escapeHTML(url)}"
          alt="${escapeHTML(name)} logo"
          loading="lazy"
          decoding="async"
          onerror="this.onerror=null;this.remove()"
        >
      </span>
    `;
  }

  function getCurrentOHLTeams() {
    return OHL_TEAMS.map(([name, code]) =>
      getOHLTeam(code)
    );
  }

  function getHistoricalOHLTeams() {
    return [...historicalByName.values()];
  }

  function searchOHLTeams(query, includeHistorical = true) {
    const key = normalizeTeam(query);

    const teams = [
      ...getCurrentOHLTeams(),
      ...(includeHistorical ? getHistoricalOHLTeams() : [])
    ];

    return teams.filter(team =>
      normalizeTeam(team.name).includes(key) ||
      normalizeTeam(team.code).includes(key)
    );
  }

  Object.assign(window, {
    OHL_TEAMS,
    OHL_HISTORICAL_TEAMS: HISTORICAL_TEAMS,

    getOHLTeam,
    getOHLTeamName,
    getOHLTeamLogo,
    getOHLFranchise,
    getCurrentOHLTeams,
    getHistoricalOHLTeams,
    searchOHLTeams,
    teamLogo,

    IceIndexBranding: {
      version: "0.1.0",
      teams: OHL_TEAMS,
      historicalTeams: HISTORICAL_TEAMS,
      getTeam: getOHLTeam,
      getTeamLogo: getOHLTeamLogo,
      getFranchise: getOHLFranchise,
      teamLogo
    }
  });

  console.info(
    "[IceIndex] OHL branding loaded:",
    OHL_TEAMS.length,
    "current clubs"
  );
})();