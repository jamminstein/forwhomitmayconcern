import {drawWriting} from './handwriting.js?v=thanks-mixed-2';
const label=document.querySelector('#currentSongId');
function render(){
 const id=label.dataset.songId||'';
 if(!id){label.replaceChildren();return}
 const drawing=drawWriting(id,{height:17,maxWidth:47,caseMode:'preserve',weight:1.7});
 drawing.setAttribute('aria-hidden','true');label.replaceChildren(drawing);
}
new MutationObserver(render).observe(label,{attributes:true,attributeFilter:['data-song-id']});
render();
