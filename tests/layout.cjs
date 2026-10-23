const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.BASE_URL||'http://127.0.0.1:8766';
const webkitLocal='/Users/tiago/Library/Caches/ms-playwright/webkit-2370/pw_run.sh';
const engines=[['Chromium',chromium,{}],['WebKit',webkit,fs.existsSync(webkitLocal)?{executablePath:webkitLocal}:{}]];
const viewports=[['phone',390,844],['small phone',320,568],['landscape phone',844,390],['tablet',820,1180],['landscape tablet',1024,768]];
(async()=>{
 for(const [engine,type,options] of engines){
  const browser=await type.launch(options);
  try{
   for(const [name,width,height] of viewports){
    const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/soundtrack.json',route=>route.fulfill({json:[]}));
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('#video')?.currentTime>.1&&document.querySelectorAll('.page-writing').length===6&&document.querySelectorAll('#overlay .point').length>25);
    const state=await page.evaluate(()=>{
     const bounds=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}};
     return{width:innerWidth,scrollWidth:document.documentElement.scrollWidth,dock:bounds('.glass-dock'),stage:bounds('.stage-wrap'),dockPosition:getComputedStyle(document.querySelector('.glass-dock')).position,touchDisplay:getComputedStyle(document.querySelector('.touch-target')).display};
    });
    assert.equal(state.width,width,`${name}: oversized canvas must not widen the layout viewport`);
    assert.equal(state.scrollWidth,width,`${name}: no horizontal overflow`);
    assert.equal(state.dockPosition,'fixed');assert.equal(state.touchDisplay,'block');
    assert(state.dock.x>=0&&state.dock.x+state.dock.width<=width+1,`${name}: all controls fit horizontally`);
    assert(state.dock.y+state.dock.height<height,`${name}: controls fit above the screen edge`);
    assert(state.stage.y+state.stage.height<=state.dock.y,`${name}: initial artwork leaves room for controls`);
    await page.evaluate(()=>scrollTo(0,300));
    const controls=await page.evaluate(()=>['#musicPlay','#randomize','#morph','#zoom','#soundtrackVolume'].map(selector=>{
     const node=document.querySelector(selector),r=node.getBoundingClientRect();
     return{selector,hit:node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};
    }));
    for(const control of controls)assert(control.hit,`${name}: ${control.selector} remains tappable while scrolling`);
    assert(Math.abs(await page.locator('.glass-dock').evaluate(e=>e.getBoundingClientRect().y)-state.dock.y)<1,`${name}: transport stays in place while scrolling`);
    await page.evaluate(()=>{const r=document.querySelector('.drum-pad').getBoundingClientRect();scrollBy(0,r.top-(innerHeight/2-15))});
    assert(await page.locator('.drum-pad').first().evaluate(node=>{const r=node.getBoundingClientRect();return node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),`${name}: drum remains tappable over the artwork`);
    await page.evaluate(()=>scrollTo(0,0));await page.dispatchEvent('.stage-wrap','pointerenter',{pointerType:'touch'});
    const points=await page.evaluate(()=>[...document.querySelectorAll('#overlay .point.corner')].flatMap(node=>{
     const r=node.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
     return[[0,0],[-7,-7],[7,-7]].map(([dx,dy])=>({index:node.dataset.index,hitIndex:document.elementFromPoint(x+dx,y+dy)?.dataset.index}));
    }));
    for(const point of points)assert.equal(point.hitIndex,point.index,`${name}: corner touch targets take priority over nearby transform grips`);
    assert.deepEqual(errors,[]);await page.close();
    console.log(`${engine}: ${name} viewport, playback, control reachability, and mesh touch targets passed`);
   }
  }finally{await browser.close()}
 }
})().catch(error=>{console.error(error);process.exit(1)});
