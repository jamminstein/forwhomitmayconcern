// Small original pen-stroke alphabet: independent variations on every page load.
const glyphs={
A:'M1 29 L9 2 L18 29 M4 20 L15 18',B:'M2 30 L2 2 Q22 0 16 13 L3 15 Q26 12 17 28 L2 30',C:'M19 5 Q2 -2 2 16 Q0 33 18 27',D:'M2 29 L3 2 Q23 1 20 17 Q19 30 2 29',E:'M19 3 L3 2 L2 29 L19 28 M3 16 L15 15',F:'M3 30 L3 3 L20 2 M3 16 L16 15',G:'M20 6 Q4 -2 2 15 Q0 32 20 27 L20 17 L12 18',H:'M2 2 L3 30 M19 1 L18 30 M3 16 L19 14',I:'M3 3 L17 2 M10 3 L9 29 M2 30 L18 28',J:'M3 3 L20 2 M16 3 L15 24 Q10 36 2 25',K:'M3 2 L2 30 M20 2 L3 17 L20 29',L:'M3 2 L2 29 L19 28',M:'M1 30 L3 2 L11 19 L19 1 L21 29',N:'M2 30 L3 2 L19 29 L19 1',O:'M10 2 Q0 2 2 20 Q4 33 16 28 Q24 23 20 9 Q18 0 10 2',P:'M3 30 L3 3 Q23 -1 19 13 Q16 19 3 16',Q:'M11 2 Q-2 2 2 23 Q5 34 18 27 Q25 17 20 6 L11 2 M12 22 L23 33',R:'M2 30 L3 2 Q24 -1 19 12 L3 17 M10 16 L21 30',S:'M20 5 Q3 -4 3 10 Q4 15 15 17 Q27 25 15 30 Q7 32 1 25',T:'M0 3 L22 2 M12 3 L10 31',U:'M2 2 L2 22 Q3 34 17 28 L20 2',V:'M1 2 L10 31 L21 1',W:'M0 2 L5 31 L11 12 L17 29 L23 1',X:'M1 2 L21 30 M20 2 L2 29',Y:'M1 2 L11 17 L21 1 M11 17 L10 31',Z:'M1 3 L21 2 L2 29 L21 28',
'0':'M10 2 Q-2 3 3 24 Q8 35 18 26 Q25 10 16 3 Z','1':'M5 9 L12 2 L11 30','2':'M2 9 Q8 -3 18 5 Q26 11 3 28 L21 29','3':'M2 3 Q26 -1 13 15 Q27 18 19 27 Q11 34 2 27','4':'M16 30 L17 2 L1 21 L23 20','5':'M21 3 L4 3 L3 16 Q23 9 21 24 Q17 34 3 28','6':'M19 2 Q-1 5 3 25 Q7 36 18 27 Q26 14 4 17','7':'M1 3 L23 2 L8 31','8':'M11 2 Q-3 4 8 16 Q27 24 15 30 Q-3 31 3 20 Q5 16 15 13 Q27 5 11 2','9':'M18 15 Q0 22 3 7 Q9 -4 19 6 Q23 21 7 31',
'.':'M9 29 L10 30',',':'M11 28 L7 34','!':'M10 2 L9 22 M9 29 L10 30','?':'M2 7 Q11 -4 20 4 Q27 13 11 18 L10 23 M10 29 L11 30','-':'M2 17 L19 16',"'":'M11 2 L8 9',':':'M10 10 L11 11 M10 26 L11 27','/':'M20 1 L1 32','&':'M20 26 Q-3 14 5 4 Q12 -3 15 7 Q16 11 5 19 Q-4 31 9 30 Q16 31 23 16'
};

