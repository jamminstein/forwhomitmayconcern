import { injectLiquidGlassFilter } from './vendor/liquid-glass/core.js';
// MIT: ccl125/liquid-glass. Use ordinary SVG filters on a scene copy for
// browsers that cannot apply SVG filters to the CSS backdrop.
injectLiquidGlassFilter({id:'scene-lens',scales:[-65,-52,-39],saturate:1.3});
injectLiquidGlassFilter({id:'control-lens',scales:[-9,-6,-3],saturate:1.2});
const dock=document.querySelector('.glass-dock');
const lens=document.createElement('canvas');
lens.className='refracted-scene';lens.setAttribute('aria-hidden','true');
dock.prepend(lens);
const ctx=lens.getContext('2d',{alpha:false});
window.renderGlass=(source,stage,view)=>{
  if(!ctx)return;
  const box=dock.getBoundingClientRect();
  const w=Math.ceil(box.width),h=Math.ceil(box.height);
  if(lens.width!==w||lens.height!==h){lens.width=w;lens.height=h}
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle=document.documentElement.dataset.theme==='dark'?'#090a0d':'#ffffff';
  ctx.fillRect(0,0,w,h);
  const rect=stage.getBoundingClientRect();
  ctx.translate(rect.left+rect.width/2-box.left,rect.top+rect.height/2-box.top);
  ctx.rotate(view.angle);ctx.scale(view.scale,view.scale);
  ctx.drawImage(source,-stage.clientWidth*2,-stage.clientHeight*2,stage.clientWidth*4,stage.clientHeight*4);
};
