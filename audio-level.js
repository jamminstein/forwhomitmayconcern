// Schedule volume on the audio clock, independent of animation-frame timing.
export function createLevelAutomation(context,params,initial){
 let from=initial,to=initial,start=0,duration=0,smooth=false;
 const valueAt=now=>{const t=duration?Math.min(1,Math.max(0,(now-start)/duration)):1;return from+(to-from)*(smooth?t*t*(3-2*t):t)};
 function schedule(target,seconds,ease=false){
  const now=context.currentTime,held=valueAt(now);
  for(const param of params){
   param.cancelScheduledValues(now);param.setValueAtTime(held,now);
   const steps=ease?32:1;
   for(let i=1;i<=steps;i++){const t=i/steps;param.linearRampToValueAtTime(held+(target-held)*(ease?t*t*(3-2*t):t),now+seconds*t)}
  }
  from=held;to=target;start=now;duration=seconds;smooth=ease;
 }
 return {set:level=>schedule(level,.03),fade:(level,seconds=3.5)=>schedule(level,seconds,true)};
}
