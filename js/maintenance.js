
/* ============================================================
   ICEINDEX v0.6.0
   WEEKLY MAINTENANCE CONTROLLER

   Schedule:
     Monday, 2:00 AM – 6:00 AM Eastern

   Features:
     - Automatic scheduled maintenance
     - Manual maintenance override
     - Redirect to standalone cooling.html
     - Automatic return after maintenance
     - GitHub Pages compatible

   Does NOT modify the dashboard or data pipeline.
   ============================================================ */

(function () {
  "use strict";

  // ==========================================================
  // CONFIGURATION
  // ==========================================================

  const CONFIG = {
    // Automatically enable maintenance on Mondays.
    scheduleEnabled: true,

    // Set to true to force maintenance at any time.
    // Set back to false when finished testing.
    forceMaintenance: false,

    // Eastern Time, including daylight saving.
    timeZone: "America/Toronto",

    // Monday = 1
    maintenanceDay: 1,

    // 24-hour clock, Eastern Time.
    startHour: 2,
    endHour: 6,

    // Check every 30 seconds.
    checkIntervalMs: 30000,

    dashboardFile: "index.html",
    coolingFile: "cooling.html"
  };

  // ==========================================================
  // GET EASTERN DATE AND TIME
  // ==========================================================

  function getEasternTime() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: CONFIG.timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date());

    const values = {};

    for (const part of parts) {
      values[part.type] = part.value;
    }

    const weekdays = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6
    };

    return {
      day: weekdays[values.weekday],
      hour: Number(values.hour),
      minute: Number(values.minute)
    };
  }

  // ==========================================================
  // DETERMINE MAINTENANCE STATUS
  // ==========================================================

  function isMaintenanceActive() {
    if (CONFIG.forceMaintenance) {
      return true;
    }

    if (!CONFIG.scheduleEnabled) {
      return false;
    }

    const now = getEasternTime();

    return (
      now.day === CONFIG.maintenanceDay &&
      now.hour >= CONFIG.startHour &&
      now.hour < CONFIG.endHour
    );
  }

  // ==========================================================
  // PAGE DETECTION
  // ==========================================================

  function isCoolingPage() {
    const filename = window.location.pathname
      .split("/")
      .pop()
      .toLowerCase();

    return filename === CONFIG.coolingFile.toLowerCase();
  }

  function getPageUrl(filename) {
    return new URL(filename, window.location.href).href;
  }

  // ==========================================================
  // REDIRECT CONTROL
  // ==========================================================

  function checkMaintenance() {
    const active = isMaintenanceActive();
    const coolingPage = isCoolingPage();

    // Dashboard -> Cooling
    if (active && !coolingPage) {
      window.location.replace(
        getPageUrl(CONFIG.coolingFile)
      );
      return;
    }

    // Cooling -> Dashboard
    if (!active && coolingPage) {
      window.location.replace(
        getPageUrl(CONFIG.dashboardFile)
      );
    }
  }

  // ==========================================================
  // INITIAL CHECK
  // ==========================================================

  checkMaintenance();

  // ==========================================================
  // AUTOMATIC STATUS CHECKS
  // ==========================================================

  // On cooling.html, check periodically so visitors
  // return to the dashboard when maintenance ends.
  if (isCoolingPage()) {
    window.setInterval(
      checkMaintenance,
      CONFIG.checkIntervalMs
    );
  }

  // Recheck when a visitor returns to the tab.
  document.addEventListener(
    "visibilitychange",
    function () {
      if (!document.hidden) {
        checkMaintenance();
      }
    }
  );

  // Make maintenance status available for debugging.
  window.IceIndexMaintenance = {
    isActive: isMaintenanceActive,
    check: checkMaintenance
  };

})();