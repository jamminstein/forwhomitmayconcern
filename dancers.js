// Pick one render, never preload the other four or replace it while the page is open.
import {assetURL} from './asset-url.js';
export function chooseDance(previous,random=Math.random){const choices=[1,2,3,4,5].filter(id=>id!==Number(previous));return choices[Math.min(choices.length-1,Math.floor(random()*choices.length))]}
const host=document.querySelector('#hiddenDancers'),image=host.querySelector('img'),source=host.querySelector('source');
let previous=null;try{previous=sessionStorage.getItem('corpus-last-loop')}catch{}
const selected=chooseDance(previous);host.dataset.loop=selected;
try{sessionStorage.setItem('corpus-last-loop',String(selected))}catch{}
let started=false;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
function updateMotion(){
 if(!started)return;
 const paused=window.siteVisualMotionPaused??reduced.matches;
 source.media=paused?'all':'not all';source.srcset=assetURL(`dancers/still-${selected}.webp`);
 const next=assetURL(`dancers/${paused?'still':'loop'}-${selected}.webp`);
 if(image.getAttribute('src')!==next)image.src=next;
}
function load(){if(started)return;started=true;updateMotion()}
window.addEventListener('site-motion-change',updateMotion);
reduced.addEventListener('change',updateMotion);
function whenIdle(){if('requestIdleCallback' in window)requestIdleCallback(load,{timeout:1500});else load()}
const video=document.querySelector('#video');
function reveal(){if(image.complete&&image.naturalWidth>0&&video.readyState>=2)host.classList.add('ready')}
image.addEventListener('load',reveal);
image.addEventListener('error',()=>host.classList.remove('ready'));
video.addEventListener('loadeddata',reveal);
reveal();
if(video.readyState>=2)whenIdle();else video.addEventListener('loadeddata',whenIdle,{once:true});
setTimeout(whenIdle,3000);
