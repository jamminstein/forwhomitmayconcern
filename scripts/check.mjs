import {readFile,readdir,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {MEDIA} from '../site-config.js';
const root=process.env.SITE_ROOT||'.';
const release=await readFile(path.join(root,'release.json'),'utf8').then(text=>JSON.parse(text).release).catch(error=>{if(error.code==='ENOENT')return null;throw error});
for(const file of (await readdir(root)).filter(name=>name.endsWith('.js'))){
 const result=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});if(result.status)throw Error(result.stderr);
 const script=await readFile(path.join(root,file),'utf8');
 for(const match of script.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"](\.\/[^'"]+\.js(?:\?[^'"]*)?)['"]/g)){
  const url=new URL(match[1],'http://local/');await access(path.join(root,url.pathname));
  if(release&&url.searchParams.get('v')!==release)throw Error(`Mixed module version in ${file}: ${match[1]}`);
 }
}
const html=await readFile(path.join(root,'index.html'),'utf8');
if(release&&!html.includes(`<meta name="site-version" content="${release}">`))throw Error('HTML release does not match release.json');
if(release)for(const match of html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))(\?[^"#]*)?"/g))if(!/^https?:/.test(match[1])&&new URLSearchParams(match[2]?.slice(1)).get('v')!==release)throw Error(`Unversioned entrypoint: ${match[1]}`);
for(const match of html.matchAll(/(?:src|href)="([^"?#]+)(?:\?[^"#]*)?"/g)){const file=match[1];if(/^(?:https?:|data:|#|mailto:)/.test(file))continue;await access(path.join(root,file))}
for(const file of Object.values(MEDIA))await access(path.join(root,file));
const passages=JSON.parse(await readFile(path.join(root,'writings.json'),'utf8'));
if([...html.matchAll(/<p data-writing/g)].length!==passages.length)throw Error('Missing semantic text');
if(!html.includes('tiagopereira@me.com')&&!((await readFile(path.join(root,'contact.js'),'utf8')).includes('tiagopereira@me.com')))throw Error('Missing contact email');
console.log('Syntax, page assets, media configuration, and semantic content checks passed.');
