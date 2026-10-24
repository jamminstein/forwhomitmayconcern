import {getOutputAnalyser} from './audio-mixer.js';
const path=document.querySelector('#musicWaveform path'),audio=document.querySelector('#audio');
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),samples=new Uint8Array(256);
const points=Array.from({length:23},(_,i)=>({x:2+i*60/22,y:14,offset:Math.sin(i*2.7)*.65}));
let last=0,lastPath='',request=0,listenUntil=0,musicPlaying=!!audio&&!audio.paused&&!audio.ended&&audio.readyState>=2;
const mayAnimate=()=>!document.hidden&&!window.siteVisualMotionPaused&&!reduced.matches;
const musicActive=()=>musicPlaying&&!audio.paused&&!audio.ended;
const resting=()=>points.every(p=>Math.abs(p.y-14-p.offset)<.005);
function read(analyser){if(!analyser)return false;analyser.getByteTimeDomainData(samples);return samples.some(value=>value!==128)}
function schedule(){if(!request)request=requestAnimationFrame(frame)}
function stop(){cancelAnimationFrame(request);request=0;last=0;listenUntil=0}
function wake(force=false){
 if(!mayAnimate())return;
 if(force)listenUntil=performance.now()+120;
 if(request)return;
 // Silent timeupdate events need no animation callback. Actual hits get a short
 // listening window because their first audio quantum follows the start event.
 if(!force&&!musicActive()&&!read(getOutputAnalyser())&&resting())return;
 last=0;schedule();
}
function draw(active){
 let d='';
 for(let i=0;i<points.length;i++){
  const p=points[i];let sample=0;
  // Preserve short transients between drawing points instead of skipping over them.
  if(active){const start=Math.floor(i*samples.length/points.length),end=Math.floor((i+1)*samples.length/points.length);for(let j=start;j<end;j++){const value=(samples[j]-128)/128;if(Math.abs(value)>Math.abs(sample))sample=value}}
  const target=14+p.offset+Math.tanh(sample*3.5)*12;
  p.y+=(target-p.y)*(active?.85:.18);
  d+=`${i?' L':'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
 }
 if(d!==lastPath){path.setAttribute('d',d);lastPath=d}
}
function frame(now){
 request=0;
 if(!mayAnimate())return;
 if(now-last<33){schedule();return}last=now;
 const analyser=getOutputAnalyser(),signal=read(analyser);
 if(signal)listenUntil=now+120;
 draw(!!analyser);
 if(musicActive()||signal||now<listenUntil||!resting())schedule();
 else{for(const point of points)point.y=14+point.offset;draw(false)}
}
function update(){if(!mayAnimate())stop();else wake(!!audio&&!audio.paused)}
// Render the resting trace immediately, including when motion is disabled.
for(const point of points)point.y=14+point.offset;
draw(false);
audio?.addEventListener('playing',()=>{musicPlaying=true;wake(true)});
audio?.addEventListener('timeupdate',()=>wake());
for(const event of ['pause','ended','waiting','emptied'])audio?.addEventListener(event,()=>{musicPlaying=false;wake()});
window.addEventListener('site-drum-hit',()=>wake(true));
for(const event of ['site-audio-running','site-music-ready'])window.addEventListener(event,update);
window.addEventListener('site-motion-change',update);
document.addEventListener('visibilitychange',update);
reduced.addEventListener('change',update);
window.addEventListener('pagehide',stop);window.addEventListener('pageshow',update);
update();
