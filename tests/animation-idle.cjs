// Paused artwork should render edits and new media, then sleep without polling.
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os');
const base=process.env.BASE_URL||'http://127.0.0.1:8766';
const localWebKit=`${os.homedir()}/Library/Caches/ms-playwright/webkit-2370/pw_run.sh`;
const engines=[['Chromium',chromium,{}],['WebKit',webkit,fs.existsSync(localWebKit)?{executablePath:localWebKit}:{}]];
async function idle(page,label){
 await page.waitForTimeout(100);
 const before=await page.evaluate(()=>renderCalls);
 await page.waitForTimeout(250);
 assert.equal(await page.evaluate(()=>renderCalls),before,label);
}
async function exercise(browser,name,fallback){
 const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/soundtrack.json*',r=>r.fulfill({json:[]}));
 await page.addInitScript(fallback=>{
  window.renderCalls=0;window.meshDraws=0;
  const request=window.requestAnimationFrame;
  window.requestAnimationFrame=callback=>request.call(window,time=>{if(callback.name==='render')renderCalls++;callback(time)});
  const draw=WebGLRenderingContext.prototype.drawElements;
  WebGLRenderingContext.prototype.drawElements=function(...args){meshDraws++;return draw.apply(this,args)};
  if(fallback)Object.defineProperty(HTMLVideoElement.prototype,'requestVideoFrameCallback',{value:undefined});
 },fallback);
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.siteVisualMotionPaused&&document.querySelectorAll('#overlay .point:not(.touch-target)').length>=25&&meshDraws>0);
 await idle(page,'A settled reduced-motion artwork must have no render callbacks');
 if(!fallback){
  // Explicit pause keeps a drag from granting initial reduced-motion consent.
  await page.locator('#artworkPlayback').evaluate(button=>button.click());
  await page.waitForFunction(()=>!video.paused&&video.currentTime>.15);
  await page.locator('#artworkPlayback').evaluate(button=>button.click());
  await page.waitForFunction(()=>window.siteVisualMotionPaused&&video.paused);
  // No polling while a drag is held: cancellation must arm its final idle timeout.
  const wrap=page.locator('.stage-wrap'),box=await page.locator('#stage').boundingBox();
  await wrap.evaluate(node=>node.addEventListener('pointerdown',event=>{window.testPointer=event.pointerId},{once:true,capture:true}));
  await page.mouse.move(box.x+box.width*.58,box.y+box.height*.56);await page.mouse.down();
  assert(await wrap.evaluate(node=>node.classList.contains('object-moving')),'Exercise a real active center drag');
  await page.waitForTimeout(2300);
  assert.equal(await wrap.evaluate(node=>node.classList.contains('guides-idle')),false);
  await wrap.evaluate(node=>node.dispatchEvent(new PointerEvent('pointercancel',{pointerId:window.testPointer,bubbles:true})));
  await page.waitForFunction(()=>document.querySelector('.stage-wrap').classList.contains('guides-idle'));
  await page.mouse.up();
 }

 // Direct edits still redraw the image while motion is paused.
 let count=await page.evaluate(()=>meshDraws);
 await page.locator('#randomize').click();
 await page.waitForFunction(count=>meshDraws>count,count);
 await idle(page,'A paused warp must stop rendering after its edit');
 await page.locator('#zoom').evaluate(input=>{input.value='1.2';input.dispatchEvent(new Event('input',{bubbles:true}))});
 await page.waitForFunction(()=>document.querySelector('.stage-wrap').style.transform.includes('scale(1.2)'));
 await idle(page,'A paused transform must stop after reaching its target');
 // Hidden tabs stay dormant, then pending geometry draws after returning.
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});
 await page.locator('#randomize').evaluate(button=>button.click());
 await idle(page,'A hidden artwork must not schedule render callbacks');
 count=await page.evaluate(()=>meshDraws);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))});
 await page.waitForFunction(count=>meshDraws>count,count);
 await idle(page,'Visibility restoration must settle again');
 // Context restoration must redraw even though no continuous loop is left.
 const restored=await page.evaluate(()=>{const ext=document.querySelector('#gl').getContext('webgl').getExtension('WEBGL_lose_context');if(!ext)return false;window.testContext=ext;ext.loseContext();return true});
 if(restored){
  await page.waitForFunction(()=>document.querySelector('#stage').dataset.renderer==='fallback');
  count=await page.evaluate(()=>meshDraws);await page.evaluate(()=>testContext.restoreContext());
  await page.waitForFunction(count=>meshDraws>count&&document.querySelector('#stage').dataset.renderer==='warp',count);
  await idle(page,'A restored paused renderer must settle again');
 }
 // Starting playback/morph wakes the loop; pausing freezes it at its current phase.
 await page.locator('#morph').click();await idle(page,'Starting Morph while visually paused must not spin');
 await page.locator('#artworkPlayback').evaluate(button=>button.click());
 await page.waitForFunction(()=>!video.paused&&video.currentTime>.15);
 count=await page.evaluate(()=>meshDraws);await page.waitForFunction(count=>meshDraws>count+3,count);
 await page.locator('#artworkPlayback').evaluate(button=>button.click());
 await page.waitForFunction(()=>window.siteVisualMotionPaused&&video.paused);
 await idle(page,'Paused video and morph must stop their render callbacks');
 const path=await page.locator('#overlay .net').first().getAttribute('d');
 await page.waitForTimeout(100);assert.equal(await page.locator('#overlay .net').first().getAttribute('d'),path);
 // A seek presents a new video texture while the artwork remains paused.
 count=await page.evaluate(()=>meshDraws);await page.evaluate(()=>{video.currentTime=1});
 await page.waitForFunction(count=>meshDraws>count&&video.currentTime>=1,count);
 await idle(page,'A paused seek must draw once and settle');
 assert.deepEqual(errors,[]);await page.close();
 console.log(`${name}: paused edits, visibility, context restore, morph/playback and seeks sleep/wake${fallback?' without video-frame callbacks':''}`);
}
(async()=>{for(const [name,type,options] of engines){const browser=await type.launch(options);try{await exercise(browser,name,false);await exercise(browser,name,true)}finally{await browser.close()}}})().catch(error=>{console.error(error);process.exitCode=1});
