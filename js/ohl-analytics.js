
"use strict";

/* ============================================================
   ICEINDEX v0.8.0
   FILE 1 — js/ohl-analytics.js

   PLAYER ANALYTICS ENGINE

   FEATURES
   ------------------------------------------------------------
   - Normalized OHL player statistics
   - Per-game production
   - Shooting efficiency
   - Power-play contribution
   - Age and draft-year calculations
   - Position-based cohorts
   - Minimum-games eligibility
   - Percentile rankings
   - Player analytics cards
   - Radar chart datasets
   - Scatter plot datasets
   - Player comparisons
   - Historical development
   - Shot-event normalization
   - Shot location and zone summaries
   - Future expected-goals integration

   COMPATIBILITY
   ------------------------------------------------------------
   Designed for normalized records from:

     js/ohl-data.js v0.2.0

   Does not modify existing application state.

   PUBLIC API
   ------------------------------------------------------------
     window.OHLAnalytics

   ============================================================ */

(function () {

  /* ==========================================================
     01. CONFIGURATION
     ========================================================== */

  const VERSION = "0.3.0";

  const DEFAULTS = Object.freeze({
    minGP: 10,
    ageWindow: 1,
    percentilePrecision: 1,
    ratePrecision: 3,
    shootingPrecision: 1,
    minimumCohortSize: 5,
    minimumShotsForShootingPct: 20,
    minimumPointsForPPShare: 5
  });

  const METRICS = Object.freeze({

    gp: {
      label: "Games Played",
      short: "GP",
      unit: "count",
      higherBetter: true
    },

    g: {
      label: "Goals",
      short: "G",
      unit: "count",
      higherBetter: true
    },

    a: {
      label: "Assists",
      short: "A",
      unit: "count",
      higherBetter: true
    },

    pts: {
      label: "Points",
      short: "PTS",
      unit: "count",
      higherBetter: true
    },

    goalsPerGame: {
      label: "Goals per Game",
      short: "G/GP",
      unit: "rate",
      higherBetter: true
    },

    assistsPerGame: {
      label: "Assists per Game",
      short: "A/GP",
      unit: "rate",
      higherBetter: true
    },

    pointsPerGame: {
      label: "Points per Game",
      short: "PTS/GP",
      unit: "rate",
      higherBetter: true
    },

    shotsPerGame: {
      label: "Shots per Game",
      short: "S/GP",
      unit: "rate",
      higherBetter: true
    },

    shootingPct: {
      label: "Shooting Percentage",
      short: "SH%",
      unit: "percent",
      higherBetter: true
    },

    powerPlayPointsPerGame: {
      label: "Power-Play Points per Game",
      short: "PPP/GP",
      unit: "rate",
      higherBetter: true
    },

    powerPlayShare: {
      label: "Power-Play Point Share",
      short: "PPP%",
      unit: "percent",
      higherBetter: null
    },

    evenStrengthPointsPerGame: {
      label: "Estimated Non-PP Points per Game",
      short: "Non-PP/GP",
      unit: "rate",
      higherBetter: true
    },

    goalShare: {
      label: "Goal Share of Points",
      short: "G/PTS",
      unit: "percent",
      higherBetter: null
    },

    pimPerGame: {
      label: "Penalty Minutes per Game",
      short: "PIM/GP",
      unit: "rate",
      higherBetter: null
    },

    plusMinusPerGame: {
      label: "Plus/Minus per Game",
      short: "+/-/GP",
      unit: "rate",
      higherBetter: null
    }

  });

  const DEFAULT_RADAR_METRICS = Object.freeze([
    "goalsPerGame",
    "assistsPerGame",
    "pointsPerGame",
    "shotsPerGame",
    "shootingPct",
    "powerPlayPointsPerGame"
  ]);

  /* ==========================================================
     02. BASIC UTILITIES
     ========================================================== */

  function finite(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    const n = Number(
      String(value).replace(/,/g, "")
    );

    return Number.isFinite(n) ? n : null;
  }

  function safeDivide(numerator, denominator) {
    const a = finite(numerator);
    const b = finite(denominator);

    if (
      a === null ||
      b === null ||
      b <= 0
    ) {
      return null;
    }

    return a / b;
  }

  function round(value, digits = 2) {
    const n = finite(value);

    if (n === null) {
      return null;
    }

    const multiplier = 10 ** digits;

    return Math.round(
      (n + Number.EPSILON) * multiplier
    ) / multiplier;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(
      maximum,
      Math.max(minimum, value)
    );
  }

  function normalizedText(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function normalizeBirth(value) {
    if (
      window.IceIndexData &&
      typeof window.IceIndexData.normalizeBirth === "function"
    ) {
      return window.IceIndexData.normalizeBirth(value);
    }

    const text = String(value ?? "").trim();

    const match = text.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

    if (!match) {
      return "";
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

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

    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  function recordKey(record) {
    return String(
      record?.key ||
      record?.id ||
      normalizedText(record?.name)
    );
  }

  function seasonEndYear(record) {
    const direct = finite(record?.endYear);

    if (direct !== null) {
      return direct;
    }

    const season = String(
      record?.season ?? ""
    );

    const match = season.match(
      /^(\d{4})[-/](\d{2,4})$/
    );

    if (!match) {
      return null;
    }

    const start = Number(match[1]);
    let end = Number(match[2]);

    if (match[2].length === 2) {
      end += Math.floor(start / 100) * 100;

      if (end <= start) {
        end += 100;
      }
    }

    return end;
  }

  /* ==========================================================
     03. POSITION CLASSIFICATION
     ========================================================== */

  function positionGroup(position) {
    const value = normalizedText(position);

    if (!value) {
      return "UNKNOWN";
    }

    if (
      value === "d" ||
      value === "defence" ||
      value === "defense" ||
      value === "defenceman" ||
      value === "defenseman" ||
      value === "ld" ||
      value === "rd"
    ) {
      return "D";
    }

    if (
      value === "g" ||
      value === "goalie" ||
      value === "goaltender"
    ) {
      return "G";
    }

    if (
      [
        "f", "c", "lw", "rw",
        "center", "centre",
        "left wing", "right wing",
        "forward", "winger"
      ].includes(value)
    ) {
      return "F";
    }

    return "UNKNOWN";
  }

  /* ==========================================================
     04. AGE CALCULATIONS

     OHL seasonal age is measured on December 31
     of the season's starting calendar year.

     This is an analytical convention, not an
     official roster eligibility determination.

     ========================================================== */

  function ageOnDate(birth, dateString) {
    const normalized = normalizeBirth(birth);

    if (!normalized) {
      return null;
    }

    const birthday = new Date(
      normalized + "T00:00:00Z"
    );

    const target = new Date(
      dateString + "T00:00:00Z"
    );

    if (
      Number.isNaN(birthday.getTime()) ||
      Number.isNaN(target.getTime())
    ) {
      return null;
    }

    let age =
      target.getUTCFullYear() -
      birthday.getUTCFullYear();

    const birthdayMonth =
      birthday.getUTCMonth();

    const targetMonth =
      target.getUTCMonth();

    if (
      targetMonth < birthdayMonth ||
      (
        targetMonth === birthdayMonth &&
        target.getUTCDate() <
          birthday.getUTCDate()
      )
    ) {
      age--;
    }

    return age;
  }

  function seasonAge(record) {
    const endYear = seasonEndYear(record);

    if (endYear === null) {
      return null;
    }

    return ageOnDate(
      record.birth,
      `${endYear - 1}-12-31`
    );
  }

  function estimatedDraftYear(birth) {
    const normalized = normalizeBirth(birth);

    if (!normalized) {
      return null;
    }

    const [year, month, day] =
      normalized.split("-").map(Number);

    /*
      An estimated first NHL draft year:
      a player turns 18 by September 15
      of the draft year.

      Players born September 16 onward
      fall into the next draft cohort.
    */

    return (
      month > 9 ||
      (month === 9 && day >= 16)
    )
      ? year + 19
      : year + 18;
  }

  function draftStatus(record) {
    const draftYear =
      estimatedDraftYear(record.birth);

    const endYear =
      seasonEndYear(record);

    if (
      draftYear === null ||
      endYear === null
    ) {
      return {
        draftYear,
        offset: null,
        label: "Unknown"
      };
    }

    const offset =
      endYear - draftYear;

    let label = "DY";

    if (offset < 0) {
      label = `DY${offset}`;
    } else if (offset > 0) {
      label = `DY+${offset}`;
    }

    return {
      draftYear,
      offset,
      label
    };
  }

  /* ==========================================================
     05. PLAYER STATISTICAL RATES

     Null means the statistic cannot be
     calculated from available data.

     Zero remains a legitimate value.

     ========================================================== */

  function calculateRates(record) {
    const gp = finite(record?.gp);
    const g = finite(record?.g);
    const a = finite(record?.a);

    const pts =
      finite(record?.pts) ??
      (
        g !== null && a !== null
          ? g + a
          : null
      );

    const shots = finite(record?.shots);

    const ppg = finite(record?.ppg);
    const ppa = finite(record?.ppa);

    const ppp =
      finite(record?.ppp) ??
      (
        ppg !== null && ppa !== null
          ? ppg + ppa
          : null
      );

    const pim = finite(record?.pim);

    const plusMinus =
      finite(record?.plusMinus);

    const goalsPerGame =
      safeDivide(g, gp);

    const assistsPerGame =
      safeDivide(a, gp);

    const pointsPerGame =
      safeDivide(pts, gp);

    const shotsPerGame =
      safeDivide(shots, gp);

    const shootingPct =
      safeDivide(g, shots);

    const powerPlayPointsPerGame =
      safeDivide(ppp, gp);

    const powerPlayShare =
      safeDivide(ppp, pts);

    const goalShare =
      safeDivide(g, pts);

    /*
      This is NOT a verified even-strength
      points total.

      Subtracting power-play points leaves
      shorthanded and other non-PP scoring.
    */

    const nonPPPoints =
      pts !== null &&
      ppp !== null
        ? pts - ppp
        : null;

    const evenStrengthPointsPerGame =
      safeDivide(nonPPPoints, gp);

    return {
      gp,
      g,
      a,
      pts,
      shots,
      ppp,
      pim,
      plusMinus,

      goalsPerGame,
      assistsPerGame,
      pointsPerGame,
      shotsPerGame,

      shootingPct:
        shootingPct === null
          ? null
          : shootingPct * 100,

      powerPlayPointsPerGame,

      powerPlayShare:
        powerPlayShare === null
          ? null
          : powerPlayShare * 100,

      evenStrengthPointsPerGame,

      goalShare:
        goalShare === null
          ? null
          : goalShare * 100,

      pimPerGame:
        safeDivide(pim, gp),

      plusMinusPerGame:
        gp !== null &&
        gp > 0 &&
        plusMinus !== null
          ? plusMinus / gp
          : null
    };
  }

  function enrichRecord(record) {
    if (!record) {
      return null;
    }

    return {
      ...record,
      ...calculateRates(record),
      age: seasonAge(record),
      positionGroup:
        positionGroup(record.position),
      draft: draftStatus(record)
    };
  }

  /* ==========================================================
     06. RECORD DEDUPLICATION

     A player may have multiple team stints.

     Prefer an explicit season-total row.
     Otherwise combine distinct team stints.

     Records from current and history sources
     should not be counted twice.

     ========================================================== */

  function isTotalRow(record) {
    const team = normalizedText(record?.team);

    return (
      team === "total" ||
      team === "totals" ||
      team === "all teams" ||
      team === "multiple teams" ||
      team === "combined" ||
      team === "2 teams" ||
      team === "3 teams" ||
      team === "4 teams"
    );
  }

  function sourcePriority(record) {
    return record?.source === "current"
      ? 2
      : 1;
  }

  const SUM_FIELDS = [
    "gp", "g", "a", "pts",
    "ppg", "ppa", "ppp",
    "shg", "sha", "shpts",
    "gwg", "eng", "pim", "shots"
  ];

  function sumKnown(records, key) {
    const values = records
      .map(record => finite(record[key]))
      .filter(value => value !== null);

    return values.length
      ? values.reduce((a, b) => a + b, 0)
      : null;
  }

  function combineStints(records) {
    if (!records.length) {
      return null;
    }

    if (records.length === 1) {
      return { ...records[0] };
    }

    const preferred = [...records].sort(
      (a, b) =>
        sourcePriority(b) -
        sourcePriority(a)
    )[0];

    const combined = {
      ...preferred,
      team: records
        .map(record => record.team)
        .filter(Boolean)
        .filter(
          (team, index, array) =>
            array.indexOf(team) === index
        )
        .join(" / "),
      combinedStints: records.length,
      isCombinedSeason: true
    };

    for (const key of SUM_FIELDS) {
      combined[key] =
        sumKnown(records, key);
    }

    /*
      Plus/minus is additive across stints,
      but only when every stint has a value.
    */

    const plusMinusValues = records.map(
      record => finite(record.plusMinus)
    );

    combined.plusMinus =
      plusMinusValues.every(
        value => value !== null
      )
        ? plusMinusValues.reduce(
            (a, b) => a + b, 0
          )
        : null;

    return combined;
  }

  function seasonRecords(records) {
    const groups = new Map();

    for (const record of records || []) {
      if (!record || !record.name) {
        continue;
      }

      const year = seasonEndYear(record);

      if (year === null) {
        continue;
      }

      const key =
        `${recordKey(record)}|${year}`;

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key).push(record);
    }

    const result = [];

    for (const group of groups.values()) {
      /*
        Remove repeated source rows for
        the same team and season.
      */

      const byTeam = new Map();

      for (const record of group) {
        const team = normalizedText(
          record.team
        );

        const existing =
          byTeam.get(team);

        if (
          !existing ||
          sourcePriority(record) >
            sourcePriority(existing)
        ) {
          byTeam.set(team, record);
        }
      }

      const unique =
        [...byTeam.values()];

      const total = unique
        .filter(isTotalRow)
        .sort(
          (a, b) =>
            sourcePriority(b) -
            sourcePriority(a)
        )[0];

      const resolved = total
        ? { ...total }
        : combineStints(unique);

      if (resolved) {
        result.push(
          enrichRecord(resolved)
        );
      }
    }

    return result.sort(
      (a, b) =>
        (b.endYear || 0) -
        (a.endYear || 0) ||
        a.name.localeCompare(b.name)
    );
  }

  /* ==========================================================
     07. COHORT FILTERING

     Supported filters:
       season
       position
       age
       ageWindow
       draftYear
       team
       minGP

     ========================================================== */

  function buildCohort(
    records,
    options = {}
  ) {
    const {
      season = null,
      position = "ALL",
      age = null,
      ageWindow = DEFAULTS.ageWindow,
      draftYear = null,
      team = null,
      minGP = DEFAULTS.minGP
    } = options;

    const resolved =
      seasonRecords(records);

    const targetPosition =
      String(position).toUpperCase();

    return resolved.filter(record => {
      if (
        season !== null &&
        seasonEndYear(record) !==
          Number(season)
      ) {
        return false;
      }

      if (
        targetPosition !== "ALL" &&
        targetPosition !== "ANY" &&
        record.positionGroup !==
          targetPosition
      ) {
        return false;
      }

      if (age !== null) {
        if (
          record.age === null ||
          Math.abs(
            record.age - Number(age)
          ) > Number(ageWindow)
        ) {
          return false;
        }
      }

      if (
        draftYear !== null &&
        record.draft?.draftYear !==
          Number(draftYear)
      ) {
        return false;
      }

      if (
        team !== null &&
        normalizedText(record.team) !==
          normalizedText(team)
      ) {
        return false;
      }

      if (
        finite(record.gp) === null ||
        record.gp < minGP
      ) {
        return false;
      }

      return true;
    });
  }

  /* ==========================================================
     08. METRIC ELIGIBILITY

     Prevents tiny denominators from
     distorting percentage rankings.

     ========================================================== */

  function metricEligible(
    record,
    metric,
    options = {}
  ) {
    const rates = calculateRates(record);

    const minGP =
      options.minGP ??
      DEFAULTS.minGP;

    if (
      rates.gp === null ||
      rates.gp < minGP
    ) {
      return false;
    }

    if (
      metric === "shootingPct" &&
      (
        rates.shots === null ||
        rates.shots <
          (
            options.minShots ??
            DEFAULTS.minimumShotsForShootingPct
          )
      )
    ) {
      return false;
    }

    if (
      metric === "powerPlayShare" &&
      (
        rates.pts === null ||
        rates.pts <
          (
            options.minPoints ??
            DEFAULTS.minimumPointsForPPShare
          )
      )
    ) {
      return false;
    }

    return finite(rates[metric]) !== null;
  }

  /* ==========================================================
     09. PERCENTILE RANKINGS

     Midrank percentile:

       (count below + 0.5 * count tied) / N * 100

     For a metric where higher is better,
     a higher percentile means a larger value
     relative to the comparison group.

     Metrics with no defined performance
     direction are distribution percentiles,
     not automatically "better" scores.

     ========================================================== */

  function percentile(
    value,
    distribution,
    options = {}
  ) {
    const target = finite(value);

    if (target === null) {
      return null;
    }

    const values = (
      distribution || []
    )
      .map(finite)
      .filter(value => value !== null);

    if (!values.length) {
      return null;
    }

    const tolerance =
      options.tolerance ?? 1e-9;

    let below = 0;
    let tied = 0;

    for (const candidate of values) {
      if (
        Math.abs(candidate - target) <=
        tolerance
      ) {
        tied++;
      } else if (candidate < target) {
        below++;
      }
    }

    return round(
      (
        (below + tied * 0.5) /
        values.length
      ) * 100,
      DEFAULTS.percentilePrecision
    );
  }

  function metricDistribution(
    records,
    metric,
    options = {}
  ) {
    return (records || [])
      .filter(record =>
        metricEligible(
          record,
          metric,
          options
        )
      )
      .map(record =>
        calculateRates(record)[metric]
      );
  }

  function metricPercentile(
    record,
    cohort,
    metric,
    options = {}
  ) {
    if (!METRICS[metric]) {
      return null;
    }

    if (
      !metricEligible(
        record,
        metric,
        options
      )
    ) {
      return null;
    }

    const distribution =
      metricDistribution(
        cohort,
        metric,
        options
      );

    if (
      distribution.length <
      (
        options.minimumCohortSize ??
        DEFAULTS.minimumCohortSize
      )
    ) {
      return null;
    }

    const value =
      calculateRates(record)[metric];

    const rawPercentile =
      percentile(
        value,
        distribution
      );

    if (rawPercentile === null) {
      return null;
    }

    const higherBetter =
      METRICS[metric].higherBetter;

    return {
      metric,
      value,
      percentile: rawPercentile,
      performancePercentile:
        higherBetter === false
          ? round(
              100 - rawPercentile,
              1
            )
          : higherBetter === true
            ? rawPercentile
            : null,
      sampleSize:
        distribution.length,
      label:
        METRICS[metric].label,
      higherBetter
    };
  }

  /* ==========================================================
     10. PLAYER ANALYTICS CARD

     Returns data only. The UI renderer
     decides how to display it.

     ========================================================== */

  function playerCard(
    player,
    records,
    options = {}
  ) {
    if (!player) {
      return null;
    }

    const season =
      seasonEndYear(player);

    const cohortOptions = {
      season:
        options.season ?? season,
      position:
        options.position ?? "ALL",
      minGP:
        options.minGP ??
        DEFAULTS.minGP,
      age:
        options.age ?? null,
      ageWindow:
        options.ageWindow ??
        DEFAULTS.ageWindow,
      draftYear:
        options.draftYear ?? null
    };

    const cohort =
      buildCohort(
        records,
        cohortOptions
      );

    const metrics =
      options.metrics ||
      DEFAULT_RADAR_METRICS;

    const percentiles = {};

    for (const metric of metrics) {
      percentiles[metric] =
        metricPercentile(
          player,
          cohort,
          metric,
          options
        );
    }

    return {
      player:
        enrichRecord(player),
      season,
      cohort: {
        count: cohort.length,
        filters: cohortOptions
      },
      metrics: percentiles,
      generatedAt:
        new Date().toISOString()
    };
  }

  /* ==========================================================
     11. RADAR CHART DATA

     Each axis uses a percentile score
     between 0 and 100.

     Missing values remain null.

     ========================================================== */

  function radarData(
    players,
    records,
    options = {}
  ) {
    const metrics =
      options.metrics ||
      DEFAULT_RADAR_METRICS;

    const validMetrics =
      metrics.filter(
        metric => METRICS[metric]
      );

    const cohort =
      buildCohort(
        records,
        options
      );

    const datasets = (
      players || []
    ).map(player => {

      const values = {};
      const details = {};

      for (const metric of validMetrics) {
        const result =
          metricPercentile(
            player,
            cohort,
            metric,
            options
          );

        values[metric] =
          result?.percentile ?? null;

        details[metric] =
          result;
      }

      return {
        key: recordKey(player),
        name: player.name,
        team: player.team,
        season: player.season,
        values,
        details
      };
    });

    return {
      axes:
        validMetrics.map(metric => ({
          key: metric,
          label:
            METRICS[metric].label,
          short:
            METRICS[metric].short,
          minimum: 0,
          maximum: 100
        })),
      datasets,
      cohortSize:
        cohort.length,
      scale:
        "percentile"
    };
  }

  /* ==========================================================
     12. SCATTER PLOT DATA

     Example:

       scatterData(records, {
         xMetric: "goalsPerGame",
         yMetric: "assistsPerGame",
         season: 2027,
         minGP: 10
       })

     ========================================================== */

  function scatterData(
    records,
    options = {}
  ) {
    const xMetric =
      options.xMetric ||
      "goalsPerGame";

    const yMetric =
      options.yMetric ||
      "assistsPerGame";

    if (
      !METRICS[xMetric] ||
      !METRICS[yMetric]
    ) {
      throw new Error(
        "Unknown scatter plot metric."
      );
    }

    const cohort =
      buildCohort(
        records,
        options
      );

    const points = [];

    for (const player of cohort) {
      if (
        !metricEligible(
          player,
          xMetric,
          options
        ) ||
        !metricEligible(
          player,
          yMetric,
          options
        )
      ) {
        continue;
      }

      const rates =
        calculateRates(player);

      points.push({
        key:
          recordKey(player),
        name:
          player.name,
        team:
          player.team,
        season:
          player.season,
        age:
          seasonAge(player),
        position:
          positionGroup(
            player.position
          ),
        gp:
          rates.gp,
        x:
          rates[xMetric],
        y:
          rates[yMetric],
        photo:
          player.photo || "",
        player
      });
    }

    return {
      xMetric,
      yMetric,
      xLabel:
        METRICS[xMetric].label,
      yLabel:
        METRICS[yMetric].label,
      points,
      count:
        points.length
    };
  }

  /* ==========================================================
     13. LEADERBOARDS
     ========================================================== */

  function leaderboard(
    records,
    metric = "pointsPerGame",
    options = {}
  ) {
    if (!METRICS[metric]) {
      return [];
    }

    const cohort =
      buildCohort(
        records,
        options
      );

    const limit =
      options.limit ?? 25;

    return cohort
      .filter(player =>
        metricEligible(
          player,
          metric,
          options
        )
      )
      .map(player => ({
        ...player,
        metric,
        metricValue:
          calculateRates(player)[metric]
      }))
      .sort(
        (a, b) =>
          b.metricValue -
          a.metricValue ||
          (b.pts ?? 0) -
          (a.pts ?? 0) ||
          a.name.localeCompare(b.name)
      )
      .slice(0, limit);
  }

  /* ==========================================================
     14. TWO-PLAYER COMPARISON
     ========================================================== */

  function comparePlayers(
    playerA,
    playerB,
    records,
    options = {}
  ) {
    const metrics =
      options.metrics ||
      DEFAULT_RADAR_METRICS;

    const cohort =
      buildCohort(
        records,
        options
      );

    const rows = metrics
      .filter(metric => METRICS[metric])
      .map(metric => {

        const a =
          playerA
            ? metricPercentile(
                playerA,
                cohort,
                metric,
                options
              )
            : null;

        const b =
          playerB
            ? metricPercentile(
                playerB,
                cohort,
                metric,
                options
              )
            : null;

        return {
          metric,
          label:
            METRICS[metric].label,
          playerA: a,
          playerB: b
        };
      });

    return {
      playerA:
        playerA
          ? enrichRecord(playerA)
          : null,
      playerB:
        playerB
          ? enrichRecord(playerB)
          : null,
      cohortSize:
        cohort.length,
      rows
    };
  }

  /* ==========================================================
     15. PLAYER DEVELOPMENT

     Returns a chronological series of
     season-by-season production.

     ========================================================== */

  function development(
    records,
    playerIdentifier
  ) {
    const target =
      String(playerIdentifier ?? "");

    const seasons =
      seasonRecords(records)
        .filter(record =>
          recordKey(record) === target ||
          String(record.id) === target ||
          normalizedText(record.name) ===
            normalizedText(target)
        )
        .sort(
          (a, b) =>
            a.endYear - b.endYear
        );

    return seasons.map(
      (record, index) => {
        const previous =
          index > 0
            ? seasons[index - 1]
            : null;

        const currentRate =
          record.pointsPerGame;

        const previousRate =
          previous?.pointsPerGame;

        const change =
          currentRate !== null &&
          previousRate !== null &&
          previousRate !== undefined
            ? currentRate -
              previousRate
            : null;

        return {
          ...record,
          draft:
            draftStatus(record),
          pointsPerGameChange:
            change,
          pointsPerGameChangePct:
            change !== null &&
            previousRate > 0
              ? change /
                previousRate * 100
              : null
        };
      }
    );
  }

  /* ==========================================================
     16. SHOT EVENT INTERFACE

     Designed to accept future normalized
     event-level shot data.

     A shot event may contain:

       playerID
       playerName
       gameID
       date
       team
       x
       y
       eventType
       result
       strength
       period
       xG

     No coordinates or xG values are
     fabricated when absent.

     ========================================================== */

  const SHOT_EVENT_TYPES =
    new Set([
      "SHOT",
      "GOAL",
      "MISSED_SHOT",
      "BLOCKED_SHOT"
    ]);

  function normalizeShotEvent(raw) {
    if (!raw) {
      return null;
    }

    const eventType = String(
      raw.eventType ||
      raw.type ||
      raw.EventType ||
      raw.event ||
      ""
    )
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");

    if (
      !SHOT_EVENT_TYPES.has(eventType)
    ) {
      return null;
    }

    const x = finite(
      raw.x ??
      raw.X ??
      raw.xCoordinate ??
      raw.XCoordinate
    );

    const y = finite(
      raw.y ??
      raw.Y ??
      raw.yCoordinate ??
      raw.YCoordinate
    );

    const suppliedXG = finite(
      raw.xG ??
      raw.xg ??
      raw.expectedGoals
    );

    return {
      playerID: String(
        raw.playerID ??
        raw.PlayerID ??
        ""
      ),
      playerName: String(
        raw.playerName ??
        raw.PlayerName ??
        raw.name ??
        ""
      ),
      gameID: String(
        raw.gameID ??
        raw.GameID ??
        ""
      ),
      date: String(
        raw.date ??
        raw.Date ??
        ""
      ),
      team: String(
        raw.team ??
        raw.Team ??
        ""
      ),
      x,
      y,
      eventType,
      result: String(
        raw.result ??
        raw.Result ??
        ""
      ),
      strength: String(
        raw.strength ??
        raw.Strength ??
        ""
      ),
      period: finite(
        raw.period ??
        raw.Period
      ),
      xG:
        suppliedXG !== null &&
        suppliedXG >= 0 &&
        suppliedXG <= 1
          ? suppliedXG
          : null,
      hasCoordinates:
        x !== null &&
        y !== null,
      isGoal:
        eventType === "GOAL",
      isOnGoal:
        eventType === "SHOT" ||
        eventType === "GOAL"
    };
  }

  function normalizeShotEvents(rows) {
    return (rows || [])
      .map(normalizeShotEvent)
      .filter(Boolean);
  }

  /* ==========================================================
     17. SHOT SUMMARY

     Reports only directly supported
     statistics.

     ========================================================== */

  function shotSummary(events) {
    const normalized =
      normalizeShotEvents(events);

    const goals =
      normalized.filter(
        event => event.isGoal
      ).length;

    const shotsOnGoal =
      normalized.filter(
        event => event.isOnGoal
      ).length;

    const attempts =
      normalized.length;

    const withCoordinates =
      normalized.filter(
        event => event.hasCoordinates
      );

    const withXG =
      normalized.filter(
        event => event.xG !== null
      );

    const xG =
      withXG.length
        ? withXG.reduce(
            (sum, event) =>
              sum + event.xG,
            0
          )
        : null;

    return {
      attempts,
      shotsOnGoal,
      goals,
      shootingPct:
        shotsOnGoal > 0
          ? goals /
            shotsOnGoal * 100
          : null,
      mappedAttempts:
        withCoordinates.length,
      xG,
      xGEvents:
        withXG.length,
      xGComplete:
        attempts > 0 &&
        withXG.length === attempts
    };
  }

  /* ==========================================================
     18. SHOT LOCATION DATA

     Returns raw, verified coordinates.

     Rink orientation and attacking
     direction are NOT assumed.

     ========================================================== */

  function shotMapData(
    events,
    options = {}
  ) {
    const normalized =
      normalizeShotEvents(events);

    const playerID =
      options.playerID !== undefined
        ? String(options.playerID)
        : null;

    const gameID =
      options.gameID !== undefined
        ? String(options.gameID)
        : null;

    const team =
      options.team !== undefined
        ? normalizedText(options.team)
        : null;

    const filtered =
      normalized.filter(event => {
        if (
          playerID !== null &&
          event.playerID !== playerID
        ) {
          return false;
        }

        if (
          gameID !== null &&
          event.gameID !== gameID
        ) {
          return false;
        }

        if (
          team !== null &&
          normalizedText(event.team) !==
            team
        ) {
          return false;
        }

        return true;
      });

    const points =
      filtered
        .filter(
          event => event.hasCoordinates
        )
        .map(event => ({
          x: event.x,
          y: event.y,
          type: event.eventType,
          goal: event.isGoal,
          xG: event.xG,
          playerID: event.playerID,
          playerName: event.playerName,
          gameID: event.gameID,
          period: event.period
        }));

    return {
      points,
      count: points.length,
      summary:
        shotSummary(filtered),
      coordinateSystem:
        "source-native",
      orientationNormalized:
        false
    };
  }

  /* ==========================================================
     19. SHOT ZONE SUMMARY

     Zone classification requires a
     documented coordinate system.

     Until rink dimensions and orientation
     are verified, return unavailable.

     ========================================================== */

  function shotZoneSummary(
    events,
    zoneClassifier = null
  ) {
    if (
      typeof zoneClassifier !== "function"
    ) {
      return {
        available: false,
        reason:
          "Shot coordinate system and zone " +
          "boundaries have not been verified.",
        zones: []
      };
    }

    const normalized =
      normalizeShotEvents(events)
        .filter(
          event => event.hasCoordinates
        );

    const groups = new Map();

    for (const event of normalized) {
      const zone =
        zoneClassifier(event);

      if (!zone) {
        continue;
      }

      if (!groups.has(zone)) {
        groups.set(zone, []);
      }

      groups.get(zone).push(event);
    }

    return {
      available: true,
      zones:
        [...groups.entries()]
          .map(([zone, rows]) => ({
            zone,
            ...shotSummary(rows)
          }))
    };
  }

  /* ==========================================================
     20. EXPECTED GOALS SUMMARY

     Uses supplied event-level xG only.

     Does not calculate xG from distance
     or shot location without a model.

     ========================================================== */

  function expectedGoalsSummary(events) {
    const normalized =
      normalizeShotEvents(events);

    const eligible =
      normalized.filter(
        event => event.xG !== null
      );

    const xG =
      eligible.length
        ? eligible.reduce(
            (sum, event) =>
              sum + event.xG,
            0
          )
        : null;

    const goals =
      eligible.filter(
        event => event.isGoal
      ).length;

    return {
      xG,
      goals,
      eventsWithXG:
        eligible.length,
      totalEvents:
        normalized.length,
      complete:
        normalized.length > 0 &&
        eligible.length ===
          normalized.length,
      goalsAboveExpected:
        xG === null
          ? null
          : goals - xG,
      model:
        "source-provided"
    };
  }

  /* ==========================================================
     21. ANALYTICS VALIDATION
     ========================================================== */

  function validateRecords(records) {
    const summary = {
      total: 0,
      missingName: 0,
      missingSeason: 0,
      missingGP: 0,
      missingBirth: 0,
      missingShots: 0,
      missingPosition: 0
    };

    for (const record of records || []) {
      summary.total++;

      if (!record?.name) {
        summary.missingName++;
      }

      if (
        seasonEndYear(record) === null
      ) {
        summary.missingSeason++;
      }

      if (
        finite(record?.gp) === null
      ) {
        summary.missingGP++;
      }

      if (
        !normalizeBirth(record?.birth)
      ) {
        summary.missingBirth++;
      }

      if (
        finite(record?.shots) === null
      ) {
        summary.missingShots++;
      }

      if (
        positionGroup(
          record?.position
        ) === "UNKNOWN"
      ) {
        summary.missingPosition++;
      }
    }

    return summary;
  }

  /* ==========================================================
     22. PUBLIC API
     ========================================================== */

  const API = Object.freeze({
    version: VERSION,

    defaults: DEFAULTS,
    metrics: METRICS,
    radarMetrics:
      DEFAULT_RADAR_METRICS,

    finite,
    safeDivide,
    round,

    positionGroup,
    ageOnDate,
    seasonAge,
    estimatedDraftYear,
    draftStatus,

    calculateRates,
    enrichRecord,

    combineStints,
    seasonRecords,
    buildCohort,

    metricEligible,
    percentile,
    metricDistribution,
    metricPercentile,

    playerCard,
    radarData,
    scatterData,
    leaderboard,
    comparePlayers,
    development,

    normalizeShotEvent,
    normalizeShotEvents,
    shotSummary,
    shotMapData,
    shotZoneSummary,
    expectedGoalsSummary,

    validateRecords
  });

  window.OHLAnalytics = API;

  console.info(
    `IceIndex Player Analytics v${VERSION} ready.`
  );

})();

/* ============================================================
   END — ICEINDEX v0.8.0 PLAYER ANALYTICS ENGINE
   ============================================================ */