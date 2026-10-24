const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os');
const base=process.env.BASE_URL||'http://127.0.0.1:8766';
const localWebKit=`${os.homedir()}/Library/Caches/ms-playwright/webkit-2370/pw_run.sh`;
const engines=[['Chromium',chromium,{}],['WebKit',webkit,fs.existsSync(localWebKit)?{executablePath:localWebKit}:{}]];
const matrix=page=>page.locator('.stage-wrap').evaluate(node=>{const m=new DOMMatrixReadOnly(getComputedStyle(node).transform);return[m.a,m.b,m.c,m.d,m.e,m.f]});
const position=(page,x,y)=>page.waitForFunction(({x,y})=>{const m=new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.stage-wrap')).transform);return Math.abs(m.e-x)<.02&&Math.abs(m.f-y)<.02},{x,y});
async function setup(browser,options={}){
 const page=await browser.newPage(options);page.setDefaultTimeout(10000);
 await page.route('**/soundtrack.json*',route=>route.fulfill({json:[]}));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForSelector('#centerMove',{state:'attached'});
 await page.waitForFunction(()=>document.querySelectorAll('#overlay .point').length>25);
 return page;
}
async function keyboard(page,name){
 const move=page.locator('#centerMove');
 assert.equal(await move.getAttribute('aria-label'),'Move video');
 assert.equal(await move.evaluate(e=>getComputedStyle(e).pointerEvents),'none');
 // The new stop follows the existing mesh in ordinary keyboard navigation.
 await page.locator('#overlay [tabindex="0"]').focus();await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>document.activeElement.id),'centerMove');
 assert.notEqual(await move.evaluate(e=>getComputedStyle(e).outlineStyle),'none');
 await page.keyboard.down('ArrowRight');await page.keyboard.down('ArrowRight');await page.keyboard.down('ArrowRight');await page.keyboard.up('ArrowRight');
 await position(page,24,0);await page.keyboard.press('Control+z');await position(page,0,0);
 await page.keyboard.press('Shift+ArrowDown');await position(page,0,1);
 await page.keyboard.press('Meta+z');await position(page,0,0);
 // An undo during a held arrow ends that history group too.
 await page.keyboard.down('ArrowRight');await position(page,8,0);
 await page.keyboard.press('Control+z');await position(page,0,0);
 await page.keyboard.down('ArrowRight');await page.keyboard.up('ArrowRight');await position(page,8,0);
 await page.keyboard.press('Control+z');await position(page,0,0);
 const before=await matrix(page);
 const ignored=await move.evaluate(button=>{
  const results=[];
  for(const modifier of ['ctrlKey','metaKey','altKey']){
   const event=new KeyboardEvent('keydown',{key:'ArrowRight',[modifier]:true,bubbles:true,cancelable:true});button.dispatchEvent(event);results.push(event.defaultPrevented);
  }
  const prevented=new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true});prevented.preventDefault();button.dispatchEvent(prevented);
  return results;
 });
 assert.deepEqual(ignored,[false,false,false]);assert.deepEqual(await matrix(page),before);
 // Center reset must retain independent size, rotation and mesh edits.
 await page.locator('#zoom').evaluate(e=>{e.value='1.15';e.dispatchEvent(new Event('input',{bubbles:true}))});
 await page.locator('.rotate-grip').focus();await page.keyboard.press('ArrowRight');
 await move.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');await position(page,8,8);
 const transformed=await matrix(page),anchors=await page.locator('#overlay .point.corner').evaluateAll(nodes=>nodes.map(e=>[e.getAttribute('cx'),e.getAttribute('cy')]));
 await page.keyboard.press('Enter');await position(page,0,0);
 const reset=await matrix(page);for(let i=0;i<4;i++)assert(Math.abs(reset[i]-transformed[i])<.00001);
 assert.deepEqual(await page.locator('#overlay .point.corner').evaluateAll(nodes=>nodes.map(e=>[e.getAttribute('cx'),e.getAttribute('cy')])),anchors);
 await page.keyboard.press('Control+z');await position(page,8,8);
 await page.keyboard.press('Space');await position(page,0,0);
 await page.locator('#dockReset').evaluate(e=>e.click());await position(page,0,0);
 await page.locator('#overlay [tabindex="0"]').focus();await page.keyboard.press('ArrowRight');
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.index),'1');await position(page,0,0);
 console.log(`${name}: center keyboard movement, fine step, grouped undo, reset and mesh isolation passed`);
}
async function pointerMovement(page,name){
 // Check screen-space response after scaling/rotation, beyond the original
 // video edge and across a renderer allocation boundary.
 await page.locator('#zoom').evaluate(e=>{e.value='.5';e.dispatchEvent(new Event('input',{bubbles:true}))});
 await page.locator('.rotate-grip').focus();
 for(let i=0;i<3;i++)await page.keyboard.press('ArrowRight');
 await page.waitForFunction(()=>Math.abs(new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.stage-wrap')).transform).a-Math.cos(Math.PI/12)*.5)<.00001);
 for(const selector of ['#overlay .point.handle[data-index="22"]','#overlay .point.tangent[data-index="24"][data-direction="up"]']){
  for(const fine of [false,true]){
   await page.locator('#centerMove').focus();
   const node=page.locator(selector),box=await node.boundingBox(),start={x:box.x+box.width/2,y:box.y+box.height/2};
   const original=await node.evaluate(e=>[e.getAttribute('cx'),e.getAttribute('cy')]);
   const height=await page.locator('#gl').evaluate(e=>e.height);
   if(fine)await page.keyboard.down('Shift');
   await page.mouse.move(start.x,start.y);await page.mouse.down();
   await page.mouse.move(start.x+40,start.y+200,{steps:12});await page.mouse.up();
   if(fine)await page.keyboard.up('Shift');
   const expected={x:start.x+40*(fine?.18:1),y:start.y+200*(fine?.18:1)};
   await page.waitForFunction(({selector,expected})=>{const r=document.querySelector(selector).getBoundingClientRect();return Math.abs(r.x+r.width/2-expected.x)<.35&&Math.abs(r.y+r.height/2-expected.y)<.35},{selector,expected});
   if(!fine&&selector.includes('22'))assert(await page.locator('#gl').evaluate(e=>e.height)>height,'The canvas expands while the node follows the pointer');
   await page.keyboard.press('Control+z');
   await page.waitForFunction(({selector,original})=>{const e=document.querySelector(selector);return e.getAttribute('cx')===original[0]&&e.getAttribute('cy')===original[1]},{selector,original});
  }
 }
 console.log(`${name}: anchors and tangents follow pointer one-to-one, Shift stays precise, crop growth and undo passed`);
}
async function controls(browser,name,options){
 const page=await setup(browser,options),pause=page.locator('#artworkPlayback');
 try{
  await page.waitForFunction(()=>document.querySelector('#video').currentTime>.1);
  assert.equal(await pause.evaluate(e=>getComputedStyle(e).pointerEvents),'none','Pause starts quiet with the hidden guides');
  const bounds=await page.locator('#stage').boundingBox();
  await page.mouse.move(bounds.x+bounds.width*.56,bounds.y+bounds.height*.56);
  await page.waitForFunction(()=>!document.querySelector('.stage-wrap').classList.contains('guides-idle'));
  assert.equal(await pause.evaluate(e=>getComputedStyle(e).opacity),'0','Pointer editing does not reveal a pause symbol');
  assert.equal(await pause.evaluate(e=>getComputedStyle(e).pointerEvents),'none');
  await page.keyboard.press('Tab');await pause.focus();
  await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('#artworkPlayback')).opacity)>.95);
  const hit=await pause.evaluate(node=>{const r=node.getBoundingClientRect(),stage=document.querySelector('#stage').getBoundingClientRect(),dock=document.querySelector('.glass-dock').getBoundingClientRect();return{reachable:node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),gap:Math.max(r.top-stage.bottom,r.left-stage.right),bottom:r.bottom,right:r.right,dock:dock.top,height:innerHeight,width:innerWidth}});
  assert(hit.reachable,`${name}: pause remains reachable on keyboard focus`);
  assert(hit.gap>=15,`${name}: pause clears the bottom corner hit target`);
  assert(hit.bottom<=hit.height,`${name}: pause remains in the viewport`);
  assert(hit.right<=hit.width,`${name}: pause remains in the viewport horizontally`);
  if(options.hasTouch)assert(hit.bottom<=hit.dock,`${name}: pause does not overlap transport controls`);
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.siteVisualMotionPaused===true);
  await keyboard(page,name);
  // Pointer hit priority remains with the mesh, even in the center grab region.
  await page.locator('#centerMove').focus();
  assert.equal(await page.locator('#overlay .point.handle[data-index="12"]').evaluate(node=>{const r=node.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.dataset.index}),'12');
  await page.locator('#themeToggle').click();await page.locator('#centerMove').focus();
  assert.equal(await page.locator('#centerMove').evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)');
  assert.equal(await pause.evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)');
  if(!options.hasTouch)await pointerMovement(page,name);
 }finally{await page.close()}
}
(async()=>{
 for(const [name,type,options] of engines){
  const browser=await type.launch(options);
  try{
   await controls(browser,name+' desktop',{viewport:{width:1280,height:800}});
   await controls(browser,name+' phone',{viewport:{width:390,height:844},hasTouch:true,isMobile:true});
   await controls(browser,name+' landscape phone',{viewport:{width:844,height:390},hasTouch:true,isMobile:true});
   const reduced=await setup(browser,{reducedMotion:'reduce'});
   assert.equal(await reduced.locator('#artworkPlayback').evaluate(e=>getComputedStyle(e).opacity),'1');
   assert.equal(await reduced.locator('#artworkPlayback').getAttribute('aria-label'),'Resume visual motion');
   await reduced.locator('#artworkPlayback').focus();await reduced.keyboard.press('Enter');await reduced.waitForFunction(()=>window.siteVisualMotionPaused===false);
   await reduced.keyboard.press('Enter');await reduced.waitForFunction(()=>window.siteVisualMotionPaused===true);
   await reduced.close();console.log(`${name}: reduced-motion resume/pause remains available`);
  }finally{await browser.close()}
 }
})().catch(error=>{console.error(error);process.exitCode=1});
