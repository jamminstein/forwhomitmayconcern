// Isolated visual scheduling checks; no video decoding or audio playback needed.
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os');
const BASE=process.env.BASE_URL||'http://127.0.0.1:8766';
const localWebKit=`${os.homedir()}/Library/Caches/ms-playwright/webkit-2370/pw_run.sh`;
const webkitOptions=fs.existsSync(localWebKit)?{executablePath:localWebKit}:{};
const harness=`<!doctype html><html><head><link id="doodleFavicon" rel="icon" href="favicon.png"></head><body><a id="musicWaveform" href="https://jamminstein.github.io/acervo-public/"><svg><path d="M2 14 L62 14"/></svg></a><audio id="audio"></audio><div id="workCredits"><span id="workCreditsLabel"></span><img id="currentBrand"><span id="currentPerson"></span></div><script type="module">import './waveform.js';import './favicon.js';import './brand-strip.js';window.idleHarnessReady=true;</script></body></html>`;
async function inspect(page){return page.evaluate(()=>({raf:visualCounts.raf,timers:visualCounts.timers,pending:pendingFrames.size,path:document.querySelector('#musicWaveform path').getAttribute('d'),icon:document.querySelector('#doodleFavicon').href,brand:document.querySelector('#workCredits').dataset.brand}))}
async function motion(page,paused){await page.evaluate(paused=>{window.siteVisualMotionPaused=paused;window.dispatchEvent(new CustomEvent('site-motion-change',{detail:{paused}}))},paused)}
async function run(browser,name){
 const p=await browser.newPage();await p.clock.install({time:new Date('2026-01-01T00:00:00Z')});await p.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
 await p.route('**/__waveform-idle.html',r=>r.fulfill({body:harness,contentType:'text/html'}));
 await p.route('**/audio-mixer.js*',r=>r.fulfill({contentType:'text/javascript',body:'export function getOutputAnalyser(){return window.waveAnalyser}'}));
 await p.route('**/handwriting.js*',r=>r.fulfill({contentType:'text/javascript',body:"export function drawWriting(text){const node=document.createElement('span');node.textContent=text;return node}"}));
 await p.addInitScript(()=>{
  window.siteVisualMotionPaused=false;window.musicPlaying=false;window.waveSignal=false;
  window.waveAnalyser={getByteTimeDomainData(samples){samples.fill(128);if(window.waveSignal)for(let i=0;i<samples.length;i++)samples[i]=i%2?150:105}};
  window.visualCounts={raf:0,timers:0};window.pendingFrames=new Set();
  const raf=window.requestAnimationFrame,cancel=window.cancelAnimationFrame,timeout=window.setTimeout,interval=window.setInterval;
  window.requestAnimationFrame=callback=>{const id=raf(now=>{pendingFrames.delete(id);visualCounts.raf++;callback(now)});pendingFrames.add(id);return id};
  window.cancelAnimationFrame=id=>{pendingFrames.delete(id);cancel(id)};
  window.setTimeout=(callback,delay,...args)=>timeout(()=>{visualCounts.timers++;callback(...args)},delay);
  window.setInterval=(callback,delay,...args)=>interval(()=>{visualCounts.timers++;callback(...args)},delay);
  document.addEventListener('DOMContentLoaded',()=>Object.defineProperty(document.querySelector('#audio'),'paused',{get:()=>!window.musicPlaying}));
 });
 await p.goto(BASE+'/__waveform-idle.html');assert(await p.evaluate(()=>window.idleHarnessReady));
 await p.clock.runFor(400);const initial=await inspect(p);
 assert.equal(initial.raf,0,`${name}: a silent resting trace must not queue frames`);assert.equal(initial.pending,0);
 // Pausing preserves the remaining time to the next icon and brand changes.
 await motion(p,true);const paused=await inspect(p);await p.clock.runFor(6000);
 assert.deepEqual(await inspect(p),paused,`${name}: paused visuals must freeze without timer/RAF callbacks`);
 await motion(p,false);await p.clock.runFor(599);assert.equal((await inspect(p)).icon,initial.icon);
 await p.clock.runFor(1);assert.notEqual((await inspect(p)).icon,initial.icon);
 await p.clock.runFor(1599);assert.equal((await inspect(p)).brand,'spacex');
 await p.clock.runFor(1);assert.equal((await inspect(p)).brand,'nike',`${name}: rotation resumes at its prior phase and next entry`);
 // Music wakes the existing scribble. A visual pause also blocks music/hit wakes.
 await p.evaluate(()=>{musicPlaying=true;waveSignal=true;audio.dispatchEvent(new Event('playing'))});
 await p.clock.runFor(150);const active=await inspect(p);assert(active.raf>0&&active.path!==initial.path);
 await motion(p,true);const frozen=await inspect(p);
 await p.evaluate(()=>{audio.dispatchEvent(new Event('playing'));audio.dispatchEvent(new Event('timeupdate'));window.dispatchEvent(new Event('site-drum-hit'))});
 await p.clock.runFor(6000);assert.deepEqual(await inspect(p),frozen);
 await motion(p,false);await p.clock.runFor(150);assert((await inspect(p)).raf>frozen.raf);
 // Hidden pages stop all three schedulers and resume when visible again.
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});
 const hidden=await inspect(p);await p.clock.runFor(6000);assert.deepEqual(await inspect(p),hidden);
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))});
 await p.clock.runFor(150);assert((await inspect(p)).raf>hidden.raf);
 // Keep the original sampling cadence through a musical rest. The next note
 // must appear without waiting for the comparatively infrequent timeupdate.
 await p.evaluate(()=>{waveSignal=false});await p.clock.runFor(500);const gap=await inspect(p);
 await p.evaluate(()=>{waveSignal=true});await p.clock.runFor(70);
 const note=await inspect(p);assert(note.raf>gap.raf&&note.path!==gap.path,`${name}: notes following a silent gap remain responsive`);
 // After an audible tail settles, even repeated silent media events queue no RAF.
 await p.evaluate(()=>{waveSignal=false;musicPlaying=false;audio.dispatchEvent(new Event('pause'))});
 await p.clock.runFor(2000);const silent=await inspect(p);assert.equal(silent.pending,0);
 await p.evaluate(()=>{for(let i=0;i<8;i++)audio.dispatchEvent(new Event('timeupdate'))});await p.clock.runFor(1000);
 assert.equal((await inspect(p)).raf,silent.raf);assert.equal((await inspect(p)).path,initial.path);
 // Actual sample-start notification must allow a render quantum before sampling.
 await p.evaluate(()=>window.dispatchEvent(new Event('site-drum-hit')));await p.clock.runFor(16);
 await p.evaluate(()=>{waveSignal=true});await p.clock.runFor(100);
 const hit=await inspect(p);assert(hit.raf>silent.raf&&hit.path!==initial.path,`${name}: a drum hit wakes the waveform with music paused`);
 await p.evaluate(()=>{waveSignal=false});await p.clock.runFor(2000);assert.equal((await inspect(p)).pending,0);
 // Reduced motion applies independently to the waveform, and by default to icons.
 await p.evaluate(()=>{window.siteVisualMotionPaused=undefined;window.reducedChanged=new Promise(resolve=>matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>resolve(),{once:true}))});
 await p.emulateMedia({reducedMotion:'reduce'});await p.evaluate(()=>window.reducedChanged);
 const reduced=await inspect(p);await p.evaluate(()=>{waveSignal=true;window.dispatchEvent(new Event('site-drum-hit'));audio.dispatchEvent(new Event('playing'))});
 await p.clock.runFor(6000);assert.deepEqual(await inspect(p),reduced);
 assert.equal(await p.locator('#musicWaveform').getAttribute('href'),'https://jamminstein.github.io/acervo-public/');
 await p.close();console.log(`${name}: silent/paused/hidden/reduced callbacks stop; music/drums and timer phase resume`);
}
(async()=>{for(const [name,type,options] of [['Chromium',chromium,{}],['WebKit',webkit,webkitOptions]]){const browser=await type.launch(options);try{await run(browser,name)}finally{await browser.close()}}})().catch(error=>{console.error(error);process.exitCode=1});
