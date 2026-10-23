const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.BASE_URL||'http://127.0.0.1:8766';
const webkitLocal='/Users/tiago/Library/Caches/ms-playwright/webkit-2370/pw_run.sh';
const engines=[['Chromium',chromium,{}],['WebKit',webkit,fs.existsSync(webkitLocal)?{executablePath:webkitLocal}:{}]];
const anchors=p=>p.locator('#overlay .point:not(.touch-target):not(.tangent)').evaluateAll(nodes=>nodes.map(e=>[e.getAttribute('cx'),e.getAttribute('cy')]));
async function checkPointerOwnership(page){
 const corner=page.locator('#overlay .point.corner[data-index="0"]');
 await page.dispatchEvent('.stage-wrap','pointerenter');
 const bounds=await corner.boundingBox(),x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2;
 await page.mouse.move(x,y);await page.mouse.down();
 const before=await anchors(page);
 await page.locator('#overlay .point.corner[data-index="4"]').dispatchEvent('pointerdown',{pointerId:99,button:0,clientX:x+200,clientY:y});
 await page.dispatchEvent('#stage','pointermove',{pointerId:99,clientX:x+200,clientY:y+100});
 await page.waitForTimeout(60);assert.deepEqual(await anchors(page),before,'A second pointer cannot hijack a warp drag');
 await page.dispatchEvent('#stage','pointercancel',{pointerId:99});
 await page.mouse.move(x+35,y+15);await page.waitForTimeout(60);
 assert.notDeepEqual(await anchors(page),before,'Canceling a different pointer must not end the active warp drag');
 await page.mouse.up();await page.keyboard.press('Control+z');await page.waitForTimeout(60);
 const stage=await page.locator('#stage').boundingBox(),cx=stage.x+stage.width*.56,cy=stage.y+stage.height*.56;
 await page.mouse.move(cx,cy);await page.mouse.down();
 const view=await page.locator('.stage-wrap').evaluate(e=>e.style.transform);
 await page.locator('#overlay .point.corner[data-index="4"]').dispatchEvent('pointerdown',{pointerId:99,button:0,clientX:cx+200,clientY:cy});
 await page.dispatchEvent('.stage-wrap','pointermove',{pointerId:99,clientX:cx+200,clientY:cy+100});
 await page.waitForTimeout(60);assert.equal(await page.locator('.stage-wrap').evaluate(e=>e.style.transform),view,'A second pointer cannot hijack a whole-video drag');
 await page.dispatchEvent('.stage-wrap','pointercancel',{pointerId:99});
 await page.mouse.move(cx+35,cy+15);await page.waitForTimeout(60);
 assert.notEqual(await page.locator('.stage-wrap').evaluate(e=>e.style.transform),view,'Canceling a different pointer must not end the active whole-video drag');
 await page.mouse.up();await page.keyboard.press('Control+z');
}
(async()=>{for(const[name,type,options]of engines){
 const browser=await type.launch(options),page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/soundtrack.json',r=>r.fulfill({json:[]}));
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedEmail=text}}})});
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelectorAll('#overlay .point').length>25);
 await page.waitForFunction(()=>document.querySelector('#video').currentTime>.1);
 await page.locator('#stage').hover();const original=await anchors(page);await page.locator('#randomize').click();await page.waitForTimeout(80);assert.notDeepEqual(await anchors(page),original);
 await page.keyboard.press('Control+z');await page.waitForTimeout(80);assert.deepEqual(await anchors(page),original);
 await page.locator('#randomize').click();await page.waitForTimeout(80);await page.keyboard.press('Meta+z');await page.waitForTimeout(80);assert.deepEqual(await anchors(page),original);
 await page.locator('#zoom').evaluate(e=>{e.value='1.4';e.dispatchEvent(new Event('input',{bubbles:true}))});await page.keyboard.press('Control+z');assert.equal(await page.locator('#zoom').inputValue(),'1');
 assert.deepEqual(await page.evaluate(()=>{
   const zoom=document.querySelector('#zoom'),values=[];
   for(const value of ['1.3','1.5']){
     zoom.value=value;zoom.dispatchEvent(new Event('input',{bubbles:true}));
     window.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true}));
     values.push(zoom.value);
   }
   return values;
 }),['1','1'],'Undo ends a zoom gesture so an immediate new edit can also be undone');
 assert.equal(await page.locator('#overlay [tabindex="0"]').count(),1);
 await page.locator('#overlay [tabindex="0"]').focus();await page.waitForTimeout(3100);assert.equal(await page.locator('#overlay').evaluate(e=>getComputedStyle(e).opacity),'1');
 await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>document.activeElement.dataset.index),'1');
 await page.keyboard.press('Enter');await page.keyboard.press('ArrowRight');await page.waitForTimeout(80);assert.notDeepEqual(await anchors(page),original);
 await page.keyboard.press('Control+z');await page.waitForTimeout(80);assert.deepEqual(await anchors(page),original);
 await page.keyboard.press('Tab');assert(!(await page.evaluate(()=>document.activeElement.closest('#overlay'))));
 await page.locator('#zoom').evaluate(e=>{e.value='1.3';e.dispatchEvent(new Event('input',{bubbles:true}))});await page.locator('.transform-grip').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#zoom').inputValue(),'1');
 await page.locator('#contactEmail').click();assert.equal(await page.evaluate(()=>window.copiedEmail),'tiagopereira@me.com');assert.equal(await page.locator('.contact-status-text').textContent(),'email copied to clipboard');
 assert.equal(await page.locator('#identityHeading').textContent(),'Tiago Pereira — creative direction');assert.equal(await page.locator('#siteText [data-writing]').count(),6);
 await checkPointerOwnership(page);
 const supported=await page.evaluate(()=>{const gl=document.querySelector('#gl').getContext('webgl');window.lossExtension=gl?.getExtension('WEBGL_lose_context');if(!window.lossExtension)return false;window.lossExtension.loseContext();return true});
 if(supported){await page.waitForFunction(()=>document.querySelector('#stage').dataset.renderer==='fallback');assert.equal(await page.locator('#video').evaluate(e=>getComputedStyle(e).opacity),'1');await page.waitForTimeout(150);await page.evaluate(()=>window.lossExtension.restoreContext());await page.waitForFunction(()=>document.querySelector('#stage').dataset.renderer==='warp');}
 assert.deepEqual(errors,[]);await page.close();
 const fallback=await browser.newPage();await fallback.route('**/soundtrack.json',r=>r.fulfill({json:[]}));await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl'?null:original.call(this,kind,...args)}});await fallback.goto(base,{waitUntil:'domcontentloaded'});await fallback.waitForFunction(()=>document.querySelector('#stage').dataset.renderer==='fallback');await fallback.waitForFunction(()=>document.querySelector('#video').currentTime>.1);assert.equal(await fallback.locator('#video').evaluate(e=>getComputedStyle(e).opacity),'1');await fallback.close();
 console.log(name+': undo, keyboard, contact, semantics, graphics fallback/restoration passed');await browser.close();
}})().catch(error=>{console.error(error);process.exit(1)});
