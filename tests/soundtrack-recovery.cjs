// Focused native-media regressions; all music is a generated local WAV fixture.
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os');
const BASE=process.env.BASE_URL||'http://127.0.0.1:8766';
const localWebKit=`${os.homedir()}/Library/Caches/ms-playwright/webkit-2370/pw_run.sh`;
const webkitOptions=fs.existsSync(localWebKit)?{executablePath:localWebKit}:{};
function tone(silence=0){
 const rate=22050,n=rate*20,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);
 for(let i=Math.ceil(rate*silence);i<n;i++)b.writeInt16LE(Math.round(Math.sin(i/rate*Math.PI*440)*.08*32767),44+i*2);return b;
}
const songs=[11827,11774,10598].map(id=>({name:`Acervo / ${id}`,url:`${BASE}/soundtrack-fixture/${id}.m4a`}));
const buttons=['musicPlay','audioPlay','musicPrev','musicNext','prevTrack','nextTrack','musicAdd','addSongs'];
const harness=`<!doctype html><html><body><button id="gesture">Activate audio</button><div class="glass-dock">${buttons.map(id=>`<button id="${id}">${id}</button>`).join('')}</div><span id="currentSongId"></span><span id="songLabel"></span><span id="audioStatus"></span><span id="trackCount"></span><span id="audioTime"></span><svg><path id="musicPlaySketch"/><g id="volumeKnob"/></svg><input id="audioSeek" type="range"><input id="soundtrackVolume" type="range" min="0" max="1" step=".01"><input id="volume" type="range" min="0" max="1" step=".01"><input id="audioFiles" type="file"><audio id="audio" preload="metadata"></audio><div id="drumMachine"><button id="drumRefresh">New kit</button>${['kick','snare','hat'].map(kind=>`<button class="drum-pad" data-drum="${kind}">${kind}</button>`).join('')}</div><script type="module">import {initializeSoundtrack} from './soundtrack.js';window.soundtrack=initializeSoundtrack();window.soundtrackInitialized=true;</script><script type="module" src="./drum-machine.js"></script></body></html>`;
async function setup(browser,{silence=0,delay=false,hold=false}={}){
 const p=await browser.newPage();p.setDefaultTimeout(8000);let mixerURL;
 p.on('request',request=>{if(new URL(request.url()).pathname.endsWith('/audio-mixer.js'))mixerURL=request.url()});
 await p.route('**/__soundtrack-recovery.html',r=>r.fulfill({body:harness,contentType:'text/html'}));
 await p.route('**/soundtrack.json*',r=>r.fulfill({json:songs}));
 await p.route('**/drum-samples.json*',r=>r.fulfill({json:Object.fromEntries(['kick','snare','hat'].map(kind=>[kind,[BASE+'/drum-fixture/'+kind+'.wav']]))}));
 await p.route('**/drum-fixture/*.wav',r=>r.fulfill({body:tone(),contentType:'audio/wav'}));
 let release;const gate=delay?new Promise(resolve=>{release=resolve}):Promise.resolve();
 await p.route('**/soundtrack-fixture/*.m4a*',async r=>{await gate;await r.fulfill({body:tone(silence),contentType:'audio/wav'}).catch(()=>{})});
 await p.addInitScript(({hold})=>{
  window.fades=[];window.audioLoads=0;window.chooserClicks=0;window.heldPlays=[];window.armPlayHold=hold;window.playCalls=0;
  let fade;Object.defineProperty(window,'fadeSiteMusic',{configurable:true,get:()=>fade,set:fn=>{fade=(target,seconds)=>{window.fades.push({target,seconds,mediaTime:audio.currentTime,ready:audio.readyState,pcm:window.siteMusicSignalReady});return fn(target,seconds)}}});
  const play=HTMLMediaElement.prototype.play,load=HTMLMediaElement.prototype.load,click=HTMLInputElement.prototype.click;
  HTMLMediaElement.prototype.play=function(){const result=play.call(this);if(this.id!=='audio')return result;playCalls++;return result.then(()=>{if(!armPlayHold)return;armPlayHold=false;return new Promise((resolve,reject)=>heldPlays.push({resolve,reject}))})};
  HTMLMediaElement.prototype.load=function(){if(this.id==='audio')audioLoads++;return load.call(this)};
  HTMLInputElement.prototype.click=function(){if(this.id==='audioFiles'){chooserClicks++;return}return click.call(this)};
 },{hold});
 await p.goto(BASE+'/__soundtrack-recovery.html',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>window.soundtrackInitialized&&window.siteAudioContext);
 await p.locator('#gesture').click();
 await p.waitForFunction(()=>window.siteAudioContext.state==='running');
 return {p,release,mixerURL};
}
async function openingFade(browser,name){
 const {p,release,mixerURL}=await setup(browser,{silence:1.5,delay:true});
 await p.waitForFunction(()=>!audio.paused);
 // Longer than the complete opening fade, with no media data available yet.
 await p.waitForTimeout(3700);
 assert.deepEqual(await p.evaluate(()=>({time:audio.currentTime,ready:audio.readyState,fades:fades.length})),{time:0,ready:0,fades:0});
 // Check rendered output from an actual pad, not merely a running AudioContext.
 await p.evaluate(async url=>{window.drumAnalyser=(await import(url)).getMixer().analyser;window.drumSamples=new Float32Array(drumAnalyser.fftSize)},mixerURL);
 await p.locator('[data-drum=kick]').click();
 await p.waitForFunction(()=>{drumAnalyser.getFloatTimeDomainData(drumSamples);return drumSamples.some(value=>Math.abs(value)>.005)});
 assert.equal(await p.evaluate(()=>audio.readyState),0,`${name}: drums must work before the song loads`);
 release();await p.waitForFunction(()=>audio.currentTime>.25);
 assert.equal(await p.evaluate(()=>fades.length),0,`${name}: a silent intro must not consume the fade`);
 await p.waitForFunction(()=>fades.length===1);
 const fade=await p.evaluate(()=>fades[0]);assert(fade.mediaTime>=1.45&&fade.ready>=2&&fade.pcm===true);assert.equal(fade.seconds,3.5);
 await p.close();
 // Explicit volume selected while loading must not be replaced by a new fade.
 const chosen=await setup(browser,{delay:true});
 await chosen.p.locator('#soundtrackVolume').evaluate(el=>{el.value='.17';el.dispatchEvent(new Event('input',{bubbles:true}))});
 chosen.release();await chosen.p.waitForFunction(()=>audio.currentTime>.2&&window.siteMusicSignalReady);
 assert.equal(await chosen.p.evaluate(()=>fades.length),0);assert.equal(await chosen.p.evaluate(()=>window.siteMixLevel),.17);
 await chosen.p.close();console.log(`${name}: delayed media, silent intro and chosen volume passed`);
}
async function pendingRecovery(browser,name,reject){
 const {p}=await setup(browser,{hold:true});await p.waitForFunction(()=>heldPlays.length===1&&audio.currentTime>.1);
 await p.evaluate(()=>{
  audio.pause();Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
  Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
 });
 assert.equal(await p.locator('#musicPlay').getAttribute('aria-label'),'Play music');
 const calls=await p.evaluate(()=>playCalls);await p.locator('#musicPlay').click();
 await p.waitForFunction(()=>!audio.paused&&audio.currentTime>.2);assert.equal(await p.evaluate(()=>playCalls),calls+1,`${name}: one explicit play must supersede the held request`);
 await p.locator('#musicPlay').click();await p.waitForFunction(()=>audio.paused);
 const loads=await p.evaluate(()=>audioLoads);
 await p.evaluate(reject=>{const held=heldPlays[0];if(reject)held.reject(new DOMException('Old failed request','NotSupportedError'));else held.resolve()},reject);
 await p.waitForTimeout(100);assert(await p.evaluate(()=>audio.paused&&document.querySelector('#musicPlay').dataset.state!=='error'));assert.equal(await p.evaluate(()=>audioLoads),loads);
 // Another old promise must not report an error against a newer selected song.
 await p.evaluate(()=>{armPlayHold=true});await p.locator('#musicPlay').click();await p.waitForFunction(()=>heldPlays.length===2);
 const previous=await p.evaluate(()=>audio.src);await p.locator('#musicNext').click();
 await p.waitForFunction(previous=>audio.src!==previous&&!audio.paused&&audio.currentTime>.1,previous);
 const selected=await p.evaluate(()=>({src:audio.src,loads:audioLoads}));
 await p.evaluate(reject=>{const held=heldPlays[1];if(reject)held.reject(new DOMException('Obsolete track request','NotSupportedError'));else held.resolve()},reject);
 await p.waitForTimeout(100);assert.deepEqual(await p.evaluate(()=>({src:audio.src,loads:audioLoads})),selected);assert(await p.evaluate(()=>!audio.paused&&document.querySelector('#musicPlay').dataset.state!=='error'));
 // Latest pause wins during the outgoing fade and pending selection.
 await p.evaluate(()=>{document.querySelector('#musicNext').click();document.querySelector('#musicPlay').click()});
 await p.waitForFunction(()=>audio.paused&&audio.src.includes('/'+document.querySelector('#currentSongId').dataset.songId+'.m4a'));
 // A quick pause/resume must cancel the deferred pause, not end up silent.
 await p.locator('#musicPlay').click();await p.waitForFunction(()=>!audio.paused);
 await p.evaluate(()=>{document.querySelector('#musicPlay').click();document.querySelector('#musicPlay').click()});
 const time=await p.evaluate(()=>audio.currentTime);await p.waitForFunction(time=>!audio.paused&&audio.currentTime>time+.15,time);
 await p.close();console.log(`${name}: held play ${reject?'rejection':'resolution'}, pause/next and rapid intent passed`);
}
async function shortcuts(browser,name){
 const {p}=await setup(browser);await p.waitForFunction(()=>audio.currentTime>.1);
 const before=await p.evaluate(()=>({src:audio.src,loads:audioLoads,chooser:chooserClicks}));
 await p.evaluate(()=>{
  for(const key of ['a','ArrowLeft','ArrowRight'])for(const modifier of ['metaKey','ctrlKey','altKey'])document.body.dispatchEvent(new KeyboardEvent('keydown',{key,[modifier]:true,bubbles:true,cancelable:true}));
  for(const key of ['a','ArrowLeft','ArrowRight']){const event=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true});event.preventDefault();document.body.dispatchEvent(event)}
  document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',repeat:true,bubbles:true}));
 });
 assert.deepEqual(await p.evaluate(()=>({src:audio.src,loads:audioLoads,chooser:chooserClicks})),before);
 await p.evaluate(()=>document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'a',bubbles:true})));
 assert.equal(await p.evaluate(()=>chooserClicks),before.chooser+1);
 await p.evaluate(()=>document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));
 await p.waitForFunction(src=>audio.src!==src,before.src);await p.close();console.log(`${name}: browser shortcuts and prevented/repeated keys passed`);
}
(async()=>{
 for(const [name,type,options] of [['Chromium',chromium,{args:['--autoplay-policy=no-user-gesture-required']}],['WebKit',webkit,webkitOptions]]){
  const browser=await type.launch(options);try{await openingFade(browser,name);await pendingRecovery(browser,name,false);await pendingRecovery(browser,name,true);await shortcuts(browser,name)}finally{await browser.close()}
 }
})().catch(error=>{console.error(error);process.exitCode=1});
