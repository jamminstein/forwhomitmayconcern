import {drawWriting} from './handwriting.js?v=thanks-mixed-1';
export const brands=[
 ['SpaceX','spacex'],['Nike','nike'],['Google','google'],['Nickelodeon','nickelodeon'],['Lyft','lyft'],["Arc'Teryx",'arcteryx'],["Ben & Jerry's",'benandjerrys'],['Indeed','indeed'],['Comedy Central','comedycentral']
];
export const agencies=[['Wieden+Kennedy','wieden-kennedy'],['Live Ad','live-ad'],['R/GA','rga']];
export const people=['helder','guilherme','zampa','dan','anne','kako','santi'];
const asLogo=(pair,category)=>({name:pair[0],file:pair[1],category});
// Keep marks predominant and interleave people; no visible category labels.
export const entries=[
 asLogo(brands[0],'clients'),asLogo(brands[1],'clients'),{name:people[0],category:'people'},
 asLogo(agencies[0],'agencies'),asLogo(brands[2],'clients'),{name:people[1],category:'people'},
 asLogo(brands[3],'clients'),asLogo(brands[4],'clients'),{name:people[2],category:'people'},
 asLogo(agencies[1],'agencies'),asLogo(brands[5],'clients'),{name:people[3],category:'people'},
 asLogo(brands[6],'clients'),{name:people[4],category:'people'},asLogo(agencies[2],'agencies'),
 asLogo(brands[7],'clients'),{name:people[5],category:'people'},asLogo(brands[8],'clients'),{name:people[6],category:'people'}
];
const host=document.querySelector('#workCredits');
document.querySelector('#workCreditsLabel').appendChild(drawWriting('thank you',{height:11,maxWidth:100,caseMode:'preserve',weight:1.25}));
const image=document.querySelector('#currentBrand'),person=document.querySelector('#currentPerson');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;let index=0;
for(const [,file] of [...brands,...agencies]){const preload=new Image();preload.src=`brand-logos/${file}.svg?v=mixed-1`}
function showEntry(){const entry=entries[index],isPerson=entry.category==='people';host.dataset.category=entry.category;host.dataset.brand=entry.file||'';image.hidden=isPerson;person.hidden=!isPerson;person.replaceChildren();if(isPerson){person.appendChild(drawWriting(entry.name,{height:31,maxWidth:98,caseMode:'lower',weight:1.2,cursive:true}))}else{image.src=`brand-logos/${entry.file}.svg?v=mixed-1`;image.alt=entry.name}}
showEntry();
setInterval(()=>{if(document.hidden)return;index=(index+1)%entries.length;showEntry()},reduced?5000:2600);
