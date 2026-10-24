import {drawWriting} from './handwriting.js';
import {assetURL} from './asset-url.js';
export const brands=[
 ['SpaceX','spacex'],['Nike','nike'],['Google','google'],['Nickelodeon','nickelodeon'],['Lyft','lyft'],["Arc'Teryx",'arcteryx'],["Ben & Jerry's",'benandjerrys'],['Indeed','indeed'],['Comedy Central','comedycentral']
];
export const agencies=[['Wieden+Kennedy','wieden-kennedy'],['Live Ad','live-ad'],['R/GA','rga'],['MESA','mesa'],['ENSO','enso']];
export const people=['helder','guilherme','zampa','dan','anne','kako','santi','mauro','kirk','mom','kevin','jimmy','ralph'];
const asLogo=(pair,category)=>({name:pair[0],file:pair[1],category});
// Clients get one opening round; subsequent rounds include every entry equally.
export const entries=[...brands.map(pair=>asLogo(pair,'clients')),...agencies.map(pair=>asLogo(pair,'agencies')),...people.map(name=>({name,category:'people'}))];
function shuffled(values){const out=[...values];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out}
let queue=brands.map(pair=>asLogo(pair,'clients')),currentEntry=null;
function takeEntry(){if(!queue.length){queue=shuffled(entries);if(queue.length>1&&queue[0].name===currentEntry?.name)[queue[0],queue[1]]=[queue[1],queue[0]]}currentEntry=queue.shift();return currentEntry}
const host=document.querySelector('#workCredits');
document.querySelector('#workCreditsLabel').appendChild(drawWriting('thank you',{height:11,maxWidth:100,caseMode:'preserve',weight:1.25}));
const image=document.querySelector('#currentBrand'),person=document.querySelector('#currentPerson');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
for(const [,file] of [...brands,...agencies]){const preload=new Image();preload.src=assetURL(`brand-logos/${file}.png`)}
function showEntry(){const entry=takeEntry(),isPerson=entry.category==='people';host.dataset.category=entry.category;host.dataset.brand=entry.file||'';image.hidden=isPerson;person.hidden=!isPerson;person.replaceChildren();if(isPerson){person.appendChild(drawWriting(entry.name,{height:31,maxWidth:98,caseMode:'lower',weight:1.2,cursive:true}))}else{image.src=assetURL(`brand-logos/${entry.file}.png`);image.alt=entry.name}}
showEntry();
let timer=0,due=0,remaining=2600;
function stop(){if(timer){remaining=Math.max(0,due-performance.now());clearTimeout(timer);timer=0}}
function update(){
 if(document.hidden||(window.siteVisualMotionPaused??reduced.matches)){stop();return}
 if(timer)return;
 due=performance.now()+remaining;
 timer=setTimeout(()=>{timer=0;remaining=2600;if(!document.hidden&&!(window.siteVisualMotionPaused??reduced.matches))showEntry();update()},remaining);
}
reduced.addEventListener('change',update);
window.addEventListener('site-motion-change',update);
document.addEventListener('visibilitychange',update);
window.addEventListener('pagehide',stop);window.addEventListener('pageshow',update);
update();
