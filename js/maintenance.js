
/* ============================================================
   ICEINDEX v0.10.0
   MAINTENANCE CONTROLLER

   MODES:
     1. Forced maintenance
        - Overrides the schedule
        - Displays website update messaging

     2. Scheduled maintenance
        - Daily, 2:00 AM – 6:00 AM Eastern
        - Displays regular cooling-down messaging

   FEATURES:
     - Automatic page redirects
     - Eastern Time / daylight saving support
     - Manual maintenance override
     - Dynamic cooling page content
     - Automatic return after maintenance
     - GitHub Pages compatible
     - Checks every 30 seconds

   ============================================================ */

(function () {
  "use strict";

  // ==========================================================
  // 01. CONFIGURATION
  // ==========================================================

  const CONFIG = {

    // Enable normal scheduled maintenance.
    scheduleEnabled: true,

    // IMPORTANT:
    //
    // true:
    //   Force the website offline at any time.
    //   Show the special website updates message.
    //
    // false:
    //   Follow the normal daily maintenance schedule.
    //
    forceMaintenance: false,

    // Eastern Time, including daylight saving.
    timeZone: "America/Toronto",

    // Days:
    // 0 = Sunday, 1 = Monday, etc.
    maintenanceDays: [0, 1, 2, 3, 4, 5, 6],

    // Normal daily maintenance window:
    // 2:00 AM until 6:00 AM Eastern.
    startHour: 2,
    endHour: 6,

    // Check status every 30 seconds.
    checkIntervalMs: 30000,

    // Site pages.
    dashboardFile: "index.html",
    coolingFile: "cooling.html"

  };

  // ==========================================================
  // 02. GET EASTERN DATE AND TIME
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
  // 03. DETERMINE MAINTENANCE MODE
  // ==========================================================

  function getMaintenanceMode() {

    // Forced maintenance always takes priority.
    if (CONFIG.forceMaintenance) {
      return "forced";
    }

    // Scheduled maintenance disabled.
    if (!CONFIG.scheduleEnabled) {
      return "none";
    }

    const now = getEasternTime();

    const validDay = CONFIG.maintenanceDays.includes(
      now.day
    );

    if (!validDay) {
      return "none";
    }

    let active = false;

    // Standard same-day maintenance window.
    if (CONFIG.startHour < CONFIG.endHour) {

      active = (
        now.hour >= CONFIG.startHour &&
        now.hour < CONFIG.endHour
      );

    }

    // Overnight maintenance window.
    else if (CONFIG.startHour > CONFIG.endHour) {

      active = (
        now.hour >= CONFIG.startHour ||
        now.hour < CONFIG.endHour
      );

    }

    // Equal hours represent a 24-hour window.
    else {
      active = true;
    }

    return active ? "scheduled" : "none";

  }

  function isMaintenanceActive() {
    return getMaintenanceMode() !== "none";
  }

  // ==========================================================
  // 04. PAGE DETECTION
  // ==========================================================

  function isCoolingPage() {

    const filename = window.location.pathname
      .split("/")
      .pop()
      .toLowerCase();

    return (
      filename === CONFIG.coolingFile.toLowerCase()
    );

  }

  function getPageUrl(filename) {

    return new URL(
      filename,
      window.location.href
    ).href;

  }

  // ==========================================================
  // 05. UPDATE COOLING PAGE CONTENT
  // ==========================================================

  function updateCoolingPage(mode) {

    if (!isCoolingPage()) {
      return;
    }

    // Set mode on body for CSS styling if needed.
    document.body.dataset.maintenanceMode = mode;

    const eyebrow = document.getElementById(
      "maintenance-eyebrow"
    );

    const heading = document.getElementById(
      "maintenance-heading"
    );

    const description = document.getElementById(
      "maintenance-description"
    );

    const statusTitle = document.getElementById(
      "maintenance-status-title"
    );

    const statusDescription = document.getElementById(
      "maintenance-status-description"
    );

    const schedule = document.getElementById(
      "maintenance-schedule"
    );

    const returnMessage = document.getElementById(
      "maintenance-return-message"
    );

    if (mode === "forced") {

      document.title = "IceIndex | Website Updates";

      if (eyebrow) {
        eyebrow.textContent = "Website Updates in Progress";
      }

      if (heading) {
        heading.innerHTML =
          'ICEINDEX IS<br><span>TEMPORARILY OFFLINE.</span>';
      }

      if (description) {
        description.textContent =
          "IceIndex is temporarily down while we " +
          "process updates to serve you better. " +
          "We're working to bring our hockey statistics, " +
          "player profiles and analytics back online.";
      }

      if (statusTitle) {
        statusTitle.textContent =
          "Website updates underway";
      }

      if (statusDescription) {
        statusDescription.textContent =
          "Our website is temporarily unavailable " +
          "while we process updates and improvements " +
          "to serve you better. Thank you for your patience.";
      }

      // Hide the regular daily maintenance schedule.
      if (schedule) {
        schedule.hidden = true;
      }

      if (returnMessage) {
        returnMessage.textContent =
          "Thank you for your patience. " +
          "We'll be back on the ice soon.";
      }

    } else {

      document.title = "IceIndex | Cooling Down";

      if (eyebrow) {
        eyebrow.textContent = "Scheduled Maintenance";
      }

      if (heading) {
        heading.innerHTML =
          'ICEINDEX IS<br><span>COOLING DOWN.</span>';
      }

      if (description) {
        description.textContent =
          "We're refreshing our hockey database " +
          "during our daily maintenance window. " +
          "Our stats, player profiles and analytics " +
          "will be back shortly.";
      }

      if (statusTitle) {
        statusTitle.textContent =
          "Database maintenance window";
      }

      if (statusDescription) {
        statusDescription.textContent =
          "IceIndex is temporarily unavailable while " +
          "scheduled daily maintenance is in progress.";
      }

      // Show the regular maintenance schedule.
      if (schedule) {
        schedule.hidden = false;
      }

      if (returnMessage) {
        returnMessage.textContent =
          "We'll be back on the ice shortly.";
      }

    }

  }

  // ==========================================================
  // 06. REDIRECT CONTROL
  // ==========================================================

  function checkMaintenance() {

    const mode = getMaintenanceMode();
    const active = mode !== "none";
    const coolingPage = isCoolingPage();

    // Website -> Cooling page.
    if (active && !coolingPage) {

      window.location.replace(
        getPageUrl(CONFIG.coolingFile)
      );

      return;
    }

    // Cooling page -> Website.
    if (!active && coolingPage) {

      window.location.replace(
        getPageUrl(CONFIG.dashboardFile)
      );

      return;
    }

    // Already on the cooling page:
    // Update the displayed message.
    if (active && coolingPage) {
      updateCoolingPage(mode);
    }

  }

  // ==========================================================
  // 07. INITIALIZE
  // ==========================================================

  function initialize() {

    checkMaintenance();

    // Periodically check maintenance status.
    window.setInterval(
      checkMaintenance,
      CONFIG.checkIntervalMs
    );

    // Check when the browser tab becomes visible.
    document.addEventListener(
      "visibilitychange",
      function () {

        if (!document.hidden) {
          checkMaintenance();
        }

      }
    );

    // Check when restoring the page.
    window.addEventListener(
      "pageshow",
      checkMaintenance
    );

  }

  // ==========================================================
  // 08. DEBUGGING ACCESS
  // ==========================================================

  window.IceIndexMaintenance = {

    isActive: isMaintenanceActive,

    getMode: getMaintenanceMode,

    check: checkMaintenance,

    getEasternTime: getEasternTime,

    config: CONFIG

  };

  // Wait for the page to be ready before changing content.
  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );

  } else {

    initialize();

  }

})();