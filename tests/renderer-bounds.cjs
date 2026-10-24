// The full 4x renderer is deliberately independent of the crop implementation.
// Compare GPU pixels and CSS coordinates, including fractional parent dimensions.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {chromium,webkit}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8766';
const localWebKit=path.join(os.homedir(),'Library/Caches/ms-playwright/webkit-2370/pw_run.sh');
const engines=[['Chromium',chromium,process.env.RENDERER_METAL==='1'?{channel:'chromium',args:['--use-angle=metal']}:{}],['WebKit',webkit,fs.existsSync(localWebKit)?{executablePath:localWebKit}:{}]];
const artifacts=process.env.RENDERER_ARTIFACT_DIR;
if(artifacts)fs.mkdirSync(artifacts,{recursive:true});
const html='<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;overflow:hidden;background:#f8f7f4}#stage{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);transform-origin:center;isolation:isolate}canvas{position:absolute;inset:-150%;width:400%;height:400%;pointer-events:none}#overlay{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}#after{visibility:hidden}</style><div id="stage"><canvas id="before"></canvas><canvas id="after"></canvas><svg id="overlay" viewBox="0 0 1 1" preserveAspectRatio="none"><rect x="0" y="0" width="1" height="1" fill="none" stroke="#c22" stroke-width=".0015"/></svg></div>';
async function install(page){
 await page.route('**/__renderer_bounds__',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(base+'/__renderer_bounds__');
 await page.evaluate(async()=>{
  const {createWarpRenderer}=await import('/warp-renderer.js');
  const {createSurfaceSampler}=await import('/warp-surface.js');
  const subdivisions=64,uvs=new Float32Array((subdivisions+1)**2*2),indices=[];
  for(let y=0,i=0;y<=subdivisions;y++)for(let x=0;x<=subdivisions;x++){uvs[i++]=x/subdivisions;uvs[i++]=y/subdivisions}
  for(let y=0;y<subdivisions;y++)for(let x=0;x<subdivisions;x++){const a=y*(subdivisions+1)+x,b=a+1,c=a+subdivisions+1,d=c+1;indices.push(a,b,c,b,d,c)}
  const triangles=new Uint16Array(indices),sample=createSurfaceSampler(5,uvs),vertices=new Float32Array(uvs.length);
  const source=document.createElement('canvas');source.width=256;source.height=144;const ctx=source.getContext('2d');
  const gradient=ctx.createLinearGradient(0,0,256,144);gradient.addColorStop(0,'#bc493b');gradient.addColorStop(.32,'#e4c89a');gradient.addColorStop(.65,'#365e71');gradient.addColorStop(1,'#0c283f');ctx.fillStyle=gradient;ctx.fillRect(0,0,256,144);
  for(let y=0;y<8;y++)for(let x=0;x<12;x++){ctx.fillStyle=(x+y)%2?'#ffffff12':'#00000012';ctx.fillRect(x*22,y*18,22,18)}
  ctx.fillStyle='#fff';ctx.font='21px sans-serif';ctx.fillText('mesh • pixels',54,76);
  const before=document.querySelector('#before'),after=document.querySelector('#after'),stage=document.querySelector('#stage');
  function reference(canvas){
   const gl=canvas.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:false});if(!gl)throw Error('WebGL unavailable');
   const shader=(kind,text)=>{const s=gl.createShader(kind);gl.shaderSource(s,text);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};
   const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,'attribute vec2 aPosition;attribute vec2 aUv;varying vec2 vUv;void main(){gl_Position=vec4(aPosition,0.0,1.0);vUv=aUv;}'));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D uVideo;varying vec2 vUv;void main(){gl_FragColor=texture2D(uVideo,vec2(vUv.x,1.0-vUv.y));}'));gl.linkProgram(p);gl.useProgram(p);
   const positions=gl.createBuffer(),texCoords=gl.createBuffer(),elements=gl.createBuffer(),texture=gl.createTexture(),a=gl.getAttribLocation(p,'aPosition'),b=gl.getAttribLocation(p,'aUv');
   gl.bindBuffer(gl.ARRAY_BUFFER,texCoords);gl.bufferData(gl.ARRAY_BUFFER,uvs,gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,elements);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,triangles,gl.STATIC_DRAW);gl.bindTexture(gl.TEXTURE_2D,texture);for(const name of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,name,gl.LINEAR);for(const name of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,name,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.uniform1i(gl.getUniformLocation(p,'uVideo'),0);gl.disable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
   return {resize(width,height){const max=gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),dpr=Math.min(devicePixelRatio||1,2,max/Math.max(2,width*4),max/Math.max(2,height*4),Math.sqrt(32000000/Math.max(1,width*height*16)));canvas.width=Math.max(2,Math.round(width*4*dpr));canvas.height=Math.max(2,Math.round(height*4*dpr))},draw(upload,data){gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(p);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);if(upload)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);gl.bindBuffer(gl.ARRAY_BUFFER,positions);if(data)gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,texCoords);gl.enableVertexAttribArray(b);gl.vertexAttribPointer(b,2,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,elements);gl.drawElements(gl.TRIANGLES,triangles.length,gl.UNSIGNED_SHORT,0)},gl};
  }
  let fallbacks=[],restores=0;const ref=reference(before),renderer=createWarpRenderer(after,{uvs,indices:triangles,onFallback:f=>fallbacks.push(f),onRestore:()=>{restores++;renderer.draw(source,true,vertices)}});
  const actual=after.getContext('webgl');let size={width:640,height:360},uploaded=false;
  function regular(){const h=1/12;return Array.from({length:25},(_,i)=>({x:(i%5)/4,y:Math.floor(i/5)/4,left:{x:-h,y:0},right:{x:h,y:0},up:{x:0,y:-h},down:{x:0,y:h}}))}
  function shape(name){
   let points=regular(),spring={x:0,y:0},seed=0x13fd3147;const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296};
   if(name==='warp'||name==='extreme')for(const p of points){const m=name==='extreme'?2.25:.46;p.x+=(random()-.5)*m;p.y+=(random()-.5)*m;for(const key of ['left','right','up','down']){p[key].x+=(random()-.5)*m;p[key].y+=(random()-.5)*m}};
   if(name==='edge'){points[0].x=-1.49;points[0].y=-1.49;points[4].x=2.49;points[20].y=2.49;points[24].x=2.49;points[24].y=2.49}
   if(name==='outside')for(const p of points){p.x=3*(p.x-.5)+.5;p.y=5*(p.y-.5)+.5}
   if(name==='offscreen')for(const p of points){p.x+=5;p.y-=2}
   sample(points,spring,vertices);return vertices;
  }
  function resize(width,height){size={width,height};stage.style.width=width+'px';stage.style.height=height+'px';renderer.resize(Math.round(width),Math.round(height));ref.resize(Math.round(width),Math.round(height))}
  function draw(name,{upload=!uploaded,data=true}={}){if(name)shape(name);ref.draw(upload,data?vertices:null);renderer.draw(source,upload,data?vertices:null);uploaded=true}
  function read(gl,c){const data=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,data);return data}
  function compare(name,opts){draw(name,opts);const expected=read(ref.gl,before),got=read(actual,after),left=Math.round((parseFloat(after.style.left)+150)/400*before.width),top=Math.round((parseFloat(after.style.top)+150)/400*before.height),bottom=before.height-top-after.height;let difference=0,large=0,max=0,missing=0,alpha=0;
   for(let y=0;y<before.height;y++)for(let x=0;x<before.width;x++){const i=(y*before.width+x)*4;if(x<left||x>=left+after.width||y<bottom||y>=bottom+after.height){if(expected[i+3])missing++;continue}const j=((y-bottom)*after.width+x-left)*4;let pixel=0;for(let c=0;c<4;c++){const d=Math.abs(expected[i+c]-got[j+c]);difference+=d;pixel=Math.max(pixel,d);max=Math.max(max,d)}if(pixel>8)large++;alpha+=Math.abs(expected[i+3]-got[j+3])}
   const expectedCSS=getComputedStyle(before),actualCSS=getComputedStyle(after);const cssError=Math.max(Math.abs(parseFloat(actualCSS.left)-(parseFloat(expectedCSS.left)+left/before.width*parseFloat(expectedCSS.width))),Math.abs(parseFloat(actualCSS.top)-(parseFloat(expectedCSS.top)+top/before.height*parseFloat(expectedCSS.height))),Math.abs(parseFloat(actualCSS.width)-after.width/before.width*parseFloat(expectedCSS.width)),Math.abs(parseFloat(actualCSS.height)-after.height/before.height*parseFloat(expectedCSS.height)));
   const css={left:parseFloat(after.style.left),top:parseFloat(after.style.top),width:parseFloat(after.style.width),height:parseFloat(after.style.height)},oldPixels=before.width*before.height,newPixels=after.width*after.height;
   return {name,oldPixels,newPixels,ratio:newPixels/oldPixels,dimensions:[before.width,before.height,after.width,after.height],left,bottom,missing,mean:difference/(newPixels*4),alphaMean:alpha/newPixels,largeFraction:large/newPixels,max,css,cssError,error:actual.getError(),fallbacks:fallbacks.filter(Boolean).length};
  }
  window.boundsFixture={resize,draw,compare,renderer,ref,source,vertices,actual,shape,before,after,get restores(){return restores},get fallbacks(){return fallbacks},setTransform(scale,angle){stage.style.transform=`translate(-50%,-50%) rotate(${angle}deg) scale(${scale})`},show(which){before.style.visibility=which==='before'?'visible':'hidden';after.style.visibility=which==='after'?'visible':'hidden';draw(null,{upload:false,data:false})}};
 });
}
module.exports={install};
if(require.main===module)(async()=>{
 const report=[];
 for(const[name,type,options]of engines){
  if(process.env.ENGINE&&process.env.ENGINE.toLowerCase()!==name.toLowerCase())continue;
  const browser=await type.launch(options);
  for(const dpr of [1,2])for(const mobile of [false,true]){
   const viewport=mobile?{width:390,height:844}:{width:1440,height:1000},page=await browser.newPage({viewport,deviceScaleFactor:dpr});await install(page);
   const cases=await page.evaluate(({mobile})=>{const f=boundsFixture;f.resize(mobile?310.25:640.375,mobile?174.375:360.625);return ['regular','warp','extreme','edge','outside','offscreen','regular'].map(name=>f.compare(name))},{mobile});
   for(const r of cases){assert.equal(r.error,0,`${name} WebGL error`);assert.equal(r.fallbacks,0,`${name} unexpected fallback`);assert(r.cssError<.025,`${name} ${r.name} CSS placement mismatch: ${r.cssError}px`);assert.equal(r.missing,0,`${name} cropped visible ${r.name} pixels`);assert(r.mean<.1&&r.largeFraction<.002,`${name} DPR${dpr} ${r.name} pixel mismatch: ${JSON.stringify(r)}`)}
   assert(cases[0].ratio<.251,`${name} regular mesh should allocate one quarter of baseline`);
   assert.equal(cases.at(-1).newPixels,cases.at(-2).newPixels,'The envelope remains stable until resize');
   const resize=await page.evaluate(()=>{const f=boundsFixture;f.resize(582.625,119.375);f.setTransform(2.4,29);return f.compare('regular',{upload:false,data:false})});
   assert(resize.cssError<.025,`${name} transformed CSS placement mismatch: ${resize.cssError}px`);assert.equal(resize.missing,0);assert(resize.mean<.1&&resize.largeFraction<.002,`${name} paused resize changed pixels`);assert(resize.ratio<.251);
   if(artifacts){for(const shape of ['warp','edge']){await page.evaluate(shape=>{const f=boundsFixture;f.resize(410.375,230.625);f.setTransform(1.6,-18);f.draw(shape)},shape);for(const which of ['before','after']){await page.evaluate(which=>boundsFixture.show(which),which);await page.screenshot({path:path.join(artifacts,`${name.toLowerCase()}-dpr${dpr}-${mobile?'phone':'desktop'}-${shape}-${which}.png`)})}}}
   const supported=await page.evaluate(()=>{window.loss=boundsFixture.actual.getExtension('WEBGL_lose_context');if(!loss)return false;loss.loseContext();return true});
   if(supported){await page.waitForFunction(()=>boundsFixture.fallbacks.includes(true));await page.waitForTimeout(100);await page.evaluate(()=>loss.restoreContext());await page.waitForFunction(()=>boundsFixture.restores===1);const restored=await page.evaluate(()=>boundsFixture.compare(null,{upload:false,data:false}));assert.equal(restored.missing,0);assert(restored.mean<.1&&restored.largeFraction<.002,`${name} restoration changed pixels`)}
   report.push({engine:name,dpr,mobile,cases,resize});console.log(`${name} DPR${dpr} ${mobile?'phone':'desktop'}: regular/warped/extreme/clipped meshes, paused resize, CSS transform, context restore passed`);await page.close();
  }
  await browser.close();
 }
 if(artifacts)fs.writeFileSync(path.join(artifacts,'pixel-results.json'),JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
