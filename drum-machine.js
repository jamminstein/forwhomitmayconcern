import {getMixer} from './audio-mixer.js?v=review-6';
export function chooseKit(manifest,previous={},rng=Math.random){return Object.fromEntries(['kick','snare','hat'].map(kind=>{const pool=manifest[kind].filter(url=>url!==previous[kind]);const choices=pool.length?pool:manifest[kind];return [kind,choices[Math.floor(rng()*choices.length)]]}))}
const padKeys={j:'kick',k:'snare',l:'hat'},pads=[...document.querySelectorAll('.drum-pad')],active=new Set();let lastHat=null,currentKit={},data=null;
const machine=document.querySelector('#drumMachine'),refresh=document.querySelector('#drumRefresh');
const manifestReady=fetch('drum-samples.json?v=drums-1').then(r=>{if(!r.ok)throw Error('Missing drum manifest');return r.json()});
async function decodeKit(kit,mix){
 if(!kit.decoding)kit.decoding=Promise.all(Object.entries(kit.blobs).map(async([kind,blob])=>{kit.buffers[kind]=await mix.context.decodeAudioData(blob.slice(0))})).catch(error=>{kit.decoding=null;throw error});
 await kit.decoding;
}
async function loadKit(mix){
 const manifest=await manifestReady;let previous=currentKit;
 if(!Object.keys(previous).length)try{previous=JSON.parse(sessionStorage.getItem('last-drum-kit')||'{}')}catch{}
 const chosen=chooseKit(manifest,previous),next={blobs:{},buffers:{},decoding:null};
 await Promise.all(Object.entries(chosen).map(async([kind,url])=>{const r=await fetch(url);if(!r.ok)throw Error('Missing drum hit');next.blobs[kind]=await r.arrayBuffer()}));
 if(mix)await decodeKit(next,mix);
 // Swap all three together; pads keep the previous kit until the replacement is ready.
 currentKit=chosen;data=next;machine.dataset.ready='true';
 try{sessionStorage.setItem('last-drum-kit',JSON.stringify(chosen))}catch{}
}
const kitReady=loadKit().catch(error=>{machine.dataset.ready='false';throw error});kitReady.catch(()=>{});
async function prepare(){const mix=getMixer();if(!mix)return null;await mix.context.resume();if(!data)await kitReady;const kit=data;await decodeKit(kit,mix);return {mix,kit}}
export async function refreshKit(){
 if(refresh.disabled)return;
 refresh.classList.remove('spinning');void refresh.offsetWidth;refresh.classList.add('spinning');
 setTimeout(()=>refresh.classList.remove('spinning'),650);
 refresh.disabled=true;refresh.setAttribute('aria-busy','true');
 try{const mix=getMixer();if(mix)await mix.context.resume();await kitReady.catch(()=>{});await loadKit(mix)}
 catch(error){console.warn('New drum samples unavailable; retaining current kit',error)}
 finally{refresh.disabled=false;refresh.removeAttribute('aria-busy')}
}
refresh.addEventListener('click',e=>{e.stopPropagation();refreshKit()});
function flash(kind){const pad=document.querySelector(`[data-drum="${kind}"]`);pad.classList.remove('hit');void pad.offsetWidth;pad.classList.add('hit');setTimeout(()=>pad.classList.remove('hit'),120)}
export async function triggerDrum(kind){flash(kind);try{const ready=await prepare();if(!ready)return;const {mix,kit}=ready,{context,drumGain}=mix,now=context.currentTime;const source=context.createBufferSource(),gain=context.createGain();source.buffer=kit.buffers[kind];gain.gain.value=.92;source.connect(gain);gain.connect(drumGain);
 if(kind==='hat'&&lastHat){lastHat.gain.gain.cancelScheduledValues(now);lastHat.gain.gain.setTargetAtTime(0,now,.004);try{lastHat.source.stop(now+.025)}catch{}}
 const voice={source,gain};if(kind==='hat')lastHat=voice;active.add(voice);source.onended=()=>{source.disconnect();gain.disconnect();active.delete(voice)};source.start(now);
 if(active.size>24){const oldest=active.values().next().value;oldest.gain.gain.setTargetAtTime(0,now,.003);try{oldest.source.stop(now+.02)}catch{}}
 }catch(error){console.warn('Drum hit unavailable',error)}}
for(const pad of pads){pad.addEventListener('pointerdown',e=>{e.preventDefault();triggerDrum(pad.dataset.drum)});pad.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.repeat){e.preventDefault();e.stopPropagation();triggerDrum(pad.dataset.drum)}})}
window.addEventListener('keydown',e=>{const kind=padKeys[e.key.toLowerCase()];if(!kind||e.repeat||e.metaKey||e.ctrlKey||e.altKey||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;e.preventDefault();triggerDrum(kind)});
// Decode after the first gesture, before the first intentional drum hit when possible.
window.addEventListener('pointerdown',()=>prepare().catch(()=>{}),{once:true});
