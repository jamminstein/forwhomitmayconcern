let mixer=null;
export function getMixer(){
 if(mixer){if(mixer.context.state==='suspended')mixer.context.resume().catch(()=>{});return mixer}
 const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)return null;
 const context=new AudioContext({latencyHint:'interactive'}),music=document.querySelector('#audio');
 const musicGain=context.createGain(),drumGain=context.createGain(),compressor=context.createDynamicsCompressor(),ceiling=context.createWaveShaper();
 compressor.threshold.value=-4;compressor.knee.value=4;compressor.ratio.value=12;compressor.attack.value=.003;compressor.release.value=.12;
 const curve=new Float32Array(4096);for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1,a=Math.abs(x);curve[i]=Math.sign(x)*(a<=.85?a:.85+.15*Math.tanh((a-.85)/.15))}ceiling.curve=curve;
 musicGain.connect(compressor);drumGain.connect(compressor);compressor.connect(ceiling);ceiling.connect(context.destination);
 const source=context.createMediaElementSource(music);source.connect(musicGain);
 const level=window.siteMixLevel??.32;musicGain.gain.value=level;drumGain.gain.value=level;music.volume=1;
 window.setSiteMusicLevel=level=>{musicGain.gain.setTargetAtTime(level,context.currentTime,.015);drumGain.gain.setTargetAtTime(level,context.currentTime,.015)};
 mixer={context,musicGain,drumGain};context.resume().catch(()=>{});return mixer;
}
function activateMixer(){try{getMixer()}catch(error){console.warn('Audio mixer unavailable',error)}}
window.addEventListener('pointerdown',activateMixer,{once:true});
window.addEventListener('keydown',e=>{if(!e.repeat&&!e.metaKey&&!e.ctrlKey&&!e.altKey)activateMixer()},{once:true});
