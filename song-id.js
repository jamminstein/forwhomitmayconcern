import {drawWriting} from './handwriting.js?v=thanks-mixed-2';
const label=document.querySelector('#currentSongId');
function render(){
 const id=label.dataset.songId||'';
 if(!id){label.replaceChildren();return}
 const drawing=drawWriting(id,{height:14.535,maxWidth:40.185,caseMode:'preserve',weight:.95});
 drawing.setAttribute('aria-hidden','true');label.replaceChildren(drawing);
}
new MutationObserver(render).observe(label,{attributes:true,attributeFilter:['data-song-id']});
render();
