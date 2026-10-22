// Native GIF favicon animation is inconsistent. Updating the image also lets
// Chromium show the same sequence, with no canvas work in the animation loop.
const icon=document.querySelector('#doodleFavicon');
const frames=Array.from({length:16},(_,i)=>`favicon-frames/${String(i).padStart(2,'0')}.png?v=doodles-1`);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
for(const frame of frames){const image=new Image();image.src=frame}
let index=0;
function tick(){if(document.hidden||reduced.matches)return;index=(index+1)%frames.length;icon.type='image/png';icon.href=frames[index]}
if(reduced.matches){icon.type='image/png';icon.href=frames[0]}
setInterval(tick,650);
reduced.addEventListener('change',()=>{if(reduced.matches){icon.type='image/png';icon.href=frames[0]}});
