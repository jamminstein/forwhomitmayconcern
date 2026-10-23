// Opt-in, local-only diagnostics. Nothing is sent or stored.
if(new URLSearchParams(location.search).has('videoDebug')){
 const video=document.querySelector('#video'),box=document.createElement('pre');
 box.setAttribute('aria-label','Video playback diagnostics');
 Object.assign(box.style,{position:'fixed',left:'8px',top:'8px',zIndex:'9999',background:'#fff',color:'#000',padding:'12px',font:'12px monospace',maxWidth:'calc(100vw - 40px)',whiteSpace:'pre-wrap',pointerEvents:'none'});
 document.body.append(box);
 let frames=0;
 function frame(){frames++;video.requestVideoFrameCallback?.(frame)}
 video.requestVideoFrameCallback?.(frame);
 setInterval(()=>{box.textContent=[
  'Video diagnostics — '+video.dataset.delivery,
  'time: '+video.currentTime.toFixed(2)+' / '+video.duration,
  'paused: '+video.paused+' ready: '+video.readyState+' network: '+video.networkState,
  'decoded frames: '+(video.getVideoPlaybackQuality?.().totalVideoFrames??'?')+' callbacks: '+frames,
  'play result: '+(video.dataset.playResult||video.dataset.playback||'pending'),
  'media error: '+(video.error?video.error.code+' '+video.error.message:'none'),
  'texture error: '+(video.dataset.textureError||'none'),
  'source: '+video.currentSrc.split('/').pop(),
  'visible page: '+!document.hidden
 ].join('\n')},500);
}
