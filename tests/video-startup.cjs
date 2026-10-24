// Muted artwork startup/recovery regressions. --baseline runs the committed
// controller against the same cases without overwriting the working file.
const {webkit}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const base=process.env.BASE_URL||'http://127.0.0.1:8766';
const localWebKit=path.join(os.homedir(),'Library/Caches/ms-playwright/webkit-2370/pw_run.sh');
const options=fs.existsSync(localWebKit)?{executablePath:localWebKit}:{};
const baseline=process.argv.includes('--baseline')?execFileSync('git',['show','HEAD:video-playback.js'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'}):null;

async function newPage(browser,mode='normal',reducedMotion='no-preference'){
 const page=await browser.newPage({viewport:{width:800,height:600},reducedMotion});
 page.setDefaultTimeout(5000);
 await page.route('**/soundtrack.json*',route=>route.fulfill({json:[]}));
 if(baseline)await page.route('**/video-playback.js*',route=>route.fulfill({contentType:'text/javascript',body:baseline}));
 await page.addInitScript(mode=>{
  const play=HTMLMediaElement.prototype.play;
  window.videoStartup={calls:0,mode,allow:false,held:false,reject:null,gestureCalls:0,events:[],attempts:[]};
  for(const name of ['play','playing','pause','error','waiting','stalled','loadedmetadata','canplay'])document.addEventListener(name,event=>{
   if(event.target.id==='video'){const media=event.target;videoStartup.events.push({event:name,time:media.currentTime,ready:media.readyState,paused:media.paused});if(videoStartup.events.length>30)videoStartup.events.shift()}
  },true);
  let gesture=null;
  window.addEventListener('pointerdown',event=>{gesture=event},true);
  HTMLMediaElement.prototype.play=function(){
   if(this.id!=='video')return play.call(this);
   const state=window.videoStartup;state.calls++;if(gesture?.eventPhase>0)state.gestureCalls++;
   state.attempts.push({ready:this.readyState,time:this.currentTime,paused:this.paused,gesture:gesture?.eventPhase>0});
   if(mode==='blocked'&&!state.allow)return Promise.reject(new DOMException('Test autoplay policy rejection','NotAllowedError'));
   if(mode==='pending'&&state.calls===1){state.held=true;return new Promise((resolve,reject)=>{state.reject=reject})}
   return play.call(this);
  };
 },mode);
 await page.goto(base,{waitUntil:'domcontentloaded'});
 return page;
}
const playing=page=>page.waitForFunction(()=>!video.paused&&video.currentTime>.1,null,{timeout:8000});

async function unsolicitedPause(browser){
 const page=await newPage(browser);
 try{
  // Progress means the finite startup loop cannot restart this pause: it exits
  // whenever currentTime is nonzero, even if its final timer has not run yet.
  await page.waitForFunction(()=>video.currentTime>.6&&video.readyState>=3,null,{timeout:8000});
  const before=await page.evaluate(()=>{const time=video.currentTime;video.pause();return time});
  await page.waitForFunction(time=>!video.paused&&video.currentTime>time+.08,before,{timeout:3500});
  assert.equal(await page.evaluate(()=>window.siteVisualMotionPaused),false);
  const second=await page.evaluate(()=>{const time=video.currentTime;video.pause();return time});
  await page.waitForFunction(time=>!video.paused&&video.currentTime>time+.08,second,{timeout:3500});
  await page.evaluate(()=>video.pause());
  await page.waitForFunction(()=>document.querySelector('#artworkPlayback').dataset.unavailable==='true');
  const stoppedCalls=await page.evaluate(()=>{
   const calls=videoStartup.calls;
   for(const event of ['canplay','canplaythrough'])video.dispatchEvent(new Event(event));
   return calls;
  });
  await page.waitForTimeout(350);
  assert(await page.evaluate(()=>video.paused),'Native-pause recovery must stop after its retry budget');
  assert.equal(await page.evaluate(()=>videoStartup.calls),stoppedCalls,'Readiness events must not bypass the native-pause retry budget');
  await page.locator('#artworkPlayback').click();await playing(page);
  // An intentional pause must not be mistaken for the browser pausing media.
  await page.locator('#artworkPlayback').focus();await page.keyboard.press('Enter');
  assert(await page.evaluate(()=>video.paused&&window.siteVisualMotionPaused));
  const calls=await page.evaluate(()=>videoStartup.calls);
  await page.mouse.click(12,350);await page.waitForTimeout(650);
  assert(await page.evaluate(()=>video.paused&&window.siteVisualMotionPaused));
  assert.equal(await page.evaluate(()=>videoStartup.calls),calls,'Unrelated gestures must retain an explicit pause');
 }catch(error){
  error.message+='\nStartup state: '+JSON.stringify(await page.evaluate(()=>({time:video.currentTime,paused:video.paused,ready:video.readyState,network:video.networkState,result:video.dataset.playResult,state:video.dataset.playback,error:video.error?.message,source:video.currentSrc,calls:videoStartup.calls,attempts:videoStartup.attempts,events:videoStartup.events})));
  throw error;
 }finally{await page.close()}
}

async function blockedRetry(browser){
 const page=await newPage(browser,'blocked');
 try{
  await page.waitForFunction(()=>video.dataset.playback==='needs-tap');
  const affordance=await page.locator('#artworkPlayback').evaluate(node=>({opacity:Number(getComputedStyle(node).opacity),pointer:getComputedStyle(node).pointerEvents,label:node.getAttribute('aria-label')}));
  // Allow the button's normal opacity transition to finish, then check genuine
  // pointer reachability rather than using a force click on a hidden control.
  await page.waitForFunction(()=>{const node=document.querySelector('#artworkPlayback'),r=node.getBoundingClientRect();return Number(getComputedStyle(node).opacity)>.9&&node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))},null,{timeout:2000});
  assert.match(affordance.label,/retry/i);
  await page.evaluate(()=>{videoStartup.allow=true});
  await page.locator('#artworkPlayback').click();
  await playing(page);
  assert.equal(await page.locator('#artworkPlayback').getAttribute('data-unavailable'),'false');
 }finally{await page.close()}
}

