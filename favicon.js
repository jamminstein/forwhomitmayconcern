// Keep exactly one favicon link and replace its node on each tick so engines
// that cache an unchanged link still pick up the next doodle.
let icon=document.querySelector('#doodleFavicon');
const frames=Array.from({length:16},(_,i)=>`favicon-frames/${String(i).padStart(2,'0')}.png?v=doodles-2`);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
for(const frame of frames){const image=new Image();image.src=frame}
let index=0;
function showFrame(i){const next=document.createElement('link');next.id='doodleFavicon';next.rel='icon';next.type='image/png';next.sizes='32x32';next.href=frames[i];icon.replaceWith(next);icon=next}
function tick(){if(document.hidden||reduced.matches)return;index=(index+1)%frames.length;showFrame(index)}
showFrame(0);setInterval(tick,650);
reduced.addEventListener('change',()=>{if(reduced.matches)showFrame(0)});
