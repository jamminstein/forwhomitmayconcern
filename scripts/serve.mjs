import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(process.env.SITE_ROOT||'.'),port=Number(process.env.PORT||8766);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.mp4':'video/mp4','.m4s':'video/iso.segment','.m3u8':'application/vnd.apple.mpegurl','.wav':'audio/wav','.ico':'image/x-icon','.gif':'image/gif'};
http.createServer(async(req,res)=>{
 try {
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
  const info=await stat(file);if(!info.isFile())throw Error('Not a file');
  let start=0,end=info.size-1,status=200;
  const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  if(range){start=Number(range[1]);end=range[2]?Math.min(Number(range[2]),end):end;status=206;if(start>end){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return}}
  const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':end-start+1,'Accept-Ranges':'bytes','Cache-Control':'no-cache'};
  if(status===206)headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;
  res.writeHead(status,headers);if(req.method==='HEAD'){res.end();return}
  const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
 }catch{res.writeHead(404);res.end('Not found')}
}).listen(port,'127.0.0.1',()=>console.log(`Serving ${root} on http://127.0.0.1:${port}`));
