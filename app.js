import {createUndoHistory} from './undo-history.js';
import {createWarpRenderer} from './warp-renderer.js';
import {createSurfaceSampler} from './warp-surface.js';
import {initializeSoundtrack} from './soundtrack.js';
import {MEDIA} from './site-config.js';
import {installCenterMove} from './center-move.js';
(()=>{
  const themeButton=document.querySelector('#themeToggle');
  function setTheme(theme){document.documentElement.dataset.theme=theme;themeButton.innerHTML=theme==='dark'?'<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M14 14 L12 18 Q10 23 16 26 L20 28 Q26 26 27 21 L26 16 Q22 11 17 13 L13 16 M15 27 L19 29 L23 27 M20 3 L21 5 L19 9 M33 8 L30 11 L28 11 M36 21 L33 20 L30 22 M31 34 L29 30 L26 29 M17 37 L19 34 L18 30 M5 30 L8 29 L11 25 M3 15 L6 17 L9 16 M9 5 L11 9 L14 10"/></svg>':'<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M26 5 L22 4 Q14 5 10 12 L8 17 Q6 24 12 30 L17 34 Q25 36 30 29 L34 23 L29 25 Q22 25 19 19 L18 14 Q19 8 26 5 M9 24 L11 28 L15 31 M29 28 L32 25"/></svg>';themeButton.setAttribute('aria-label',theme==='dark'?'Switch to light mode':'Switch to dark mode');document.querySelector('meta[name="theme-color"]').setAttribute('content',theme==='dark'?'#090a0d':'#ffffff');try{localStorage.setItem('jamminstein-theme',theme)}catch{}}
  setTheme(document.documentElement.dataset.theme==='dark'?'dark':'light');
  themeButton.addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
  const stage=document.querySelector('#stage'), video=document.querySelector('#video'), canvas=document.querySelector('#gl'), overlay=document.querySelector('#overlay');
  // Keep the viewport unclipped so edge nodes and their small filters can paint outside the video.
  const meshDrawing=document.createElementNS('http://www.w3.org/2000/svg','g');
  meshDrawing.classList.add('mesh-drawing');overlay.appendChild(meshDrawing);
  const videoPlay=document.querySelector('#videoPlay'), timeLabel=document.querySelector('#videoTime'), editToggle=document.querySelector('#editToggle'), editHint=document.querySelector('#editHint');
  const videoFile=document.querySelector('#videoFile');
  const soundtrack=initializeSoundtrack();
  let isEditing=true;
  const gridSize=5, pointIndex=(r,c)=>r*gridSize+c;
  let points=initialPoints(),resetTransition=null;
  let morphing=false,morphFrom=null,morphTo=null,morphStarted=0;
  function initialPoints(){const result=[],h=1/(gridSize-1)/3;for(let r=0;r<gridSize;r++)for(let c=0;c<gridSize;c++)result.push({x:c/(gridSize-1),y:r/(gridSize-1),left:{x:-h,y:0},right:{x:h,y:0},up:{x:0,y:-h},down:{x:0,y:h}});return result}

  const firstFrame=new Image();firstFrame.src=MEDIA.poster;firstFrame.className='artwork-poster';firstFrame.alt='';firstFrame.setAttribute('aria-hidden','true');stage.prepend(firstFrame);
  function bezier(t){const q=1-t;return[q*q*q,3*q*q*t,3*q*t*t,t*t*t]}
  const subdivisions=64;
  const uvs=new Float32Array((subdivisions+1)*(subdivisions+1)*2),indices=[];
  for(let y=0;y<=subdivisions;y++)for(let x=0;x<=subdivisions;x++){const k=(y*(subdivisions+1)+x)*2;uvs[k]=x/subdivisions;uvs[k+1]=y/subdivisions}
  for(let y=0;y<subdivisions;y++)for(let x=0;x<subdivisions;x++){const a=y*(subdivisions+1)+x,b=a+1,c=a+subdivisions+1,d=c+1;indices.push(a,c,b,b,c,d)}
  const indexArray=new Uint16Array(indices);
  const renderer=createWarpRenderer(canvas,{
    uvs,indices:indexArray,
    onFallback(fallback){const mode=fallback?'fallback':'warp';if(stage.dataset.renderer!==mode)stage.dataset.renderer=mode},
    onRestore(){textureSource=null;videoFrameDirty=true;geometryDirty=true;requestRender()}
  });
  function sizeCanvas(){renderer.resize(stage.clientWidth,stage.clientHeight);drawOverlay()}
  function curve(a,b,dir,opposite,t){const w=bezier(t);return {x:w[0]*a.x+w[1]*(a.x+a[dir].x+spring.x)+w[2]*(b.x+b[opposite].x+spring.x)+w[3]*b.x,y:w[0]*a.y+w[1]*(a.y+a[dir].y+spring.y)+w[2]*(b.y+b[opposite].y+spring.y)+w[3]*b.y}}
  function surface(u,v){const n=gridSize-1,c=Math.min(n-1,Math.floor(u*n)),r=Math.min(n-1,Math.floor(v*n)),x=u*n-c,y=v*n-r,a=points[pointIndex(r,c)],b=points[pointIndex(r,c+1)],d=points[pointIndex(r+1,c)],e=points[pointIndex(r+1,c+1)],top=curve(a,b,'right','left',x),bottom=curve(d,e,'right','left',x),left=curve(a,d,'down','up',y),right=curve(b,e,'down','up',y);const out={};for(const k of ['x','y'])out[k]=(1-y)*top[k]+y*bottom[k]+(1-x)*left[k]+x*right[k]-((1-x)*(1-y)*a[k]+x*(1-y)*b[k]+(1-x)*y*d[k]+x*y*e[k]);return out}
  const vertexCache=new Float32Array(uvs.length),sampleSurface=createSurfaceSampler(gridSize,uvs);
  function surfaceVertices(){return sampleSurface(points,spring,vertexCache)}
  // Wake for decoded frames or edits; a paused, settled artwork needs no frame loop.
  let textureSource=null,videoFrameDirty=true,uploadedVideoTime=-1,renderRequest=0,videoFrameRequest=0;
  const hasVideoFrameCallback=typeof video.requestVideoFrameCallback==='function';
  function requestRender(){if(!renderRequest&&!document.hidden)renderRequest=requestAnimationFrame(render)}
  function watchVideoFrames(){
    if(!hasVideoFrameCallback)return;
    if(document.hidden||video.paused||video.ended){if(videoFrameRequest)video.cancelVideoFrameCallback(videoFrameRequest);videoFrameRequest=0;return}
    if(!videoFrameRequest)videoFrameRequest=video.requestVideoFrameCallback(()=>{videoFrameRequest=0;videoFrameDirty=true;requestRender();watchVideoFrames()});
  }
  for(const event of ['loadeddata','seeked','resize','play','playing','pause','ended'])video.addEventListener(event,()=>{videoFrameDirty=true;watchVideoFrames();requestRender()});
  firstFrame.addEventListener('load',requestRender);
  function render(now){
    renderRequest=0;if(document.hidden)return;
    animateMorph(now);animateReset(now);const moving=animateMotion(now);
    if(overlayDirty&&(!isEditing||!meshDrawing.children.length||!wrap.classList.contains('guides-idle')||now<guidePaintUntil)){overlayDirty=false;paintOverlay()}
    const source=video.readyState>=2?video:textureSource||(firstFrame.complete&&firstFrame.naturalWidth?firstFrame:null);
    const upload=source&&(source!==textureSource||(source===video&&video.readyState>=2&&(videoFrameDirty||(!hasVideoFrameCallback&&video.currentTime!==uploadedVideoTime))));
    if(renderer.available&&source&&(upload||geometryDirty)&&renderer.draw(source,upload,geometryDirty?surfaceVertices():null)){
      if(upload){textureSource=source;videoFrameDirty=false;uploadedVideoTime=video.currentTime}
      geometryDirty=false;
    }
    if(moving||resetTransition||(morphing&&!window.siteVisualMotionPaused)||(!hasVideoFrameCallback&&!video.paused&&!video.ended&&video.readyState>=2))requestRender();
  }
  let selectedPoint=-1,dragState=null,meshFocus={index:0,dir:null},meshEditing=false;
  overlay.setAttribute('role','group');overlay.setAttribute('aria-label','Video warp controls');overlay.setAttribute('aria-describedby','meshHelp');
  const meshHelp=document.createElement('p');meshHelp.id='meshHelp';meshHelp.className='sr-only';meshHelp.textContent='Arrow keys select a warp point. Bracket keys select its tangent handles. Enter starts or stops editing; while editing, arrows move the point and Shift moves it finely. Escape leaves editing. Tab leaves the mesh. Command or Control Z undoes an edit.';stage.after(meshHelp);
  const pointKey=(i,dir)=>`${i}:${dir||'anchor'}`;
  const isMeshFocus=(i,dir)=>i===meshFocus.index&&(dir||null)===meshFocus.dir;
  function focusMesh(){const node=[...overlay.querySelectorAll('.point:not(.touch-target)')].find(e=>isMeshFocus(Number(e.dataset.index),e.dataset.direction));if(node&&document.activeElement!==node)node.focus({preventScroll:true})}

  // Draw the pencil variation into the traces themselves. Filtering the entire
  // moving mesh makes WebKit rasterize a large turbulence/displacement surface.
  // These subpixel offsets stay fixed between frames and meet at each anchor.
  const pencilTraces=Array.from({length:gridSize*2},(_,seed)=>{
    const offsets=new Float32Array(130);
    for(let j=0;j<=64;j++){const amount=j%16===0?0:.24*Math.sin(j*Math.PI/16);offsets[j*2]=Math.sin(j*1.7+seed*2.3)*amount;offsets[j*2+1]=Math.cos(j*1.3+seed*3.1)*amount}
    return offsets;
  });
  function pencilLine(x1,y1,x2,y2,seed){
    let d='';const amount=Math.min(.24,Math.hypot(x2-x1,y2-y1)/40);
    for(let j=0;j<=16;j++){const t=j/16,w=j===0||j===16?0:Math.sin(t*Math.PI)*amount;d+=(j?' L ':'M ')+(x1+(x2-x1)*t+Math.sin(j*1.7+seed)*w)+' '+(y1+(y2-y1)*t+Math.cos(j*1.3+seed)*w)}
    return d;
  }

  function directions(i){const r=Math.floor(i/gridSize),c=i%gridSize;return [...(c>0?['left']:[]),...(c<gridSize-1?['right']:[]),...(r>0?['up']:[]),...(r<gridSize-1?['down']:[])]}
  function isCorner(i){const r=Math.floor(i/gridSize),c=i%gridSize;return (r===0||r===gridSize-1)&&(c===0||c===gridSize-1)}
  let overlayDirty=true,geometryDirty=true,guidePaintUntil=0;
  function drawOverlay(){overlayDirty=true;geometryDirty=true;requestRender();const h=1/(gridSize-1)/3;const warped=points.some((p,i)=>Math.abs(p.x-(i%gridSize)/(gridSize-1))>1e-5||Math.abs(p.y-Math.floor(i/gridSize)/(gridSize-1))>1e-5||['left','right','up','down'].some(dir=>{const x=dir==='left'?-h:dir==='right'?h:0,y=dir==='up'?-h:dir==='down'?h:0;return Math.abs(p[dir].x-x)>1e-5||Math.abs(p[dir].y-y)>1e-5}));document.querySelector('#dockReset').classList.toggle('available',warped)}
  function paintOverlay(){if(!overlay.isConnected)return;const hadFocus=overlay.contains(document.activeElement);const w=stage.clientWidth,h=stage.clientHeight,viewBox=`0 0 ${w} ${h}`;if(overlay.getAttribute('viewBox')!==viewBox)overlay.setAttribute('viewBox',viewBox);if(!isEditing){meshDrawing.replaceChildren();return}let cursor=0;function el(tag,attrs){let e=meshDrawing.children[cursor];if(!e||e.localName!==tag){const fresh=document.createElementNS('http://www.w3.org/2000/svg',tag);if(e)meshDrawing.replaceChild(fresh,e);else meshDrawing.appendChild(fresh);e=fresh}cursor++;if(!('data-direction' in attrs)&&e.hasAttribute('data-direction'))e.removeAttribute('data-direction');for(const [k,v]of Object.entries(attrs)){const value=String(v);if(e.getAttribute(k)!==value)e.setAttribute(k,value)}return e}
    for(let axis=0;axis<2;axis++)for(let n=0;n<gridSize;n++){let d='';const offsets=pencilTraces[axis*gridSize+n];for(let j=0;j<=64;j++){const p=surface(axis?j/64:n/(gridSize-1),axis?n/(gridSize-1):j/64);d+=(j?' L ':'M ')+(p.x*w+offsets[j*2])+' '+(p.y*h+offsets[j*2+1])}el('path',{d,class:'net'})}
    points.forEach((p,i)=>{if(!isCorner(i)&&i!==selectedPoint)return;directions(i).forEach((dir,di)=>{const q=p[dir],x=(p.x+q.x+spring.x)*w,y=(p.y+q.y+spring.y)*h;el('path',{d:pencilLine(p.x*w,p.y*h,x,y,i*4+di),class:'handle-line selected'});const hit=el('circle',{cx:x,cy:y,r:13,class:'point touch-target',tabindex:-1,role:'presentation','aria-pressed':'false','data-index':i,'data-direction':dir,'aria-hidden':'true'});bind(hit);const end=el('circle',{cx:x,cy:y,r:4,'aria-hidden':'false',class:'point tangent','data-index':i,'data-direction':dir,role:'button',tabindex:isMeshFocus(i,dir)?0:-1,'aria-pressed':String(isMeshFocus(i,dir)&&meshEditing),'aria-label':`Warp point ${i+1} ${dir} tangent handle`});bind(end)})});
    points.forEach((p,i)=>{const hit=el('circle',{cx:p.x*w,cy:p.y*h,r:13,class:'point touch-target',tabindex:-1,role:'presentation','aria-pressed':'false','data-index':i,'aria-hidden':'true'});bind(hit);const c=el('circle',{cx:p.x*w,cy:p.y*h,r:4,'aria-hidden':'false',class:'point '+(isCorner(i)?'corner':'handle'),'data-index':i,role:'button',tabindex:isMeshFocus(i)?0:-1,'aria-pressed':String(isMeshFocus(i)&&meshEditing),'aria-label':`Warp point ${i+1}`});bind(c)})
    while(meshDrawing.children.length>cursor)meshDrawing.lastChild.remove();
    if(hadFocus)focusMesh();
    function bind(e){if(e.dataset.bound)return;e.dataset.bound='true';e.addEventListener('pointerdown',startDrag);e.addEventListener('keydown',keyboardMove)}
  }
  function startDrag(e){if(!isEditing||transformMode||spaceHeld||dragState||objectDrag||e.button!==0)return;history.remember();setMorph(false);e.preventDefault();const i=Number(e.currentTarget.dataset.index),dir=e.currentTarget.dataset.direction,p=points[i],q=dir?p[dir]:p;selectedPoint=i;meshFocus={index:i,dir:dir||null};meshEditing=false;wrap.classList.add('bezier-dragging');dragState={id:e.pointerId,i,dir,startX:e.clientX,startY:e.clientY,x:q.x,y:q.y};stage.setPointerCapture(e.pointerId);drawOverlay()}
  stage.addEventListener('pointermove',e=>{if(!dragState||dragState.id!==e.pointerId)return;const d=dragState,p=points[d.i],q=d.dir?p[d.dir]:p,gain=e.shiftKey?.18:.70,dx=(e.clientX-d.startX)/view.scale,dy=(e.clientY-d.startY)/view.scale,cos=Math.cos(view.angle),sin=Math.sin(view.angle);q.x=d.x+(dx*cos+dy*sin)/stage.clientWidth*gain;q.y=d.y+(-dx*sin+dy*cos)/stage.clientHeight*gain;drawOverlay()});
  function endDrag(e){if(!dragState||dragState.id!==e.pointerId)return;dragState=null;wrap.classList.remove('bezier-dragging');wakeGuides()}stage.addEventListener('pointerup',endDrag);stage.addEventListener('pointercancel',endDrag);stage.addEventListener('lostpointercapture',endDrag);
  function keyboardMove(e){
    if(e.metaKey||e.ctrlKey||e.altKey)return;
    const i=Number(e.currentTarget.dataset.index),dir=e.currentTarget.dataset.direction;
    meshFocus={index:i,dir:dir||null};
    const arrows=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
    if(e.key==='Escape'){e.preventDefault();meshEditing=false}
    else if(e.key==='Enter'||e.key===' '){e.preventDefault();meshEditing=!meshEditing;selectedPoint=i}
    else if(e.key==='['||e.key===']'){
      e.preventDefault();const choices=[null,...directions(i)],step=e.key===']'?1:-1;
      meshFocus.dir=choices[(choices.indexOf(meshFocus.dir)+step+choices.length)%choices.length];selectedPoint=i;meshEditing=false;
    }else if(arrows.includes(e.key)){
      e.preventDefault();
      if(meshEditing){
        if(!e.repeat)history.remember();setMorph(false);
        const p=dir?points[i][dir]:points[i],step=e.shiftKey?.001:.004;
        p.x+=e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0;p.y+=e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0;
      }else{
        const row=Math.floor(i/gridSize),column=i%gridSize;
        meshFocus.index=e.key==='ArrowUp'?Math.max(0,row-1)*gridSize+column:e.key==='ArrowDown'?Math.min(gridSize-1,row+1)*gridSize+column:e.key==='ArrowLeft'?row*gridSize+Math.max(0,column-1):row*gridSize+Math.min(gridSize-1,column+1);
        meshFocus.dir=null;selectedPoint=meshFocus.index;
      }
    }else return;
    drawOverlay();paintOverlay();overlayDirty=false;focusMesh();
  }
  const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
  const spring={x:0,y:0,vx:0,vy:0},displayView={x:0,y:0,scale:1,angle:0};let lastFrame=0,lastTransform='';
  const wrap=document.querySelector('.stage-wrap'),view={x:0,y:0,scale:1,angle:0};let transformMode=false,spaceHeld=false,objectDrag=null;
  const undoHistory=createUndoHistory(()=>({points,view}),state=>{
    clearTimeout(zoomTimer);zoomGesture=false;
    setMorph(false);points=state.points;Object.assign(view,state.view);Object.assign(displayView,view);Object.assign(spring,{x:0,y:0,vx:0,vy:0});
    selectedPoint=-1;meshFocus={index:0,dir:null};meshEditing=false;dragState=null;objectDrag=null;applyView();drawOverlay();wakeGuides();
  });
  // A new edit takes over the current shape, even halfway through a reset.
  const history={remember(){cancelReset();undoHistory.remember()},undo(){cancelReset();return undoHistory.undo()}};
  window.addEventListener('keydown',e=>{
    if(!(e.metaKey||e.ctrlKey)||e.altKey||e.shiftKey||e.key.toLowerCase()!=='z'||e.target.closest?.('textarea,input:not([type="range"]),[contenteditable="true"]'))return;
    if(history.undo()){e.preventDefault();e.stopImmediatePropagation()}
  },true);
  let zoomGesture=false,zoomTimer;
  function rememberZoom(){if(!zoomGesture){history.remember();zoomGesture=true}clearTimeout(zoomTimer);zoomTimer=setTimeout(()=>{zoomGesture=false},300)}
  function applyView(keepReset=false){if(!keepReset)cancelReset();document.querySelector('#zoom').value=view.scale;updateZoomSketch();requestRender()}
  function animateMotion(now){
    const dt=Math.min(.033,(now-lastFrame)/1000||1/60);lastFrame=now;
    const paused=window.siteVisualMotionPaused,blend=paused?1:1-Math.exp(-24*dt),oldX=displayView.x,oldY=displayView.y;
    let moving=false;
    for(const k of ['x','y','scale','angle']){
      displayView[k]+=(view[k]-displayView[k])*blend;
      if(Math.abs(view[k]-displayView[k])<(k==='x'||k==='y'?.005:.000005))displayView[k]=view[k];else moving=true;
    }
    const cos=Math.cos(displayView.angle),sin=Math.sin(displayView.angle),dx=(displayView.x-oldX)/stage.clientWidth,dy=(displayView.y-oldY)/stage.clientHeight;
    const wasX=spring.x,wasY=spring.y;
    if(paused)Object.assign(spring,{x:0,y:0,vx:0,vy:0});
    else{
      if(!motionPreference.matches){spring.vx-=((dx*cos+dy*sin)/displayView.scale)*12;spring.vy-=((-dx*sin+dy*cos)/displayView.scale)*12}
      spring.vx+=(-110*spring.x-15*spring.vx)*dt;spring.vy+=(-110*spring.y-15*spring.vy)*dt;
      spring.x=Math.max(-.025,Math.min(.025,spring.x+spring.vx*dt));spring.y=Math.max(-.025,Math.min(.025,spring.y+spring.vy*dt));
      if(Math.abs(spring.x)+Math.abs(spring.y)+Math.abs(spring.vx)+Math.abs(spring.vy)<.000001)Object.assign(spring,{x:0,y:0,vx:0,vy:0});
      else moving=true;
    }
    if(wasX!==spring.x||wasY!==spring.y){geometryDirty=true;overlayDirty=true}
    const transform=`translate(${displayView.x}px,${displayView.y}px) rotate(${displayView.angle}rad) scale(${displayView.scale})`;
    if(lastTransform!==transform){wrap.style.transform=transform;lastTransform=transform}
    return moving;
  }
  function setTransform(){transformMode=false}
  const frame=document.createElement('div');frame.className='transform-frame';
  frame.innerHTML=`<button class="transform-grip" data-corner="br" aria-label="Resize video"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5 L19 19 M5 11 L5 5 L11 5 M13 19 L19 19 L19 13"/></svg></button><button class="rotate-grip" aria-label="Rotate video"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 12 V6 Q7 3 9 5 V10 V3 Q11 1 12 4 V10 V4 Q15 2 15 5 V11 V7 Q18 5 18 9 L18 15 Q17 21 12 21 Q9 21 7 17 L4 13 Q3 10 5 11 L7 13"/></svg></button>`;wrap.appendChild(frame);

  frame.addEventListener('click',e=>{
    if(e.detail!==0)return;const target=e.target.closest('button');if(!target)return;
    history.remember();if(target.classList.contains('rotate-grip'))view.angle=0;else view.scale=1;applyView();wakeGuides();
  });
  frame.addEventListener('keydown',e=>{
    if(e.metaKey||e.ctrlKey||e.altKey||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    e.preventDefault();if(!e.repeat)history.remember();const positive=e.key==='ArrowUp'||e.key==='ArrowRight';
    if(e.target.classList.contains('rotate-grip'))view.angle+=(positive?1:-1)*Math.PI/180*(e.shiftKey?1:5);
    else view.scale=Math.max(.3,Math.min(2,view.scale+(positive?1:-1)*(e.shiftKey?.01:.05)));
    applyView();wakeGuides();
  });
  function inCenterDragArea(e){if(e.target.closest('.point,.transform-grip,.rotate-grip,#artworkPlayback'))return false;const rect=stage.getBoundingClientRect(),dx=(e.clientX-rect.left-rect.width/2)/displayView.scale,dy=(e.clientY-rect.top-rect.height/2)/displayView.scale,c=Math.cos(displayView.angle),n=Math.sin(displayView.angle),x=dx*c+dy*n,y=-dx*n+dy*c;return Math.abs(x)<stage.clientWidth*.15&&Math.abs(y)<stage.clientHeight*.18}
  wrap.addEventListener('pointermove',e=>{wrap.classList.toggle('center-drag',!dragState&&!objectDrag&&inCenterDragArea(e))});
  wrap.addEventListener('pointerleave',()=>wrap.classList.remove('center-drag'));
  wrap.addEventListener('pointerdown',e=>{if(e.target.closest('#artworkPlayback')||dragState||objectDrag)return;const grip=e.target.closest('.transform-grip,.rotate-grip');if(!grip&&!transformMode&&!spaceHeld&&!inCenterDragArea(e))return;if(e.button!==0)return;history.remember();e.preventDefault();e.stopPropagation();const rect=stage.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;objectDrag={id:e.pointerId,moved:false,kind:grip?(grip.classList.contains('move-grip')?'move':grip.classList.contains('rotate-grip')?'rotate':'scale'):'move',x:e.clientX,y:e.clientY,cx,cy,start:{...view},distance:Math.hypot(e.clientX-cx,e.clientY-cy),angle:Math.atan2(e.clientY-cy,e.clientX-cx)};wrap.classList.toggle('object-moving',objectDrag.kind==='move');wrap.setPointerCapture(e.pointerId)},true);
  wrap.addEventListener('pointermove',e=>{if(!objectDrag||objectDrag.id!==e.pointerId)return;const d=objectDrag;if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>4)d.moved=true;if(!d.moved)return;if(d.kind==='move'){view.x=d.start.x+e.clientX-d.x;view.y=d.start.y+e.clientY-d.y}else if(d.kind==='scale'){view.scale=Math.max(.3,Math.min(2,d.start.scale*Math.hypot(e.clientX-d.cx,e.clientY-d.cy)/Math.max(1,d.distance)))}else{view.angle=d.start.angle+Math.atan2(e.clientY-d.cy,e.clientX-d.cx)-d.angle;if(e.shiftKey)view.angle=Math.round(view.angle/(Math.PI/12))*Math.PI/12}applyView()});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])wrap.addEventListener(event,e=>{if(!objectDrag||objectDrag.id!==e.pointerId)return;if(event==='pointerup'&&!objectDrag.moved){if(objectDrag.kind==='rotate')view.angle=0;else if(objectDrag.kind==='scale')view.scale=1;applyView()}objectDrag=null;wrap.classList.remove('object-moving');wakeGuides()});
  document.querySelector('#transform').onclick=()=>setTransform(!transformMode);
  document.querySelector('#zoom').oninput=e=>{rememberZoom();view.scale=Number(e.target.value);applyView()};
  document.querySelector('#guides').onclick=()=>{isEditing=!isEditing;document.querySelector('#guides').setAttribute('aria-pressed',String(isEditing));drawOverlay()};
  function cancelReset(){resetTransition=null}
  function resetMesh(resetView=false){
    if(resetTransition){
      // The dock arrow can also restore the view during a mesh-only reset.
      if(resetView){Object.assign(view,{x:0,y:0,scale:1,angle:0});applyView(true)}
      return;
    }
    history.remember();setMorph(false);selectedPoint=-1;meshEditing=false;
    const pointer=dragState?.id,objectPointer=objectDrag?.id;
    dragState=null;objectDrag=null;wrap.classList.remove('bezier-dragging','object-moving');
    if(pointer!==undefined&&stage.hasPointerCapture(pointer))stage.releasePointerCapture(pointer);
    if(objectPointer!==undefined&&wrap.hasPointerCapture(objectPointer))wrap.releasePointerCapture(objectPointer);
    clearTimeout(zoomTimer);zoomGesture=false;
    if(resetView){Object.assign(view,{x:0,y:0,scale:1,angle:0});applyView()}
    const target=initialPoints();
    if(motionPreference.matches||window.siteVisualMotionPaused){
      points=target;Object.assign(spring,{x:0,y:0,vx:0,vy:0});
      if(resetView)Object.assign(displayView,view);
    }else resetTransition={from:structuredClone(points),to:target,started:performance.now()};
    drawOverlay();
  }
  function animateReset(now){
    if(!resetTransition)return;
    // Ease anchors and tangents together; whole-artwork easing and springs keep
    // using their existing motion path, so returning to center stays continuous.
    const {from,to,started}=resetTransition,t=motionPreference.matches||window.siteVisualMotionPaused?1:Math.min(1,Math.max(0,(now-started)/500)),ease=t*t*(3-2*t);
    if(t===1){points=to;resetTransition=null}
    else for(let i=0;i<points.length;i++){
      const p=points[i],a=from[i],b=to[i];
      for(const key of ['x','y'])p[key]=a[key]+(b[key]-a[key])*ease;
      for(const dir of ['left','right','up','down'])for(const key of ['x','y'])p[dir][key]=a[dir][key]+(b[dir][key]-a[dir][key])*ease;
    }
    drawOverlay();
  }
  document.querySelector('#dockReset').onclick=()=>resetMesh(true);
  function randomWarpPoints(){const random=(a,b)=>a+Math.random()*(b-a);return Array.from({length:gridSize*gridSize},(_,i)=>{const p={x:(i%gridSize)/(gridSize-1)+random(-.18,.18),y:Math.floor(i/gridSize)/(gridSize-1)+random(-.22,.22)};for(const dir of ['left','right','up','down']){const angle=random(-Math.PI,Math.PI),length=random(.08,.42);p[dir]={x:Math.cos(angle)*length,y:Math.sin(angle)*length}}return p})}
  function randomizeWarp(){history.remember();points=randomWarpPoints();if(morphing)beginMorph(performance.now());drawOverlay()}
  function beginMorph(now){morphFrom=structuredClone(points);morphTo=randomWarpPoints();morphStarted=now;morphPausedAt=window.siteVisualMotionPaused||document.hidden?now:null}
  function setMorph(active){cancelReset();morphing=active;const button=document.querySelector('#morph');button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',active?'Stop morphing':'Start morphing');if(active){morphPausedAt=null;beginMorph(performance.now())}requestRender()}
  let morphPausedAt=null;
  function syncMotionPause(){
    const now=performance.now();lastFrame=now;
    if(window.siteVisualMotionPaused||document.hidden){if(morphPausedAt===null)morphPausedAt=now}
    else if(morphPausedAt!==null){morphStarted+=now-morphPausedAt;morphPausedAt=null}
    if(window.siteVisualMotionPaused&&(spring.x||spring.y||spring.vx||spring.vy)){Object.assign(spring,{x:0,y:0,vx:0,vy:0});drawOverlay()}
    watchVideoFrames();
    if(document.hidden){cancelAnimationFrame(renderRequest);renderRequest=0}else requestRender();
  }
  window.addEventListener('site-motion-change',syncMotionPause);
  document.addEventListener('visibilitychange',syncMotionPause);
  function animateMorph(now){if(window.siteVisualMotionPaused||document.hidden){if(morphPausedAt===null)morphPausedAt=now;return}if(morphPausedAt!==null){morphStarted+=now-morphPausedAt;morphPausedAt=null}if(!morphing)return;const t=Math.min(1,Math.max(0,(now-morphStarted)/6500)),ease=t*t*(3-2*t);for(let i=0;i<points.length;i++){const p=points[i],a=morphFrom[i],b=morphTo[i];for(const key of ['x','y'])p[key]=a[key]+(b[key]-a[key])*ease;for(const dir of ['left','right','up','down'])for(const key of ['x','y'])p[dir][key]=a[dir][key]+(b[dir][key]-a[dir][key])*ease}drawOverlay();if(t===1)beginMorph(now)}
  document.querySelector('#morph').onclick=()=>{if(!morphing)history.remember();setMorph(!morphing)};
  function redrawWarpScribble(){const random=(a,b)=>a+Math.random()*(b-a);let d=`M ${random(8,15).toFixed(1)} ${random(8,14).toFixed(1)}`;for(let i=0;i<4;i++)d+=` C ${random(3,37).toFixed(1)} ${random(3,37).toFixed(1)}, ${random(3,37).toFixed(1)} ${random(3,37).toFixed(1)}, ${random(6,34).toFixed(1)} ${random(6,34).toFixed(1)}`;d+=` L ${random(9,32).toFixed(1)} ${random(8,33).toFixed(1)}`;document.querySelector('#warpScribblePath').setAttribute('d',d)}
  redrawWarpScribble();
  document.querySelector('#randomize').onclick=()=>{randomizeWarp();redrawWarpScribble()};
  function updateZoomSketch(){const t=(view.scale-.3)/1.7;document.querySelector('#zoomKnob').setAttribute('transform',`translate(${8+94*t} ${27-17*t})`)}
  updateZoomSketch();
  window.addEventListener('keydown',e=>{if(e.defaultPrevented||e.metaKey||e.ctrlKey||e.altKey||e.target.closest?.('input,textarea,button,[contenteditable="true"],.point'))return;if(e.code==='Space'){e.preventDefault();spaceHeld=true}if(e.key.toLowerCase()==='t'){e.preventDefault();setTransform(!transformMode)}if(e.key==='Escape')setTransform(false);if(e.key.toLowerCase()==='h')document.querySelector('#guides').click()},true);
  window.addEventListener('keyup',e=>{if(e.code==='Space')spaceHeld=false});window.addEventListener('blur',()=>{const interacting=!!(objectDrag||dragState);spaceHeld=false;objectDrag=null;dragState=null;wrap.classList.remove('object-moving','bezier-dragging');if(interacting)wakeGuides()});
  function pinchScale(next,cx,cy){rememberZoom();const old=view.scale;next=Math.max(.3,Math.min(2,next));const r=stage.getBoundingClientRect(),centerX=r.left+r.width/2,centerY=r.top+r.height/2;view.x+=(cx-centerX)*(1-next/old);view.y+=(cy-centerY)*(1-next/old);view.scale=next;applyView()}
  let safariGesture=false,gestureScale=1;
  window.addEventListener('wheel',e=>{if(!e.ctrlKey||e.target.closest('.glass-dock'))return;e.preventDefault();if(!safariGesture)pinchScale(view.scale*Math.exp(-e.deltaY*.008),e.clientX,e.clientY)},{passive:false});
  window.addEventListener('gesturestart',e=>{if(e.target.closest('.glass-dock'))return;e.preventDefault();safariGesture=true;gestureScale=view.scale},{passive:false});
  window.addEventListener('gesturechange',e=>{if(!safariGesture)return;e.preventDefault();pinchScale(gestureScale*e.scale,e.clientX||innerWidth/2,e.clientY||innerHeight/2)},{passive:false});
  window.addEventListener('gestureend',e=>{if(safariGesture)e.preventDefault();safariGesture=false},{passive:false});
  let guideIdleTimer;
  function wakeGuides(){clearTimeout(guideIdleTimer);const asleep=wrap.classList.contains('guides-idle');wrap.classList.remove('guides-idle');if(asleep||overlayDirty)requestRender();guideIdleTimer=setTimeout(()=>{if(dragState||objectDrag||wrap.contains(document.activeElement))return;guidePaintUntil=performance.now()+650;wrap.classList.add('guides-idle')},2200)}
  wrap.addEventListener('pointerenter',wakeGuides);wrap.addEventListener('pointermove',wakeGuides);wrap.addEventListener('pointerdown',wakeGuides);wrap.addEventListener('pointerup',wakeGuides);wrap.addEventListener('focusin',wakeGuides);wrap.addEventListener('focusout',wakeGuides);wrap.addEventListener('keydown',wakeGuides);
  installCenterMove({wrap,stage,view,applyView,history,wakeGuides});
  new ResizeObserver(sizeCanvas).observe(stage);sizeCanvas();watchVideoFrames();requestRender();
  const videoDuration=()=>Number.isFinite(video.duration)&&video.duration>0?video.duration:24;
  video.addEventListener('loadedmetadata',()=>{timeLabel.textContent=`00:00 / ${formatTime(videoDuration())}`});
  video.addEventListener('timeupdate',()=>{timeLabel.textContent=`${formatTime(video.currentTime)} / ${formatTime(videoDuration())}`});
  function formatTime(s){if(!Number.isFinite(s))return'00:00';return`${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`}
  video.addEventListener('play',()=>{videoPlay.textContent='Ⅱ  Pause';videoPlay.setAttribute('aria-label','Pause video')});video.addEventListener('pause',()=>{videoPlay.textContent='▶  Play';videoPlay.setAttribute('aria-label','Play video')});
  editToggle.addEventListener('click',()=>{isEditing=!isEditing;editToggle.classList.toggle('active',isEditing);editToggle.textContent=isEditing?'Warp on':'Warp off';editToggle.setAttribute('aria-pressed',String(isEditing));editHint.hidden=!isEditing;drawOverlay()});
  document.querySelector('#resetWarp').addEventListener('click',()=>resetMesh());
  document.querySelector('#videoUpload').addEventListener('click',()=>videoFile.click());
  function loadVideoFile(file){if(file)window.loadSiteArtwork?.(file)}
  videoFile.addEventListener('change',()=>loadVideoFile(videoFile.files?.[0]));
  document.querySelector('#fullScreen').addEventListener('click',()=>{const el=document.querySelector('.stage-wrap');if(!document.fullscreenElement)el.requestFullscreen?.();else document.exitFullscreen?.()});

  window.addEventListener('keydown',e=>{
    if(e.defaultPrevented||e.metaKey||e.ctrlKey||e.altKey||e.target.closest?.('input,button,textarea,select,[contenteditable="true"],.point'))return;
    if(e.key.toLowerCase()==='v')videoFile.click();
    if(e.key.toLowerCase()==='r')resetMesh();
    if(e.key.toLowerCase()==='f')wrap.requestFullscreen?.();
  });
  window.addEventListener('dragover',e=>e.preventDefault());
  window.addEventListener('drop',e=>{
    e.preventDefault();const files=[...e.dataTransfer.files];const clip=files.find(f=>f.type.startsWith('video/'));
    if(clip){loadVideoFile(clip);return}
    soundtrack.addFiles(files.filter(f=>f.type.startsWith('audio/')));
  });
})();
