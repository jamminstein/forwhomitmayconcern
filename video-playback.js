import {createArtworkSource} from './video-source.js';

const video=document.querySelector('#video'),stage=document.querySelector('.stage-wrap'),button=document.querySelector('#artworkPlayback');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let userPaused=false,allowed=!reduced.matches,initialConsent=!reduced.matches,pending=false,restartRequested=false,retries=0,retryTimer=0;
let playAttempt=0,pendingSince=0,policyBlocked=false,automaticStopped=false,nativePauses=0,pauseTimer=0,steadyPlaybackSince=0,hungAttempts=0;
let autoplayProbes=0,autoplayTimer=0;
let lastProgress=performance.now(),lastTime=0,recoveryBaseline=0;
const mayPlay=()=>allowed&&!userPaused&&!document.hidden;
video.muted=true;video.defaultMuted=true;video.playsInline=true;video.autoplay=false;
video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');
video.removeAttribute('autoplay');video.preload=allowed?'auto':'none';
const source=createArtworkSource(video,{ready:start,failed:scheduleRecovery,mayLoad:mayPlay});
function publish(){
 const paused=!allowed||userPaused;
 window.siteVisualMotionPaused=paused;document.documentElement.dataset.motionPaused=String(paused);
 if(button){button.dataset.state=paused?'paused':'running';button.setAttribute('aria-pressed',String(paused));button.setAttribute('aria-label',button.dataset.unavailable==='true'?'Retry artwork playback':paused?'Resume visual motion':'Pause visual motion')}
 window.dispatchEvent(new CustomEvent('site-motion-change',{detail:{paused}}));
}
function unavailable(state){
 video.dataset.playback=state;
 if(button){button.dataset.unavailable='true';publish()}
}
function scheduleAutoplayProbe(){
 // Safari can reject a request made before media/layout readiness. A few
 // delayed, ready-state probes distinguish that from a persistent policy block.
 if(!policyBlocked||!mayPlay()||automaticStopped||video.readyState<2||autoplayTimer||autoplayProbes>=3)return;
 autoplayTimer=setTimeout(()=>{
  autoplayTimer=0;
  if(mayPlay()&&policyBlocked&&!automaticStopped&&video.readyState>=2){autoplayProbes++;policyBlocked=false;start()}
 },500*2**autoplayProbes);
}
async function start(gesture=false,retry=false){
 if(!mayPlay()||((policyBlocked||automaticStopped)&&!gesture))return;
 if(gesture){policyBlocked=false;if(automaticStopped){nativePauses=0;hungAttempts=0}automaticStopped=false}
 const superseding=retry||(gesture&&pending);
 // Preserve a newer resume intent while an earlier play/load promise settles.
 // A real gesture must also be able to replace a play promise Safari left pending.
 if(pending&&!gesture&&!retry){restartRequested=true;return}
 if(!superseding&&!video.paused&&!video.ended&&video.readyState>=2)return;
 const attempt=++playAttempt;
 pending=true;pendingSince=performance.now();video.muted=true;let mayDrain=true;
 try{
  // Once the source exists, call play in the gesture's own stack. Awaiting
  // delivery first can lose Safari's user-activation opportunity.
  if(source.initialized)source.resumeLoading().catch(scheduleRecovery);
  else await source.resumeLoading();
  if(attempt!==playAttempt||!mayPlay()||!source.initialized)return;
  if(!superseding&&!video.paused&&!video.ended)return;
  await video.play();
  if(!mayPlay())video.pause();
  if(attempt!==playAttempt)return;
  video.dataset.playResult='resolved';
 }catch(error){
  if(attempt!==playAttempt)return;
  // A pause interrupts play with AbortError. Policy/network failures must keep
  // their existing gesture or bounded-recovery path instead of retrying here.
  mayDrain=error.name==='AbortError';
  video.dataset.playResult=error.name+': '+error.message;
  if(error.name==='NotAllowedError'&&!video.error){policyBlocked=true;clearRecovery();unavailable('needs-tap');scheduleAutoplayProbe()}
  else video.dataset.playback='waiting';
  if(video.error||(error.name!=='NotAllowedError'&&error.name!=='AbortError'))scheduleRecovery();
 }finally{
  if(attempt===playAttempt){
   pending=false;const requested=restartRequested;restartRequested=false;
   if(requested&&mayDrain&&mayPlay()&&video.paused)queueMicrotask(()=>start());
  }
 }
}
function clearRecovery(){clearTimeout(retryTimer);retryTimer=0;clearTimeout(pauseTimer);pauseTimer=0;clearTimeout(autoplayTimer);autoplayTimer=0}
function scheduleRecovery(){
 // An actual media failure still gets its bounded source retries, even if an
 // earlier play request was also rejected before the broken source was ready.
 if(video.error)policyBlocked=false;
 if(policyBlocked||automaticStopped)return;
 video.dataset.playback='error';if(button){button.dataset.unavailable='true';button.setAttribute('aria-label','Retry artwork playback')}
 if(!mayPlay()||source.custom||retryTimer||retries>=2||navigator.onLine===false)return;
 const delay=1000*2**retries++;recoveryBaseline=video.currentTime||0;
 retryTimer=setTimeout(()=>{retryTimer=0;if(mayPlay()&&!policyBlocked&&!automaticStopped){source.reload();lastProgress=performance.now();start()}},delay);
}
function pause(){userPaused=true;clearRecovery();video.pause();source.pauseLoading();publish()}
function resume(){userPaused=false;allowed=true;initialConsent=true;retries=0;nativePauses=0;hungAttempts=0;autoplayProbes=0;clearRecovery();publish();if(video.error)source.reload();start(true)}
function toggle(){if(userPaused||!allowed||video.error||button?.dataset.unavailable==='true')resume();else pause()}
button?.addEventListener('click',toggle);
document.querySelector('#videoPlay')?.addEventListener('click',toggle);
for(const event of ['loadedmetadata','loadeddata','canplay','canplaythrough'])video.addEventListener(event,()=>{if(mayPlay()){start();scheduleAutoplayProbe()}});
video.addEventListener('playing',()=>{if(!mayPlay()){video.pause();return}policyBlocked=false;automaticStopped=false;video.dataset.playback='playing';if(button){button.dataset.unavailable='false';publish()}lastProgress=steadyPlaybackSince=performance.now();clearRecovery()});
// Safari may pause muted media itself after the first frame. Retry briefly
// without reloading the file, but never override pause intent or a policy block.
video.addEventListener('pause',()=>{
 if(!mayPlay()||policyBlocked||automaticStopped||video.error||pauseTimer)return;
 if(nativePauses>=2){automaticStopped=true;unavailable('needs-tap');return}
 nativePauses++;
 pauseTimer=setTimeout(()=>{pauseTimer=0;if(mayPlay()&&video.paused)start()},250);
});
video.addEventListener('error',scheduleRecovery);
video.addEventListener('timeupdate',()=>{if(video.currentTime!==lastTime){lastProgress=performance.now();lastTime=video.currentTime;if(video.currentTime-recoveryBaseline>5)retries=0;if(!video.paused&&lastProgress-steadyPlaybackSince>5000){nativePauses=0;hungAttempts=0}}});
// Initial reduced-motion consent belongs to the artwork, never an unrelated click.
for(const event of ['pointerdown','keydown'])stage?.addEventListener(event,e=>{
 if(e.target.closest?.('#artworkPlayback,#videoPlay'))return;
 if(e.type==='keydown'&&!['Enter','Space'].includes(e.code))return;
 if(!initialConsent||video.error){resume();return}
 if(!userPaused)start(true);
},{capture:true,passive:true});
// Normal autoplay can retry on a gesture; an explicit pause always takes precedence.
for(const event of ['pointerdown','touchend','click','keydown'])window.addEventListener(event,e=>{
 if(e.target.closest?.('#artworkPlayback,#videoPlay'))return;
 if(e.type==='keydown'&&(e.repeat||e.metaKey||e.ctrlKey||e.altKey))return;
 if(initialConsent&&!userPaused)start(true);
},{capture:true,passive:true});
function visibility(){
 if(document.hidden){clearRecovery();video.pause();source.pauseLoading()}
 else{lastProgress=performance.now();if(mayPlay()){start();scheduleAutoplayProbe()}}
}
document.addEventListener('visibilitychange',visibility);window.addEventListener('pageshow',visibility);
window.addEventListener('pagehide',()=>{clearRecovery();video.pause();source.pauseLoading()});
window.addEventListener('online',()=>{if(mayPlay()){retries=0;if(video.error)source.reload();start()}});
reduced.addEventListener('change',()=>{if(reduced.matches){allowed=false;initialConsent=false;video.pause();source.pauseLoading();publish()}else if(!userPaused){allowed=true;initialConsent=true;publish();start()}});
window.loadSiteArtwork=file=>{source.loadFile(file);resume()};
setInterval(()=>{
 if(!mayPlay()||policyBlocked||automaticStopped)return;
 if(pending&&performance.now()-pendingSince>10000){
  // Retry an abandoned promise without reloading the media. Keep this bounded,
  // and leave a usable play control if Safari still cannot start by itself.
  playAttempt++;pending=false;restartRequested=false;
  if(hungAttempts++<2)start(false,true);else{automaticStopped=true;unavailable('needs-tap')}
 }
 if(!video.paused&&video.readyState<3&&performance.now()-lastProgress>15000)scheduleRecovery();
},5000);
// Early Safari play requests can precede its ready state; keep this finite.
let attempts=0;const startup=setInterval(()=>{if(video.currentTime>0||++attempts>=24){clearInterval(startup);return}if(mayPlay())start()},250);
publish();if(mayPlay())start();
