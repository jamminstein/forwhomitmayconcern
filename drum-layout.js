// Keep the little instrument clear of the lettering, including its random sizes.
const machine=document.querySelector('#drumMachine');
let pending=false;
function arrange(){
 pending=false;
 const mobile=matchMedia('(max-width:700px)').matches;
 const width=document.documentElement.clientWidth,height=innerHeight;
 const scroll=mobile?scrollY:0;
 const limit=mobile?height*2.35:height;
 const obstacles=[...document.querySelectorAll('.page-writing svg,.written-name,.portrait-link,.glass-dock,#workCredits,#themeToggle')].map(el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height).map(r=>({left:r.left-20,right:r.right+20,top:r.top+scroll-20,bottom:r.bottom+scroll+20}));
 const preferred={x:width*(mobile?.13:.07),y:mobile?height*1.45:height*.8-66};
 const candidates=[preferred];
 for(let y=30;y<limit-90;y+=18)for(let x=24;x<width-145;x+=18)candidates.push({x,y});
 candidates.sort((a,b)=>Math.hypot(a.x-preferred.x,a.y-preferred.y)-Math.hypot(b.x-preferred.x,b.y-preferred.y));
 // Include the rotated shell and its overflowing pencil strokes in the footprint.
 const clear=p=>obstacles.every(r=>p.x+132<r.left||p.x-12>r.right||p.y+84<r.top||p.y-12>r.bottom);
 const spot=candidates.find(clear);
 if(spot){machine.style.left=`${spot.x}px`;machine.style.top=`${spot.y}px`;machine.style.bottom='auto'}
}
function schedule(){if(!pending){pending=true;requestAnimationFrame(arrange)}}
new MutationObserver(schedule).observe(document.querySelector('#pageWritings'),{childList:true,subtree:true});
window.addEventListener('resize',schedule);
window.addEventListener('load',schedule);
schedule();
