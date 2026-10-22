// A short, music-only envelope prevents discontinuities at transport starts/stops.
export function createTransportEnvelope(context){
 const node=context.createGain();node.gain.value=0;
 let from=0,to=0,start=0,end=0;
 function ramp(value,duration){
  const gain=node.gain,now=context.currentTime;
  const progress=end>start?Math.max(0,Math.min(1,(now-start)/(end-start))):1;
  const held=from+(to-from)*progress;
  gain.cancelScheduledValues(now);gain.setValueAtTime(held,now);
  gain.linearRampToValueAtTime(value,now+duration);
  from=held;to=value;start=now;end=now+duration;
 }
 function reset(){const now=context.currentTime;node.gain.cancelScheduledValues(now);node.gain.setValueAtTime(0,now);from=to=0;start=end=now}
 return {node,open:()=>ramp(1,.035),close:()=>ramp(0,.025),reset};
}
