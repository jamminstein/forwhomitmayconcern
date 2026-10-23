import {drawWriting} from './handwriting.js';
for(const link of document.querySelectorAll('.project-links a')){
 link.replaceChildren(drawWriting(link.dataset.label,{height:17,maxWidth:100,caseMode:'lower',weight:1.8}));
}
