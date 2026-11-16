/* IceIndex v0.14.0: label the home scoreboard according to the existing 10:45 AM Toronto game-date rollover. */
(() => {
  'use strict';
  function beforeRollover() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date());
    const value = type => Number(parts.find(part => part.type === type)?.value || 0);
    return value('hour') * 60 + value('minute') < 10 * 60 + 45;
  }
  function updateHeading() {
    const widget = document.getElementById('igc-daily-widget');
    if (!widget) return;
    const heading = widget.querySelector('.igc-daily-head strong');
    if (!heading) return;
    const yesterday = beforeRollover();
    const title = yesterday ? "Yesterday's OHL scores" : "Today's OHL games";
    if (heading.textContent !== title) heading.textContent = title;
    widget.setAttribute('aria-label', title);
    const empty = widget.querySelector('.igc-daily-none');
    if (empty) {
      const message = yesterday ? 'No OHL games scheduled yesterday.' : 'No OHL games scheduled today.';
      if (empty.textContent !== message) empty.textContent = message;
    }
  }
  function init() {
    const target = document.getElementById('main-content') || document.body;
    const observer = new MutationObserver(updateHeading);
    observer.observe(target, {childList: true, subtree: true});
    updateHeading();
    // Handle the 10:45 AM rollover without requiring a page reload.
    setInterval(updateHeading, 30000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
