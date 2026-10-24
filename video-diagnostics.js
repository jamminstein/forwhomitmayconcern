// Opt-in, local-only diagnostics. Nothing is sent or stored.
if(new URLSearchParams(location.search).has('videoDebug')){
 const video=document.querySelector('#video'),box=document.createElement('pre');
 box.setAttribute('aria-label','Video playback diagnostics');
 Object.assign(box.style,{position:'fixed',left:'8px',top:'8px',zIndex:'9999',background:'#fff',color:'#000',padding:'12px',font:'12px monospace',maxWidth:'calc(100vw - 40px)',whiteSpace:'pre-wrap',pointerEvents:'none'});
 document.body.append(box);
 const audio=document.querySelector('#audio');let audioEvent='none';
 for(const name of ['playing','waiting','stalled','pause','error'])audio.addEventListener(name,()=>{audioEvent=name+' at '+audio.currentTime.toFixed(2)+'s'});
 let frames=0;
 function frame(){frames++;video.requestVideoFrameCallback?.(frame)}
 video.requestVideoFrameCallback?.(frame);
 setInterval(()=>{box.textContent=[
  'Video diagnostics — '+video.dataset.delivery,
  'release: '+(document.querySelector('meta[name="site-version"]')?.content||'local'),
  'time: '+video.currentTime.toFixed(2)+' / '+video.duration,
  'paused: '+video.paused+' ready: '+video.readyState+' network: '+video.networkState,
  'decoded frames: '+(video.getVideoPlaybackQuality?.().totalVideoFrames??'?')+' callbacks: '+frames,
  'play result: '+(video.dataset.playResult||video.dataset.playback||'pending'),
  'playback state: '+(video.dataset.playback||'pending')+' muted: '+video.muted,
  'motion paused: '+!!window.siteVisualMotionPaused+' reduced motion: '+matchMedia('(prefers-reduced-motion: reduce)').matches,
  'media error: '+(video.error?video.error.code+' '+video.error.message:'none'),
  'texture error: '+(video.dataset.textureError||'none'),
  'source: '+video.currentSrc.split('/').pop(),
  'visible page: '+!document.hidden,
  'audio: '+audio.currentTime.toFixed(2)+'s paused: '+audio.paused+' ready: '+audio.readyState,
  'audio engine: '+(window.siteAudioContext?.state||'not initialized'),
  'audio event: '+audioEvent,
  'audio buffered: '+Array.from({length:audio.buffered.length},(_,i)=>audio.buffered.end(i).toFixed(1)).join(',')
 ].join('\n')},500);
}
