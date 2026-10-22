import {getOutputAnalyser} from './audio-mixer.js?v=waveform-drums-2';
const path=document.querySelector('#musicWaveform path');
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),samples=new Uint8Array(256);
const points=Array.from({length:23},(_,i)=>({x:2+i*60/22,y:14,offset:Math.sin(i*2.7)*.65}));
let last=0;
function frame(now){
 requestAnimationFrame(frame);
 if(document.hidden||now-last<50)return;last=now;
 const analyser=getOutputAnalyser(),active=!reduced.matches&&analyser;
 if(active)analyser.getByteTimeDomainData(samples);
 let d='';
 for(let i=0;i<points.length;i++){
  const p=points[i],sample=active?(samples[Math.round(i*255/(points.length-1))]-128)/128:0;
  const target=14+p.offset+sample*24;
  p.y+=(target-p.y)*(active?.65:.18);
  d+=`${i?' L':'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
 }
 path.setAttribute('d',d);
}
requestAnimationFrame(frame);
