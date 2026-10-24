// Mixer readiness gates sound without delaying the artwork or interaction setup.
export function initializeSoundtrack(){
 const $=selector=>document.querySelector(selector),audio=$('#audio'),files=$('#audioFiles');
 window.siteMusicIntroPending=true;
 let mixerReady=false,createMixer=null;
 let tracks=[],queue=[],history=[],current=-1,level=.32,started=false,volumeChosen=false,wantsPlay=true,pending=false,switching=false;
 let selection=0,playAttempt=0,retryCount=0,retryTimer=0,recoveryBaseline=0,fadeGeneration=0,lastProgress=performance.now(),lastTime=0,restoreTime=0,mediaState='loading',manifestPending=null;
 const urls=[],PLAY='M12 7 L14 13 L11 17 L30 22 L22 25 L10 33 L12 24 L10 12 Z',PAUSE='M12 8 L14 14 L10 22 L12 32 M27 7 L24 17 L28 23 L25 32';
 const shuffled=values=>{const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
 const formatTime=value=>Number.isFinite(value)?`${Math.floor(value/60).toString().padStart(2,'0')}:${Math.floor(value%60).toString().padStart(2,'0')}`:'00:00';
 function positionId(){const play=$('#musicPlay'),id=$('#currentSongId');id.style.left=`${play.offsetLeft+play.offsetWidth/2}px`}
 function update(){
  const track=tracks[current],id=track?.url.match(/\/(\d+)\.m4a(?:[?#]|$)/)?.[1]||track?.name.match(/Acervo\s*\/\s*(\d+)/)?.[1]||'';
  $('#currentSongId').dataset.songId=id;$('#currentSongId').setAttribute('aria-label',id?`Song ${id}`:'');positionId();
  $('#songLabel').textContent=track?.name||'Acervo';
  const playing=wantsPlay&&(!audio.paused||switching),label=mediaState==='error'?'Retry music':playing?'Pause music':'Play music';
  $('#musicPlaySketch').setAttribute('d',playing?PAUSE:PLAY);$('#musicPlay').setAttribute('aria-label',label);$('#musicPlay').dataset.state=mediaState;
  $('#musicPlay').setAttribute('aria-busy',String(mediaState==='loading'&&wantsPlay));
  $('#audioPlay').textContent=playing?'Ⅱ':'▶';$('#audioPlay').setAttribute('aria-label',label);
  $('#audioStatus').textContent=mediaState==='error'?'Audio unavailable':playing?'Playlist playing':'Video sound off';
  $('#trackCount').textContent=`${tracks.length} TRACKS`;
  for(const id of ['musicPrev','musicNext','prevTrack','nextTrack','audioPlay','audioSeek'])$('#'+id).disabled=!tracks.length;
 }
 function setLevel(value){window.siteMixLevel=value;if(window.setSiteMusicLevel)window.setSiteMusicLevel(value);else audio.volume=value}
 function startFade(){
  if(started||!wantsPlay||switching||audio.paused||audio.readyState<2)return;
  const context=window.siteAudioContext;if(context&&(context.state!=='running'||window.siteMusicSignalReady===false))return;
  started=true;window.siteMusicIntroPending=false;
  // A volume chosen while loading remains authoritative when the song arrives.
  if(volumeChosen)return;
  if(window.fadeSiteMusic)window.fadeSiteMusic(level,3.5);
  else{setLevel(0);const generation=++fadeGeneration,beginning=performance.now();const tick=now=>{if(generation!==fadeGeneration)return;const t=Math.min(1,(now-beginning)/3500);setLevel(level*t*t*(3-2*t));if(t<1)requestAnimationFrame(tick)};requestAnimationFrame(tick)}
 }
 function mixer(){try{return createMixer?.()||null}catch(error){console.warn('Audio mixer unavailable',error);return null}}
 function play(explicit=false){
  if(!mixerReady||!wantsPlay||switching||(pending&&!explicit)||current<0||mediaState==='error')return;
  if(!audio.paused&&started&&!explicit)return;
  mixer();if(!started&&!volumeChosen&&!window.fadeSiteMusic)audio.volume=0;window.prepareSiteMusic?.();pending=true;
  const token=selection,attempt=++playAttempt;
  audio.play().then(()=>{if(token!==selection||attempt!==playAttempt)return;pending=false;if(!wantsPlay){audio.pause();return}startFade();update()}).catch(error=>{
   if(token!==selection||attempt!==playAttempt)return;pending=false;
   if(error.name!=='NotAllowedError'&&error.name!=='AbortError')scheduleRecovery();
   update();
  });
 }
 function cancelPlay(){playAttempt++;pending=false}
 function cancelRecovery(){clearTimeout(retryTimer);retryTimer=0}
 async function select(index,playNow=true,{resume=0,recovery=false}={}){
  if(!tracks.length)return;
  const token=++selection;cancelRecovery();cancelPlay();switching=true;
  current=(index+tracks.length)%tracks.length;wantsPlay=playNow;mediaState='loading';
  if(!recovery)retryCount=0;else recoveryBaseline=resume;
  if(playNow)mixer();
  update();
  if(!audio.paused&&window.fadeOutSiteMusic)await window.fadeOutSiteMusic();
  if(token!==selection)return;
  audio.pause();window.resetSiteMusicEnvelope?.();
  restoreTime=resume;const selectedURL=new URL(tracks[current].url,document.baseURI);
  if(recovery&&/^https?:$/.test(selectedURL.protocol))selectedURL.searchParams.set('retry',`${Date.now()}-${retryCount}`);
  audio.src=selectedURL.href;audio.load();$('#audioSeek').value=0;$('#audioTime').textContent='00:00';
  lastTime=resume;lastProgress=performance.now();switching=false;
  if(wantsPlay)play();update();
 }
 function scheduleRecovery(){
  if(switching||current<0)return;
  mediaState='error';update();
  if(!wantsPlay||retryTimer)return;
  if(navigator.onLine===false||retryCount>=2)return;
  const token=selection,position=Math.max(restoreTime,lastTime,audio.currentTime||0),delay=1000*2**retryCount;
  retryCount++;
  retryTimer=setTimeout(()=>{retryTimer=0;if(token===selection&&wantsPlay)select(current,true,{resume:position,recovery:true})},delay);
 }
 function retry(){
  cancelRecovery();retryCount=0;wantsPlay=true;
  if(current<0){loadManifest();return}
  if(mediaState==='error'||audio.error)select(current,true,{resume:Math.max(restoreTime,audio.currentTime||0),recovery:true});
  else{mediaState='ready';play(true)}
 }
 function toggle(){
  if(mediaState==='error'){retry();return}
  if(wantsPlay&&(!audio.paused||switching)){
   wantsPlay=false;cancelPlay();cancelRecovery();
   // A pending selection may finish loading, but must honor this latest pause intent.
   if(window.pauseSiteMusic)window.pauseSiteMusic();else audio.pause();
  }else{wantsPlay=true;play(true)}
  update();
 }
 function next(){
  if(!tracks.length)return;
  if(!queue.length)queue=shuffled(tracks.map((_,i)=>i).filter(i=>i!==current));
  if(!queue.length){select(current,true);return}
  if(current>=0)history.push(current);select(queue.pop(),true);
 }
 function previous(){
  if(!tracks.length)return;
  if(!history.length&&!queue.length)queue=shuffled(tracks.map((_,i)=>i).filter(i=>i!==current));
  if(!history.length&&!queue.length){audio.currentTime=0;return}
  const index=history.length?history.pop():queue.pop();if(current>=0)queue.push(current);select(index,true);
 }
 async function loadManifest(){
  if(manifestPending)return manifestPending;
  mediaState='loading';update();
  manifestPending=fetch('soundtrack.json').then(r=>{if(!r.ok)throw Error('Soundtrack unavailable');return r.json()}).then(collection=>{
   if(!Array.isArray(collection)||!collection.length)throw Error('Empty soundtrack');
   tracks=shuffled(collection);queue=shuffled(tracks.map((_,i)=>i).slice(1));history=[];select(0,wantsPlay);
  }).catch(error=>{mediaState='error';console.warn(error);update()}).finally(()=>{manifestPending=null});
  return manifestPending;
 }
 function addFiles(items){
  for(const file of items){if(!file.type.startsWith('audio/'))continue;const url=URL.createObjectURL(file);urls.push(url);tracks.push({name:file.name.replace(/\.[^.]+$/,''),url})}
  if(current<0&&tracks.length)select(0,false);update();
 }
 function volume(value,chosen=true){volumeChosen||=chosen;if(chosen)window.siteMusicIntroPending=false;fadeGeneration++;level=Math.max(0,Math.min(1,Number(value)));setLevel(level);$('#soundtrackVolume').value=level;$('#volume').value=level;$('#volumeKnob').setAttribute('transform',`translate(14 ${52-43*level})`)}
 for(const id of ['musicPlay','audioPlay'])$('#'+id).addEventListener('click',toggle);
 for(const id of ['musicNext','nextTrack'])$('#'+id).addEventListener('click',next);
 for(const id of ['musicPrev','prevTrack'])$('#'+id).addEventListener('click',previous);
 for(const id of ['musicAdd','addSongs'])$('#'+id).addEventListener('click',()=>files.click());
 for(const id of ['soundtrackVolume','volume'])$('#'+id).addEventListener('input',e=>volume(e.target.value));
 files.addEventListener('change',()=>{addFiles(files.files||[]);files.value=''});
 $('#audioSeek').addEventListener('input',e=>{if(Number.isFinite(audio.duration))audio.currentTime=Number(e.target.value)});
 audio.addEventListener('loadedmetadata',()=>{if(restoreTime){audio.currentTime=Math.min(restoreTime,Math.max(0,audio.duration-.1)||restoreTime);restoreTime=0}update()});
 audio.addEventListener('playing',()=>{if(!wantsPlay){audio.pause();return}mediaState='playing';cancelRecovery();lastProgress=performance.now();startFade();update()});
 audio.addEventListener('waiting',()=>{if(wantsPlay){mediaState='loading';update()}});
 audio.addEventListener('error',scheduleRecovery);
 audio.addEventListener('pause',update);
 audio.addEventListener('ended',()=>{if(wantsPlay&&!switching)next()});
 audio.addEventListener('timeupdate',()=>{
  if(Number.isFinite(audio.duration)){$('#audioSeek').max=audio.duration;$('#audioSeek').value=audio.currentTime;$('#audioTime').textContent=`${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`}
  if(audio.currentTime>lastTime+.1){if(audio.currentTime-recoveryBaseline>5)retryCount=0;lastProgress=performance.now();lastTime=audio.currentTime;if(mediaState==='error'){mediaState='playing';cancelRecovery();update()}}
 });
 window.addEventListener('site-audio-running',startFade);
 window.addEventListener('site-music-ready',startFade);
 const controls='#musicPlay,#audioPlay,#musicPrev,#musicNext,#prevTrack,#nextTrack';
 function gesture(e){
  if(e.defaultPrevented||(e.type==='keydown'&&(e.repeat||e.metaKey||e.ctrlKey||e.altKey)))return;
  mixer();if(e.target.closest?.(controls))return;
  if(wantsPlay&&mediaState!=='error')play();
 }
 for(const event of ['pointerdown','touchend','click','keydown'])window.addEventListener(event,gesture,{capture:true,passive:true});
 window.addEventListener('keydown',e=>{if(e.defaultPrevented||e.repeat||e.metaKey||e.ctrlKey||e.altKey||e.target.closest?.('input,button,textarea,select,.point,[contenteditable=true]'))return;if(e.key==='ArrowRight')next();else if(e.key==='ArrowLeft')previous();else if(e.key.toLowerCase()==='a')files.click()});
 function recover(){if(!document.hidden&&wantsPlay){mixer();if(mediaState!=='error')play()}}
 document.addEventListener('visibilitychange',recover);window.addEventListener('pageshow',recover);
 window.addEventListener('online',()=>{if(wantsPlay&&mediaState==='error')retry()});
 setInterval(()=>{if(wantsPlay&&!switching&&!audio.paused&&audio.readyState<3&&performance.now()-lastProgress>15000)scheduleRecovery()},5000);
 window.addEventListener('beforeunload',()=>urls.forEach(URL.revokeObjectURL));
 new ResizeObserver(positionId).observe($('.glass-dock'));
 volume(level,false);audio.volume=0;
 import('./audio-mixer.js').then(module=>{createMixer=module.getMixer}).catch(error=>console.warn('Audio mixer unavailable; using native playback',error)).finally(()=>{mixerReady=true;play()});
 loadManifest();
 return {audio,addFiles,next,previous,openFiles:()=>files.click(),toggle,retry};
}
