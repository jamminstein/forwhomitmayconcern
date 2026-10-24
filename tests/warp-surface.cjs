const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');

// Independent copy of the original cubic-edge / bilinear Coons construction.
// Keep its operation order so this catches changes to the renderer's geometry.
function originalSampler(gridSize,uvs){
 function bezier(t){const q=1-t;return[q*q*q,3*q*q*t,3*q*t*t,t*t*t]}
 function curve(a,b,dir,opposite,t,spring){const w=bezier(t);return {x:w[0]*a.x+w[1]*(a.x+a[dir].x+spring.x)+w[2]*(b.x+b[opposite].x+spring.x)+w[3]*b.x,y:w[0]*a.y+w[1]*(a.y+a[dir].y+spring.y)+w[2]*(b.y+b[opposite].y+spring.y)+w[3]*b.y}}
 function surface(u,v,points,spring){const n=gridSize-1,c=Math.min(n-1,Math.floor(u*n)),r=Math.min(n-1,Math.floor(v*n)),x=u*n-c,y=v*n-r,a=points[r*gridSize+c],b=points[r*gridSize+c+1],d=points[(r+1)*gridSize+c],e=points[(r+1)*gridSize+c+1],top=curve(a,b,'right','left',x,spring),bottom=curve(d,e,'right','left',x,spring),left=curve(a,d,'down','up',y,spring),right=curve(b,e,'down','up',y,spring);const out={};for(const k of ['x','y'])out[k]=(1-y)*top[k]+y*bottom[k]+(1-x)*left[k]+x*right[k]-((1-x)*(1-y)*a[k]+x*(1-y)*b[k]+(1-x)*y*d[k]+x*y*e[k]);return out}
 return (points,spring,out)=>{for(let i=0;i<uvs.length;i+=2){const p=surface(uvs[i],uvs[i+1],points,spring);out[i]=(p.x-.5)/2;out[i+1]=(.5-p.y)/2}return out};
}
let seed=0x79d9beef;
function random(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296}
const between=(a,b)=>a+(b-a)*random(),directions=['left','right','up','down'];
function regular(gridSize){const h=1/(gridSize-1)/3;return Array.from({length:gridSize*gridSize},(_,i)=>({x:(i%gridSize)/(gridSize-1),y:Math.floor(i/gridSize)/(gridSize-1),left:{x:-h,y:0},right:{x:h,y:0},up:{x:0,y:-h},down:{x:0,y:h}}))}
function warped(gridSize){return regular(gridSize).map(p=>{p.x+=between(-.4,.4);p.y+=between(-.4,.4);for(const dir of directions){p[dir].x=between(-.7,.7);p[dir].y=between(-.7,.7)}return p})}
function gridUVs(subdivisions){const uvs=new Float32Array((subdivisions+1)**2*2);for(let y=0,i=0;y<=subdivisions;y++)for(let x=0;x<=subdivisions;x++){uvs[i++]=x/subdivisions;uvs[i++]=y/subdivisions}return uvs}
function testUVs(gridSize){
 const values=Array.from(gridUVs(64)),edges=[0,1,1+Number.EPSILON,1.02];
 for(let i=1;i<gridSize-1;i++){const v=i/(gridSize-1);edges.push(v-Number.EPSILON,v,v+Number.EPSILON)}
 for(const u of edges)for(const v of edges)values.push(u,v);
 for(let i=0;i<2048;i++)values.push(random(),random());
 return new Float64Array(values);
}

(async()=>{
 const {createSurfaceSampler}=await import('../warp-surface.js');
 let compared=0,maxError=0;
 for(const gridSize of [2,3,5,7]){
  const uvs=testUVs(gridSize),sample=createSurfaceSampler(gridSize,uvs),reference=originalSampler(gridSize,uvs);
  const actual=new Float32Array(uvs.length),expected=new Float32Array(uvs.length);
  function compare(points,spring,label){
   assert.equal(sample(points,spring,actual),actual,'Must reuse the caller output');reference(points,spring,expected);
   for(let i=0;i<actual.length;i++){
    const error=Math.abs(actual[i]-expected[i]);maxError=Math.max(maxError,error);
    assert(Number.isFinite(actual[i])&&error<=1e-7,`${label} grid=${gridSize}, UV=${uvs[i-i%2]},${uvs[i-i%2+1]}, component=${i%2}: ${actual[i]} vs ${expected[i]}`);
   }
   compared+=uvs.length/2;
  }
  const points=regular(gridSize);compare(points,{x:0,y:0},'regular');
  // With straight, evenly spaced handles the unwarped surface is exactly UV.
  for(let i=0;i<uvs.length;i+=2){assert(Math.abs(actual[i]-(uvs[i]-.5)/2)<=1e-7);assert(Math.abs(actual[i+1]-(.5-uvs[i+1])/2)<=1e-7)}
  compare(points,{x:.025,y:-.025},'regular spring');
  for(let shape=0;shape<32;shape++)compare(warped(gridSize),{x:between(-.025,.025),y:between(-.025,.025)},'random warp');
  // Exercise every point and all four tangent directions in isolation. Reuse
  // the compiled sampler across mutations and replacement point arrays.
  for(let index=0;index<points.length;index++)for(const dir of [null,...directions]){
   const moved=regular(gridSize),target=dir?moved[index][dir]:moved[index];target.x+=.63;target.y-=.49;
   compare(moved,{x:-.017,y:.023},`dragged ${index} ${dir||'anchor'}`);
  }
  const cornerUVs=new Float64Array([0,0,1,0,0,1,1,1]),cornerOut=new Float32Array(8),cornerPoints=warped(gridSize);
  createSurfaceSampler(gridSize,cornerUVs)(cornerPoints,{x:.025,y:-.025},cornerOut);
  for(const [i,index]of [0,gridSize-1,gridSize*(gridSize-1),gridSize*gridSize-1].entries()){
   assert.equal(cornerOut[i*2],Math.fround((cornerPoints[index].x-.5)/2));assert.equal(cornerOut[i*2+1],Math.fround((.5-cornerPoints[index].y)/2));
  }
 }
 console.log(`Warp surface: ${compared.toLocaleString('en-US')} UV evaluations match the original within 1e-7 (max error ${maxError}).`);
 if(process.argv.includes('--bench')){
  const uvs=gridUVs(64),points=warped(5),spring={x:.019,y:-.012},out=new Float32Array(uvs.length);
  const before=originalSampler(5,uvs),after=createSurfaceSampler(5,uvs),iterations=200;
  for(let i=0;i<100;i++){before(points,spring,out);after(points,spring,out)}
  function timing(fn){const runs=[];for(let r=0;r<7;r++){const start=performance.now();for(let i=0;i<iterations;i++){spring.x=.02*Math.sin(i/20);fn(points,spring,out)}runs.push((performance.now()-start)/iterations)}return runs.sort((a,b)=>a-b)[3]}
  const oldMs=timing(before),newMs=timing(after);
  console.log(`4225-vertex CPU benchmark (median of 7 × ${iterations} frames): original ${oldMs.toFixed(3)} ms/frame; precomputed ${newMs.toFixed(3)} ms/frame; ${(oldMs/newMs).toFixed(2)}× faster. Construction excluded.`);
 }
})().catch(error=>{console.error(error);process.exitCode=1});
