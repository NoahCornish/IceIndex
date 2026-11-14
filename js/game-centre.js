"use strict";
/* IceIndex OHL Game Centre — browser-only, reads existing published 2026–27 CSVs. */
window.IceIndexGameCentre = (() => {
  const BASE = "data/games/2026-27/";
  const sources = {
    schedule: BASE + "schedule.csv",
    summary: BASE + "game_event_summary.csv",
    shots: BASE + "player_shot_locations.csv",
    logs: BASE + "player_game_logs_enriched.csv",
    events: BASE + "game_events.csv",
    metadata: BASE + "game_metadata.csv",
    periods: BASE + "game_period_stats.csv",
    goalies: BASE + "game_goalie_stats.csv",
    officialMetadata: BASE + "official_game_metadata.csv",
    officialPeriods: BASE + "official_period_stats.csv",
    officialGoals: BASE + "official_scoring_plays.csv",
    officialGoalies: BASE + "official_goalie_stats.csv",
    officialSkaters: BASE + "official_skater_stats.csv",
    officialPenalties: BASE + "official_penalties.csv",
    officialStars: BASE + "official_three_stars.csv"
  };
  const cache = {}, failures = {};
  let root = null, activeId = null;
  const activityIds = new Set();
  const state = { team:"all", status:"all", date:"", search:"", page:1, perPage:30, shotTeam:"all", shotType:"all", period:"all" };
  // IceIndex already provides verified OHL team-logo mappings via ohl-branding.js.
  function logo(team, cls="igc-team-logo") {
    const url=typeof window.getOHLLogoURL==="function" ? window.getOHLLogoURL(team) : "";
    return url ? `<img class="${cls}" src="${esc(url)}" alt="${esc(team)} logo" loading="lazy" onerror="this.style.display='none'">` : `<span class="${cls} igc-logo-fallback" aria-hidden="true">${esc((team||'OHL').split(' ').map(w=>w[0]).slice(0,2).join(''))}</span>`;
  }
  // Use the application's existing data-person navigation handler.
  // The app resolves official player IDs to its internal player keys.
  function playerLink(id, name, cls="igc-player-link") {
    const playerId=String(id??"").trim();
    const label=esc(name||"Player unavailable");
    return /^\d+$/.test(playerId)
      ? `<a href="#profile" class="${cls}" data-person="${esc(playerId)}" title="Open ${label} profile">${label}</a>`
      : `<span>${label}</span>`;
  }
  // Goaltender links use the dedicated goalie engine's data-goalie-id handler.
  function goalieLink(id, name, cls="igc-player-link") {
    const goalieId=String(id??"").trim();
    const label=esc(name||"Goaltender unavailable");
    return /^\d+$/.test(goalieId)
      ? `<a href="#goalie-profile" class="${cls}" data-goalie-id="${esc(goalieId)}" title="Open ${label} goaltender profile">${label}</a>`
      : `<span>${label}</span>`;
  }
  function portrait(playerId, name, cls="igc-player-photo") {
    const id=String(playerId||"").trim();
    const initials=String(name||"?").split(/\s+/).map(w=>w[0]||"").slice(0,2).join("").toUpperCase();
    if(!/^\d+$/.test(id))return `<span class="${cls} igc-photo-fallback">${esc(initials)}</span>`;
    // Matches the existing IceIndex OHL player-headshot convention.
    return `<span class="${cls} igc-photo-frame"><img src="https://assets.leaguestat.com/ohl/240x240/${id}.jpg" alt="${esc(name)}" loading="lazy" onerror="this.remove()"><span class="igc-photo-initials">${esc(initials)}</span></span>`;
  }
  function torontoToday() {
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
    const v=Object.fromEntries(parts.map(p=>[p.type,p.value]));
    const date=`${v.year}-${v.month}-${v.day}`;
    if(Number(v.hour)*60+Number(v.minute)>=10*60+45)return date;
    const d=new Date(date+"T12:00:00Z");d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10);
  }
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const get = (r,...keys) => { for(const key of keys) {const v=r?.[key]; if(v!==undefined && v!==null && String(v).trim()!=="")return String(v).trim();} return ""; };
  const num = v => v===""||v==null||!Number.isFinite(+v)?null:+v;
  const fmt = v => v==null ? "—" : Number(v).toLocaleString("en-CA");
  function parseCSV(text) {
    const rows=[]; let row=[], field="", quoted=false;
    text=String(text).replace(/^\uFEFF/,"");
    for(let i=0;i<text.length;i++) {const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(field);field="";}else if(c==='\n'){row.push(field.replace(/\r$/,""));rows.push(row);row=[];field="";}else field+=c;}
    if(field!==""||row.length){row.push(field.replace(/\r$/,""));rows.push(row);}
    const keys=(rows.shift()||[]).map(s=>s.trim());
    return rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(keys.map((k,i)=>[k,r[i]??""])));
  }
  async function load(key) {
    if(cache[key])return cache[key];
    cache[key]=(async()=>{try{const response=await fetch(sources[key],{cache:"no-cache"});if(!response.ok)throw Error(`HTTP ${response.status}`);const rows=parseCSV(await response.text());failures[key]="";return rows;}catch(e){failures[key]=String(e.message||e);return [];}})();
    return cache[key];
  }
  function gameId(r){return get(r,"game_id","gameId","GameID","ID","id","game_number");}
  function normDate(v){if(!v)return "";const m=String(v).match(/\d{4}-\d{2}-\d{2}/);if(m)return m[0];const d=new Date(v);return Number.isNaN(d.valueOf())?"":d.toISOString().slice(0,10);}
  function dateOf(r){return normDate(get(r,"game_date","date","scheduled_date","start_date","GameDate","Date","scheduled_start"));}
  function home(r){return get(r,"home_team_name","home_team","home","HomeTeam","home_name","homeTeamName","HomeLongName");}
  function away(r){return get(r,"visitor_team_name","away_team_name","away_team","visitor_team","away","AwayTeam","visiting_team_name","visitor","awayTeamName","VisitorLongName");}
  function homeScore(r){return num(get(r,"home_goals","home_score","home_team_score","HomeScore","homeScore","HomeGoals"));}
  function awayScore(r){return num(get(r,"visitor_goals","away_goals","away_score","visitor_score","away_team_score","AwayScore","awayScore","VisitorGoals"));}
  // Status is estimated from the scheduled puck-drop time in Toronto.
  // The schedule feed does not contain an authoritative live/final/cancelled flag.
  function torontoParts(now=new Date()) {
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now);
    return Object.fromEntries(parts.map(p=>[p.type,p.value]));
  }
  function gameStartMinutes(r) {
    const raw=gameTime(r).trim().toLowerCase();
    const match=raw.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
    if(!match)return null;
    let h=Number(match[1]), m=Number(match[2]);
    if(m>59||h>23)return null;
    if(match[3]){if(h<1||h>12)return null;h=(h%12)+(match[3]==="pm"?12:0);}
    const date=dateOf(r);
    if(!date)return null;
    const [year,month,day]=date.split("-").map(Number);
    return Date.UTC(year,month-1,day,h,m)/60000;
  }
  function status(r) {
    const start=gameStartMinutes(r);
    if(start===null)return "upcoming";
    const now=torontoParts();
    const localNow=Date.UTC(+now.year,+now.month-1,+now.day,+now.hour,+now.minute)/60000;
    const elapsed=localNow-start;
    if(elapsed<0)return "upcoming";
    if(elapsed<210)return "live";
    // After 3.5 hours: no recorded events and no nonzero score => cancelled.
    // This is a requested heuristic, NOT an official cancellation report.
    const hasData=activityIds.has(gameId(r)) || (homeScore(r)||0)>0 || (awayScore(r)||0)>0;
    return hasData?"final":"cancelled";
  }
  function statusLabel(s){return ({final:"FINAL",live:"LIVE",upcoming:"UPCOMING",cancelled:"CANCELLED"})[s]||s.toUpperCase();}
  function scoreAvailable(r){return (status(r)==="live"||status(r)==="final") && homeScore(r)!==null && awayScore(r)!==null;}
  function displayDate(date){if(!date)return "Date unavailable";const d=new Date(date+"T12:00:00Z");return new Intl.DateTimeFormat("en-CA",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}).format(d);}
  function gameTime(r){return get(r,"scheduled_time","game_time","time","start_time","scheduled_start_time","scheduled_time_et","ScheduledFormattedTime");}
  function rowsByGame(rows,id){return rows.filter(r=>gameId(r)===id);}
  function teamOptions(games){return [...new Set(games.flatMap(r=>[home(r),away(r)]).filter(Boolean))].sort((a,b)=>a.localeCompare(b));}
  function filtered(games){
    let rows=games.filter(r=>state.team==="all"||home(r)===state.team||away(r)===state.team)
      .filter(r=>state.status==="all"||status(r)===state.status)
      .filter(r=>!state.date||dateOf(r)===state.date);
    if(state.search){const q=state.search.toLowerCase();rows=rows.filter(r=>[home(r),away(r),gameId(r),get(r,"venue","arena")].join(" ").toLowerCase().includes(q));}
    // When dates are cleared, prioritize live / next scheduled games, not season-end finals.
    if(!state.date && state.status==="all"){
      const priority=r=>status(r)==="live"?0:status(r)==="upcoming"?1:status(r)==="final"?2:3;
      return rows.sort((a,b)=>priority(a)-priority(b)||(priority(a)<=1?dateOf(a).localeCompare(dateOf(b)):dateOf(b).localeCompare(dateOf(a)))||gameId(a).localeCompare(gameId(b)));
    }
    return rows.sort((a,b)=>state.status==="upcoming"?dateOf(a).localeCompare(dateOf(b))||gameId(a).localeCompare(gameId(b)):dateOf(b).localeCompare(dateOf(a))||gameId(b).localeCompare(gameId(a)));
  }
  function card(r){const id=gameId(r),s=status(r),hs=scoreAvailable(r)?homeScore(r):null,as=scoreAvailable(r)?awayScore(r):null;
    const teamRow=(name,score)=>`<span class="igc-card-team">${logo(name)}<span>${esc(name||"Team unavailable")}</span></span><strong>${score===null?"—":score}</strong>`;
    return `<button class="igc-game" data-igc-game="${esc(id)}" type="button"><span class="igc-game-date">${esc(displayDate(dateOf(r)))} <span class="igc-status igc-${s}">${esc(statusLabel(s))}</span></span><span class="igc-game-teams">${teamRow(away(r),as)}${teamRow(home(r),hs)}</span><span class="igc-game-foot">${esc(gameTime(r)||`Game ${id}`)} <span>GAME CENTRE ↗</span></span></button>`;
  }
  function overview(games){const all=filtered(games),final=games.filter(r=>status(r)==="final").length,upcoming=games.filter(r=>status(r)==="upcoming").length,live=games.filter(r=>status(r)==="live").length;const shown=all.slice((state.page-1)*state.perPage,state.page*state.perPage);const pages=Math.max(1,Math.ceil(all.length/state.perPage));root.innerHTML=`<div class="igc"><div class="page-heading"><div class="eyebrow">ICEINDEX / OHL / 2026–27</div><h1>OHL Game Centre</h1><p>Scores, scorers, player box scores and shot maps — all season long.</p></div><section class="panel igc-panel"><div class="igc-filters"><label>Team<select id="igc-team" class="select"><option value="all">All OHL teams</option>${teamOptions(games).map(t=>`<option value="${esc(t)}" ${state.team===t?"selected":""}>${esc(t)}</option>`).join("")}</select></label><label>Games<select id="igc-status" class="select">${[["all","All games"],["final","Final results"],["upcoming","Upcoming"],["live","In progress"],["cancelled","Cancelled"]].map(([v,l])=>`<option value="${v}" ${state.status===v?"selected":""}>${l}</option>`).join("")}</select></label><label>Date<input id="igc-date" type="date" class="select" value="${esc(state.date)}"></label><label>Search<input id="igc-search" type="search" class="select" placeholder="Team, arena or game ID" value="${esc(state.search)}"></label><button class="btn secondary" id="igc-clear" type="button">Clear filters</button><button class="btn secondary" id="igc-all-dates" type="button">Default date</button></div><div class="igc-list-head"><h2>Schedule & results</h2><span>${fmt(all.length)} matching games</span></div>${shown.length?`<div class="igc-games">${shown.map(card).join("")}</div>`:`<div class="empty">No games match these filters.</div>`}<div class="igc-pagination"><button type="button" class="btn secondary" id="igc-prev" ${state.page<=1?"disabled":""}>Previous</button><span>Page ${state.page} of ${pages}</span><button type="button" class="btn secondary" id="igc-next" ${state.page>=pages?"disabled":""}>Next</button></div></section></div>`;
    root.querySelector("#igc-team").onchange=e=>{state.team=e.target.value;state.page=1;overview(games);};root.querySelector("#igc-status").onchange=e=>{state.status=e.target.value;state.page=1;overview(games);};root.querySelector("#igc-date").onchange=e=>{state.date=e.target.value;state.page=1;overview(games);};root.querySelector("#igc-search").onchange=e=>{state.search=e.target.value;state.page=1;overview(games);};root.querySelector("#igc-clear").onclick=()=>{Object.assign(state,{team:"all",status:"all",date:"",search:"",page:1});overview(games);};root.querySelector("#igc-all-dates").onclick=()=>{state.date=torontoToday();state.page=1;overview(games);};root.querySelector("#igc-prev").onclick=()=>{state.page--;overview(games);};root.querySelector("#igc-next").onclick=()=>{state.page++;overview(games);};root.querySelectorAll("[data-igc-game]").forEach(b=>b.onclick=()=>detail(games.find(r=>gameId(r)===b.dataset.igcGame),games));
  }
  function parseClock(v){const m=String(v).match(/^(\d+):(\d+)$/);return m?Number(m[1])*60+Number(m[2]):0;}
  function shotType(r){return get(r,"event_type","type","event").toLowerCase();}
  // Match the Player Profile's historical HockeyTech scale and team/game direction inference.
  // Keep every valid source coordinate, including neutral/defensive and behind-net events.
  function gameShots(rows,game){return rows.map(r=>({...r,_team:get(r,"team_name","team","shooting_team_name","team_code","team_id"),_type:shotType(r)})).filter(r=>num(get(r,"x_location"))!==null&&num(get(r,"y_location"))!==null);}
  function shotMap(rows,game){
    const selected=rows.filter(r=>(state.shotTeam==="all"||r._team===state.shotTeam)&&(state.shotType==="all"||r._type===state.shotType)&&(state.period==="all"||get(r,"period")==state.period));
    const teams=[...new Set(rows.map(r=>r._team).filter(Boolean))].sort();
    const periods=[...new Set(rows.map(r=>get(r,"period")).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
    const groups=new Map();
    rows.forEach(r=>{const k=gameId(r)+'|'+get(r,'team_id','team_code');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(Number(get(r,'x_location')));});
    const directions=new Map();
    for(const [k,xs] of groups){const hi=xs.filter(x=>x>300).length,lo=xs.filter(x=>x<300).length;if(hi!==lo)directions.set(k,hi>lo?'high':'low');}
    const point=r=>{const x=Number(get(r,'x_location')),y=Number(get(r,'y_location'));const k=gameId(r)+'|'+get(r,'team_id','team_code');const dir=directions.get(k)||(x>=300?'high':'low');return {x:300+(y-150)/3*4.9*(dir==='high'?1:-1),y:536-(dir==='high'?x-300:300-x)/2.93*4.9};};
    const markers=selected.map(r=>{const p=point(r),goal=r._type==='goal';return `<circle tabindex="0" role="button" aria-label="View ${goal?'goal':'shot'} details" data-igc-shot="${rows.indexOf(r)}" class="igc-interactive-shot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${goal?6.4:4.5}" fill="${goal?'#ed555f':'#1783c6'}" stroke="${goal?'#fff':'#8acaff'}" stroke-width="${goal?1.5:0.8}"><title>${esc(`${goal?'Goal':'Shot'} · ${r._team||'Team unavailable'} · P${get(r,'period')} ${get(r,'time_formatted')} · ${r._player||'Player unavailable'}`)}</title></circle>`;}).join('');
    return `<div class="igc-shot-controls"><label>Team<select class="select" id="igc-shot-team"><option value="all">Both teams</option>${teams.map(t=>`<option ${state.shotTeam===t?'selected':''} value="${esc(t)}">${esc(t)}</option>`).join('')}</select></label><label>Event<select class="select" id="igc-shot-type"><option value="all">Shots + goals</option><option value="shot" ${state.shotType==='shot'?'selected':''}>Shots</option><option value="goal" ${state.shotType==='goal'?'selected':''}>Goals</option></select></label><label>Period<select class="select" id="igc-shot-period"><option value="all">All periods</option>${periods.map(p=>`<option value="${esc(p)}" ${state.period===p?'selected':''}>Period ${esc(p)}</option>`).join('')}</select></label></div><div class="igc-rink-wrap"><svg class="igc-rink" viewBox="0 0 600 1060" role="img" aria-label="Full rink shot locations, preserving every recorded event"><defs><clipPath id="igc-full-rink-clip"><path d="M127 46H473Q545 46 545 118V954Q545 1026 473 1026H127Q55 1026 55 954V118Q55 46 127 46Z"/></clipPath></defs><path d="M127 46H473Q545 46 545 118V954Q545 1026 473 1026H127Q55 1026 55 954V118Q55 46 127 46Z" fill="#122639" stroke="#8ba9be" stroke-width="2.5"/><g clip-path="url(#igc-full-rink-clip)"><path d="M55 100H545M55 972H545" stroke="#c85767" stroke-width="2.5"/><path d="M55 414H545M55 658H545" stroke="#8ba9be" stroke-width="3"/><path d="M55 536H545" stroke="#c85767" stroke-width="3"/><circle cx="180" cy="234" r="73.5" fill="none" stroke="#c85767" stroke-width="2"/><circle cx="420" cy="234" r="73.5" fill="none" stroke="#c85767" stroke-width="2"/><circle cx="180" cy="838" r="73.5" fill="none" stroke="#c85767" stroke-width="2"/><circle cx="420" cy="838" r="73.5" fill="none" stroke="#c85767" stroke-width="2"/><path d="M285 100V79H315V100M285 972V993H315V972" fill="none" stroke="white" stroke-width="3"/>${markers}</g></svg></div><div class="igc-legend"><span><i class="igc-shot-dot" style="background:#1783c6"></i> Shot event</span><span><i class="igc-goal-dot" style="background:#ed555f"></i> Goal</span><span>${selected.length} events</span></div>`;
  }
  // Shareable deep links use the existing hash router: #game-centre?game=GAME_ID.
  function sharedGameId() {
    const hash = window.location.hash;
    if (!hash.startsWith("#game-centre?")) return "";
    const id = new URLSearchParams(hash.slice(hash.indexOf("?") + 1)).get("game") || "";
    return /^\d+$/.test(id) ? id : "";
  }
  function shareUrl(id) {
    const url = new URL(window.location.href);
    url.hash = "game-centre?game=" + encodeURIComponent(id);
    return url.href;
  }
  function setGameUrl(id) {
    const target = id ? shareUrl(id) : new URL("#game-centre", window.location.href).href;
    if (window.location.href !== target) window.history.replaceState(window.history.state, "", target);
  }
  async function shareGame(game) {
    const url = shareUrl(gameId(game));
    const title = `${away(game)} ${scoreAvailable(game) ? awayScore(game) : "vs"} – ${home(game)} ${scoreAvailable(game) ? homeScore(game) : ""} | IceIndex`;
    if (navigator.share) {
      try { await navigator.share({title, text: `${away(game)} at ${home(game)} — IceIndex Game Centre`, url}); return; }
      catch (error) { if (error.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(url); }
    catch (error) {
      const input = document.createElement("textarea"); input.value = url;
      document.body.appendChild(input); input.select();
      try { document.execCommand("copy"); } finally { input.remove(); }
    }
    const button = root?.querySelector("#igc-share");
    if (button) button.textContent = "✓ Link copied";
  }
  async function detail(game,games){
    if(!game)return;
    const id=gameId(game); activeId=id; setGameUrl(id);
    state.shotTeam="all";state.shotType="all";state.period="all";
    root.innerHTML=`<div class="igc"><button class="btn secondary" id="igc-back">← All games</button><div class="panel igc-panel"><div class="empty">Loading game ${esc(id)}…</div></div></div>`;
    root.querySelector("#igc-back").onclick=()=>{activeId=null;setGameUrl("");overview(games);};
    const [shots,logs,summary,events,metadata,periods,goalies,om,op,og,ok,os,ope,ost]=await Promise.all([load("shots"),load("logs"),load("summary"),load("events"),load("metadata"),load("periods"),load("goalies"),load("officialMetadata"),load("officialPeriods"),load("officialGoals"),load("officialGoalies"),load("officialSkaters"),load("officialPenalties"),load("officialStars")]);
    if(activeId!==id||!root?.isConnected)return;
    const gameLogs=rowsByGame(logs,id), gameSummary=rowsByGame(summary,id), gameEvents=rowsByGame(events,id);
    const official=rowsByGame(om,id)[0]||{};
    const officialPeriodRows=rowsByGame(op,id), officialGoals=rowsByGame(og,id), officialGoalies=rowsByGame(ok,id), officialSkaters=rowsByGame(os,id), officialPenalties=rowsByGame(ope,id), officialStars=rowsByGame(ost,id);
    const meta=rowsByGame(metadata,id)[0]||{}, periodRows=rowsByGame(periods,id), goalieRows=rowsByGame(goalies,id);
    const playerLookup=new Map(gameLogs.map(r=>[get(r,"player_id"),get(r,"player_name")]));
    const teamLookup=new Map(gameLogs.map(r=>[get(r,"team_id"),get(r,"team_name")]));
    const gameShotRows=gameShots(rowsByGame(shots,id),game).map(r=>({...r,_team:teamLookup.get(get(r,"team_id"))||r._team,_player:playerLookup.get(get(r,"player_id"))||"Player unavailable"}));
    const playerRows=gameLogs.map(r=>({id:get(r,"player_id"),name:get(r,"player_name"),team:get(r,"team_name"),g:num(get(r,"G"))||0,a:num(get(r,"A"))||0,p:num(get(r,"P"))||0,shots:num(get(r,"SHOT_EVENT")),pim:num(get(r,"PIM")),foWin:num(get(r,"FO_WIN")),foAtt:num(get(r,"FO_ATT"))}));
    const goals=gameShotRows.filter(r=>r._type==="goal").sort((a,b)=>Number(get(a,"period"))-Number(get(b,"period"))||parseClock(get(a,"time_formatted"))-parseClock(get(b,"time_formatted")));
    const scorer=(r)=>{
      const assists=[get(r,"assist1_player_name"),get(r,"assist2_player_name")].filter(Boolean);
      const listed=get(r,"assist_names");
      const strength=get(r,"goal_strength").toUpperCase();
      const label=({EV:'EV',PP:'PP',SH:'SH',EN:'EN'})[strength]||strength;
      return `<div class="igc-goal" data-igc-event-period="${esc(get(r,"period"))}"><div class="igc-goal-time"><strong>P${esc(get(r,"period")||"—")}</strong><span>${esc(get(r,"time_formatted")||"—")}</span></div><div class="igc-goal-main">${portrait(get(r,"player_id"),r._player,"igc-goal-photo")}<div class="igc-goal-text"><small>${logo(r._team,"igc-mini-logo")} ${esc(r._team)}</small><strong>${playerLink(get(r,"player_id"),r._player)} ${label?`<span class="igc-strength">${esc(label)}</span>`:''}</strong><span>${assists.length||listed?`Assists: ${esc(assists.length?assists.join(' · '):listed)}`:'Unassisted'}</span>${get(r,'plus_players')||get(r,'minus_players')?`<span class="igc-onice">On ice + ${esc(get(r,'plus_players')||'—')} · − ${esc(get(r,'minus_players')||'—')}</span>`:''}</div></div></div>`;
    };
    const tableFor=(team)=>{
      const rows=playerRows.filter(r=>r.team===team).sort((a,b)=>b.p-a.p||b.g-a.g||a.name.localeCompare(b.name));
      if(!rows.length)return `<div class="igc-empty-note">No player game logs published for this team.</div>`;
      const totals=rows.reduce((a,r)=>({g:a.g+r.g,a:a.a+r.a,p:a.p+r.p,shots:a.shots+(r.shots||0),pim:a.pim+(r.pim||0)}),{g:0,a:0,p:0,shots:0,pim:0});
      return `<div class="igc-table-scroll"><table class="igc-table igc-box-table"><thead><tr><th>Player</th><th>G</th><th>A</th><th>PTS</th><th class="igc-optional-stat">Shot events</th><th>PIM</th><th class="igc-optional-stat">FO W/Att</th></tr></thead><tbody>${rows.map(r=>`<tr><td><span class="igc-player-cell">${portrait(r.id,r.name)}<span>${playerLink(r.id,r.name)}</span></span></td><td>${r.g}</td><td>${r.a}</td><td><strong>${r.p}</strong></td><td class="igc-optional-stat">${fmt(r.shots)}</td><td>${fmt(r.pim)}</td><td class="igc-optional-stat">${r.foAtt==null?"—":`${fmt(r.foWin)}/${fmt(r.foAtt)}`}</td></tr>`).join("")}</tbody><tfoot><tr><th>Recorded totals</th><th>${totals.g}</th><th>${totals.a}</th><th>${totals.p}</th><th class="igc-optional-stat">${fmt(totals.shots)}</th><th>${fmt(totals.pim)}</th><th class="igc-optional-stat">—</th></tr></tfoot></table></div>`;
    };
    const detailVal=(v)=>v!==undefined&&v!==null&&String(v).trim()!==''?esc(v):'—';
    const metadataMarkup=`<section class="panel igc-panel igc-metadata"><div class="igc-section-title"><h2>Game details</h2><span>Official fields where available</span></div><div class="igc-fact-grid">${[['Arena',get(official,'arena')||get(meta,'arena','venue','Venue','Arena')||get(game,'Venue','arena','venue')],['Attendance',get(official,'attendance')||get(meta,'attendance','Attendance')],['Start',get(official,'actual_start')||gameTime(game)],['Game ID',id]].map(([label,value])=>`<div class="igc-fact"><small>${esc(label)}</small><strong>${detailVal(value)}</strong></div>`).join('')}</div></section>`;
    const sideName=(side)=>side==='home'?home(game):away(game);
    const periodKeys=[...new Set(periodRows.map(r=>get(r,'period')).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
    const officialPeriodKeys=[...new Set(officialPeriodRows.map(r=>get(r,'period')).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
    const periodSource=officialPeriodKeys.length?officialPeriodRows:periodRows;
    const usedPeriodKeys=officialPeriodKeys.length?officialPeriodKeys:periodKeys;
    const periodsMarkup=`<section class="panel igc-panel"><div class="igc-section-title"><h2>Period breakdown</h2><span>${officialPeriodKeys.length?'Official goals & shots on goal':'Legacy period data'}</span></div>${usedPeriodKeys.length?`<div class="igc-table-scroll"><table class="igc-table igc-period-table"><thead><tr><th>Team</th>${usedPeriodKeys.map(p=>`<th>P${esc(p)}</th>`).join('')}<th>Total</th></tr></thead><tbody>${['visitor','home'].map(side=>{const lookupSide=officialPeriodKeys.length?side:(side==='visitor'?'away':'home');return `<tr><th>${esc(side==='home'?(get(official,'home_team')||home(game)):(get(official,'visitor_team')||away(game)))}</th>${usedPeriodKeys.map(p=>{const r=periodSource.find(r=>get(r,'side')===lookupSide&&get(r,'period')===p)||{};return `<td><strong>${detailVal(get(r,'goals'))}</strong><small>${detailVal(get(r,officialPeriodKeys.length?'shots_on_goal':'shot_events'))} ${officialPeriodKeys.length?'SOG':'events'}</small></td>`;}).join('')}<td><strong>${detailVal(side==='home'?(get(official,'home_goals')||homeScore(game)):(get(official,'visitor_goals')||awayScore(game)))}</strong></td></tr>`;}).join('')}</tbody></table></div>`:'<div class="igc-empty-note">No period data available.</div>'}</section>`;
    const goalieMarkup=`<section class="panel igc-panel"><div class="igc-section-title"><h2>Goaltenders</h2><span>${officialGoalies.length?'Official box score':'No official goalie data'}</span></div>${officialGoalies.length?`<div class="igc-table-scroll"><table class="igc-table"><thead><tr><th>Goaltender</th><th>Team</th><th>TOI</th><th>SA</th><th>SV</th><th>GA</th><th>SV%</th></tr></thead><tbody>${officialGoalies.filter(r=>get(r,'appeared').toLowerCase()!=='false' || (num(get(r,'shots_against'))||0)>0).map(r=>{const sa=num(get(r,'shots_against')),sv=num(get(r,'saves'));return `<tr><td><span class="igc-player-cell">${portrait(get(r,'player_id'),get(r,'player_name'),'igc-mini-portrait')}<strong>${goalieLink(get(r,'player_id'),get(r,'player_name'))}</strong></span></td><td>${esc(get(r,'side')==='home'?(get(official,'home_code')||'HOME'):(get(official,'visitor_code')||'AWAY'))}</td><td>${detailVal(get(r,'time_on_ice'))}</td><td>${detailVal(get(r,'shots_against'))}</td><td>${detailVal(get(r,'saves'))}</td><td>${detailVal(get(r,'goals_against'))}</td><td>${sa>0&&sv!==null?(sv/sa).toFixed(3):'—'}</td></tr>`;}).join('')}</tbody></table></div>`:'<div class="igc-empty-note">Official goalie statistics are unavailable for this game.</div>'}</section>`;
    const officialGoalMarkup=officialGoals.length?officialGoals.sort((a,b)=>Number(get(a,'period'))-Number(get(b,'period'))||parseClock(get(a,'time'))-parseClock(get(b,'time'))).map(r=>{const side=get(r,'side');const team=side==='home'?(get(official,'home_team')||home(game)):(get(official,'visitor_team')||away(game));const assists=[get(r,'assist1_name'),get(r,'assist2_name')].filter(Boolean);return `<div class="igc-goal" data-igc-event-period="${esc(get(r,"period"))}"><div class="igc-goal-time"><strong>P${esc(get(r,'period'))}</strong><span>${esc(get(r,'time'))}</span></div><div class="igc-goal-main">${portrait(get(r,'scorer_id'),get(r,'scorer_name'),'igc-goal-photo')}<div class="igc-goal-text"><small>${logo(team,'igc-mini-logo')} ${esc(team)}</small><strong>${playerLink(get(r,'scorer_id'),get(r,'scorer_name'))} <span class="igc-strength">${esc(get(r,'strength')||'EV')}${get(r,'empty_net')==='1'?' · EN':''}</span></strong><span>${assists.length?'Assists: '+[1,2].map(i=>({id:get(r,'assist'+i+'_id'),name:get(r,'assist'+i+'_name')})).filter(a=>a.name).map(a=>playerLink(a.id,a.name)).join(', '):'Unassisted'}${get(r,'game_winning')==='1'?' · GWG':''}</span></div></div></div>`;}).join(''):goals.map(scorer).join('');
    const officialSkaterTable=side=>{const rows=officialSkaters.filter(r=>get(r,'side')===side).sort((a,b)=>(num(get(b,'points'))||0)-(num(get(a,'points'))||0));if(!rows.length)return '<p class="igc-note">No official skater data available.</p>';return `<div class="igc-table-scroll"><table class="igc-table"><thead><tr><th>Player</th><th>G</th><th>A</th><th>PTS</th><th>+/-</th><th>SOG</th><th>PIM</th></tr></thead><tbody>${rows.map(r=>`<tr><td><span class="igc-player-cell">${portrait(get(r,'player_id'),get(r,'player_name'),'igc-mini-portrait')}<span>${playerLink(get(r,'player_id'),get(r,'player_name'))}</span></span></td><td>${detailVal(get(r,'goals'))}</td><td>${detailVal(get(r,'assists'))}</td><td><strong>${detailVal(get(r,'points'))}</strong></td><td>${detailVal(get(r,'plus_minus'))}</td><td>${detailVal(get(r,'shots_on_goal'))}</td><td>${detailVal(get(r,'pim'))}</td></tr>`).join('')}</tbody></table></div>`;};
    // Dedicated narrow-screen penalty rows: no table-cell collisions or sideways scrolling.
    const eventPeriodOptions=(rows)=>[...new Set(rows.map(r=>get(r,'period')).filter(Boolean))].sort((a,b)=>Number(a)-Number(b)).map(p=>`<option value="${esc(p)}">${Number(p)===4?'Overtime':Number(p)>4?'Period '+p:'Period '+p}</option>`).join('');
    const eventPeriodFilter=(id,rows)=>`<label class="igc-event-period-filter">Period <select class="select" id="${id}" aria-label="Filter by period"><option value="all">Full game</option>${eventPeriodOptions(rows)}</select></label>`;
    const mobilePenaltyRows=officialPenalties.map(r=>{
      const period=esc(get(r,'period')),time=esc(get(r,'time'));
      const team=esc(get(r,'side')==='home'?get(official,'home_code'):get(official,'visitor_code'));
      const player=esc(get(r,'player_name')),reason=esc(get(r,'description')),mins=esc(get(r,'minutes'));
      return `<div class="igc-penalty-mobile-row" data-igc-event-period="${period}"><div class="igc-penalty-mobile-top"><span class="igc-penalty-clock">P${period} · ${time}</span><span class="igc-penalty-team">${team}</span><span class="igc-penalty-min">${mins} min</span></div><div class="igc-penalty-mobile-bottom"><strong>${playerLink(get(r,"player_id"),get(r,"player_name"))}</strong><span>${reason}</span></div></div>`;
    }).join('');
    const penaltyMarkup=`<section class="panel igc-panel"><div class="igc-section-title"><h2>Penalties</h2><span>${officialPenalties.length} recorded</span></div>${officialPenalties.length?`${eventPeriodFilter("igc-penalties-period",officialPenalties)}<div class="igc-table-scroll igc-penalties-desktop"><table class="igc-table"><thead><tr><th>Period</th><th>Time</th><th>Team</th><th>Player</th><th>Infraction</th><th>Min</th></tr></thead><tbody>${officialPenalties.map(r=>`<tr data-igc-event-period="${esc(get(r,'period'))}"><td>${esc(get(r,'period'))}</td><td>${esc(get(r,'time'))}</td><td>${esc(get(r,'side')==='home'?get(official,'home_code'):get(official,'visitor_code'))}</td><td>${playerLink(get(r,"player_id"),get(r,"player_name"))}</td><td>${esc(get(r,'description'))}</td><td>${esc(get(r,'minutes'))}</td></tr>`).join('')}</tbody></table></div><div class="igc-penalties-mobile">${mobilePenaltyRows}</div>`:'<p class="igc-note">No penalties recorded in the official export.</p>'}</section>`;
    const starsMarkup=officialStars.length?`<section class="panel igc-panel"><div class="igc-section-title"><h2>Three stars</h2></div><div class="igc-stars">${officialStars.sort((a,b)=>Number(get(a,'star'))-Number(get(b,'star'))).map(r=>`<div class="igc-star"><span class="igc-star-rank">★ ${esc(get(r,'star'))}</span>${portrait(get(r,'player_id'),get(r,'player_name'),'igc-star-photo')}<strong>${officialGoalies.some(g=>String(get(g,"player_id"))===String(get(r,"player_id")))?goalieLink(get(r,"player_id"),get(r,"player_name")):playerLink(get(r,"player_id"),get(r,"player_name"))}</strong></div>`).join('')}</div></section>`:'';
    // Interactive game exploration: only official source values are used.
    const sumPeriod=(side,key)=>officialPeriodRows.filter(r=>get(r,'side')===side).reduce((total,r)=>total+(num(get(r,key))||0),0);
    const sumGoalie=(side,key)=>officialGoalies.filter(r=>get(r,'side')===side && get(r,'appeared').toLowerCase()!=='false').reduce((total,r)=>total+(num(get(r,key))||0),0);
    const sumPim=side=>officialPenalties.filter(r=>get(r,'side')===side).reduce((total,r)=>total+(num(get(r,'minutes'))||0),0);
    const officialCompare=officialPeriodRows.length>0;
    const metricPairs=officialCompare?[
      {label:'Shots on goal',a:sumPeriod('visitor','shots_on_goal'),h:sumPeriod('home','shots_on_goal'),tab:'shots',hint:'Explore shot locations'},
      {label:'Goaltender saves',a:sumGoalie('visitor','saves'),h:sumGoalie('home','saves'),tab:'goalies',hint:'Open goalie statistics'},
      {label:'Penalty minutes',a:sumPim('visitor'),h:sumPim('home'),tab:'penalties',hint:'Review penalties'},
      {label:'Third-period shots',a:sumPeriod('visitor','shots_on_goal')-officialPeriodRows.filter(r=>get(r,'side')==='visitor'&&get(r,'period')!=='3').reduce((n,r)=>n+(num(get(r,'shots_on_goal'))||0),0),h:sumPeriod('home','shots_on_goal')-officialPeriodRows.filter(r=>get(r,'side')==='home'&&get(r,'period')!=='3').reduce((n,r)=>n+(num(get(r,'shots_on_goal'))||0),0),tab:'shots',hint:'Explore third-period pressure'}
    ]:[];
    const compareMarkup=officialCompare?`<section class="igc-compare" aria-label="Interactive team comparison"><div class="igc-section-title"><h2>Inside the game</h2><span>Select a statistic to explore</span></div><div class="igc-compare-legend"><span>${logo(away(game),'igc-mini-logo')} ${esc(away(game))}</span><span>${logo(home(game),'igc-mini-logo')} ${esc(home(game))}</span></div><div class="igc-compare-grid">${metricPairs.map(m=>{const total=m.a+m.h;const left=total?Math.max(0,100*m.a/total):50;return `<button type="button" class="igc-metric" data-igc-tab="${m.tab}" aria-label="${esc(m.label)}: ${m.a} away, ${m.h} home. ${esc(m.hint)}"><span class="igc-metric-label">${esc(m.label)} <span aria-hidden="true">↗</span></span><span class="igc-metric-values"><strong>${m.a}</strong><small>${esc(m.hint)}</small><strong>${m.h}</strong></span><span class="igc-metric-track"><i style="width:${left.toFixed(2)}%"></i></span></button>`;}).join('')}</div></section>`:'';
    const gameTabs=[['summary','Overview'],['scoring','Scoring'],['shots','Shot map'],['goalies','Goaltenders'],['players','Players'],['penalties','Penalties'],['stars','Three stars']];
    const tabsMarkup=`<nav class="igc-tabs" aria-label="Game Centre sections">${gameTabs.map(([key,label])=>`<button type="button" class="igc-tab" data-igc-tab="${key}" aria-selected="${key==='summary'}">${label}</button>`).join('')}</nav>`;
    // Mobile-first: only user-facing event information; never expose raw IDs or coordinates.
    // Display actual game length only for completed games; never infer elapsed time from the current clock.
    const officialStatus=get(official,'status').toLowerCase();
    const isFinal=/final|complete/.test(officialStatus)||(!officialStatus&&status(game)==='final');
    const isUpcoming=/scheduled|upcoming|not started|pre-game|pregame/.test(officialStatus)||(!officialStatus&&status(game)==='upcoming');
    const gameLength=get(official,'game_length');
    const timingText=isFinal?(gameLength?`Game length ${gameLength}`:''):(isUpcoming?(get(official,'scheduled_time')||gameTime(game)):'');
    const gameTimingMarkup=timingText?`<span>${esc(timingText)}</span>`:'';
    const shotDetails=(r)=>{
      const goal=r._type==='goal';
      const period=get(r,'period');
      const clock=get(r,'time_formatted');
      const type=get(r,'shot_type_description','shot_type');
      const strength=get(r,'goal_strength');
      const assists=get(r,'assist_names')||[get(r,'assist1_player_name'),get(r,'assist2_player_name')].filter(Boolean).join(', ');
      const empty=/^(true|1|yes)$/i.test(get(r,'empty_net'));
      const flags=[strength,empty&&!/\bEN\b/i.test(strength)?'Empty net':''].filter(Boolean);
      const rows=[
        ['Period',period?`P${period}`:''],
        ['Time',clock],
        ['Shot type',type],
        ...(goal?[['Strength',flags.join(' · ')],['Assists',assists||'Unassisted']]:[]),
        ...(!goal&&get(r,'goalie_name')?[['Goaltender',get(r,'goalie_name')]]:[])
      ].filter(([,v])=>String(v||'').trim());
      return `<div class="igc-shot-detail-top">${portrait(get(r,'player_id'),r._player)}<div><strong>${playerLink(get(r,"player_id"),r._player||"Unknown player")}</strong><span>${esc(r._team)} · ${goal?'GOAL':'SHOT'}</span></div></div><dl class="igc-shot-fields">${rows.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
    };
    const bindShots=()=>{root.querySelectorAll('[data-igc-shot]').forEach(el=>{const open=()=>{const r=gameShotRows[Number(el.dataset.igcShot)];if(!r)return;const modal=root.querySelector('#igc-shot-modal');modal.querySelector('.igc-modal-content').innerHTML=shotDetails(r);modal.hidden=false;modal.querySelector('.igc-modal-close').focus();};el.onclick=open;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};});};
    const shotEvents=[...gameShotRows].sort((a,b)=>Number(get(a,"period"))-Number(get(b,"period"))||parseClock(get(a,"time_formatted"))-parseClock(get(b,"time_formatted")));
    const eventColumns=gameEvents.length?Object.keys(gameEvents[0]).filter(k=>!/^season$/i.test(k)).slice(0,12):[];
    const fullEventTable=gameEvents.length?`<div class="igc-table-scroll"><table class="igc-table"><thead><tr>${eventColumns.map(k=>`<th>${esc(k.replace(/_/g," "))}</th>`).join("")}</tr></thead><tbody>${gameEvents.map(r=>`<tr>${eventColumns.map(k=>`<td>${esc(r[k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`:`<p class="igc-note">Complete chronological play-by-play is not yet published as a CSV. Recorded shots and goals are shown below; other event types are summarized above.</p>`;
    root.innerHTML=`<div class="igc igc-boxscore igc-modern">
      <div class="igc-share-actions"><button class="btn secondary igc-back" id="igc-back">← All games</button><button class="btn secondary" id="igc-share" type="button" aria-label="Share this game">↗ Share game</button></div>
      <header class="panel igc-panel igc-game-hero"><div class="igc-hero-top"><span>OHL 2026–27 · ${esc(displayDate(dateOf(game)))}</span><span class="igc-hero-status">${esc(get(official,'status')||statusLabel(status(game)))}</span></div><div class="igc-scoreboard"><div class="igc-score-team">${logo(away(game),'igc-hero-logo')}<strong>${esc(away(game))}</strong><span>${get(official,'visitor_goals')||(scoreAvailable(game)?fmt(awayScore(game)):'—')}</span><small class="igc-side-label">Away</small></div><div class="igc-score-middle" aria-hidden="true"></div><div class="igc-score-team">${logo(home(game),'igc-hero-logo')}<strong>${esc(home(game))}</strong><span>${get(official,'home_goals')||(scoreAvailable(game)?fmt(homeScore(game)):'—')}</span><small class="igc-side-label">Home</small></div></div><div class="igc-hero-foot"><span>${esc(get(official,'arena')||get(meta,'arena','venue')||'Venue unavailable')}</span><span>${get(official,'attendance')?'Attendance '+esc(get(official,'attendance')):''}</span>${gameTimingMarkup}</div></header>
      ${tabsMarkup}
      <div class="igc-tab-panel" data-igc-panel="summary">${compareMarkup}${periodsMarkup}<div class="igc-quick-links"><button data-igc-tab="scoring">View scoring plays ↗</button><button data-igc-tab="players">Full player box score ↗</button></div></div>
      <div class="igc-tab-panel" data-igc-panel="scoring" hidden><section class="panel igc-panel"><div class="igc-section-title"><h2>Scoring timeline</h2><span>${officialGoals.length||goals.length} goals</span></div>${officialGoals.length||goals.length?`${eventPeriodFilter("igc-scoring-period",officialGoals.length?officialGoals:goals)}<div class="igc-goals" id="igc-scoring-events">${officialGoalMarkup}</div>`:'<div class="igc-empty-note">No scoring plays recorded.</div>'}</section></div>
      <div class="igc-tab-panel" data-igc-panel="shots" hidden><section class="panel igc-panel"><div class="igc-section-title"><h2>Shot explorer</h2><span>Tap any marker for event details</span></div><div id="igc-map">${gameShotRows.length?shotMap(gameShotRows,game):'<div class="igc-empty-note">No shot coordinates published.</div>'}</div></section></div>
      <div class="igc-tab-panel" data-igc-panel="goalies" hidden>${goalieMarkup}</div>
      <div class="igc-tab-panel" data-igc-panel="players" hidden><section class="panel igc-panel"><div class="igc-section-title"><h2>Player box score</h2><span>Official statistics</span></div><h3 class="igc-team-heading">${logo(away(game),'igc-heading-logo')}${esc(away(game))}</h3>${officialSkaters.length?officialSkaterTable('visitor'):tableFor(away(game))}<h3 class="igc-team-heading">${logo(home(game),'igc-heading-logo')}${esc(home(game))}</h3>${officialSkaters.length?officialSkaterTable('home'):tableFor(home(game))}</section></div>
      <div class="igc-tab-panel" data-igc-panel="penalties" hidden>${penaltyMarkup}</div>
      <div class="igc-tab-panel" data-igc-panel="stars" hidden>${starsMarkup||'<div class="igc-empty-note">Three stars unavailable.</div>'}</div>
      <div class="igc-shot-modal" id="igc-shot-modal" hidden role="dialog" aria-modal="true" aria-label="Shot details"><div class="igc-modal-box"><button type="button" class="igc-modal-close" aria-label="Close shot details">×</button><h2>Shot details</h2><div class="igc-modal-content"></div></div></div></div>`;
    // Add accessible labels to every cell for zero-scroll mobile table cards.
    // Original table semantics and desktop presentation are preserved.
    root.querySelectorAll('.igc-table').forEach(table=>{
      const headings=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
      const signature=headings.map(h=>h.toLowerCase()).join('|');
      const isPeriodTable = table.classList.contains('igc-period-table') || (headings[0]?.toLowerCase()==='team' && headings.some(h=>/^P\d+$/i.test(h)));
      table.classList.add(isPeriodTable?'igc-compact-periods':signature.includes('goaltender')?'igc-compact-goalies':signature.includes('player')?'igc-compact-players':signature.includes('infraction')?'igc-compact-penalties':'igc-compact-other');
      if(isPeriodTable) table.style.setProperty('--igc-period-cols',String(Math.max(2,headings.length-1)));
      table.querySelectorAll('tbody tr, tfoot tr').forEach(tr=>{
        [...tr.children].forEach((cell,i)=>{
          const label=headings[i] || (i===0?'Player':'Stat');
          cell.setAttribute('data-igc-label',label);
        });
      });
    });
    // Period filtering never destroys the underlying official records or table layout.
    for(const [filterId,panelName] of [['igc-scoring-period','scoring'],['igc-penalties-period','penalties']]){
      const selector=root.querySelector('#'+filterId), panel=root.querySelector(`[data-igc-panel="${panelName}"]`);
      if(!selector||!panel)continue;
      const apply=()=>{
        const chosen=selector.value;
        panel.querySelectorAll('[data-igc-event-period]').forEach(el=>{el.hidden=chosen!=='all'&&el.dataset.igcEventPeriod!==chosen;});
        const count=panel.querySelectorAll(panelName==='scoring'?'.igc-goal:not([hidden])':'.igc-penalty-mobile-row:not([hidden])').length;
        let empty=panel.querySelector('.igc-period-empty');
        if(!empty){empty=document.createElement('p');empty.className='igc-period-empty igc-note';empty.textContent='No events recorded in this period.';panel.querySelector('.igc-panel')?.append(empty);}
        empty.hidden=count!==0;
      };
      selector.onchange=apply;apply();
    }
    const modal=root.querySelector('#igc-shot-modal');modal.querySelector('.igc-modal-close').onclick=()=>{modal.hidden=true;};modal.onclick=e=>{if(e.target===modal)modal.hidden=true;};
    root.querySelector("#igc-back").onclick=()=>{activeId=null;setGameUrl("");overview(games);};
    root.querySelector("#igc-share")?.addEventListener("click",()=>shareGame(game));
    const selectTab=tab=>{root.querySelectorAll('[data-igc-panel]').forEach(p=>{p.hidden=p.dataset.igcPanel!==tab;});root.querySelectorAll('.igc-tab').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.igcTab===tab));});root.querySelector('.igc-tabs')?.scrollIntoView({behavior:'smooth',block:'start'});};
    root.querySelectorAll('[data-igc-tab]').forEach(b=>b.addEventListener('click',()=>selectTab(b.dataset.igcTab)));
    const bind=()=>{for(const [key,field] of [["igc-shot-team","shotTeam"],["igc-shot-type","shotType"],["igc-shot-period","period"]]){const el=root.querySelector("#"+key);if(el)el.onchange=e=>{state[field]=e.target.value;root.querySelector("#igc-map").innerHTML=shotMap(gameShotRows,game);bind();bindShots();};}};bind();bindShots();
  }
  async function render(container){root=container;activeId=null;state.date=torontoToday();state.page=1;root.innerHTML=`<div class="igc"><div class="page-heading"><div class="eyebrow">ICEINDEX / OHL</div><h1>OHL Game Centre</h1></div><div class="panel igc-panel"><div class="empty">Loading the 2026–27 schedule…</div></div></div>`;const [games, summaries]=await Promise.all([load("schedule"),load("summary")]);
    activityIds.clear();
    summaries.filter(r=>Number(get(r,"total_events"))>0).forEach(r=>activityIds.add(gameId(r)));if(root!==container||!container.isConnected||location.hash.replace(/^#/,"").split("?")[0]!=="game-centre")return;if(!games.length){root.innerHTML=`<div class="igc"><h1>OHL Game Centre</h1><div class="panel igc-panel"><div class="igc-empty-note">Unable to load <code>${esc(sources.schedule)}</code>${failures.schedule?` (${esc(failures.schedule)})`:""}. Confirm your refresh publishes this CSV, then reload.</div></div></div>`;return;}const requestedId=sharedGameId()||pendingGameId;pendingGameId=null;if(requestedId){const selected=games.find(r=>gameId(r)===requestedId);if(selected){detail(selected,games);return;}setGameUrl("");}overview(games);}
  // Official three-character team codes for the compact daily schedule.
  const dailyCodes = {
    'Barrie Colts':'BAR','Brampton Steelheads':'BRM','Brantford Bulldogs':'BFD',
    'Erie Otters':'ERI','Flint Firebirds':'FLT','Guelph Storm':'GUE',
    'Kingston Frontenacs':'KGN','Kitchener Rangers':'KIT','London Knights':'LDN',
    'Niagara IceDogs':'NIA','North Bay Battalion':'NBY','Oshawa Generals':'OSH',
    "Ottawa 67's":'OTT','Owen Sound Attack':'OSO','Peterborough Petes':'PBO',
    'Saginaw Spirit':'SAG','Sarnia Sting':'SAR','Soo Greyhounds':'SOO',
    'Sudbury Wolves':'SBY','Windsor Spitfires':'WSR',
    'Blainville-Boisbriand Armada':'BLB','Gatineau Olympiques':'GAT',
    'Rouyn-Noranda Huskies':'ROU',"Val-d'Or Foreurs":'VDO'
  };
  // Normal home venues are a fallback for future fixtures: neutral-site games can differ.
  const dailyHomeVenues = {
    'Barrie Colts':'Sadlon Arena','Brampton Steelheads':'CAA Centre',
    'Brantford Bulldogs':'TD Civic Centre','Erie Otters':'Erie Insurance Arena',
    'Flint Firebirds':'Dort Financial Center','Guelph Storm':'Sleeman Centre',
    'Kingston Frontenacs':'Slush Puppie Place','Kitchener Rangers':'Kitchener Memorial Auditorium',
    'London Knights':'Canada Life Place','Niagara IceDogs':'Meridian Centre',
    'North Bay Battalion':'Boart Longyear Memorial Gardens',
    'Oshawa Generals':'Tribute Communities Centre',"Ottawa 67's":'TD Place Arena',
    'Owen Sound Attack':'Harry Lumley Bayshore Community Centre',
    'Peterborough Petes':'Peterborough Memorial Centre',
    'Saginaw Spirit':'Dow Event Center','Sarnia Sting':'Progressive Auto Sales Arena',
    'Soo Greyhounds':'GFL Memorial Gardens','Sudbury Wolves':'Sudbury Community Arena',
    'Windsor Spitfires':'WFCU Centre'
  };
  function dailyCode(name) {
    return dailyCodes[name] || String(name||'').replace(/[^A-Za-z ]/g,'').split(/\s+/).filter(Boolean).map(w=>w[0]).join('').padEnd(3,'X').slice(0,3).toUpperCase();
  }
  async function renderDailyGames(container){
    if(!container)return;
    const [games, officialMeta, fallbackMeta] = await Promise.all([
      load('schedule'), load('officialMetadata'), load('metadata')
    ]);
    if(!container.isConnected)return;
    if(!games.length){container.hidden=true;return;}
    const today=torontoToday();
    const todayGames=games.filter(r=>dateOf(r)===today).sort((a,b)=>(gameStartMinutes(a)||0)-(gameStartMinutes(b)||0));
    const officialById=new Map(officialMeta.map(r=>[gameId(r),r]));
    const fallbackById=new Map(fallbackMeta.map(r=>[gameId(r),r]));
    const venueFor=r=>{
      const id=gameId(r),o=officialById.get(id),m=fallbackById.get(id);
      return get(o,'arena','venue','location') || get(m,'arena','venue','location') ||
        get(r,'venue','arena','location') || dailyHomeVenues[home(r)] || 'Venue TBD';
    };
    container.innerHTML=`<div class="igc-daily-head"><strong>Today's OHL games</strong><span>${esc(displayDate(today))}</span><a href="#game-centre" data-page="game-centre">All games ↗</a></div><div class="igc-daily-list">${todayGames.length?todayGames.map(r=>{const st=status(r),sc=scoreAvailable(r);return `<a href="#game-centre" class="igc-daily-row" data-igc-daily-id="${esc(gameId(r))}" title="${esc(away(r))} at ${esc(home(r))} — ${esc(venueFor(r))}"><span class="igc-daily-match"><span class="igc-daily-team">${logo(away(r),'igc-daily-logo')}<b>${esc(dailyCode(away(r)))}</b></span><span class="igc-daily-separator">@</span><span class="igc-daily-team">${logo(home(r),'igc-daily-logo')}<b>${esc(dailyCode(home(r)))}</b></span></span><span class="igc-daily-time">${esc(sc?`${awayScore(r)}–${homeScore(r)}`:gameTime(r)||'TBD')}<small>${esc(statusLabel(st))}</small></span><span class="igc-daily-arena">${esc(venueFor(r))}</span></a>`;}).join(''):'<div class="igc-daily-none">No OHL games scheduled today.</div>'}</div>`;
    container.querySelectorAll('[data-igc-daily-id]').forEach(el=>el.addEventListener('click',()=>{pendingGameId=el.dataset.igcDailyId;}));
  }
  let pendingGameId=null;
  return {render,renderDailyGames};
})();
