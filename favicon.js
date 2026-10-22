// Swap canvas-generated PNGs; browsers that ignore updates retain the static icon.
const icon=document.querySelector('#doodleFavicon');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;
const ctx=canvas.getContext('2d');
const random=(a,b)=>a+Math.random()*(b-a);
function draw(){
 if(!ctx||document.hidden||reduced.matches)return;
 ctx.clearRect(0,0,32,32);ctx.strokeStyle='#000';ctx.lineWidth=1.3;ctx.lineCap='round';ctx.lineJoin='round';
 ctx.beginPath();ctx.moveTo(random(7,12),random(7,12));
 for(let i=0;i<4;i++)ctx.bezierCurveTo(random(3,29),random(3,29),random(3,29),random(3,29),random(5,27),random(5,27));
 ctx.lineTo(random(8,25),random(7,26));ctx.stroke();
 icon.href=canvas.toDataURL('image/png');
}
function restore(){icon.href='favicon.png?v=static-1'}
setInterval(draw,1000);
reduced.addEventListener('change',()=>{if(reduced.matches)restore();else draw()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)draw()});
