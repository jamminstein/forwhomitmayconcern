// Browser behavior regressions. Requires the local static server and Playwright.
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os');
const BASE=process.env.BASE_URL||'http://127.0.0.1:8766';
const webkitLocal=`${os.homedir()}/Library/Caches/ms-playwright/webkit-2370/pw_run.sh`;
const webkitOptions=fs.existsSync(webkitLocal)?{executablePath:webkitLocal}:{};
function tone(){
 const rate=22050,n=rate*20,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);
 for(let i=0;i<n;i++){const envelope=Math.min(1,i/(rate*.01),(n-1-i)/(rate*.01));b.writeInt16LE(Math.round(Math.sin(i/rate*Math.PI*880)*.08*envelope*32767),44+i*2)}return b;
}
const audioBytes=tone(),collection=[11827,11774,10598].map(id=>({name:`Acervo / ${id}`,url:`https://audio.fixture/${id}.m4a`,remote:true}));
const fulfillAudio=r=>r.fulfill({body:audioBytes,contentType:'audio/wav'});
async function routeAudio(page){await page.route('**/soundtrack.json*',r=>r.fulfill({json:collection}));await page.route('**/*.m4a*',fulfillAudio)}
async function pendingVisibility(page){
 // Hold a *fulfilled* native play promise: paused becomes false before the
 // controller's pending flag clears, exactly as a rapid tab switch can do.
 await page.evaluate(()=>{
  const video=document.querySelector('#video'),nativePlay=video.play.bind(video);
  window.heldPlay={armed:false,held:false,calls:0,release:null};
  video.play=()=>{const c=window.heldPlay;c.calls++;const result=nativePlay();if(!c.armed)return result;c.armed=false;return result.then(()=>new Promise(resolve=>{c.held=true;c.release=resolve}))};
  document.querySelector('#artworkPlayback').click();
 });
 assert(await page.evaluate(()=>document.querySelector('#video').paused));
 await page.evaluate(()=>{heldPlay.armed=true;heldPlay.held=false;document.querySelector('#artworkPlayback').click()});
 await page.waitForFunction(()=>heldPlay.held);
 const before=await page.evaluate(()=>{
  const time=video.currentTime;
  Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
  Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));
  heldPlay.release();return time;
 });
 await page.waitForFunction(time=>!video.paused&&video.currentTime>time+.04,before);
 // A newer explicit pause wins even if visibility changes while play settles.
 await page.evaluate(()=>{document.querySelector('#artworkPlayback').click();heldPlay.armed=true;heldPlay.held=false;document.querySelector('#artworkPlayback').click()});
 await page.waitForFunction(()=>heldPlay.held);
 const calls=await page.evaluate(()=>{
  document.querySelector('#artworkPlayback').click();
  Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
  Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));
  heldPlay.release();return heldPlay.calls;
 });
 await page.waitForTimeout(250);
 assert(await page.evaluate(()=>video.paused&&window.siteVisualMotionPaused));
 assert.equal(await page.evaluate(()=>heldPlay.calls),calls);
}
async function lifecycle(browser,name){
 const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await routeAudio(p);
 await p.route('**/audio-mixer.js*',async r=>{await new Promise(resolve=>setTimeout(resolve,3500));await r.continue()});
 await p.goto(BASE,{waitUntil:'commit'});await p.waitForTimeout(1200);
 assert(await p.evaluate(()=>document.querySelectorAll('#overlay .point').length>0&&document.querySelector('#audio').paused&&document.querySelector('#audio').currentTime===0));
 await p.locator('#musicNext').click({noWaitAfter:true});await p.waitForTimeout(2800);await p.locator('#stage').click();
 await p.waitForFunction(()=>window.siteAudioContext?.state==='running'&&document.querySelector('#audio').currentTime>.1);
 await p.evaluate(()=>{document.querySelector('#musicNext').click();setTimeout(()=>document.querySelector('#musicPlay').click(),5)});
 // Media loading and the fade timer can settle later on a busy browser runner.
 await p.waitForFunction(()=>document.querySelector('#audio').paused&&document.querySelector('#audio').src.includes('/'+document.querySelector('#currentSongId').dataset.songId+'.m4a'),null,{timeout:3000});
 await p.waitForTimeout(160);
 assert(await p.evaluate(()=>document.querySelector('#audio').paused&&document.querySelector('#audio').src.includes('/'+document.querySelector('#currentSongId').dataset.songId+'.m4a')));
 await p.locator('#musicPlay').click();await p.waitForFunction(()=>!document.querySelector('#audio').paused);
 await p.evaluate(()=>{for(let i=0;i<4;i++)document.querySelector('#musicNext').click()});
 await p.waitForFunction(()=>!document.querySelector('#audio').paused&&document.querySelector('#audio').src.includes('/'+document.querySelector('#currentSongId').dataset.songId+'.m4a'),null,{timeout:3000});
 assert.deepEqual(errors,[]);await p.close();
 const q=await browser.newPage({reducedMotion:'reduce'});await routeAudio(q);q.on('pageerror',e=>errors.push(e.message));await q.goto(BASE);await q.waitForTimeout(200);
 assert(await q.evaluate(()=>window.siteVisualMotionPaused&&document.querySelector('#video').paused&&!document.querySelector('#video').currentSrc));
 await q.locator('#musicPlay').click();assert(await q.evaluate(()=>window.siteVisualMotionPaused&&document.querySelector('#video').paused));
 await q.locator('#stage').click();await q.waitForFunction(()=>document.querySelector('#video').currentTime>.1);
 await q.locator('#artworkPlayback').click({force:true});await q.mouse.click(10,500);assert(await q.evaluate(()=>window.siteVisualMotionPaused&&document.querySelector('#video').paused));
 await q.locator('#artworkPlayback').click({force:true});await q.waitForFunction(()=>!document.querySelector('#video').paused);
 await q.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});
 assert(await q.evaluate(()=>document.querySelector('#video').paused));
 await q.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))});
 await q.waitForFunction(()=>!document.querySelector('#video').paused);await pendingVisibility(q);assert.deepEqual(errors,[]);await q.close();
 console.log(`${name}: delayed startup, rapid transport, reduced motion and visibility passed`);
}
async function failures(browser){
 const p=await browser.newPage();let manifests=0,drums=0,failAudio=true;
 await p.addInitScript(()=>{window.audioLoads=0;const load=HTMLMediaElement.prototype.load;HTMLMediaElement.prototype.load=function(){if(this.id==='audio')audioLoads++;return load.call(this)}});
 await p.route('**/soundtrack.json*',r=>++manifests===1?r.fulfill({status:503,body:'unavailable'}):r.fulfill({json:collection}));
 await p.route('**/drum-samples.json*',r=>++drums===1?r.fulfill({status:503,body:'unavailable'}):r.continue());
 await p.route('**/*.m4a*',r=>failAudio?r.abort('failed'):fulfillAudio(r));
 await p.goto(BASE);await p.waitForFunction(()=>document.querySelector('#musicPlay').dataset.state==='error');await p.locator('#musicPlay').click();await p.waitForTimeout(6200);
 assert.equal(manifests,2);assert.equal(await p.evaluate(()=>audioLoads),3);await p.waitForTimeout(700);assert.equal(await p.evaluate(()=>audioLoads),3);
 failAudio=false;await p.locator('#musicPlay').click();await p.waitForFunction(()=>document.querySelector('#audio').currentTime>.2);
 await p.locator('#drumRefresh').click({force:true});await p.waitForFunction(()=>document.querySelector('#drumMachine').dataset.ready==='true');assert.equal(drums,2);
 await p.locator('#musicPlay').click();await p.waitForTimeout(80);await p.evaluate(()=>{document.querySelector('#audio').dispatchEvent(new Event('error'));window.dispatchEvent(new Event('online'))});await p.waitForTimeout(1200);assert(await p.evaluate(()=>document.querySelector('#audio').paused));await p.close();
 console.log('Recoverable manifests, bounded audio retries and pause intent passed');
 const q=await browser.newPage();await routeAudio(q);await q.route('**/audio-mixer.js*',r=>r.abort('failed'));await q.goto(BASE);if(await q.evaluate(()=>document.querySelector('#audio').paused))await q.locator('#musicPlay').click();await q.waitForFunction(()=>document.querySelector('#audio').currentTime>.1);assert(await q.evaluate(()=>document.querySelectorAll('#overlay .point').length>0));await q.close();console.log('Missing mixer retains artwork and native audio fallback');
}
async function videoFailure(browser){
 const p=await browser.newPage();await routeAudio(p);let fail=true;
 await p.addInitScript(()=>{window.videoLoads=0;const load=HTMLMediaElement.prototype.load;HTMLMediaElement.prototype.load=function(){if(this.id==='video')videoLoads++;return load.call(this)}});
 await p.route('**/tiago-*.mp4*',r=>fail?r.abort('failed'):r.continue());await p.goto(BASE);await p.waitForTimeout(6500);
 assert.equal(await p.evaluate(()=>videoLoads),3);await p.waitForTimeout(600);assert.equal(await p.evaluate(()=>videoLoads),3);
 fail=false;await p.locator('#artworkPlayback').focus();await p.locator('#artworkPlayback').press('Enter');await p.waitForFunction(()=>document.querySelector('#video').currentTime>.1);await p.close();console.log('Progressive video failure retries are bounded; explicit retry succeeds');
}
(async()=>{
 const chrome=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});try{await lifecycle(chrome,'Chromium');await failures(chrome)}finally{await chrome.close()}
 const safari=await webkit.launch(webkitOptions);try{await lifecycle(safari,'WebKit');await videoFailure(safari)}finally{await safari.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
