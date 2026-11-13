"use strict";
/* IceIndex v0.10.0 — player profile shot locations, lazily loaded */
window.IceIndexShotMap = (() => {
  const season = "2026-27";
  const path = `data/games/${season}/player_shot_locations.csv`;
  let all = null, promise = null, error = "", active = null, mode = "dots", type = "all", period = "all";
  let gameInfo = new Map(), gameInfoPromise = null;
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function parseCSV(s) {
    const lines = [], row = []; let field = "", quoted = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (quoted) { if (c === '"' && s[i+1] === '"') {field+='"';i++;} else if(c==='"') quoted=false; else field+=c; }
      else if (c==='"') quoted=true; else if(c===',') {row.push(field);field='';}
      else if(c==='\n') {row.push(field.replace(/\r$/,''));lines.push([...row]);row.length=0;field='';} else field+=c;
    }
    if(field || row.length){row.push(field);lines.push([...row]);}
    const headers = lines.shift() || [];
    return lines.filter(r=>r.length>1).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]||''])));
  }
  async function load() {
    if(all || promise)return promise;
    promise=(async()=>{try{const res=await fetch(path,{cache:'no-cache'});if(!res.ok)throw Error(`HTTP ${res.status}`);all=parseCSV(await res.text()).filter(r=>Number.isFinite(+r.x_location)&&Number.isFinite(+r.y_location)&&r.x_location!==''&&r.y_location!=='');error='';}catch(e){error=e.message;all=[];}})();
    return promise;
  }
  // Enrich individual events with actual published game-log records. The event
  // coordinates and shot counts are never modified by this optional lookup.
  function loadGameInfo(){
    if(gameInfoPromise)return gameInfoPromise;
    gameInfoPromise=(async()=>{
      try{
        const res=await fetch(`data/games/${season}/player_game_logs_enriched.csv`,{cache:'no-cache'});
        if(!res.ok)return;
        for(const r of parseCSV(await res.text())){
          const game=String(r.game_id||r.GameID||'').trim();
          const player=String(r.player_id||r.PlayerID||'').trim();
          if(game&&player)gameInfo.set(game+'|'+player,r);
        }
      }catch(e){console.warn('IceIndex: game context unavailable',e);}
    })();
    return gameInfoPromise;
  }
  function markup(p,selected,competition) {
    if(competition!=="regular")return '';
    return `<section class="panel ism-panel" id="ism-panel" aria-label="Player shot map"><div class="panel-head"><div><h2>Shot Map</h2><p class="ism-sub">${season} season</p></div></div><div id="ism-body" class="ism-body"><div class="ism-loading">Loading shot locations…</div></div></section>`;
  }
  function mount(p,selected,competition) {
    const body=document.getElementById('ism-body');if(!body)return;
    const id=String(p.id||'');active={id,selected,competition};mode='dots';type='all';period='all';
    if(selected!=='career' && selected!==season){body.innerHTML=`<div class="ism-empty">Shot locations are currently available for ${season}. Select that season or Career to view the map.</div>`;return;}
    Promise.all([load(),loadGameInfo()]).then(()=>{if(active?.id===id && document.getElementById('ism-body')===body)draw(body,id);});
  }
  // Historical HockeyTech scale: ~2.93 raw X units/foot, 3 raw Y units/foot.
  // Goal lines: centre +/- 89 feet. Every event remains in the full-rink view.
  const GEO={cx:300,centerY:536,pxPerFt:4.9,rawXPerFt:2.93,rawYPerFt:3,goalFt:89};
  function attackingEnds(rows){
    const groups=new Map();
    for(const r of rows){
      const team=String(r.team_id||r.team_code||'');
      const game=String(r.game_id||'');
      if(!team||!game)continue;
      const k=game+'|'+team;
      if(!groups.has(k))groups.set(k,[]);
      groups.get(k).push(+r.x_location);
    }
    const dirs=new Map();
    for(const [k,xs] of groups){
      // Use robust majority of locations on each half; don't rely on period changes.
      const high=xs.filter(x=>x>300).length,low=xs.filter(x=>x<300).length;
      if(high!==low)dirs.set(k,high>low?'high':'low');
    }
    return dirs;
  }
  let directions=new Map();
  function fold(r){
    const rx=+r.x_location,ry=+r.y_location;
    const key=String(r.game_id||'')+'|'+String(r.team_id||r.team_code||'');
    const dir=directions.get(key)||(rx>=300?'high':'low');
    const longitudinal=(dir==='high'?rx-300:300-rx)/GEO.rawXPerFt;
    const lateral=(ry-150)/GEO.rawYPerFt*(dir==='high'?1:-1);
    return {x:GEO.cx+lateral*GEO.pxPerFt,y:GEO.centerY-longitudinal*GEO.pxPerFt,
      direction:dir,estimated:!directions.has(key)};
  }
  // Zones share the exact same SVG coordinate system as the event markers.
  // The last two zones retain neutral/defensive events instead of dropping them.
  const zoneRegions=[
    {name:'Behind net',points:[[55,46],[545,46],[545,100],[55,100]],label:[300,73]},
    {name:'High slot',points:[[300,100],[180,210],[420,210]],label:[300,158]},
    {name:'Left circle',points:[[55,100],[300,100],[180,210],[180,300],[55,300]],label:[113,233]},
    {name:'Right circle',points:[[300,100],[545,100],[545,300],[420,300],[420,210]],label:[487,233]},
    {name:'Low slot',points:[[180,210],[420,210],[420,300],[180,300]],label:[300,258]},
    {name:'Left point',points:[[55,300],[218,300],[218,414],[55,414]],label:[136,361]},
    {name:'Centre point',points:[[218,300],[382,300],[382,414],[218,414]],label:[300,361]},
    {name:'Right point',points:[[382,300],[545,300],[545,414],[382,414]],label:[464,361]},
    {name:'Neutral zone',points:[[55,414],[545,414],[545,658],[55,658]],label:[300,536]},
    {name:'Defensive zone',points:[[55,658],[545,658],[545,1026],[55,1026]],label:[300,835]}
  ];
  const zoneNames = zoneRegions.map(z=>z.name);
  function pointInPolygon(x,y,poly) {
    let inside=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++) {
      const xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1];
      if(((yi>y)!==(yj>y)) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
    }
    return inside;
  }
  function zone(r) {
    const p=fold(r);
    return (zoneRegions.find(z=>pointInPolygon(p.x,p.y,z.points))||zoneRegions[p.y<100?0:p.y<414?7:p.y<658?8:9]).name;
  }
  // Attacking half only: events beyond centre ice remain in source data,
  // but are deliberately excluded from this visualization.
  const HALF={left:55,right:545,top:46,bottom:536};
  function onShownHalf(r){
    const p=fold(r);
    return p.x>=HALF.left && p.x<=HALF.right && p.y>=HALF.top && p.y<=HALF.bottom;
  }
  function rink(){
    return `<svg class="ism-half-rink" viewBox="0 0 600 562" role="img" aria-label="Attacking half rink shot map; events outside the displayed half are excluded" xmlns="http://www.w3.org/2000/svg">
      <defs><clipPath id="ism-half-clip"><path d="M127 46H473Q545 46 545 118V536H55V118Q55 46 127 46Z"/></clipPath></defs>
      <path d="M127 46H473Q545 46 545 118V536H55V118Q55 46 127 46Z" fill="#27231f" stroke="#b6a38c" stroke-width="2.5"/>
      <g clip-path="url(#ism-half-clip)">
        <g id="ism-zones"></g>
        <path d="M55 100H545" stroke="#b9676b" stroke-width="2.6"/>
        <path d="M55 414H545" stroke="#a3a5aa" stroke-width="4.2" opacity=".85"/>
        <path d="M55 536H545" stroke="#b9676b" stroke-width="2.8"/>
        <circle cx="180" cy="234" r="73.5" fill="none" stroke="#b96970" stroke-width="2"/>
        <circle cx="420" cy="234" r="73.5" fill="none" stroke="#b96970" stroke-width="2"/>
        <path d="M227 536A73.5 73.5 0 0 1 373 536" fill="none" stroke="#b96970" stroke-width="1.6"/>
        <g fill="#c36a72"><circle cx="180" cy="234" r="4"/><circle cx="420" cy="234" r="4"/></g>
        <path d="M285 100V118Q300 145 315 118V100" fill="#625245" fill-opacity=".6" stroke="#c77a80" stroke-width="2"/>
        <path d="M285 100V79H315V100" fill="none" stroke="#e6ded3" stroke-width="3"/>
        <g id="ism-markers"></g>
      </g>
      <path d="M127 46H473Q545 46 545 118V536H55V118Q55 46 127 46Z" fill="none" stroke="#b6a38c" stroke-width="2.5"/>
    </svg>`;
  }
  function drawZones(svg,rows) {
    const g=svg.querySelector('#ism-zones'),ns='http://www.w3.org/2000/svg';
    const counts=Object.fromEntries(zoneNames.map(z=>[z,0]));
    rows.forEach(r=>counts[zone(r)]++);
    zoneRegions.slice(0,9).forEach((z,i)=>{
      const n=counts[z.name],pct=rows.length?Math.round(100*n/rows.length):0;
      const shape=document.createElementNS(ns,'polygon');
      shape.setAttribute('points',z.points.map(p=>p.join(',')).join(' '));
      shape.setAttribute('fill',i===1?'#9b4f32':i===4?'#694538':'#574039');
      shape.setAttribute('fill-opacity',i===0?'.35':i===8?'.28':i===1?'.75':'.54');
      shape.setAttribute('stroke','#b5a6a2');shape.setAttribute('stroke-opacity','.7');
      shape.setAttribute('stroke-width','1.4');g.appendChild(shape);
      const t=document.createElementNS(ns,'text');
      t.setAttribute('x',z.label[0]);t.setAttribute('y',z.label[1]-3);
      t.setAttribute('text-anchor','middle');t.setAttribute('fill','#f8f5f2');
      t.setAttribute('font-size',i>=8?'18':'22');t.setAttribute('font-weight','800');
      t.textContent=pct+'%';g.appendChild(t);
      const sub=document.createElementNS(ns,'text');
      sub.setAttribute('x',z.label[0]);sub.setAttribute('y',z.label[1]+16);
      sub.setAttribute('text-anchor','middle');sub.setAttribute('fill','#ddd1cb');
      sub.setAttribute('font-size','12');sub.textContent=n+' events';g.appendChild(sub);
    });
    return counts;
  }
  function eventDetails(r) {
    const get=(obj,...keys)=>{for(const k of keys){const v=obj?.[k];if(v!==undefined&&v!==null&&String(v).trim()!=="")return String(v).trim();}return "";};
    const context=gameInfo.get(String(r.game_id||'')+'|'+String(r.player_id||''))||{};
    const goal=r.event_type==='goal';
    const name=get(r,'player_name','shooter_name','goal_player_name')||get(context,'player_name');
    const date=get(r,'game_date','date')||get(context,'game_date');
    const opponent=get(r,'opponent_team_name','opponent_name')||get(context,'opponent_team_name','opponent_team_code');
    const club=get(context,'team_name','team_code');
    const periodRaw=get(r,'period','period_id');
    const periodLabel=/^\d+$/.test(periodRaw)?({1:'1st',2:'2nd',3:'3rd',4:'OT'}[Number(periodRaw)]||'Period '+periodRaw):periodRaw;
    const clock=get(r,'time_formatted','event_time','game_time','time');
    const home=get(context,'home_team_name'),away=get(context,'visitor_team_name');
    const homeGoals=get(context,'home_goals'),awayGoals=get(context,'visitor_goals');
    const finalScore=homeGoals!==''&&awayGoals!==''?`${homeGoals}–${awayGoals}`:'';
    const scoreAtEvent=get(r,'score_at_event','score_at_time');
    const goalie=get(r,'goalie_name','opposing_goalie_name','goalie_player_name');
    const assists=[get(r,'assist1_player_name','assist1_name'),get(r,'assist2_player_name','assist2_name')].filter(Boolean);
    const assistText=assists.length?assists.join(', '):get(r,'assist_names','assists_text');
    const rawShotType=get(r,'shot_type_description','shot_type_name');
    const shotType=rawShotType||(/^[0-9]+$/.test(get(r,'shot_type'))?'':get(r,'shot_type'));
    const lines=[
      ['Opponent',opponent],
      ['Period',periodLabel],
      ['Game time',clock],
      ['Goalie',goalie],
      ...(goal?[['Assists',assistText||((get(r,'assists_count')==='0'||get(r,'unassisted')==='true')?'Unassisted':'')]]:[]),
      ['Score at event',scoreAtEvent],
      ['Final score (home–away)',finalScore],
      ['Shot type',shotType],
      ['Location',zone(r)]
    ].filter(([,value])=>value);
    const subtitle=[club&&opponent?`${club} vs ${opponent}`:opponent?`vs ${opponent}`:'',date].filter(Boolean).join(' · ');
    return `<div class="ism-detail-head"><div><strong>${esc(goal?'Goal':'Shot')}${name?' · '+esc(name):''}</strong>${subtitle?`<div class="ism-detail-subtitle">${esc(subtitle)}</div>`:''}</div><button type="button" class="ism-detail-close" aria-label="Close event details">×</button></div><dl class="ism-detail-list">${lines.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
  }
  function draw(body,id) {
    if(error){body.innerHTML=`<div class="ism-empty"><strong>Shot-map data not published yet.</strong><p>Run <code>scripts/games/build_shot_locations.R</code> and publish <code>${esc(path)}</code>. (${esc(error)})</p></div>`;return;}
    directions=attackingEnds(all);
    const player=all.filter(r=>String(r.player_id)===id);
    if(!player.length){body.innerHTML='<div class="ism-empty">No shot-location events available for this player in 2026–27.</div>';return;}
    const periods=[...new Set(player.map(r=>r.period).filter(Boolean))].sort((a,b)=>+a-+b);
    const filtered=player.filter(r=>(type==='all'||r.event_type===type)&&(period==='all'||r.period===period));
    const rows=filtered.filter(onShownHalf);
    const excluded=filtered.length-rows.length;
    const goals=rows.filter(r=>r.event_type==='goal').length;
    const shots=rows.filter(r=>r.event_type==='shot').length;
    body.innerHTML=`<div class="ism-topline"><div class="ism-title"><div class="ism-title-row"><h3>Shot locations</h3><span class="ism-count">${rows.length} displayed</span></div></div><div class="ism-switch" role="group" aria-label="Map display mode"><button type="button" data-ism-mode="dots" aria-pressed="${mode==='dots'}" class="${mode==='dots'?'active':''}">◎ &nbsp;Dots</button><button type="button" data-ism-mode="zones" aria-pressed="${mode==='zones'}" class="${mode==='zones'?'active':''}">▦ &nbsp;Zones</button></div></div><div class="ism-toolbar"><label>EVENT TYPE<select id="ism-type" class="select"><option value="all" ${type==='all'?'selected':''}>All events</option><option value="shot" ${type==='shot'?'selected':''}>Shot events</option><option value="goal" ${type==='goal'?'selected':''}>Goals only</option></select></label><label>PERIOD<select id="ism-period" class="select"><option value="all">All periods</option>${periods.map(p=>`<option value="${esc(p)}" ${period===p?'selected':''}>Period ${esc(p)}</option>`).join('')}</select></label><div class="ism-mini-stats"><div><strong>${shots}</strong><span>SHOTS</span></div><div><strong>${goals}</strong><span>GOALS</span></div><div><strong>${rows.length}</strong><span>EVENTS</span></div></div></div><div class="ism-rink-frame"><div class="ism-rink-head"><span><i class="ism-live-dot"></i> SHOT LOCATIONS</span><span>${season}</span></div><div class="ism-rink-wrap">${rink()}<div class="ism-tooltip" id="ism-tooltip" hidden></div></div><div class="ism-rink-footer"><div class="ism-legend"><span><i class="ism-dot"></i> Shot event</span><span><i class="ism-dot ism-goal"></i> Goal</span></div><span class="ism-scale">${mode==='zones'?'Share of recorded events by zone':'Tap or hover for event details'}</span></div></div><p class="ism-half-disclaimer">Attacking half only · ${excluded} of ${filtered.length} selected events outside this view are not plotted. Source records are unchanged.</p><details class="ism-method"><summary>Methodology <span>⌄</span></summary><p>All recorded events remain in the underlying CSV; only events within the attacking half are plotted. Attacking direction is inferred from each team’s shots within each game; individual events fall back to their recorded rink half when a direction cannot be inferred. Raw coordinates use the historical 2.93 × 3 units-per-foot conversion. Neutral- and defensive-half events are not shown on this half-rink view. Zone boundaries are illustrative, not official scoring-chance zones. Shot events may differ from official shots on goal.</p></details>`;
    const marker=body.querySelector('#ism-markers');if(!marker)return;
    const ns='http://www.w3.org/2000/svg';
    const coord=r=>{const p=fold(r);return [p.x,p.y];};
    if(mode==='dots'){
      const frag=document.createDocumentFragment();
      rows.forEach((r,i)=>{const [x,y]=coord(r),goal=r.event_type==='goal';const c=document.createElementNS(ns,'circle');c.setAttribute('cx',x);c.setAttribute('cy',y);c.setAttribute('r',goal?5.1:3.3);c.setAttribute('class',goal?'ism-marker ism-marker-goal':'ism-marker');c.setAttribute('tabindex','0');c.setAttribute('role','button');c.setAttribute('data-event-index',String(i));c.setAttribute('aria-label',`${goal?'Goal':'Shot'}, game ${r.game_id||'unknown'}, period ${r.period||'unknown'}. Show event details`);frag.appendChild(c);});marker.appendChild(frag);
    }else{
      drawZones(body.querySelector('.ism-half-rink'),rows);
    }
    body.querySelectorAll('[data-ism-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.ismMode;draw(body,id);}));
    body.querySelector('#ism-type').addEventListener('change',e=>{type=e.target.value;draw(body,id);});
    body.querySelector('#ism-period').addEventListener('change',e=>{period=e.target.value;draw(body,id);});
    const tooltip=body.querySelector('#ism-tooltip'),wrap=body.querySelector('.ism-rink-wrap');
    let pinned=null;
    const hide=()=>{tooltip.hidden=true;pinned=null;};
    const show=(c,pin=false)=>{
      const r=rows[Number(c.dataset.eventIndex)];if(!r)return;
      if(pin)pinned=c;
      tooltip.innerHTML=eventDetails(r);tooltip.hidden=false;
      const b=c.getBoundingClientRect(),w=wrap.getBoundingClientRect();
      const maxWidth=Math.min(290,Math.max(190,w.width-16));
      tooltip.style.width=maxWidth+'px';
      tooltip.style.left=`${Math.max(8,Math.min(w.width-maxWidth-8,b.left-w.left-maxWidth/2+b.width/2))}px`;
      tooltip.style.top=`${Math.max(8,Math.min(w.height-tooltip.offsetHeight-8,b.top-w.top-tooltip.offsetHeight-12))}px`;
      tooltip.querySelector('.ism-detail-close')?.addEventListener('click',hide);
    };
    marker.querySelectorAll('.ism-marker').forEach(c=>{
      c.addEventListener('mouseenter',()=>{if(!pinned)show(c);});
      c.addEventListener('focus',()=>{if(!pinned)show(c);});
      c.addEventListener('click',e=>{e.stopPropagation();pinned===c?hide():show(c,true);});
      c.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pinned===c?hide():show(c,true);}else if(e.key==='Escape')hide();});
      c.addEventListener('mouseleave',()=>{if(!pinned)tooltip.hidden=true;});
      c.addEventListener('blur',()=>{if(!pinned)tooltip.hidden=true;});
    });
    wrap.addEventListener('click',e=>{if(!e.target.closest('.ism-marker')&&!e.target.closest('.ism-tooltip'))hide();});
    body.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});
  }
  return {markup,mount};
})();
