/* IceIndex v0.14.0 — responsive full-rink orientation. Original coordinates preserved. */
(()=>{'use strict';
const desktop=matchMedia('(min-width: 761px)');
function apply(){
 document.querySelectorAll('.igc-rink').forEach(svg=>{
  if(!svg.querySelector('.igc-rink-art')){
   const art=document.createElementNS('http://www.w3.org/2000/svg','g');
   art.setAttribute('class','igc-rink-art');
   // Preserve defs, markers, event click listeners and shot coordinates.
   while(svg.firstChild)art.appendChild(svg.firstChild);
   svg.appendChild(art);
  }
  const wide=desktop.matches;
  if(svg.dataset.rinkOrientation===(wide?'wide':'tall'))return;
  svg.setAttribute('viewBox',wide?'0 0 1060 600':'0 0 600 1060');
  svg.querySelector('.igc-rink-art').setAttribute('transform',wide?'translate(1060 0) rotate(90)':'');
  svg.dataset.rinkOrientation=wide?'wide':'tall';
  svg.setAttribute('aria-label',wide?'Horizontal full-rink shot locations':'Vertical full-rink shot locations');
 });
}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}
function init(){const host=document.getElementById('main-content');if(!host)return;new MutationObserver(schedule).observe(host,{childList:true,subtree:true});desktop.addEventListener?.('change',schedule);window.addEventListener('resize',schedule,{passive:true});schedule()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
