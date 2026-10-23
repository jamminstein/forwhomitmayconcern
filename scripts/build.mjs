import {readFile,writeFile,readdir,mkdir,rm,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {MEDIA} from '../site-config.js';
const root=path.resolve('.'),out=path.join(root,'dist');
const assets=['brand-logos','drum-samples','dancers','vendor','favicon.svg','favicon.png','favicon.ico','favicon.gif','portrait-cutout.webp','share-preview.jpg','CNAME',MEDIA.fallback,path.dirname(MEDIA.manifest)];
const runtime=(await readdir(root)).filter(name=>/\.(js|css|html|json)$/.test(name)&&!['package.json','package-lock.json','glass.js','project-links.js'].includes(name)).sort();
const hash=createHash('sha256');for(const name of runtime)hash.update(name).update(await readFile(name));
hash.update(await readFile('scripts/build.mjs'));
async function hashAsset(name){
 const entries=await readdir(name,{withFileTypes:true}).catch(error=>{if(error.code==='ENOTDIR')return null;throw error});
 if(entries){for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name,'en')))await hashAsset(path.join(name,entry.name));return}
 hash.update(name);for await(const chunk of createReadStream(name))hash.update(chunk);
}
for(const name of assets)await hashAsset(name);
const release=hash.digest('hex').slice(0,12);
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
const versioned=(url)=>/^(?:https?:|data:|#)/.test(url)?url:`${url.split('?')[0]}?v=${release}`;
for(const name of runtime){
 let text=await readFile(name,'utf8');
 if(name.endsWith('.js'))text=text.replace(/((?:from\s*|import\s*\(\s*|import\s*)(['"]))(\.\/[^'"]+\.js)(?:\?[^'"]*)?\2/g,(_,prefix,quote,file)=>prefix+versioned(file)+quote);
 if(name==='index.html'){
  text=text.replace(/(<meta name="site-version" content=")[^"]*/,'$1'+release);
  text=text.replace(/((?:src|href)=")([^"?#]+\.(?:js|css|png|webp|svg|ico))(?:\?[^"#]*)?("[\s>])/g,(_,prefix,url,suffix)=>prefix+versioned(url)+suffix);
  text=text.replace(/(<link rel="preload" as="image" href=")[^"]+/,`$1${MEDIA.poster}`);
  const passages=JSON.parse(await readFile('writings.json','utf8'));
  let index=0;text=text.replace(/(<p data-writing[^>]*>)[\s\S]*?(<\/p>)/g,(_,start,end)=>start+escapeHtml(passages[index++])+end);
  if(index!==passages.length)throw Error('Semantic writing slots do not match writings.json');
 }
 await writeFile(path.join(out,name),text);
}
function escapeHtml(text){return text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}
for(const name of assets){await mkdir(path.dirname(path.join(out,name)),{recursive:true});await cp(name,path.join(out,name),{recursive:true})}
await writeFile(path.join(out,'.nojekyll'),'');await writeFile(path.join(out,'release.json'),JSON.stringify({release},null,2));
console.log(`Built release ${release}: current artwork and runtime assets only.`);
