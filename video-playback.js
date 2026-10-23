import {createArtworkSource} from './video-source.js';

const video=document.querySelector('#video'),stage=document.querySelector('.stage-wrap'),button=document.querySelector('#artworkPlayback');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let userPaused=false,allowed=!reduced.matches,initialConsent=!reduced.matches,pending=false,retries=0,retryTimer=0;
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
async function start(){
 if(!mayPlay()||pending||(!video.paused&&!video.ended&&video.readyState>=2))return;
 pending=true;video.muted=true;
 try{
  await source.resumeLoading();
  if(!mayPlay()||!source.initialized)return;
  if(!video.paused&&!video.ended)return;
  await video.play();video.dataset.playResult='resolved';
  if(!mayPlay())video.pause();
 }catch(error){
  video.dataset.playResult=error.name+': '+error.message;
  video.dataset.playback=error.name==='NotAllowedError'?'needs-tap':'waiting';
  if(error.name!=='NotAllowedError'&&error.name!=='AbortError')scheduleRecovery();
 }finally{pending=false}
}
function clearRecovery(){clearTimeout(retryTimer);retryTimer=0}
function scheduleRecovery(){
 video.dataset.playback='error';if(button){button.dataset.unavailable='true';button.setAttribute('aria-label','Retry artwork playback')}
 if(!mayPlay()||source.custom||retryTimer||retries>=2||navigator.onLine===false)return;
 const delay=1000*2**retries++;recoveryBaseline=video.currentTime||0;
 retryTimer=setTimeout(()=>{retryTimer=0;if(mayPlay()){source.reload();lastProgress=performance.now();start()}},delay);
}
function pause(){userPaused=true;clearRecovery();video.pause();source.pauseLoading();publish()}
function resume(){userPaused=false;allowed=true;initialConsent=true;retries=0;clearRecovery();publish();if(video.error)source.reload();start()}
function toggle(){if(userPaused||!allowed||video.error)resume();else pause()}
button?.addEventListener('click',toggle);
document.querySelector('#videoPlay')?.addEventListener('click',toggle);
for(const event of ['loadedmetadata','loadeddata','canplay','canplaythrough'])video.addEventListener(event,()=>{if(mayPlay())start()});
video.addEventListener('playing',()=>{if(!mayPlay()){video.pause();return}video.dataset.playback='playing';if(button){button.dataset.unavailable='false';publish()}lastProgress=performance.now();clearRecovery()});
video.addEventListener('error',scheduleRecovery);
video.addEventListener('timeupdate',()=>{if(video.currentTime!==lastTime){lastProgress=performance.now();lastTime=video.currentTime;if(video.currentTime-recoveryBaseline>5)retries=0}});
// Initial reduced-motion consent belongs to the artwork, never an unrelated click.
for(const event of ['pointerdown','keydown'])stage?.addEventListener(event,e=>{
 if(e.target.closest?.('#artworkPlayback,#videoPlay'))return;
 if(e.type==='keydown'&&!['Enter','Space'].includes(e.code))return;
 if(!initialConsent||video.error){resume();return}
 if(!userPaused)start();
},{capture:true,passive:true});
// Normal autoplay can retry on a gesture; an explicit pause always takes precedence.
for(const event of ['pointerdown','touchend','click','keydown'])window.addEventListener(event,e=>{
 if(e.target.closest?.('#artworkPlayback,#videoPlay'))return;
 if(e.type==='keydown'&&(e.repeat||e.metaKey||e.ctrlKey||e.altKey))return;
 if(initialConsent&&!userPaused)start();
},{capture:true,passive:true});
function visibility(){
 if(document.hidden){clearRecovery();video.pause();source.pauseLoading()}
 else{lastProgress=performance.now();if(mayPlay())start()}
}
document.addEventListener('visibilitychange',visibility);window.addEventListener('pageshow',visibility);
window.addEventListener('pagehide',()=>{clearRecovery();video.pause();source.pauseLoading()});
window.addEventListener('online',()=>{if(mayPlay()){retries=0;if(video.error)source.reload();start()}});
reduced.addEventListener('change',()=>{if(reduced.matches){allowed=false;initialConsent=false;video.pause();source.pauseLoading();publish()}else if(!userPaused){allowed=true;initialConsent=true;publish();start()}});
window.loadSiteArtwork=file=>{source.loadFile(file);resume()};
setInterval(()=>{if(mayPlay()&&!video.paused&&video.readyState<3&&performance.now()-lastProgress>15000)scheduleRecovery()},5000);
// Early Safari play requests can precede its ready state; keep this finite.
let attempts=0;const startup=setInterval(()=>{if(video.currentTime>0||++attempts>=24){clearInterval(startup);return}if(mayPlay())start()},250);
publish();if(mayPlay())start();
