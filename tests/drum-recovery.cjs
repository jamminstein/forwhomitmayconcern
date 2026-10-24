// Exercise the real drum controller with deterministic samples and mixer timing.
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os');
const base=process.env.BASE_URL||'http://127.0.0.1:8766';
const localWebKit=`${os.homedir()}/Library/Caches/ms-playwright/webkit-2370/pw_run.sh`;
const engines=[['Chromium',chromium,{}],['WebKit',webkit,fs.existsSync(localWebKit)?{executablePath:localWebKit}:{}]];
const kinds=['kick','snare','hat'];
const manifest=Object.fromEntries(kinds.map(kind=>[kind,[`/drum-fixture/one-${kind}`,`/drum-fixture/two-${kind}`]]));
const html='<div id="drumMachine"><button id="drumRefresh">Refresh</button>'+kinds.map(kind=>`<button class="drum-pad" data-drum="${kind}">${kind}</button>`).join('')+'</div><style>button{width:80px;height:50px;margin:8px}</style>';

async function fixture(browser,mode='normal'){
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/__drum_recovery_test.html',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.route('**/audio-mixer.js*',r=>r.fulfill({contentType:'text/javascript',body:'export const getMixer=()=>window.testMixer;'}));
 await page.route('**/drum-samples.json*',r=>r.fulfill({json:manifest}));
 await page.route('**/drum-fixture/*',async r=>{
  const replacement=r.request().url().includes('/two-');
  if(mode==='failed-refresh'&&r.request().url().endsWith('/two-snare')){
   await new Promise(resolve=>setTimeout(resolve,80));return r.fulfill({status:503,body:'unavailable'});
  }
  return r.fulfill({body:Buffer.from([mode.includes('samples')||mode.includes('manifest')||mode.includes('body')?2:replacement?2:1]),contentType:'application/octet-stream'});
 });
 await page.addInitScript(({mode,manifest})=>{
  Math.random=()=>0;
  window.hits=[];window.releaseOld=[];window.releaseDecode=[];window.holdDecode=false;
  window.requests={manifest:0,samples:{}};
  const connection=()=>({connect(){},disconnect(){}});
  window.testMixer={drumGain:connection(),context:{
   state:'running',currentTime:0,resume:()=>Promise.resolve(),
   decodeAudioData:blob=>{const buffer={marker:new Uint8Array(blob)[0]};return window.holdDecode?new Promise(resolve=>releaseDecode.push(()=>resolve(buffer))):Promise.resolve(buffer)},
   createGain:()=>({...connection(),gain:{value:0,cancelScheduledValues(){},setTargetAtTime(){}}}),
   createBufferSource:()=>({...connection(),buffer:null,start(){hits.push(this.buffer.marker)},stop(){this.onended?.()}})
  }};
  const nativeFetch=window.fetch;
  window.fetch=(input,options)=>{
   const url=String(input);
   if(url.includes('drum-samples.json')){
    requests.manifest++;
    if(mode.includes('manifest')&&requests.manifest===1)return new Promise(resolve=>releaseOld.push(()=>resolve(new Response(JSON.stringify(manifest),{headers:{'Content-Type':'application/json'}}))));
   }
   if(url.includes('/drum-fixture/')){
    requests.samples[url]=(requests.samples[url]||0)+1;
    if(requests.samples[url]===1){
     if(mode.includes('samples'))return new Promise(resolve=>releaseOld.push(()=>resolve(new Response(new Uint8Array([1])))));
     if(mode.includes('body'))return Promise.resolve({ok:true,arrayBuffer:()=>new Promise(resolve=>releaseOld.push(()=>resolve(new Uint8Array([1]).buffer)))});
    }
   }
   return nativeFetch(input,options);
  };
  // Advance only the kit deadline in timeout cases; hit expiry stays real time.
  if(mode.startsWith('timeout')){const timer=window.setTimeout;window.setTimeout=(callback,delay,...args)=>timer(callback,delay===12000?300:delay,...args)}
 },{mode,manifest});
 await page.goto(base+'/__drum_recovery_test.html');
 await page.evaluate(()=>import('./drum-machine.js'));
 return {page,errors};
}
const ready=page=>page.waitForFunction(()=>document.querySelector('#drumMachine').dataset.ready==='true'&&!document.querySelector('#drumRefresh').disabled);
const clickPad=(page,kind='kick')=>page.locator(`[data-drum=${kind}]`).evaluate(e=>e.click());
const hitCount=(page,count)=>page.waitForFunction(count=>hits.length===count,count);
const selected=page=>page.evaluate(()=>sessionStorage.getItem('last-drum-kit'));

