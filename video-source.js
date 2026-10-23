import {MEDIA} from './site-config.js';

// Delivery is separate from playback intent. Loading a source never calls play().
export function createArtworkSource(video,{ready=()=>{},failed=()=>{},mayLoad=()=>true}={}){
 let reloadRevision=0;
 let hls=null,loading=false,customURL=null,fallback=false,pending=null,initialized=false,resumeTime=0;
 function rememberPosition(){return Math.max(resumeTime,video.currentTime||0)}
 function restore(){if(resumeTime){try{video.currentTime=Math.min(resumeTime,Number.isFinite(video.duration)?Math.max(0,video.duration-.1):resumeTime)}catch{}resumeTime=0}ready()}
 video.addEventListener('loadedmetadata',restore);
 function useMP4(time=0,refresh=false){
  hls?.destroy();hls=null;loading=false;fallback=true;initialized=true;resumeTime=time;
  video.dataset.delivery='mp4';
  const url=new URL(MEDIA.fallback,document.baseURI);if(refresh)url.searchParams.set('retry',`${Date.now()}-${++reloadRevision}`);
  video.src=url.href;video.load();
 }
 async function ensure(){
  if(initialized)return;
  if(pending)return pending;
  pending=(async()=>{
   if(customURL||!mayLoad())return;
   const appleWebKit=/Apple/.test(navigator.vendor)||/iPad|iPhone|iPod/.test(navigator.userAgent);
   if(appleWebKit){useMP4();return}
   if(video.canPlayType('application/vnd.apple.mpegurl')){initialized=true;video.dataset.delivery='native-hls';video.src=MEDIA.manifest;video.load();return}
   try{
    await import('./vendor/hls-1.7.3.light.min.js');
    if(customURL||!mayLoad())return;
    const Hls=window.Hls;if(!Hls?.isSupported()){useMP4();return}
    hls=new Hls({startLevel:0,capLevelToPlayerSize:false,maxBufferLength:10,maxMaxBufferLength:16,backBufferLength:6,lowLatencyMode:false,autoStartLoad:false});
    initialized=true;video.dataset.delivery='hls-js';
    hls.on(Hls.Events.ERROR,(_,data)=>{if(!data.fatal)return;if(!fallback)useMP4(rememberPosition());else failed()});
    hls.on(Hls.Events.MANIFEST_PARSED,()=>{if(mayLoad()){hls?.startLoad();loading=true;ready()}});
    hls.on(Hls.Events.LEVEL_SWITCHED,(_,data)=>{video.dataset.quality=String(hls?.levels[data.level]?.height||'')});
    hls.loadSource(MEDIA.manifest);hls.attachMedia(video);
   }catch{if(!customURL&&mayLoad())useMP4()}
  })().finally(()=>{pending=null});
  return pending;
 }
 function pauseLoading(){hls?.stopLoad();loading=false;video.preload='metadata'}
 async function resumeLoading(){video.preload='auto';await ensure();if(mayLoad()&&hls&&!loading){hls.startLoad(-1);loading=true}}
 function reload(){
  if(customURL)return false;
  const time=rememberPosition();
  if(!fallback&&video.dataset.delivery==='native-hls'){useMP4(time);return true}
  if(hls){hls.startLoad(time);return true}
  useMP4(time,true);return true;
 }
 function loadFile(file){
  hls?.destroy();hls=null;if(customURL)URL.revokeObjectURL(customURL);
  customURL=URL.createObjectURL(file);initialized=true;resumeTime=0;
  video.pause();video.dataset.delivery='local';video.src=customURL;video.load();
 }
 window.stopAdaptiveVideo=()=>{hls?.destroy();hls=null;initialized=true};
 return {ensure,pauseLoading,resumeLoading,reload,loadFile,get initialized(){return initialized},get custom(){return !!customURL}};
}
