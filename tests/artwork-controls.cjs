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
async function controls(browser,name,options,desktop=false){
 const page=await setup(browser,options),pause=page.locator('#artworkPlayback');
 try{
  await page.waitForFunction(()=>document.querySelector('#video').currentTime>.1);
  assert.equal(await pause.evaluate(e=>getComputedStyle(e).pointerEvents),'none','Pause starts quiet with the hidden guides');
  const bounds=await page.locator('#stage').boundingBox();
  await page.mouse.move(bounds.x+bounds.width*.56,bounds.y+bounds.height*.56);
  await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('#artworkPlayback')).opacity)>.95);
  const hit=await pause.evaluate(node=>{const r=node.getBoundingClientRect(),stage=document.querySelector('#stage').getBoundingClientRect(),dock=document.querySelector('.glass-dock').getBoundingClientRect();return{reachable:node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),gap:Math.max(r.top-stage.bottom,r.left-stage.right),bottom:r.bottom,right:r.right,dock:dock.top,height:innerHeight,width:innerWidth}});
  assert(hit.reachable,`${name}: pause is reachable when guides appear`);
  assert(hit.gap>=15,`${name}: pause clears the bottom corner hit target`);
  assert(hit.bottom<=hit.height,`${name}: pause remains in the viewport`);
  assert(hit.right<=hit.width,`${name}: pause remains in the viewport horizontally`);
  if(options.hasTouch)assert(hit.bottom<=hit.dock,`${name}: pause does not overlap transport controls`);
  if(desktop){
   await pause.hover();await page.waitForTimeout(2800);
   assert.equal(await pause.evaluate(e=>getComputedStyle(e).pointerEvents),'auto','A stationary hover keeps the pause action available');
   assert.equal(await pause.evaluate(e=>getComputedStyle(e).opacity),'1');
   // Space-drag must not swallow a click on the explicit pause button.
   await page.keyboard.down('Space');await pause.click();await page.keyboard.up('Space');
  }else await pause.tap();
  await page.waitForFunction(()=>window.siteVisualMotionPaused===true);
  await keyboard(page,name);
  // Pointer hit priority remains with the mesh, even in the center grab region.
  await page.locator('#centerMove').focus();
  assert.equal(await page.locator('#overlay .point.handle[data-index="12"]').evaluate(node=>{const r=node.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.dataset.index}),'12');
  await page.locator('#themeToggle').click();await page.locator('#centerMove').focus();
  assert.equal(await page.locator('#centerMove').evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)');
  assert.equal(await pause.evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)');
 }finally{await page.close()}
}
(async()=>{
 for(const [name,type,options] of engines){
  const browser=await type.launch(options);
  try{
   await controls(browser,name+' desktop',{viewport:{width:1280,height:800}},true);
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
