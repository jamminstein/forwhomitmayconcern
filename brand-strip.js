import {drawWriting} from './handwriting.js?v=credits-3';
export const brands=[
 ['SpaceX','spacex'],['Nike','nike'],['Google','google'],['Nickelodeon','nickelodeon'],['Lyft','lyft'],["Arc'Teryx",'arcteryx'],["Ben & Jerry's",'benandjerrys'],['Indeed','indeed'],['Comedy Central','comedycentral']
];
const host=document.querySelector('#workCredits');
document.querySelector('#workCreditsLabel').appendChild(drawWriting("I've worked with",{height:11,maxWidth:100,caseMode:'preserve',weight:1.25}));
const image=document.querySelector('#currentBrand'),screen=document.querySelector('.brand-screen');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;let index=0;
for(const [,file] of brands){const preload=new Image();preload.src=`brand-logos/${file}.svg?v=wordmarks-1`}
function showBrand(){const [name,file]=brands[index];image.src=`brand-logos/${file}.svg?v=wordmarks-1`;image.alt=name;host.dataset.brand=file}
showBrand();
setInterval(()=>{if(document.hidden)return;index=(index+1)%brands.length;showBrand()},reduced?5000:2600);
