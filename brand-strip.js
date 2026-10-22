import {drawWriting} from './handwriting.js?v=thanks-mixed-2';
export const brands=[
 ['SpaceX','spacex'],['Nike','nike'],['Google','google'],['Nickelodeon','nickelodeon'],['Lyft','lyft'],["Arc'Teryx",'arcteryx'],["Ben & Jerry's",'benandjerrys'],['Indeed','indeed'],['Comedy Central','comedycentral']
];
export const agencies=[['Wieden+Kennedy','wieden-kennedy'],['Live Ad','live-ad'],['R/GA','rga']];
export const people=['helder','guilherme','zampa','dan','anne','kako','santi'];
const asLogo=(pair,category)=>({name:pair[0],file:pair[1],category});
// Clients get one opening round; subsequent rounds include every entry equally.
export const entries=[...brands.map(pair=>asLogo(pair,'clients')),...agencies.map(pair=>asLogo(pair,'agencies')),...people.map(name=>({name,category:'people'}))];
function shuffled(values){const out=[...values];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out}
let queue=brands.map(pair=>asLogo(pair,'clients')),currentEntry=null;
function takeEntry(){if(!queue.length){queue=shuffled(entries);if(queue.length>1&&queue[0].name===currentEntry?.name)[queue[0],queue[1]]=[queue[1],queue[0]]}currentEntry=queue.shift();return currentEntry}
const host=document.querySelector('#workCredits');
document.querySelector('#workCreditsLabel').appendChild(drawWriting('thank you',{height:11,maxWidth:100,caseMode:'preserve',weight:1.25}));
const image=document.querySelector('#currentBrand'),person=document.querySelector('#currentPerson');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
for(const [,file] of [...brands,...agencies]){const preload=new Image();preload.src=`brand-logos/${file}.svg?v=mixed-3`}
function showEntry(){const entry=takeEntry(),isPerson=entry.category==='people';host.dataset.category=entry.category;host.dataset.brand=entry.file||'';image.hidden=isPerson;person.hidden=!isPerson;person.replaceChildren();if(isPerson){person.appendChild(drawWriting(entry.name,{height:31,maxWidth:98,caseMode:'lower',weight:1.2,cursive:true}))}else{image.src=`brand-logos/${entry.file}.svg?v=mixed-3`;image.alt=entry.name}}
showEntry();
setInterval(()=>{if(document.hidden)return;showEntry()},reduced?5000:2600);
