import {getOutputAnalyser} from './audio-mixer.js?v=audio-clock-5';
const path=document.querySelector('#musicWaveform path');
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),samples=new Uint8Array(256);
const points=Array.from({length:23},(_,i)=>({x:2+i*60/22,y:14,offset:Math.sin(i*2.7)*.65}));
let last=0;
function frame(now){
 requestAnimationFrame(frame);
 if(document.hidden||now-last<33)return;last=now;
 const analyser=getOutputAnalyser(),active=!reduced.matches&&analyser;
 if(active)analyser.getByteTimeDomainData(samples);
 let d='';
 for(let i=0;i<points.length;i++){
  const p=points[i];let sample=0;
  // Preserve short transients between drawing points instead of skipping over them.
  if(active){const start=Math.floor(i*samples.length/points.length),end=Math.floor((i+1)*samples.length/points.length);for(let j=start;j<end;j++){const value=(samples[j]-128)/128;if(Math.abs(value)>Math.abs(sample))sample=value}}
  const target=14+p.offset+Math.tanh(sample*3.5)*12;
  p.y+=(target-p.y)*(active?.85:.18);
  d+=`${i?' L':'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
 }
 path.setAttribute('d',d);
}
requestAnimationFrame(frame);
