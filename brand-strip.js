import {drawWriting} from './handwriting.js?v=credits-1';
export const brands=[
 ['SpaceX','spacex'],['Nike','nike'],['Google','google'],['Nickelodeon','nickelodeon'],['Lyft','lyft'],["Arc'Teryx",'arcteryx'],["Ben & Jerry's",'benandjerrys'],['Indeed','indeed'],['Comedy Central','comedycentral']
];
const host=document.querySelector('#workCredits');
document.querySelector('#workCreditsLabel').appendChild(drawWriting("I've worked with",{height:21,maxWidth:170,caseMode:'preserve',weight:1.25}));
const image=document.querySelector('#currentBrand'),screen=document.querySelector('.brand-screen');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;let index=0;
for(const [,file] of brands){const preload=new Image();preload.src=`brand-logos/${file}.svg`}
function showBrand(){const [name,file]=brands[index];image.src=`brand-logos/${file}.svg`;image.alt=name;host.dataset.brand=file}
showBrand();
setInterval(()=>{if(document.hidden)return;screen.classList.add('switching');setTimeout(()=>{index=(index+1)%brands.length;showBrand();setTimeout(()=>screen.classList.remove('switching'),120)},reduced?0:100)},reduced?5000:2600);
