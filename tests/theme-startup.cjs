// A stored theme must be visible before a delayed application module executes.
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const base=process.env.BASE_URL||'http://127.0.0.1:8766';
const localWebKit=path.join(os.homedir(),'Library/Caches/ms-playwright/webkit-2370/pw_run.sh');
const engines=[['Chromium',chromium,{}],['WebKit',webkit,fs.existsSync(localWebKit)?{executablePath:localWebKit}:{}]];
(async()=>{
 for(const [name,engine,options] of engines){
  const browser=await engine.launch(options);
  try{
   for(const stored of ['dark',null,'blocked']){
    const page=await browser.newPage({reducedMotion:'reduce'});
    const expected=stored==='dark'?'dark':'light',color=expected==='dark'?'rgb(9, 10, 13)':'rgb(255, 255, 255)';
    await page.addInitScript(stored=>{
     if(stored==='blocked')Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage unavailable','SecurityError')}});
     else if(stored)localStorage.setItem('jamminstein-theme',stored);
    },stored);
    await page.route('**/soundtrack.json*',route=>route.fulfill({json:[]}));
    let release;
    const application=new Promise(resolve=>release=resolve);
    await page.route('**/app.js*',async route=>{await application;await route.continue().catch(()=>{})});
    try{
     await page.goto(base,{waitUntil:'commit'});
     await page.waitForFunction(()=>document.body&&document.querySelector('#themeToggle')&&document.styleSheets.length>=3);
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     const initial=await page.evaluate(()=>({theme:document.documentElement.dataset.theme,background:getComputedStyle(document.body).backgroundColor,chrome:document.querySelector('meta[name="theme-color"]').content,appLoaded:!!document.querySelector('#themeToggle svg')}));
     assert.equal(initial.appLoaded,false,'Inspect the first painted state while the application is still loading');
     assert.equal(initial.theme,expected);assert.equal(initial.background,color);
     assert.equal(initial.chrome,expected==='dark'?'#090a0d':'#ffffff');
     release();
     await page.waitForSelector('#themeToggle svg');
     await page.locator('#themeToggle').click();
     await page.waitForFunction(previous=>document.documentElement.dataset.theme!==previous,expected);
     assert.equal(await page.locator('#themeToggle').getAttribute('aria-label'),expected==='dark'?'Switch to dark mode':'Switch to light mode');
     console.log(`${name}: ${stored||'default light'} theme paints before modules and remains toggleable`);
    }finally{release();await page.close()}
   }
  }finally{await browser.close()}
 }
})().catch(error=>{console.error(error);process.exitCode=1});
