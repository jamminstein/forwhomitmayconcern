// Preserve the lettering's placement except where it covers the resize trace.
let pending=false;
function arrange(){
 pending=false;
 const phrase=document.querySelector('.page-writing:nth-child(4)'),handle=document.querySelector('.transform-grip[data-corner="br"]');
 if(!phrase||!handle)return;
 phrase.style.translate='0 0';
 if(matchMedia('(max-width:700px)').matches)return;
 const paths=[...phrase.querySelectorAll('path')].map(p=>p.getBoundingClientRect());
 if(!paths.length)return;
 const text={left:Math.min(...paths.map(r=>r.left)),right:Math.max(...paths.map(r=>r.right)),top:Math.min(...paths.map(r=>r.top)),bottom:Math.max(...paths.map(r=>r.bottom))};
 const r=handle.getBoundingClientRect(),gap=16;
 if(text.left<r.right+gap&&text.right>r.left-gap&&text.top<r.bottom+gap&&text.bottom>r.top-gap){phrase.style.translate=`0 ${Math.ceil(r.bottom+gap-text.top)}px`}
}
function schedule(){if(!pending){pending=true;requestAnimationFrame(arrange)}}
new MutationObserver(schedule).observe(document.querySelector('#pageWritings'),{childList:true,subtree:true});
new ResizeObserver(schedule).observe(document.querySelector('.stage-wrap'));
window.addEventListener('resize',schedule);window.addEventListener('load',schedule);schedule();
