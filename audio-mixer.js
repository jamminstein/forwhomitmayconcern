import {createLevelAutomation} from './audio-level.js';
import {createTransportEnvelope} from './transport-envelope.js';
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
 let pauseTimer,transportHeld=false,signalReady=false,signalTimer=0,signalGeneration=0,signalTap=null,signalSplitter=null;const signalProbes=[];
 const signalSamples=new Float32Array(256);
 function releaseSignalProbe(){if(signalTap){try{source.disconnect(signalTap)}catch{}signalTap.disconnect();signalTap=null}if(signalSplitter){signalSplitter.disconnect();signalSplitter=null}for(const probe of signalProbes)probe.disconnect();signalProbes.length=0}
 // Inspect channels separately: a mono analyser cancels anti-phase stereo.
 // Speaker downmix on this observation branch also preserves center-only files.
 try{signalTap=context.createGain();signalTap.channelCount=2;signalTap.channelCountMode='explicit';signalTap.channelInterpretation='speakers';signalSplitter=context.createChannelSplitter(2);signalTap.connect(signalSplitter);for(let i=0;i<2;i++){const probe=context.createAnalyser();probe.fftSize=signalSamples.length;signalProbes.push(probe);signalSplitter.connect(probe,i)}source.connect(signalTap)}catch{releaseSignalProbe();signalReady=true}
 function cancelSignalWatch(){clearTimeout(signalTimer);signalTimer=0;signalGeneration++}
 function openTransport(){
  if(transportHeld||music.paused)return;
  if(signalReady){envelope.open();return}
  cancelSignalWatch();const generation=signalGeneration,from=context.currentTime;
  const check=()=>{
   if(generation!==signalGeneration||transportHeld||music.paused||context.state!=='running')return;
   // Discard an analyser window left by an interrupted source before inspecting it.
   if(context.currentTime-from>=signalSamples.length/context.sampleRate){
    let available=true,hasSignal=false;
    try{for(const probe of signalProbes){probe.getFloatTimeDomainData(signalSamples);for(const value of signalSamples){if(!Number.isFinite(value)){available=false;break}if(Math.abs(value)>1e-7)hasSignal=true}}}catch{available=false}
    if(hasSignal||!available){signalReady=true;cancelSignalWatch();releaseSignalProbe();envelope.open();return}
   }
   signalTimer=setTimeout(check,16);
  };
  check();
 }
 // Safari can announce playing before the first PCM buffer arrives. Keep only
 // the music envelope closed until that buffer exists; drums/volume remain live.
 window.prepareSiteMusic=()=>{transportHeld=false;clearTimeout(pauseTimer);if(music.paused)envelope.reset();else openTransport()};
 window.pauseSiteMusic=()=>{transportHeld=true;cancelSignalWatch();clearTimeout(pauseTimer);envelope.close();pauseTimer=setTimeout(()=>music.pause(),30)};
 window.fadeOutSiteMusic=()=>{transportHeld=true;cancelSignalWatch();clearTimeout(pauseTimer);envelope.close();return new Promise(resolve=>setTimeout(resolve,30))};
 window.resetSiteMusicEnvelope=()=>{cancelSignalWatch();clearTimeout(pauseTimer);envelope.reset()};
 music.addEventListener('playing',()=>{if(!transportHeld){clearTimeout(pauseTimer);openTransport()}});
 for(const event of ['pause','ended','emptied'])music.addEventListener(event,()=>{cancelSignalWatch();envelope.reset()});
 context.addEventListener('statechange',()=>{if(context.state==='running')openTransport();else cancelSignalWatch()});
 if(!music.paused)openTransport();
 const analyser=context.createAnalyser();analyser.fftSize=256;analyser.smoothingTimeConstant=.72;ceiling.connect(analyser);
 const level=window.siteMixLevel??.32;musicGain.gain.value=level;drumGain.gain.value=level;music.volume=1;
 const levels=createLevelAutomation(context,[musicGain.gain,drumGain.gain],level);
 window.setSiteMusicLevel=levels.set;
 window.fadeSiteMusic=(target,seconds)=>{levels.fade(target,seconds);window.siteMixLevel=target};
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
