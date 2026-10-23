import {drawWriting} from './handwriting.js';

const button=document.querySelector('#contactEmail');
const fallback=document.querySelector('#contactFallback');
const status=document.querySelector('#contactStatus');
const statusText=status.querySelector('.contact-status-text');
const statusDrawing=status.querySelector('.contact-status-drawing');
const email=fallback.value;
let busy=false,clearTimer;

function legacyCopy(){
 const active=document.activeElement,selection=window.getSelection();
 const ranges=selection?Array.from({length:selection.rangeCount},(_,i)=>selection.getRangeAt(i).cloneRange()):[];
 const field=document.createElement('textarea');
 field.value=email;field.setAttribute('readonly','');
 Object.assign(field.style,{position:'fixed',left:'-9999px',top:'0',fontSize:'16px'});
 document.body.appendChild(field);field.select();field.setSelectionRange(0,email.length);
 let copied=false;
 try{copied=document.execCommand('copy')===true}catch{}
 field.remove();active?.focus?.({preventScroll:true});
 if(selection){selection.removeAllRanges();for(const range of ranges)selection.addRange(range)}
 return copied;
}

function confirmCopy(){
 const message='email copied to clipboard';
 fallback.hidden=true;
 statusText.textContent=message;
 const drawing=drawWriting(message,{height:10.5,maxWidth:170,caseMode:'preserve',weight:1.2});
 drawing.setAttribute('aria-hidden','true');statusDrawing.replaceChildren(drawing);
 clearTimer=setTimeout(()=>{statusText.textContent='';statusDrawing.replaceChildren()},4500);
}

button.addEventListener('click',async()=>{
 if(busy)return;
 busy=true;clearTimeout(clearTimer);button.setAttribute('aria-busy','true');
 statusText.textContent='';statusDrawing.replaceChildren();fallback.hidden=true;
 let copied=false;
 try{
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(email);copied=true}
 }catch{}
 if(!copied)copied=legacyCopy();
 if(copied)confirmCopy();
 else{
  fallback.hidden=false;fallback.focus({preventScroll:true});fallback.select();
  statusText.textContent='Automatic copy is unavailable. Select and copy the email address.';
 }
 busy=false;button.removeAttribute('aria-busy');
});
fallback.addEventListener('keydown',event=>{if(event.key==='Escape'){fallback.hidden=true;statusText.textContent='';button.focus()}});
