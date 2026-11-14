/* IceIndex v0.11.0 — maintenance controller. GitHub Pages / America-Toronto. */
(function () {
  "use strict";
  const CONFIG = {
    scheduleEnabled: true,
    forceMaintenance: false,
    timeZone: "America/Toronto",
    maintenanceDays: [0,1,2,3,4,5,6],
    windows: [
      { id: "overnight", label: "Daily database refresh", start: 2*60, end: 6*60 },
      { id: "midday", label: "Daily quick refresh", start: 12*60+30, end: 12*60+45 }
    ],
    checkIntervalMs: 1000,
    dashboardFile: "index.html",
    coolingFile: "cooling.html"
  };
  const $ = id => document.getElementById(id);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: CONFIG.timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  });
  function getEasternTime(date = new Date()) {
    const p = Object.fromEntries(formatter.formatToParts(date).map(x => [x.type, x.value]));
    return {year:+p.year, month:+p.month, date:+p.day, day:({Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6})[p.weekday], hour:+p.hour, minute:+p.minute, second:+p.second};
  }
  // Find the actual UTC instant corresponding to a local Eastern clock time.
  // Re-evaluate the offset to handle EST/EDT and DST transitions.
  function easternInstant(y,m,d,h,min) {
    const desired = Date.UTC(y,m-1,d,h,min,0);
    let guess = desired;
    for (let i=0;i<5;i++) {
      const t=getEasternTime(new Date(guess));
      const apparent=Date.UTC(t.year,t.month-1,t.date,t.hour,t.minute,t.second);
      const delta=desired-apparent;
      if (Math.abs(delta)<1000) break;
      guess+=delta;
    }
    return guess;
  }
  function getStatus(date=new Date()) {
    if(CONFIG.forceMaintenance) return {mode:"forced",window:null};
    if(!CONFIG.scheduleEnabled) return {mode:"none",window:null};
    const t=getEasternTime(date);
    if(!CONFIG.maintenanceDays.includes(t.day)) return {mode:"none",window:null};
    const now=t.hour*60+t.minute;
    for(const w of CONFIG.windows) {
      if(now>=w.start && now<w.end) {
        const start=easternInstant(t.year,t.month,t.date,Math.floor(w.start/60),w.start%60);
        const end=easternInstant(t.year,t.month,t.date,Math.floor(w.end/60),w.end%60);
        return {mode:"scheduled",window:w,start,end};
      }
    }
    return {mode:"none",window:null};
  }
  function isCoolingPage() { return location.pathname.split('/').pop().toLowerCase()===CONFIG.coolingFile.toLowerCase(); }
  function pageUrl(file) { return new URL(file,location.href).href; }
  function setText(id,value){ const el=$(id);if(el)el.textContent=value; }
  function formatDuration(ms){ const s=Math.max(0,Math.ceil(ms/1000));return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(n=>String(n).padStart(2,'0')).join(':'); }
  function timeLabel(minutes){const h=Math.floor(minutes/60),m=minutes%60;return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;}
  function updateCoolingPage(status, date=new Date()) {
    if(!isCoolingPage()) return;
    document.body.dataset.maintenanceMode=status.mode;
    const forced=status.mode==='forced';
    document.title=forced?'IceIndex | Website Updates':'IceIndex | Cooling Down';
    setText('maintenance-eyebrow',forced?'Website updates':'Scheduled maintenance');
    const h=$('maintenance-heading');if(h)h.innerHTML=forced?'We’re <em>making updates.</em>':'We’re <em>cooling down.</em>';
    setText('maintenance-description',forced?'IceIndex is temporarily offline while we make improvements to the website.':'We’re taking a short break to refresh hockey data and check that everything is running smoothly.');
    setText('maintenance-why',forced?'We’re updating the website to keep IceIndex running smoothly. Thanks for your patience.':'Why the cooldown? We refresh game results, update player stats and run quick data checks so IceIndex stays accurate and reliable.');
    const why=$('maintenance-why');if(why&&!forced)why.innerHTML='<strong>Why the cooldown?</strong> We refresh game results, update player stats and run quick data checks so IceIndex stays accurate and reliable.';
    const schedule=$('maintenance-schedule');if(schedule)schedule.hidden=forced;
    document.querySelectorAll('[data-window]').forEach(el=>el.classList.toggle('active',!forced&&el.dataset.window===status.window?.id));
    const track=$('maintenance-progress');
    if(forced){
      setText('maintenance-status-title','Update in progress');
      setText('maintenance-countdown','Please stand by');
      setText('maintenance-status-description','Reopening time not yet confirmed');
      setText('maintenance-return-message','This page will return to IceIndex when maintenance is switched off.');
      if(track)track.hidden=true;
      return;
    }
    if(track)track.hidden=false;
    setText('maintenance-status-title','Back on the ice in');
    setText('maintenance-countdown',formatDuration(status.end-date.getTime()));
    setText('maintenance-status-description',`Scheduled reopening · ${timeLabel(status.window.end)} Eastern`);
    setText('maintenance-return-message','This page will return to IceIndex automatically when the window ends.');
    const pct=Math.min(100,Math.max(0,100*(date.getTime()-status.start)/(status.end-status.start)));
    if(track)track.setAttribute('aria-valuenow',String(Math.round(pct)));
    const fill=$('maintenance-progress-fill');if(fill)fill.style.width=pct.toFixed(2)+'%';
  }
  function checkMaintenance() {
    const now=new Date(), status=getStatus(now), active=status.mode!=='none', cooling=isCoolingPage();
    if(active&&!cooling){location.replace(pageUrl(CONFIG.coolingFile));return;}
    if(!active&&cooling){location.replace(pageUrl(CONFIG.dashboardFile));return;}
    if(active&&cooling)updateCoolingPage(status,now);
  }
  function initialize(){checkMaintenance();setInterval(checkMaintenance,CONFIG.checkIntervalMs);document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkMaintenance()});window.addEventListener('pageshow',checkMaintenance);}
  window.IceIndexMaintenance={isActive:()=>getStatus().mode!=='none',getMode:()=>getStatus().mode,getStatus,getEasternTime,check:checkMaintenance,config:CONFIG};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
