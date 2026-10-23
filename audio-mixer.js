import {createTransportEnvelope} from './transport-envelope.js?v=1';
let mixer=null;
export function getMixer(){
 if(mixer){if(mixer.context.state!=='running'&&mixer.context.state!=='closed')mixer.context.resume().catch(()=>{});return mixer}
 const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)return null;
 const context=new AudioContext({latencyHint:'interactive'}),music=document.querySelector('#audio');
 window.siteAudioContext=context;
 context.addEventListener('statechange',()=>{if(context.state==='running')window.dispatchEvent(new Event('site-audio-running'))});
 const musicGain=context.createGain(),drumGain=context.createGain(),compressor=context.createDynamicsCompressor(),ceiling=context.createWaveShaper();
 compressor.threshold.value=-4;compressor.knee.value=4;compressor.ratio.value=12;compressor.attack.value=.003;compressor.release.value=.12;
 const curve=new Float32Array(4096);for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1,a=Math.abs(x);curve[i]=Math.sign(x)*(a<=.85?a:.85+.15*Math.tanh((a-.85)/.15))}ceiling.curve=curve;
 musicGain.connect(compressor);drumGain.connect(compressor);compressor.connect(ceiling);ceiling.connect(context.destination);
 const envelope=createTransportEnvelope(context);
 const source=context.createMediaElementSource(music);source.connect(envelope.node);envelope.node.connect(musicGain);
 let pauseTimer;
 window.prepareSiteMusic=()=>{clearTimeout(pauseTimer);if(music.paused)envelope.reset();else envelope.open()};
 window.pauseSiteMusic=()=>{clearTimeout(pauseTimer);envelope.close();pauseTimer=setTimeout(()=>music.pause(),30)};
 music.addEventListener('playing',()=>{clearTimeout(pauseTimer);envelope.open()});
 for(const event of ['pause','ended','emptied'])music.addEventListener(event,envelope.reset);
 if(!music.paused)envelope.open();
 const analyser=context.createAnalyser();analyser.fftSize=256;analyser.smoothingTimeConstant=.72;ceiling.connect(analyser);
 const level=window.siteMixLevel??.32;musicGain.gain.value=level;drumGain.gain.value=level;music.volume=1;
 window.setSiteMusicLevel=level=>{musicGain.gain.setTargetAtTime(level,context.currentTime,.015);drumGain.gain.setTargetAtTime(level,context.currentTime,.015)};
 mixer={context,musicGain,drumGain,analyser};context.resume().catch(()=>{});return mixer;
}
function activateMixer(){try{return getMixer()}catch(error){console.warn('Audio mixer unavailable',error)}}
window.resumeSiteAudio=activateMixer;
for(const event of ['pointerdown','touchend','click','keydown'])window.addEventListener(event,e=>{
 if(e.type==='keydown'&&(e.repeat||e.metaKey||e.ctrlKey||e.altKey))return;
 activateMixer();
},{capture:true,passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&mixer)activateMixer()});
window.addEventListener('pageshow',()=>{if(mixer)activateMixer()});

export function getOutputAnalyser(){return mixer?.context.state==='running'?mixer.analyser:null}