Object.assign(glyphs,{
a:'M16 15 Q5 10 3 23 Q1 32 11 28 L16 19 L16 30 L20 28',b:'M3 2 L2 29 M3 21 Q7 10 16 15 Q25 22 13 29 L3 28',c:'M18 17 Q4 9 2 24 Q4 34 18 27',d:'M18 2 L17 30 M17 18 Q6 9 2 22 Q0 34 13 28 L17 22',e:'M3 22 L19 18 Q16 10 7 15 Q-2 21 5 29 Q12 33 19 27',f:'M5 37 L10 8 Q12 -2 20 5 M2 17 L18 16',g:'M18 15 Q5 9 3 23 Q2 33 15 27 L18 17 L16 36 Q11 44 3 36',h:'M3 2 L2 30 M3 22 Q12 8 18 17 L19 30',i:'M9 15 L8 30 M9 7 L10 8',j:'M14 15 L12 35 Q9 43 2 36 M14 7 L15 8',k:'M3 2 L2 30 M18 14 L4 23 L19 30',l:'M8 2 L7 26 Q7 33 14 29',m:'M2 30 L3 15 L3 23 Q9 9 12 18 L12 29 M12 22 Q20 9 23 19 L24 30',n:'M3 30 L3 14 L3 23 Q13 8 18 18 L19 30',o:'M10 14 Q0 14 3 27 Q9 34 18 26 Q23 14 10 14',p:'M3 40 L3 15 L3 23 Q9 9 18 17 Q24 29 10 30 L3 27',q:'M18 15 Q4 10 2 23 Q2 34 14 28 L18 20 L17 40 L23 35',r:'M3 30 L4 15 L4 24 Q10 11 19 16',s:'M18 16 Q5 9 4 19 L15 24 Q23 32 5 30 L2 27',t:'M10 5 L9 27 Q12 34 18 28 M2 16 L20 14',u:'M3 15 L3 25 Q5 37 17 23 L18 14 L17 29 L22 28',v:'M2 15 L10 31 L20 14',w:'M1 15 L6 31 L12 19 L17 30 L24 14',x:'M2 15 L19 30 M19 14 L3 30',y:'M2 15 L10 29 M20 14 L10 36 Q6 42 1 37',z:'M2 16 L19 14 L3 30 L20 29'
});
const ns='http://www.w3.org/2000/svg',random=(a,b)=>a+Math.random()*(b-a);
function el(tag,attrs={}){const node=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);return node}
export function drawWriting(text,{height=29,maxWidth=240,caseMode='preserve',slant=0,weight=1.3,loose=false}={}){
 const svg=el('svg',{role:'img','aria-label':text});const group=el('g',{fill:'none',stroke:'currentColor','stroke-linecap':'round','stroke-linejoin':'round'});svg.appendChild(group);
 const unit=height/49,limit=maxWidth/unit;let x=8,y=8,maxX=0;
 const nextLine=()=>{maxX=Math.max(maxX,x);x=8+(loose?random(0,30):0);y+=loose?random(39,64):46};
 for(const word of text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(/(\s+)/)){
  if(word.trim()&&x>8&&x+word.length*21>limit){nextLine()}
  for(const raw of word){
   if(raw==='\n'){nextLine();continue}
   if(/\s/.test(raw)){x+=loose?random(7,23)+(Math.random()<.2?random(9,21):0):random(9,14);continue}
   const letter=caseMode==='lower'?raw.toLowerCase():caseMode==='upper'?raw.toUpperCase():caseMode==='mixed'?(Math.random()<.3?raw.toUpperCase():raw.toLowerCase()):raw;
   const d=glyphs[letter]||glyphs[letter.toUpperCase()];if(!d){x+=15;continue}
   const g=el('g',{'data-letter':letter,transform:`translate(${x} ${y+random(-2,3)}) rotate(${random(-9,9)} 10 15) skewX(${slant+random(-5,5)}) scale(${random(.74,1.06)} ${random(.83,1.16)})`});
   const rough=d.replace(/-?\d+(?:\.\d+)?/g,n=>(Number(n)+random(-.65,.65)).toFixed(2));
   g.appendChild(el('path',{d:rough,'stroke-width':random(weight*.8,weight*1.2)}));
   if(Math.random()<.14)g.appendChild(el('path',{d:rough,transform:`translate(${random(.3,1)} ${random(-.5,.5)})`,'stroke-width':weight*.55,opacity:.6}));
   group.appendChild(g);x+=random(18,24);
  }
 }
 maxX=Math.max(maxX,x)+12;svg.setAttribute('viewBox',`0 0 ${maxX} ${y+46}`);svg.style.width=`${Math.min(maxWidth,maxX*unit)}px`;svg.style.height='auto';return svg;
}
const name=document.querySelector('#writtenName');name.appendChild(drawWriting('tiago pereira',{height:30,maxWidth:170,caseMode:'lower'}));name.style.transform=`rotate(${random(-6,1)}deg)`;
const slots=[
 {left:'3%',top:'27%',angle:-9,height:44,width:265,mode:'mixed',weight:1.25},
 {left:'5%',bottom:'19%',angle:3,height:25,width:285,mode:'lower',weight:1.15,loose:true},
 {left:'33%',top:'12%',angle:-4,height:37,width:350,mode:'upper',weight:1.65},
 {right:'5%',top:'20%',angle:8,height:33,width:245,mode:'upper',weight:1.35},
 {right:'4%',bottom:'18%',angle:-5,height:24,width:270,mode:'preserve',weight:1.2,loose:true},
 {left:'22%',top:'21%',angle:5,height:19,width:190,mode:'preserve',weight:1.1}
];
fetch('writings.json?v=credits-2',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('No writings');return r.json()}).then(phrases=>{phrases.slice(0,slots.length).forEach((entry,i)=>{
 const text=typeof entry==='string'?entry:entry.text,div=document.createElement('div'),slot=slots[i];div.className='page-writing';
 for(const key of ['left','right','top','bottom'])if(slot[key])div.style[key]=slot[key];
 div.style.transform=`translate(${random(-14,14)}px,${random(-10,10)}px) rotate(${slot.angle+random(-4,4)}deg)`;
 div.appendChild(drawWriting(text,{height:slot.height*random(.9,1.1),maxWidth:slot.width,caseMode:slot.mode,slant:random(-10,9),weight:slot.weight,loose:slot.loose}));document.querySelector('#pageWritings').appendChild(div)
 });}).catch(()=>{});
