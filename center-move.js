// Keyboard counterpart of the existing center drag zone. Pointer events keep
// passing through to the mesh and the original whole-artwork drag handler.
export function installCenterMove({wrap,stage,view,applyView,history,wakeGuides}){
 const button=document.createElement('button'),help=document.createElement('p');
 button.id='centerMove';button.type='button';button.tabIndex=0;button.setAttribute('aria-label','Move video');
 button.setAttribute('aria-describedby','centerMoveHelp');
 help.id='centerMoveHelp';help.className='sr-only';
 help.textContent='Arrow keys move the video. Hold Shift for fine movement. Enter or Space returns it to the center without changing its size, rotation or warp. Command or Control Z undoes an edit.';
 stage.append(button);wrap.append(help);
 const arrows={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
 let heldKey=null,lastX=view.x,lastY=view.y;
 const endGesture=()=>{heldKey=null};
 function move(event){
  if(event.defaultPrevented||event.metaKey||event.ctrlKey||event.altKey||!arrows[event.key])return;
  event.preventDefault();
  // An external edit/undo also ends the group, even if a key is still held.
  if(!event.repeat||heldKey!==event.key||view.x!==lastX||view.y!==lastY)history.remember();
  heldKey=event.key;
  const [dx,dy]=arrows[event.key],step=event.shiftKey?1:8;
  view.x+=dx*step;view.y+=dy*step;lastX=view.x;lastY=view.y;
  applyView();wakeGuides();
 }
 function reset(event){
  if(event.defaultPrevented||event.metaKey||event.ctrlKey||event.altKey)return;
  endGesture();
  if(view.x||view.y){history.remember();view.x=0;view.y=0;applyView()}
  wakeGuides();
 }
 function release(event){if(event.key===heldKey)endGesture()}
 button.addEventListener('keydown',move);button.addEventListener('keyup',release);
 button.addEventListener('click',reset);button.addEventListener('blur',endGesture);
 window.addEventListener('blur',endGesture);
 return {button,destroy(){button.remove();help.remove();window.removeEventListener('blur',endGesture)}};
}
