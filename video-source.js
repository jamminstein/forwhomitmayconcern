// Safari uses progressive MP4 for reliable autoplay and WebGL texture updates.
// Other browsers use local HLS renditions with an MP4 fallback.
const video=document.querySelector('#video');
const manifest='video/1-6/master.m3u8',fallback='tiago-1-6.mp4';
let hls=null,custom=false,fellBack=false;
window.stopAdaptiveVideo=()=>{custom=true;hls?.destroy();hls=null};
function play(){video.muted=true;video.defaultMuted=true;video.play().catch(()=>{})}
function useFallback(){
 if(custom||fellBack)return;
 fellBack=true;hls?.destroy();hls=null;
 const time=video.currentTime||0;
 video.dataset.delivery='mp4';video.muted=true;video.defaultMuted=true;video.src=fallback;
 video.addEventListener('loadedmetadata',()=>{if(time)video.currentTime=time;play()},{once:true});
 play();
}
async function setup(){
 const appleWebKit=/Apple/.test(navigator.vendor)||/iPad|iPhone|iPod/.test(navigator.userAgent);
 if(appleWebKit){useFallback();return}
 if(video.canPlayType('application/vnd.apple.mpegurl')){
  video.dataset.delivery='native-hls';
  video.addEventListener('error',useFallback,{once:true});
  video.src=manifest;play();return;
 }
 try{
  await import('./vendor/hls-1.7.3.light.min.js');
  if(custom)return;
  const Hls=window.Hls;
  if(!Hls?.isSupported()){useFallback();return}
  hls=new Hls({startLevel:0,capLevelToPlayerSize:false,maxBufferLength:10,maxMaxBufferLength:16,backBufferLength:6,lowLatencyMode:false});
  video.dataset.delivery='hls-js';
  hls.on(Hls.Events.ERROR,(_,data)=>{if(data.fatal)useFallback()});
  hls.on(Hls.Events.MANIFEST_PARSED,play);
  hls.on(Hls.Events.LEVEL_SWITCHED,(_,data)=>{video.dataset.quality=String(hls?.levels[data.level]?.height||'')});
  hls.loadSource(manifest);hls.attachMedia(video);
 }catch{useFallback()}
}
setup();
