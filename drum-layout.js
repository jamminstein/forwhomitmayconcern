// Keep the little instrument clear of the lettering, including its random sizes.
const machine=document.querySelector('#drumMachine');
let pending=false,userPosition=null,placedPosition=null,drag=null;
let layoutWidth=document.documentElement.clientWidth;
function layoutHeight(){return matchMedia('(max-width:700px)').matches?document.querySelector('#pageWritings').getBoundingClientRect().height/2.35:innerHeight}
function arrange(){
 pending=false;
 if(drag)return;
 const mobile=matchMedia('(max-width:700px)').matches;
 const width=document.documentElement.clientWidth,height=layoutHeight();
 const scroll=mobile?scrollY:0;
 const limit=mobile?height*2.35:height;
 const obstacles=[...document.querySelectorAll('.page-writing,.page-writing svg,.page-writing svg path,.written-name,.written-name svg path,.portrait-link,#workCredits,.glass-dock,#musicWaveform,.project-links,#themeToggle')].filter(el=>!mobile||getComputedStyle(el).position!=='fixed').map(el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height).map(r=>({left:r.left-30,right:r.right+30,top:r.top+scroll-30,bottom:r.bottom+scroll+30}));
 const preferred=userPosition||placedPosition||{x:width*(mobile?.13:.07),y:mobile?height*1.45:height*.8-66};
 const candidates=[];
 if(preferred.x>=14&&preferred.x<=width-134&&preferred.y>=14&&preferred.y<=limit-84)candidates.push(preferred);
 for(let y=30;y<limit-90;y+=10)for(let x=24;x<width-145;x+=10)candidates.push({x,y});
 candidates.sort((a,b)=>Math.hypot(a.x-preferred.x,a.y-preferred.y)-Math.hypot(b.x-preferred.x,b.y-preferred.y));
 // Include the rotated shell and its overflowing pencil strokes in the footprint.
 const clear=p=>obstacles.every(r=>p.x+132<r.left||p.x-12>r.right||p.y+84<r.top||p.y-12>r.bottom);
 const spot=candidates.find(clear);
 if(spot){placedPosition=spot;machine.style.left=`${spot.x}px`;machine.style.top=`${spot.y}px`;machine.style.bottom='auto'}
}
function schedule(){if(!pending){pending=true;requestAnimationFrame(arrange)}}
const writings=document.querySelector('#pageWritings');
const sizes=new ResizeObserver(schedule);
function watchWritingSizes(){for(const el of writings.querySelectorAll('.page-writing,svg'))sizes.observe(el);schedule()}
new MutationObserver(watchWritingSizes).observe(writings,{childList:true,subtree:true});
watchWritingSizes();
for(const el of document.querySelectorAll('.written-name'))sizes.observe(el);
window.addEventListener('resize',()=>{
 const width=document.documentElement.clientWidth;
 // Mobile browser chrome changes viewport height during scrolling, not the page layout.
 if(matchMedia('(max-width:700px)').matches&&width===layoutWidth)return;
 layoutWidth=width;schedule();
});
window.addEventListener('load',schedule);
schedule();

const grip=machine.querySelector('.drum-grab');
grip.addEventListener('pointerdown',e=>{
 if(e.button!==0)return;
 e.preventDefault();
 drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:machine.offsetLeft,top:machine.offsetTop};
 grip.setPointerCapture(e.pointerId);
});
grip.addEventListener('pointermove',e=>{
 if(!drag||drag.id!==e.pointerId)return;
 const mobile=matchMedia('(max-width:700px)').matches;
 const x=Math.max(14,Math.min(document.documentElement.clientWidth-134,drag.left+e.clientX-drag.x));
 const y=Math.max(14,Math.min((mobile?layoutHeight()*2.35:innerHeight)-80,drag.top+e.clientY-drag.y));
 userPosition={x,y};machine.style.left=`${x}px`;machine.style.top=`${y}px`;machine.style.bottom='auto';
});
function finish(e){if(!drag||drag.id!==e.pointerId)return;drag=null;schedule()}
grip.addEventListener('pointerup',finish);
grip.addEventListener('pointercancel',finish);
grip.addEventListener('keydown',e=>{
 const delta={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]}[e.key];
 if(!delta)return;e.preventDefault();userPosition={x:machine.offsetLeft+delta[0],y:machine.offsetTop+delta[1]};schedule();
});
