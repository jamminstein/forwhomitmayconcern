// Swap canvas-generated PNGs; browsers that ignore updates retain the static icon.
import {assetURL} from './asset-url.js';
const icon=document.querySelector('#doodleFavicon');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;
const ctx=canvas.getContext('2d');
const random=(a,b)=>a+Math.random()*(b-a);
function draw(){
 if(!ctx||document.hidden||(window.siteVisualMotionPaused??reduced.matches))return;
 ctx.clearRect(0,0,32,32);ctx.strokeStyle='#000';ctx.lineWidth=1.3;ctx.lineCap='round';ctx.lineJoin='round';
 ctx.beginPath();ctx.moveTo(random(7,12),random(7,12));
 for(let i=0;i<4;i++)ctx.bezierCurveTo(random(3,29),random(3,29),random(3,29),random(3,29),random(5,27),random(5,27));
 ctx.lineTo(random(8,25),random(7,26));ctx.stroke();
 icon.href=canvas.toDataURL('image/png');
}
function restore(){icon.href=assetURL('favicon.png')}
let timer=0,due=0,remaining=1000;
function stop(){if(timer){remaining=Math.max(0,due-performance.now());clearTimeout(timer);timer=0}}
function update(){
 if(!ctx||document.hidden||(window.siteVisualMotionPaused??reduced.matches)){stop();return}
 if(timer)return;
 due=performance.now()+remaining;
 timer=setTimeout(()=>{timer=0;remaining=1000;draw();update()},remaining);
}
reduced.addEventListener('change',()=>{if(reduced.matches)restore();update()});
window.addEventListener('site-motion-change',update);
document.addEventListener('visibilitychange',update);
window.addEventListener('pagehide',stop);window.addEventListener('pageshow',update);
update();
