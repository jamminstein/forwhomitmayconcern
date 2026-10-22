import {drawWriting} from './handwriting.js?v=thanks-mixed-2';
for(const link of document.querySelectorAll('.project-links a')){
 link.appendChild(drawWriting(link.dataset.label,{height:12,maxWidth:92,caseMode:'lower',weight:1.15}));
}
