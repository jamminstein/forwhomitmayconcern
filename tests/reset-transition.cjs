// Observe painted SVG geometry on the app's own frames, rather than guessing
// which animation frame an arbitrary test-runner sleep will land on.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os');
const {chromium,webkit}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8766';
const localWebKit=`${os.homedir()}/Library/Caches/ms-playwright/webkit-2370/pw_run.sh`;
const engines=[['Chromium',chromium,{}],['WebKit',webkit,fs.existsSync(localWebKit)?{executablePath:localWebKit}:{}]];
async function setup(browser,mode='normal'){
 const page=await browser.newPage({viewport:{width:1280,height:1000},reducedMotion:mode==='reduced'?'reduce':'no-preference'});
 page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/soundtrack.json*',route=>route.fulfill({json:[]}));
 await page.addInitScript(()=>{
  window.resetRenderCalls=0;
  window.readResetMesh=()=>[...document.querySelectorAll('#overlay .point:not(.touch-target)')]
   .filter(node=>!node.dataset.direction||[0,4,20,24].includes(Number(node.dataset.index)))
   .map(node=>({key:node.dataset.index+':'+(node.dataset.direction||''),x:Number(node.getAttribute('cx')),y:Number(node.getAttribute('cy'))}))
   .sort((a,b)=>a.key.localeCompare(b.key));
  const request=window.requestAnimationFrame;
  window.requestAnimationFrame=callback=>request.call(window,time=>{
   callback(time);
   if(callback.name!=='render')return;
   resetRenderCalls++;
   const probe=window.resetProbe;if(!probe||probe.done)return;
   const shape=readResetMesh();probe.frames.push({time:time-probe.started,shape});
   if(probe.interrupted){probe.after=shape;probe.done=true;return}
   if(JSON.stringify(shape)===JSON.stringify(probe.target)){probe.done=true;return}
   // Trigger competing input only after a genuinely intermediate paint.
   const index=probe.before.findIndex((point,i)=>Math.abs(point.x-probe.target[i].x)>1);
   const progress=index<0?0:(shape[index].x-probe.before[index].x)/(probe.target[index].x-probe.before[index].x);
   if(progress>.1&&progress<.9&&probe.action&&!probe.actionTaken){
    probe.actionTaken=true;probe.atInterruption=shape;
    if(probe.action==='repeat')document.querySelector('#dockReset').click();
    else{
     probe.interrupted=true;
     if(probe.action==='node'){
      const node=document.querySelector('#overlay .point.corner[data-index="0"]');node.focus();
      for(const key of ['Enter','ArrowRight'])node.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
     }else if(probe.action==='zoom'){
      const zoom=document.querySelector('#zoom');zoom.value='.8';zoom.dispatchEvent(new Event('input',{bubbles:true}));
     }else if(probe.action==='randomize')document.querySelector('#randomize').click();
     else if(probe.action==='undo')window.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true}));
    }
   }
  });
 });
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelectorAll('#overlay .point:not(.touch-target)').length===33);
 await page.locator('#centerMove').focus();
 if(mode!=='reduced'){
  await page.waitForFunction(()=>!video.paused&&video.currentTime>.1);
  await page.locator('#artworkPlayback').evaluate(button=>button.click());
  await page.waitForFunction(()=>video.paused&&window.siteVisualMotionPaused);
  if(mode==='normal'){
   // Isolate the finite reset animation from decoded video frames. The playback
   // controller retains explicit pause intent, while mesh motion is enabled.
   await page.evaluate(()=>{window.siteVisualMotionPaused=false;window.dispatchEvent(new CustomEvent('site-motion-change',{detail:{paused:false}}))});
  }
 }
 await page.waitForFunction(()=>resetRenderCalls>0);
 return {page,errors,normal:await page.evaluate(()=>readResetMesh())};
}
async function randomize(page){
 const before=await page.evaluate(()=>JSON.stringify(readResetMesh()));
 await page.locator('#randomize').evaluate(button=>button.click());
 await page.waitForFunction(before=>JSON.stringify(readResetMesh())!==before,before);
 return page.evaluate(()=>readResetMesh());
}
async function reset(page,target,action,meshOnly=false){
 await page.evaluate(({target,action,meshOnly})=>{
  window.resetProbe={started:performance.now(),before:readResetMesh(),target,action,frames:[],done:false};
  if(meshOnly)window.dispatchEvent(new KeyboardEvent('keydown',{key:'r',bubbles:true,cancelable:true}));
  else document.querySelector('#dockReset').click();
 },{target,action,meshOnly});
 await page.waitForFunction(()=>resetProbe.done);
 return page.evaluate(()=>resetProbe);
}
async function waitShape(page,shape){await page.waitForFunction(shape=>JSON.stringify(readResetMesh())===JSON.stringify(shape),shape)}
async function idle(page,label){
 await page.waitForTimeout(100);const before=await page.evaluate(()=>resetRenderCalls);
 await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>resetRenderCalls),before,label);
}
async function normalReset(browser,name){
 const {page,errors,normal}=await setup(browser);
 try{
  const warped=await randomize(page),probe=await reset(page,normal,'repeat');
  assert(probe.actionTaken,`${name}: repeated reset must occur during the transition`);
  const intermediate=probe.frames.filter(frame=>JSON.stringify(frame.shape)!==JSON.stringify(warped)&&JSON.stringify(frame.shape)!==JSON.stringify(normal));
  assert(intermediate.length>=2,`${name}: reset must paint intermediate geometry`);
  const sample=intermediate[Math.floor(intermediate.length/2)];
  for(const type of ['anchor','tangent']){
   const differences=warped.map((point,i)=>({point,i})).filter(({point})=>type==='anchor'?point.key.endsWith(':'):!point.key.endsWith(':'));
   assert(differences.some(({point,i})=>Math.abs(point.x-normal[i].x)>1&&sample.shape[i].x!==point.x&&sample.shape[i].x!==normal[i].x),`${name}: ${type} coordinates must animate`);
  }
  // Every coordinate must lie on the same interpolation path, including handles.
  const ratios=[];
  for(let i=0;i<warped.length;i++)for(const axis of ['x','y'])if(Math.abs(normal[i][axis]-warped[i][axis])>1)ratios.push((sample.shape[i][axis]-warped[i][axis])/(normal[i][axis]-warped[i][axis]));
  assert(Math.min(...ratios)>0&&Math.max(...ratios)<1);
  assert(Math.max(...ratios)-Math.min(...ratios)<1e-9,`${name}: anchors and tangents share transition progress`);
  const duration=probe.frames.at(-1).time;
  assert(duration>=480&&duration<1500,`${name}: expected approximately 500 ms reset, observed ${duration} ms`);
  assert.deepEqual(await page.evaluate(()=>readResetMesh()),normal);
  assert.equal(await page.locator('#dockReset').evaluate(button=>button.classList.contains('available')),false);
  await idle(page,`${name}: a completed reset must stop rendering while video alone is paused`);
  await page.keyboard.press('Control+z');await waitShape(page,warped);
  await page.keyboard.press('Control+z');await waitShape(page,normal);
  // A dock click during R's mesh-only transition upgrades the same reset to
  // restore the view, without canceling the animation or adding an undo step.
  await page.locator('#zoom').evaluate(input=>{input.value='.7';input.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.waitForFunction(()=>Math.abs(new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.stage-wrap')).transform).a-.7)<.00001);
  const upgradeWarp=await randomize(page),upgrade=await reset(page,normal,'repeat',true);
  assert(upgrade.actionTaken,`${name}: dock reset must upgrade an active mesh-only reset`);
  await page.waitForFunction(()=>Math.abs(new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.stage-wrap')).transform).a-1)<.00001);
  assert.deepEqual(await page.evaluate(()=>readResetMesh()),normal);
  await page.keyboard.press('Control+z');await waitShape(page,upgradeWarp);
  assert(Math.abs(await page.locator('.stage-wrap').evaluate(node=>new DOMMatrixReadOnly(getComputedStyle(node).transform).a)-.7)<.00001,`${name}: one undo restores the pre-reset view after an upgrade`);
  assert.deepEqual(errors,[]);
  console.log(`${name}: intermediate anchor/tangent paints, ${Math.round(duration)} ms completion, repeated reset, mesh-to-full reset upgrade, exact undo and RAF idle passed`);
 }finally{await page.close()}
}
async function interruptions(browser,name){
 const {page,errors,normal}=await setup(browser);
 try{
  for(const action of ['node','zoom','randomize','undo']){
   const warped=await randomize(page),probe=await reset(page,normal,action);
   assert(probe.interrupted,`${name}: ${action} must interrupt an intermediate reset frame`);
   if(action==='node'){
    const index=probe.after.findIndex(point=>point.key==='0:');
    const width=await page.locator('#stage').evaluate(stage=>stage.clientWidth);
    assert(Math.abs(probe.after[index].x-probe.atInterruption[index].x-width*.004)<1e-8,`${name}: keyboard node edit applies to current intermediate geometry`);
   }else if(action==='zoom'){
    assert.deepEqual(probe.after,probe.atInterruption);
    await page.waitForFunction(()=>Math.abs(new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.stage-wrap')).transform).a-.8)<.00001);
   }else if(action==='randomize')assert.notDeepEqual(probe.after,probe.atInterruption);
   else assert.deepEqual(probe.after,warped);
   await page.waitForTimeout(600);
   assert.deepEqual(await page.evaluate(()=>readResetMesh()),probe.after,`${name}: canceled reset must not overwrite ${action}`);
  }
  assert.deepEqual(errors,[]);console.log(`${name}: node edit, zoom, randomize and undo cancel reset without later overwrite`);
 }finally{await page.close()}
}
async function immediateReset(browser,name,mode){
 const {page,errors,normal}=await setup(browser,mode);
 try{
  const warped=await randomize(page),probe=await reset(page,normal);
  assert.equal(probe.frames.length,1,`${name}: ${mode} reset must finish in its first paint`);
  assert.deepEqual(probe.frames[0].shape,normal);
  await idle(page,`${name}: ${mode} reset must remain idle`);
  await page.keyboard.press('Control+z');await waitShape(page,warped);
  assert.deepEqual(errors,[]);console.log(`${name}: ${mode} reset is immediate and undoable`);
 }finally{await page.close()}
}
(async()=>{
 for(const[name,type,options]of engines){
  const browser=await type.launch(options);
  try{await normalReset(browser,name);await interruptions(browser,name);await immediateReset(browser,name,'reduced');await immediateReset(browser,name,'paused')}
  finally{await browser.close()}
 }
})().catch(error=>{console.error(error);process.exitCode=1});
