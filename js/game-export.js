"use strict";
/* IceIndex v0.12.0: full game PNG export from existing rendered Game Centre sections.
   The public CSVs remain public. This is a member-gated UI, not DRM. */
(() => {
  const W=1600, PAD=78, INNER=W-2*PAD;
  const C={bg:'#07111d',panel:'#101f30',ink:'#eef7ff',muted:'#a7c1d6',accent:'#58b8ff',rule:'#2b4255'};
  const norm=s=>String(s??'').replace(/\s+/g,' ').trim();
  function wrap(ctx,text,width){
    const words=norm(text).split(' '), lines=[];let line='';
    for(const word of words){const next=line?line+' '+word:word;if(ctx.measureText(next).width>width&&line){lines.push(line);line=word;}else line=next;}
    if(line)lines.push(line);return lines.length?lines:['—'];
  }
  function build(gameRoot){
    const title=gameRoot.querySelector('.igc-game-hero');
    if(!title)throw Error('Open an individual game first.');
    const teams=[...title.querySelectorAll('.igc-score-team')].map(el=>({name:norm(el.querySelector('strong')?.textContent),score:norm(el.querySelector('span:not(.igc-side-label)')?.textContent)}));
    const header=norm(title.querySelector('.igc-hero-top')?.textContent);
    const foot=norm(title.querySelector('.igc-hero-foot')?.textContent);
    const sections=[];
    for(const panel of gameRoot.querySelectorAll('[data-igc-panel]')){
      const tab=panel.dataset.igcPanel;
      if(tab==='summary'){
        const facts=[...gameRoot.querySelectorAll('.igc-metadata .igc-fact')].map(el=>norm(el.textContent));
        if(facts.length)sections.push({title:'GAME DETAILS',lines:facts});
        const metrics=[...panel.querySelectorAll('.igc-metric')].map(el=>norm(el.querySelector('.igc-metric-label')?.textContent)+' — '+norm(el.querySelector('.igc-metric-values')?.textContent));
        if(metrics.length)sections.push({title:'INSIDE THE GAME',lines:metrics});
      }
      if(tab==='shots'){
        const shotCount=norm(panel.querySelector('.igc-legend')?.textContent);
        sections.push({title:'SHOT LOCATIONS',lines:[shotCount||'No shot coordinates available'],svg:panel.querySelector('.igc-rink')});
      }
      if(tab==='scoring'){
        const lines=[...panel.querySelectorAll('.igc-goal')].map(el=>norm(el.textContent));
        sections.push({title:'SCORING TIMELINE',lines:lines.length?lines:['No scoring plays recorded']});
      }
      if(tab==='stars'){
        const lines=[...panel.querySelectorAll('.igc-star')].map(el=>norm(el.textContent));
        sections.push({title:'THREE STARS',lines:lines.length?lines:['Three stars unavailable']});
      }
      if(tab==='penalties'){
        const rows=[...panel.querySelectorAll('.igc-penalties-desktop tbody tr')].map(tr=>[...tr.cells].map(td=>norm(td.textContent)).join('  |  '));
        sections.push({title:'PENALTIES',lines:rows.length?rows:['No penalties recorded']});
      }
      if(tab==='goalies'){
        const rows=[...panel.querySelectorAll('tbody tr')].map(tr=>[...tr.cells].map(td=>norm(td.textContent)).join('  |  '));
        sections.push({title:'GOALTENDERS  •  NAME | TEAM | TOI | SA | SV | GA | SV%',lines:rows.length?rows:['No goalie statistics available']});
      }
      if(tab==='players'){
        const headings=[...panel.querySelectorAll('h3.igc-team-heading')];
        const tables=[...panel.querySelectorAll('table')];
        tables.forEach((table,i)=>{
          const labels=[...table.querySelectorAll('thead th')].map(th=>norm(th.textContent)).join(' | ');
          const lines=[...table.querySelectorAll('tbody tr, tfoot tr')].map(tr=>[...tr.cells].map(td=>norm(td.textContent)).join(' | '));
          sections.push({title:'PLAYER BOX SCORE — '+norm(headings[i]?.textContent),lines:[labels,...lines]});
        });
      }
    }
    const period=gameRoot.querySelector('.igc-period-table');
    if(period){const lines=[...period.querySelectorAll('tr')].map(tr=>[...tr.cells].map(td=>norm(td.textContent)).join(' | '));sections.splice(1,0,{title:'PERIOD BREAKDOWN  •  GOALS / SHOTS',lines});}
    return {teams,header,foot,sections};
  }
  async function download(gameRoot,gameId){
    if(!window.IceIndexMembers?.isApproved()) {window.IceIndexMembers?.open();throw Error('Administrator approval is required to download game reports.');}
    await window.IceIndexMembers.refresh();
    if(!window.IceIndexMembers.isApproved())throw Error('Your account is not currently approved.');
    const data=build(gameRoot);
    const canvas=document.createElement('canvas');const ctx=canvas.getContext('2d');
    if(!ctx)throw Error('Canvas is unavailable in this browser.');
    canvas.width=W;ctx.font='27px system-ui, sans-serif';
    const lineHeight=40, sections=[];
    for(const s of data.sections){
      const lines=[];
      for(const line of s.lines)lines.push(...wrap(ctx,line,INNER-70));
      const svgHeight=s.svg?780:0;
      sections.push({...s,lines,height:95+lines.length*lineHeight+svgHeight+35});
    }
    const height=470+sections.reduce((n,s)=>n+s.height+22,0)+135;
    if(height>30000)throw Error('This game report exceeds the browser PNG height limit.');
    canvas.height=height;
    ctx.fillStyle=C.bg;ctx.fillRect(0,0,W,height);
    ctx.fillStyle=C.accent;ctx.fillRect(0,0,W,12);
    let y=76;
    ctx.fillStyle=C.accent;ctx.font='bold 30px system-ui';ctx.fillText('ICEINDEX  /  OHL GAME REPORT',PAD,y);y+=76;
    ctx.fillStyle=C.muted;ctx.font='27px system-ui';ctx.fillText(data.header,PAD,y);y+=70;
    ctx.fillStyle=C.ink;ctx.font='bold 39px system-ui';
    const [away,home]=data.teams;
    ctx.fillText(away?.name||'Away',PAD,y);ctx.textAlign='right';ctx.fillText(home?.name||'Home',W-PAD,y);ctx.textAlign='left';y+=95;
    ctx.font='bold 82px system-ui';ctx.fillStyle=C.accent;
    ctx.fillText(away?.score||'—',PAD,y);ctx.textAlign='right';ctx.fillText(home?.score||'—',W-PAD,y);ctx.textAlign='left';y+=68;
    ctx.font='25px system-ui';ctx.fillStyle=C.muted;
    for(const line of wrap(ctx,data.foot,INNER)){ctx.fillText(line,PAD,y);y+=34;}
    y=Math.max(y+45,470);
    for(const s of sections){
      ctx.fillStyle=C.panel;ctx.fillRect(PAD,y,INNER,s.height);
      ctx.fillStyle=C.accent;ctx.fillRect(PAD,y,6,s.height);
      ctx.fillStyle=C.ink;ctx.font='bold 30px system-ui';ctx.fillText(s.title,PAD+28,y+49);
      let ly=y+95;ctx.font='25px system-ui';
      for(let i=0;i<s.lines.length;i++){
        if(i%2===1){ctx.fillStyle='#15283a';ctx.fillRect(PAD+16,ly-29,INNER-32,lineHeight);}
        ctx.fillStyle=C.ink;ctx.fillText(s.lines[i],PAD+30,ly);ly+=lineHeight;
      }
      if(s.svg){
        try{
          const clone=s.svg.cloneNode(true);clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width','600');clone.setAttribute('height','1060');
          const xml=new XMLSerializer().serializeToString(clone);
          const blob=new Blob([xml],{type:'image/svg+xml;charset=utf-8'});const url=URL.createObjectURL(blob);
          try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});ctx.drawImage(img,PAD+INNER/2-205,ly+15,410,725);}finally{URL.revokeObjectURL(url);}
        }catch(e){ctx.fillStyle=C.muted;ctx.fillText('Shot map rendering unavailable',PAD+30,ly+60);}
      }
      y+=s.height+22;
    }
    ctx.fillStyle=C.rule;ctx.fillRect(PAD,height-112,INNER,2);
    ctx.fillStyle=C.muted;ctx.font='25px system-ui';ctx.fillText('IceIndex • Hockey Data Intelligence',PAD,height-66);
    ctx.textAlign='right';ctx.fillText('iceindex • game '+String(gameId),W-PAD,height-66);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw Error('Could not encode the game report PNG.');
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`IceIndex-OHL-Game-${String(gameId)}.png`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
  }
  window.IceIndexGameExport={download};
})();
