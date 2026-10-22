// Retry muted inline video on mobile-friendly gestures and after interruptions.
const video=document.querySelector('#video');
let userPaused=false;
video.muted=true;video.defaultMuted=true;video.playsInline=true;
video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');
video.autoplay=true;video.preload='auto';
function start(){
 if(document.hidden||userPaused||!video.paused&&!video.ended)return;
 video.muted=true;
 video.play().catch(error=>{video.dataset.playback=error.name==='NotAllowedError'?'needs-tap':'waiting'});
}
for(const event of ['loadeddata','canplay'])video.addEventListener(event,start);
video.addEventListener('playing',()=>{video.dataset.playback='playing'});
video.addEventListener('error',()=>{video.dataset.playback='error'});
for(const event of ['pointerdown','touchend','click','keydown'])window.addEventListener(event,e=>{
 if(e.type==='keydown'&&(e.repeat||e.metaKey||e.ctrlKey||e.altKey))return;
 if(e.target.closest?.('#videoPlay')){if(e.type==='click')userPaused=!video.paused;return}
 start();
},{capture:true,passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)start()});
window.addEventListener('pageshow',start);
start();
