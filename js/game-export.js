"use strict";
/* IceIndex v0.12.5 — responsive 9:16 story layouts with full-size rinks. */
(() => {
 const W=1800,P=85,IW=W-P*2;
 const C={bg:'#06101c',panel:'#102236',panel2:'#172e45',stripe:'#142a40',white:'#f4f9ff',muted:'#a8c1d5',blue:'#54bfff',gold:'#ffd27a',rule:'#29445b',red:'#ff6875'};
 const F='Inter,system-ui,-apple-system,"Segoe UI",Arial,sans-serif';
 const $=(r,s)=>r?.querySelector(s), $$=(r,s)=>[...(r?.querySelectorAll(s)||[])], norm=s=>String(s??'').replace(/\s+/g,' ').trim();
 const txt=(r,s)=>norm($(r,s)?.textContent),font=(c,n=25,w=400)=>{c.font=`${w} ${n}px ${F}`};
 function label(c,s,x,y,n=25,col=C.white,w=400,align='left'){font(c,n,w);c.fillStyle=col;c.textAlign=align;c.fillText(norm(s),x,y);c.textAlign='left'}
 function rect(c,x,y,w,h,col,r=0){c.fillStyle=col;c.beginPath();if(r)c.roundRect(x,y,w,h,r);else c.rect(x,y,w,h);c.fill()}
 function fit(c,s,max,n=25,w=400){s=norm(s);font(c,n,w);if(c.measureText(s).width<=max)return s;while(s.length&&c.measureText(s+'…').width>max)s=s.slice(0,-1);return s+'…'}
 function lines(c,s,max,n=25,w=400){font(c,n,w);const out=[];let line='';for(const word of norm(s).split(' ')){const next=line?line+' '+word:word;if(line&&c.measureText(next).width>max){out.push(line);line=word}else line=next}if(line)out.push(line);return out.length?out:['—']}
 // These filenames match scripts/collect_images.R exactly.
 const TEAM_LOGOS={
  'barrie colts':'7.png','brampton steelheads':'18.jpg','brantford bulldogs':'1.png',
  'erie otters':'8.png','flint firebirds':'13.png','guelph storm':'9.png',
  'kingston frontenacs':'2.png','kitchener rangers':'10.png','london knights':'14.png',
  'niagara icedogs':'20.jpg','north bay battalion':'19.png','oshawa generals':'4.png',
  "ottawa 67's":'5_88.png','owen sound attack':'11.png','peterborough petes':'6.png',
  'saginaw spirit':'34.png','sarnia sting':'15.png','soo greyhounds':'16.png',
  'sudbury wolves':'12.png','windsor spitfires':'17.png'
 };
 const TEAM_CODES={'BAR':'barrie colts','BRAM':'brampton steelheads','BFD':'brantford bulldogs',
 'ER':'erie otters','FLNT':'flint firebirds','GUE':'guelph storm','KGN':'kingston frontenacs',
 'KIT':'kitchener rangers','LDN':'london knights','NIAG':'niagara icedogs','NB':'north bay battalion',
 'OSH':'oshawa generals','OTT':"ottawa 67's",'OS':'owen sound attack','PBO':'peterborough petes',
 'SAG':'saginaw spirit','SAR':'sarnia sting','SOO':'soo greyhounds','SBY':'sudbury wolves','WSR':'windsor spitfires'};
 const key=s=>norm(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const logoFor=name=>{
   const raw=norm(name), mapped=TEAM_CODES[raw.toUpperCase()]||raw.toLowerCase();
   const file=TEAM_LOGOS[mapped]||TEAM_LOGOS[Object.keys(TEAM_LOGOS).find(k=>key(k)===key(mapped))];
   if(!file)return '';
   // Resolve against the page, including GitHub Pages /IceIndex/ subdirectory.
   return new URL('assets/teams/ohl/'+file,document.baseURI).href;
 };
 // Draw a team logo inside a square without cropping or distorting it.
 function portrait(c,img,x,y,size,fallback='OHL'){
   rect(c,x,y,size,size,C.panel2,Math.max(7,Math.round(size*.13)));
   if(img && img.naturalWidth && img.naturalHeight){
     const margin=Math.max(4,Math.round(size*.09));
     const scale=Math.min((size-2*margin)/img.naturalWidth,(size-2*margin)/img.naturalHeight);
     const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
     c.drawImage(img,x+(size-w)/2,y+(size-h)/2,w,h);
   }else{
     const initials=norm(fallback).split(/\s+/).map(v=>v[0]||'').slice(0,2).join('').toUpperCase()||'OHL';
     label(c,initials,x+size/2,y+size*.61,Math.max(13,Math.round(size*.25)),C.muted,800,'center');
   }
 }
 function imageUrl(el){const im=$(el,'img');return im?.currentSrc||im?.src||''}
 function idFrom(el){const a=$(el,'[data-person],[data-goalie-id]');return a?.dataset.person||a?.dataset.goalieId||''}
 function person(el){const a=$(el,'[data-person],[data-goalie-id]');return {name:norm(a?.textContent||$(el,'strong')?.textContent||el?.textContent),id:idFrom(el),logo:''}}
 function dataTable(el){return {headers:$$(el,'thead th').map(x=>norm(x.textContent)),rows:$$(el,'tbody tr, tfoot tr').map(tr=>({cells:[...tr.cells].map(x=>norm(x.textContent)),id:idFrom(tr),logo:'',total:tr.parentElement?.tagName==='TFOOT'}))}}
 function collect(root){const hero=$(root,'.igc-game-hero');if(!hero)throw Error('Open an individual game first.');const panels=Object.fromEntries($$(root,'[data-igc-panel]').map(x=>[x.dataset.igcPanel,x]));
 const teams=$$(hero,'.igc-score-team').map(el=>{const name=txt(el,'strong');return {name,score:txt(el,'span:not(.igc-side-label)'),logo:logoFor(name)}});
 const stars=$$(panels.stars,'.igc-star').map(el=>person(el));
 const goals=$$(panels.scoring,'.igc-goal').map(el=>({period:txt(el,'.igc-goal-time strong'),time:txt(el,'.igc-goal-time span'),team:txt(el,'.igc-goal-text small'),scorer:txt(el,'.igc-goal-text strong'),assists:txt(el,'.igc-goal-text > span'),id:idFrom(el),logo:''}));
 const players=$$(panels.players,'table').map((t,i)=>({title:norm($$(panels.players,'h3.igc-team-heading')[i]?.textContent)||teams[i]?.name||'Team',...dataTable(t)}));
 const goalies=$$(panels.goalies,'table').map(dataTable);
 // Associate every player with the club whose box score they appear in.
 players.forEach(t=>t.rows.forEach(r=>r.logo=logoFor(t.title)));
 // Associate goaltenders with their abbreviated team column.
 goalies.forEach(t=>t.rows.forEach(r=>r.logo=logoFor(r.cells[1])));
 const playerTeam=new Map();
 players.forEach(t=>t.rows.forEach(r=>{
   const name=key(r.cells[0]); if(name)playerTeam.set(name,logoFor(t.title));
 }));
 stars.forEach(s=>{s.logo=playerTeam.get(key(s.name))||''});
 goals.forEach(g=>{g.logo=logoFor(g.team)||playerTeam.get(key(g.scorer))||''});
 const penalties=$(panels.penalties,'.igc-penalties-desktop table')||$(panels.penalties,'table');
 return {teams,header:txt(hero,'.igc-hero-top'),footer:$$ (hero,'.igc-hero-foot span').map(e=>norm(e.textContent)).filter(Boolean),facts:$$(root,'.igc-metadata .igc-fact').map(e=>({key:txt(e,'small'),value:txt(e,'strong')})),metrics:$$(panels.summary,'.igc-metric').map(e=>({key:txt(e,'.igc-metric-label'),value:txt(e,'.igc-metric-values')})),period:$(root,'.igc-period-table')?dataTable($(root,'.igc-period-table')):null,stars,goals,players,goalies,penalties:penalties?dataTable(penalties):null,rink:$(panels.shots,'.igc-rink'),shotLegend:txt(panels.shots,'.igc-legend')};}
 async function loadImage(url){if(!url||!/^https?:\/\//i.test(url))return null;try{const img=new Image();img.crossOrigin='anonymous';const loaded=new Promise((ok,no)=>{const timer=setTimeout(()=>no(Error('timeout')),6000);img.onload=()=>{clearTimeout(timer);ok(img)};img.onerror=()=>{clearTimeout(timer);no(Error('image unavailable'))}});img.src=url;return await loaded}catch{return null}}
 async function loadRink(svg,teams){
  if(!svg)return null;
  try{
   const clone=svg.cloneNode(true);
   clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
   clone.setAttribute('width','600');clone.setAttribute('height','1060');
   const markers=[...clone.querySelectorAll('circle.igc-interactive-shot')];
   const names=(teams||[]).map(t=>norm(t.name).toLowerCase());
   const codes=(teams||[]).map(t=>norm(t.name).split(' ').map(w=>w[0]).join('').toLowerCase());
   const events=[];
   markers.forEach(marker=>{
     const description=norm(marker.querySelector('title')?.textContent).toLowerCase();
     let side=names.findIndex(name=>name&&description.includes(name));
     if(side<0)side=codes.findIndex(code=>code&&description.includes(' · '+code+' · '));
     const cy=Number(marker.getAttribute('cy'));
     if(side<0||!Number.isFinite(cy)){marker.remove();return;}
     events.push({marker,side,cy});
   });
   // Infer the attacking end independently for each team using the majority
   // of its recorded events. Exclude shots on the other side of centre red line.
   const endBySide=[0,1].map(side=>{
     const group=events.filter(e=>e.side===side);
     const upper=group.filter(e=>e.cy<536).length;
     const lower=group.filter(e=>e.cy>536).length;
     return upper>=lower?'upper':'lower';
   });
   for(const e of events){
     const isUpper=e.cy<536,isLower=e.cy>536;
     if((endBySide[e.side]==='upper'&&!isUpper)||(endBySide[e.side]==='lower'&&!isLower)){
       e.marker.remove();continue;
     }
     const distance=Math.min(430,Math.abs(e.cy-536));
     e.marker.setAttribute('cy',String(e.side===0?536-distance:536+distance));
   }
   const xml=new XMLSerializer().serializeToString(clone);
   const url=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml'}));
   try{
     const im=new Image();
     return await new Promise((resolve,reject)=>{
       im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Rink unavailable'));im.src=url;
     });
   }finally{URL.revokeObjectURL(url)}
  }catch(e){console.warn('IceIndex rink rendering:',e);return null}
 }
 const SW=1080, SH=1920, SP=42;
 function storyText(c,text,x,y,size=24,color=C.white,weight=600,align='left',max=Infinity){
   label(c,fit(c,text,max,size,weight),x,y,size,color,weight,align);
 }
 function storySection(c,name,y){
   rect(c,SP,y,SW-SP*2,2,C.rule);
   storyText(c,name,SP,y+33,22,C.blue,850);
 }
 function storyMetadata(d){
   const raw=[d.header,...d.footer,...d.facts.map(x=>`${x.key} ${x.value}`)].join(' • ');
   const date=(raw.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}/i)||[])[0]||'';
   const season=(raw.match(/20\d{2}[-–]\d{2,4}/)||[])[0]||'2026–27';
   const arena=d.facts.find(x=>/venue|arena|location/i.test(x.key))?.value||d.footer.find(x=>/centre|center|arena|coliseum|gardens|place|complex|memorial/i.test(x))||'';
   const attendance=(raw.match(/attendance\s*[: ]\s*([\d,]+)/i)||[])[1]||d.facts.find(x=>/attendance/i.test(x.key))?.value||'';
   const duration=(raw.match(/(?:game\s*length|duration)\s*[: ]\s*(\d+:\d+)/i)||[])[1]||d.facts.find(x=>/length|duration/i.test(x.key))?.value||'';
   return {date,season,arena,attendance,duration};
 }
 function storyRink(c,d,im,y,h=490,vertical=false,rinkScale=1){
   storySection(c,'SHOT MAP',y);
   const bx=SP,by=y+44,bw=SW-SP*2,bh=h-44;
   rect(c,bx,by,bw,bh,C.panel,16);
   const left=d.teams[1]||{},right=d.teams[0]||{};
   if(vertical){
     storyText(c,(d.teams[0]||{}).name||'TEAM 1',SW/2,by+39,23,C.white,800,'center',bw-40);
     storyText(c,(d.teams[1]||{}).name||'TEAM 2',SW/2,by+bh-78,23,C.white,800,'center',bw-40);
   }else{
     storyText(c,left.name,bx+20,by+35,21,C.white,750,'left',bw*.43);
     storyText(c,right.name,bx+bw-20,by+35,21,C.white,750,'right',bw*.43);
   }
   const disclaimerH=60;
   const topPad=vertical?62:54,bottomPad=vertical?106:disclaimerH+17;
   const availW=bw-44,availH=bh-topPad-bottomPad;
   if(im){
     const ow=600,oh=1060;
     const naturalW=vertical?ow:oh,naturalH=vertical?oh:ow;
     const base=Math.min(availW/naturalW,availH/naturalH);
     // Use maximum available rink area without clipping.
     const scale=Math.min(base*rinkScale,availW/naturalW,availH/naturalH);
     const centerY=by+topPad+availH/2;
     c.save();c.translate(SW/2,centerY);
     if(!vertical)c.rotate(Math.PI/2);
     c.drawImage(im,-ow*scale/2,-oh*scale/2,ow*scale,oh*scale);
     c.restore();
   }else storyText(c,'Shot locations unavailable',SW/2,by+bh/2,25,C.muted,600,'center');
   storyText(c,'BLUE  •  SHOTS     RED  •  GOALS',SW/2,by+bh-39,17,C.muted,700,'center');
   storyText(c,'* Shots and goals beyond the centre red line are excluded.',SW/2,by+bh-15,15,C.muted,500,'center');
   return by+bh;
 }
 function goalLayout(d){
   const groups=[];
   for(const g of d.goals){const p=norm(g.period)||'—';let group=groups.find(x=>x.period===p);if(!group){group={period:p,goals:[]};groups.push(group)}group.goals.push(g)}
   return {groups,rows:groups.reduce((a,g)=>a+Math.ceil(g.goals.length/2),0)};
 }
 function storyGoals(c,d,images,y,allocatedH){
   if(!d.goals.length)return y;
   storySection(c,'GOAL SCORERS',y);
   const {groups,rows}=goalLayout(d);
   const top=y+47,headerH=35,gap=8;
   const available=allocatedH-47-groups.length*(headerH+gap);
   const rowH=Math.max(48,Math.floor(available/Math.max(rows,1)));
   const colGap=12,colW=(SW-SP*2-colGap)/2;
   let yy=top;
   groups.forEach(group=>{
     rect(c,SP,yy,SW-SP*2,29,C.panel2,7);
     storyText(c,`PERIOD ${group.period.replace(/^P/i,'')}`,SP+14,yy+22,19,C.blue,850);
     yy+=headerH;
     group.goals.forEach((g,i)=>{
       const col=i%2,row=Math.floor(i/2),x=SP+col*(colW+colGap),ry=yy+row*rowH;
       rect(c,x,ry,colW,rowH-5,row%2?C.panel:C.stripe,9);
       const im=images.get(g.logo),sz=Math.min(57,rowH-13);
       if(im)portrait(c,im,x+8,ry+6,sz,g.team);
       const tx=x+(im?sz+17:14),avail=colW-(tx-x)-10;
       storyText(c,g.time||'—',tx,ry+Math.min(26,rowH*.4),18,C.blue,800,'left',avail);
       storyText(c,g.scorer||'Unknown scorer',tx,ry+Math.min(rowH-12,59),Math.min(25,Math.max(18,rowH*.31)),C.white,800,'left',avail);
     });
     yy+=Math.ceil(group.goals.length/2)*rowH+gap;
   });
   return yy;
 }
 function chooseFormat(){
   return new Promise(resolve=>{
     const overlay=document.createElement('div');
     overlay.className='ice-export-overlay';
     overlay.innerHTML=`
       <style>
         .ice-export-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(1,8,17,.84);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
         .ice-export-overlay *{box-sizing:border-box}
         .ice-export-dialog{width:min(100%,540px);max-height:min(92dvh,780px);overflow:auto;background:#0e2032;color:#f5f9ff;border:1px solid #2a4960;border-radius:22px;box-shadow:0 30px 95px #000b;padding:26px}
         .ice-export-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:22px}
         .ice-export-eyebrow{font-size:11px;letter-spacing:1.5px;font-weight:850;color:#54bfff;margin:0 0 9px}
         .ice-export-title{font-size:25px;line-height:1.16;letter-spacing:-.7px;font-weight:850;margin:0 0 9px;color:#f5f9ff}
         .ice-export-subtitle{font-size:13px;line-height:1.55;color:#a8c1d5;margin:0}
         .ice-export-close{border:1px solid #29445b;background:#172e45;color:#c9d9e6;width:35px;height:35px;border-radius:10px;font-size:22px;line-height:1;cursor:pointer;flex-shrink:0}
         .ice-export-section{font-size:11px;letter-spacing:1.25px;color:#a8c1d5;font-weight:850;margin:0 0 12px}
         .ice-export-options{display:grid;grid-template-columns:1fr 1fr;gap:12px}
         .ice-export-option{appearance:none;display:flex;flex-direction:column;text-align:left;gap:9px;background:#132a40;border:1.5px solid #31516a;border-radius:14px;padding:12px;color:#f5f9ff;cursor:pointer;transition:border-color .15s,background .15s,box-shadow .15s;min-width:0;font-family:inherit}
         .ice-export-option:hover{border-color:#69c8ff;background:#19354d}
         .ice-export-option[aria-checked="true"]{border-color:#54bfff;background:#17354e;box-shadow:inset 0 0 0 1px #54bfff,0 0 0 2px #54bfff19}
         .ice-export-option:focus-visible,.ice-export-close:focus-visible,.ice-export-btn:focus-visible{outline:3px solid #8ad7ff;outline-offset:3px}
         .ice-export-preview{height:125px;width:100%;border-radius:9px;background:#071521;border:1px solid #24445c;padding:9px;display:flex;flex-direction:column;gap:5px;overflow:hidden}
         .ice-export-minihero{height:28px;border-radius:5px;background:#1c3a52;display:flex;align-items:center;justify-content:center;color:#69c8ff;font-weight:850;font-size:15px;letter-spacing:1px}
         .ice-export-minigoals{display:grid;grid-template-columns:1fr 1fr;gap:4px}.ice-export-minigoals span{height:12px;border-radius:3px;background:#1c3a52}
         .ice-export-minirink{flex:1;min-height:0;border:1px solid #7a9fb7;border-radius:11px;position:relative;background:linear-gradient(90deg,transparent 48%,#e76a79 48%,#e76a79 49%,transparent 49%);overflow:hidden}
         .ice-export-minirink:before,.ice-export-minirink:after{content:"";position:absolute;top:20%;width:18%;height:60%;border:1px solid #df6677;border-radius:50%}.ice-export-minirink:before{left:17%}.ice-export-minirink:after{right:17%}
         .ice-export-preview.ice-export-preview-vertical{flex-direction:row;justify-content:center}.ice-export-preview-vertical .ice-export-minirink{width:58%;height:100%;flex:none;background:linear-gradient(0deg,transparent 49%,#e76a79 49%,#e76a79 51%,transparent 51%)}.ice-export-preview-vertical .ice-export-minirink:before,.ice-export-preview-vertical .ice-export-minirink:after{top:auto;left:20%;width:60%;height:18%}.ice-export-preview-vertical .ice-export-minirink:before{top:15%}.ice-export-preview-vertical .ice-export-minirink:after{bottom:15%}
         .ice-export-option-top{display:flex;align-items:center;justify-content:space-between;gap:5px}.ice-export-option-name{font-size:15px;font-weight:800;line-height:1.25}.ice-export-check{width:19px;height:19px;border:1.5px solid #52748b;border-radius:50%;display:grid;place-items:center;flex:none;font-size:12px;color:transparent}.ice-export-option[aria-checked="true"] .ice-export-check{background:#54bfff;border-color:#54bfff;color:#06101c}
         .ice-export-option-desc{font-size:12px;color:#a8c1d5;line-height:1.45;min-height:35px}
         .ice-export-meta{display:flex;align-items:center;justify-content:center;gap:7px;color:#a8c1d5;font-size:12px;padding:16px 0 17px;border-bottom:1px solid #29445b}
         .ice-export-actions{display:flex;gap:10px;padding-top:17px}
         .ice-export-btn{border-radius:11px;min-height:47px;padding:11px 17px;font:750 14px Inter,system-ui,sans-serif;cursor:pointer}
         .ice-export-cancel{flex:1;border:1px solid #37556b;background:#172e45;color:#e3edf5}
         .ice-export-download{flex:2;border:0;background:#54bfff;color:#06101c;display:flex;align-items:center;justify-content:center;gap:9px}
         .ice-export-download:hover{background:#81d0ff}
         @media(max-width:410px){.ice-export-dialog{padding:18px;border-radius:17px}.ice-export-title{font-size:22px}.ice-export-options{gap:8px}.ice-export-option{padding:9px}.ice-export-preview{height:100px}.ice-export-option-name{font-size:13px}.ice-export-option-desc{font-size:11px}}
         @media(max-height:620px){.ice-export-dialog{padding:16px}.ice-export-head{margin-bottom:12px}.ice-export-preview{height:80px}.ice-export-meta{padding:9px 0}.ice-export-actions{padding-top:10px}}
         @media(prefers-reduced-motion:reduce){.ice-export-option{transition:none}}
       </style>
       <div class="ice-export-dialog" role="dialog" aria-modal="true" aria-labelledby="ice-export-title" aria-describedby="ice-export-subtitle">
         <div class="ice-export-head">
           <div><p class="ice-export-eyebrow">ICEINDEX · GAME CENTRE</p><h2 class="ice-export-title" id="ice-export-title">Create game graphic</h2><p class="ice-export-subtitle" id="ice-export-subtitle">Choose a ready-to-post Instagram Story layout.</p></div>
           <button class="ice-export-close" type="button" data-action="cancel" aria-label="Close export dialog">×</button>
         </div>
         <p class="ice-export-section" id="ice-export-layout-label">SELECT FORMAT</p>
         <div class="ice-export-options" role="radiogroup" aria-labelledby="ice-export-layout-label">
           <button class="ice-export-option" type="button" role="radio" aria-checked="true" data-format="full">
             <div class="ice-export-preview" aria-hidden="true"><div class="ice-export-minihero">6 — 4</div><div class="ice-export-minigoals"><span></span><span></span><span></span><span></span></div><div class="ice-export-minirink"></div><div class="ice-export-minigoals"><span></span><span></span></div></div>
             <div class="ice-export-option-top"><span class="ice-export-option-name">Full recap</span><span class="ice-export-check" aria-hidden="true">✓</span></div>
             <span class="ice-export-option-desc">Final score, goal scorers, shot map and three stars.</span>
           </button>
           <button class="ice-export-option" type="button" role="radio" aria-checked="false" data-format="condensed" tabindex="-1">
             <div class="ice-export-preview ice-export-preview-vertical" aria-hidden="true"><div class="ice-export-minirink"></div></div>
             <div class="ice-export-option-top"><span class="ice-export-option-name">Shot map</span><span class="ice-export-check" aria-hidden="true">✓</span></div>
             <span class="ice-export-option-desc">Final score and enlarged vertical rink.</span>
           </button>
         </div>
         <div class="ice-export-meta"><span>1080 × 1920</span><span aria-hidden="true">·</span><span>9:16 portrait</span><span aria-hidden="true">·</span><span>PNG</span></div>
         <div class="ice-export-actions"><button class="ice-export-btn ice-export-cancel" type="button" data-action="cancel">Cancel</button><button class="ice-export-btn ice-export-download" type="button" data-action="export"><span aria-hidden="true">↓</span> Download graphic</button></div>
       </div>`;
     let selected='full';
     const options=[...overlay.querySelectorAll('[data-format]')];
     const setSelected=value=>{selected=value;options.forEach(btn=>{const active=btn.dataset.format===value;btn.setAttribute('aria-checked',String(active));btn.tabIndex=active?0:-1;});};
     const previousFocus=document.activeElement;
     const finish=v=>{document.removeEventListener('keydown',onKey);overlay.remove();if(previousFocus?.isConnected)previousFocus.focus();resolve(v);};
     const onKey=e=>{
       if(e.key==='Escape'){e.preventDefault();finish(null);return;}
       if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&options.includes(document.activeElement)){
         e.preventDefault();const next=selected==='full'?'condensed':'full';setSelected(next);options.find(x=>x.dataset.format===next).focus();
       }
       if(e.key==='Tab'){
         const focusable=[...overlay.querySelectorAll('button:not([tabindex="-1"])')];
         const first=focusable[0],last=focusable[focusable.length-1];
         if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
         else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
       }
     };
     document.addEventListener('keydown',onKey);
     overlay.addEventListener('click',e=>{
       const format=e.target.closest('[data-format]');if(format){setSelected(format.dataset.format);format.focus();return;}
       const action=e.target.closest('[data-action]');
       if(action){finish(action.dataset.action==='cancel'?null:{format:selected,rinkScale:1});return;}
       if(e.target===overlay)finish(null);
     });
     document.body.append(overlay);
     options[0].focus();
   });
 }
 async function download(root,gameId){
   if(!window.IceIndexMembers?.isApproved()){
     window.IceIndexMembers?.open();
     throw Error('Approved membership required to export reports.');
   }
   await window.IceIndexMembers.refresh();
   if(!window.IceIndexMembers.isApproved())throw Error('Membership approval required.');
   const settings=await chooseFormat();
   if(!settings)return;
   const {format,rinkScale}=settings;
   const d=collect(root),m=storyMetadata(d);
   const urls=[...new Set([...d.teams.map(t=>t.logo),...d.stars.map(t=>t.logo),...d.goals.map(t=>t.logo)].filter(Boolean))];
   const images=new Map();
   await Promise.all(urls.map(async u=>images.set(u,await loadImage(u))));
   const rinkImage=await loadRink(d.rink,d.teams);
   const brandImage=await loadImage(new URL('assets/branding/iceindex-logo.png',document.baseURI).href);
   const canvas=document.createElement('canvas');canvas.width=SW;canvas.height=SH;
   const c=canvas.getContext('2d');if(!c)throw Error('Canvas unavailable');
   rect(c,0,0,SW,SH,C.bg);rect(c,0,0,SW,7,C.blue);
   if(brandImage){
     const ratio=brandImage.width/brandImage.height;
     const bh=49,bw=Math.min(110,bh*ratio);
     c.drawImage(brandImage,SP,22,bw,bh);
     storyText(c,'ICEINDEX',SP+bw+12,60,33,C.white,850);
   }else storyText(c,'ICEINDEX',SP,61,36,C.white,850);
   storyText(c,'OHL GAME RECAP',SW-SP,60,27,C.blue,850,'right');
   const a=d.teams[0]||{name:'Away',score:'—'},b=d.teams[1]||{name:'Home',score:'—'};
   const heroY=82,heroH=340;
   rect(c,SP,heroY,SW-SP*2,heroH,C.panel,18);
   storyText(c,'FINAL',SW/2,heroY+42,29,C.gold,850,'center');
   storyText(c,m.date||'GAME DAY',SW/2,heroY+73,21,C.muted,650,'center');
   const al=images.get(a.logo),bl=images.get(b.logo);
   portrait(c,al,SP+50,heroY+90,112,a.name);
   portrait(c,bl,SW-SP-162,heroY+90,112,b.name);
   storyText(c,`${a.score||'—'} – ${b.score||'—'}`,SW/2,heroY+189,92,C.blue,850,'center');
   storyText(c,a.name,SP+20,heroY+229,24,C.white,800,'left',400);
   storyText(c,b.name,SW-SP-20,heroY+229,24,C.white,800,'right',400);
   rect(c,SP+24,heroY+249,SW-SP*2-48,1,C.rule);
   storyText(c,`OHL ${m.season} SEASON`,SW/2,heroY+278,20,C.muted,750,'center');
   const venue=norm(m.arena)||'Arena not listed';
   storyText(c,venue,SW/2,heroY+307,22,C.white,700,'center',SW-SP*2-50);
   const details=[m.attendance?`ATTENDANCE ${m.attendance}`:'',m.duration?`GAME LENGTH ${m.duration}`:''].filter(Boolean).join('    •    ');
   if(details)storyText(c,details,SW/2,heroY+331,17,C.muted,650,'center',SW-SP*2-50);
   if(format==='condensed'){
     // A vertical rink uses the full height between scoreboard and footer.
     storyRink(c,d,rinkImage,444,1378,true,rinkScale);
   }else{
     const goalsTop=441, footerStart=SH-95, starsH=d.stars.length?157:0;
     const usableEnd=footerStart-starsH-18;
     const {rows,groups}=goalLayout(d);
     let rinkTop;
     if(rows){
       // Allocate space according to actual scoring volume, not a fixed Y.
       // Zero-goal games get a much larger shot map automatically.
       const goalNeed=47+groups.length*43+rows*72+15;
       const maxGoalArea=Math.max(230,usableEnd-goalsTop-430);
       const goalArea=Math.min(maxGoalArea,Math.max(230,goalNeed));
       const goalEnd=storyGoals(c,d,images,goalsTop,goalArea);
       rinkTop=Math.max(goalsTop+goalArea+12,goalEnd+14);
     }else{
       rinkTop=goalsTop;
     }
     const rinkEnd=storyRink(c,d,rinkImage,rinkTop,Math.max(370,usableEnd-rinkTop),false,rinkScale);
     if(d.stars.length){
       storySection(c,'THREE STARS',rinkEnd+12);
       const stars=d.stars.slice(0,3),starTop=rinkEnd+58;
       const starW=(SW-SP*2-20)/3;
       stars.forEach((s,i)=>{
         const x=SP+i*(starW+10);
         rect(c,x,starTop,starW,92,C.panel,10);
         const logo=images.get(s.logo);
         if(logo)portrait(c,logo,x+9,starTop+18,54,s.name);
         const tx=x+(logo?72:13),mw=starW-(logo?80:23);
         storyText(c,`${i+1}${['ST','ND','RD'][i]} STAR`,tx,starTop+31,16,C.gold,850,'left',mw);
         const nameLines=lines(c,s.name,mw,19,750).slice(0,2);
         nameLines.forEach((line,j)=>storyText(c,line,tx,starTop+58+j*21,19,C.white,750,'left',mw));
       });
     }
   }
   rect(c,SP,SH-80,SW-SP*2,2,C.rule);
   if(brandImage){
     const fh=37,fw=Math.min(90,fh*brandImage.width/brandImage.height);
     const labelWidth=140,total=fw+10+labelWidth;
     const x=(SW-total)/2;
     c.drawImage(brandImage,x,SH-65,fw,fh);
     storyText(c,'ICEINDEX',x+fw+10,SH-37,26,C.white,850);
   }else storyText(c,'ICEINDEX',SW/2,SH-38,27,C.white,850,'center');
   const blob=await new Promise(ok=>canvas.toBlob(ok,'image/png'));
   if(!blob)throw Error('PNG encoding failed (check image CORS)');
   const url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;link.download=`IceIndex-OHL-Game-${String(gameId)}-${format}-Story-1080x1920.png`;
   document.body.append(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),15000);
 }
 window.IceIndexGameExport={download};
})();
