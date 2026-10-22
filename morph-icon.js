// Flex only the curve handles: petal anchors and the overall icon stay fixed.
const button=document.querySelector('#morph'),petals=[...button.querySelectorAll('.morph-loop')];
const original=petals.map(p=>p.getAttribute('d')),reduced=matchMedia('(prefers-reduced-motion: reduce)');
let request=0,start=0;
const f=n=>n.toFixed(3);
function frame(now){
 const t=(now-start)/1000,a=Math.sin(t*1.65)*.9,b=Math.sin(t*1.19)*.8;
 petals[0].setAttribute('d',`M8 22 C${f(2-a)} 7 ${f(22+a)} ${f(5-a*.3)} 24 17 C${f(29+a)} 32 ${f(11-a)} ${f(36+a*.3)} 8 22`);
 petals[1].setAttribute('d',`M16 13 C${f(32+b)} ${f(3-b*.3)} ${f(38+b)} 22 27 29 C${f(12-b)} ${f(39+b*.3)} ${f(5-b)} 18 16 13`);
 request=requestAnimationFrame(frame);
}
function update(){
 cancelAnimationFrame(request);petals.forEach((p,i)=>p.setAttribute('d',original[i]));
 if(button.getAttribute('aria-pressed')==='true'&&!reduced.matches){start=performance.now();request=requestAnimationFrame(frame)}
}
new MutationObserver(update).observe(button,{attributes:true,attributeFilter:['aria-pressed']});
reduced.addEventListener('change',update);update();