async function activations(browser){
 const {page,errors}=await fixture(browser);await ready(page);
 await clickPad(page);await hitCount(page,1);
 await page.locator('[data-drum=kick]').click();await hitCount(page,2);
 await page.locator('[data-drum=snare]').focus();await page.keyboard.press('Enter');await hitCount(page,3);
 await page.keyboard.press('Space');await hitCount(page,4);
 await page.keyboard.down('Enter');await page.keyboard.down('Enter');await page.keyboard.up('Enter');await hitCount(page,5);
 for(const key of ['j','k','l'])await page.keyboard.press(key);
 await hitCount(page,8);
 await page.waitForTimeout(20);
 await page.locator('[data-drum=hat]').evaluate(pad=>{
  for(const modifier of ['metaKey','ctrlKey','altKey'])for(const key of ['j','k','l','Enter',' ']){
   pad.dispatchEvent(new KeyboardEvent('keydown',{key,[modifier]:true,bubbles:true,cancelable:true}));
   if(key==='Enter'||key===' ')pad.dispatchEvent(new MouseEvent('click',{[modifier]:true,bubbles:true,cancelable:true}));
  }
  for(const key of ['j','Enter']){const event=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true});event.preventDefault();pad.dispatchEvent(event)}
 });
 await page.waitForTimeout(20);assert.equal(await page.evaluate(()=>hits.length),8,'Modified or already-handled keys must not trigger pads');
 await page.locator('[data-drum=hat]').evaluate(pad=>{
  pad.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  pad.click();
  window.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true}));
 });
 await hitCount(page,9);
 await page.waitForTimeout(20);
 await page.locator('[data-drum=kick]').evaluate(pad=>{
  pad.dispatchEvent(new PointerEvent('pointerdown',{button:0,pointerId:42,bubbles:true,cancelable:true}));
  pad.click();
  window.dispatchEvent(new PointerEvent('pointerup',{pointerId:42,bubbles:true}));
 });
 await hitCount(page,10);await page.waitForTimeout(50);
 assert.equal(await page.evaluate(()=>hits.length),10,'Pointer and keyboard follow-up clicks must not double the sound');
 assert.deepEqual(errors,[]);await page.close();
}

async function supersededLoad(browser,mode){
 const {page,errors}=await fixture(browser,mode);
 await page.waitForFunction(()=>releaseOld.length>0);
 await clickPad(page);assert.equal(await page.evaluate(()=>hits.length),0,'A missing kit must not queue a future hit');
 if(mode.startsWith('timeout'))await page.waitForFunction(()=>document.querySelector('#drumMachine').dataset.ready==='false');
 await page.locator('#drumRefresh').click();await ready(page);
 const kit=await selected(page);
 await clickPad(page);await hitCount(page,1);assert.deepEqual(await page.evaluate(()=>hits),[2]);
 await page.evaluate(()=>releaseOld.splice(0).forEach(release=>release()));
 await page.waitForTimeout(60);
 assert.equal(await selected(page),kit,'An aborted initial request cannot publish its kit later');
 assert.equal(await page.evaluate(()=>hits.length),1,'Old loading gestures must not fire after readiness');
 for(const kind of kinds)await clickPad(page,kind);
 await hitCount(page,4);assert.deepEqual(await page.evaluate(()=>hits),[2,2,2,2]);
 assert.equal(await page.evaluate(()=>requests.manifest),mode.includes('manifest')?2:1);
 assert.deepEqual(errors,[]);await page.close();
}

async function failedRefresh(browser){
 const {page,errors}=await fixture(browser,'failed-refresh');await ready(page);
 const initial=await selected(page);
 await page.locator('#drumRefresh').click();
 await clickPad(page);await hitCount(page,1);
 await page.waitForFunction(()=>!document.querySelector('#drumRefresh').disabled);
 assert.equal(await page.locator('#drumMachine').getAttribute('data-ready'),'true');
 assert.equal(await selected(page),initial,'A failed replacement must preserve the complete previous kit');
 for(const kind of kinds)await clickPad(page,kind);
 await hitCount(page,4);assert.deepEqual(await page.evaluate(()=>hits),[1,1,1,1]);
 assert.deepEqual(errors,[]);await page.close();
}

async function expiredHit(browser){
 const {page,errors}=await fixture(browser);await ready(page);
 await page.evaluate(()=>{holdDecode=true});await clickPad(page);
 await page.waitForFunction(()=>releaseDecode.length===3);await page.waitForTimeout(350);
 await page.evaluate(()=>{holdDecode=false;releaseDecode.splice(0).forEach(release=>release())});
 await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>hits.length),0,'A late decoder must not play an expired hit');
 await clickPad(page);await hitCount(page,1);
 assert.deepEqual(errors,[]);await page.close();
}

async function decodeDeadline(browser){
 const {page,errors}=await fixture(browser,'timeout-decode');await ready(page);
 await clickPad(page);await hitCount(page,1);const original=await selected(page);
 await page.evaluate(()=>{holdDecode=true});await page.locator('#drumRefresh').click();
 await page.waitForFunction(()=>releaseDecode.length===3);
 await clickPad(page);await hitCount(page,2);
 await page.waitForFunction(()=>!document.querySelector('#drumRefresh').disabled);
 assert.equal(await selected(page),original,'Decode timeout must preserve the previous playable kit');
 await page.evaluate(()=>{holdDecode=false;releaseDecode.splice(0).forEach(release=>release())});
 await page.waitForTimeout(50);assert.equal(await selected(page),original,'Late decoded replacement must not overwrite the previous kit');
 await clickPad(page);await hitCount(page,3);assert.deepEqual(await page.evaluate(()=>hits),[1,1,1]);
 assert.deepEqual(errors,[]);await page.close();
}

(async()=>{
 for(const [name,type,options] of engines){
  const browser=await type.launch(options);
  try{
   await activations(browser);
   for(const mode of ['held-manifest','held-samples','timeout-manifest','timeout-samples','timeout-body'])await supersededLoad(browser,mode);
   await failedRefresh(browser);await expiredHit(browser);await decodeDeadline(browser);
   console.log(`${name}: drum activation, superseded/timed-out loading, atomic replacement, and expired hits passed`);
  }finally{await browser.close()}
 }
})().catch(error=>{console.error(error);process.exitCode=1});