async function pendingGesture(browser){
 const page=await newPage(browser,'pending');
 try{
  await page.waitForFunction(()=>videoStartup.held&&video.readyState>=2);
  assert.equal(await page.evaluate(()=>video.paused),true);
  await page.locator('#stage').click();
  // The first request is still pending. A later trusted gesture must be usable
  // immediately, not queued behind that indefinitely unresolved promise.
  await playing(page);
  assert(await page.evaluate(()=>videoStartup.gestureCalls>0),'Recovery play should execute in the pointer gesture stack');
  const result=await page.evaluate(async()=>{
   videoStartup.reject(new DOMException('Obsolete autoplay request','NotAllowedError'));
   await new Promise(resolve=>setTimeout(resolve,0));
   return{paused:video.paused,state:video.dataset.playback,unavailable:document.querySelector('#artworkPlayback').dataset.unavailable};
  });
  assert.equal(result.paused,false);assert.equal(result.state,'playing');assert.notEqual(result.unavailable,'true');
 }finally{await page.close()}
}

async function reducedMotionProtection(browser){
 const page=await newPage(browser,'normal','reduce');
 try{
  await page.waitForFunction(()=>window.siteVisualMotionPaused===true);
  await page.mouse.click(12,350);await page.keyboard.press('a');
  assert(await page.evaluate(()=>video.paused&&!video.currentSrc&&videoStartup.calls===0),'Reduced motion needs artwork-specific consent');
  await page.locator('#artworkPlayback').click();await playing(page);
  await page.locator('#artworkPlayback').focus();await page.keyboard.press('Enter');
  const calls=await page.evaluate(()=>videoStartup.calls);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))});
  await page.mouse.click(12,350);await page.waitForTimeout(650);
  assert(await page.evaluate(()=>video.paused&&window.siteVisualMotionPaused));
  assert.equal(await page.evaluate(()=>videoStartup.calls),calls,'Visibility and unrelated clicks must retain a later explicit pause');
 }finally{await page.close()}
}

(async()=>{
 const browser=await webkit.launch(options),failed=[];
 try{
  for(const [name,test]of [['unsolicited pause and explicit pause intent',unsolicitedPause],['blocked autoplay first-click retry',blockedRetry],['pending play gesture and obsolete rejection',pendingGesture],['reduced motion and pause protection',reducedMotionProtection]]){
   try{await test(browser);console.log(`WebKit: ${name} passed`)}catch(error){failed.push(name);console.error(`WebKit: ${name} FAILED\n${error.message}\n${error.stack}`)}
  }
 }finally{await browser.close()}
 assert.equal(failed.length,0,`Failed startup cases: ${failed.join(', ')}`);
})().catch(error=>{console.error(error);process.exitCode=1});
