import http from 'node:http';
import {readFile,stat,writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
const root=path.resolve('public'),manifest=JSON.parse(await readFile(process.env.DRIFTWING_MANIFEST,'utf8'));
const files=new Map(manifest.map(x=>['/'+x.path,x.path]));files.set('/','index.html');
const headers=Object.fromEntries(JSON.parse(await readFile('vercel.json','utf8')).headers[0].headers.map(x=>[x.key,x.value]));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://127.0.0.1');
 if(!['GET','HEAD'].includes(req.method)||u.search||!files.has(u.pathname)){res.writeHead(404);res.end();return;}
 const file=path.join(root,files.get(u.pathname)),s=await stat(file);
 res.writeHead(200,{...headers,'Content-Type':types[path.extname(file)],'Content-Length':s.size});
 if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);
}catch(e){console.error(String(e));if(!res.headersSent)res.writeHead(500);res.end();}});
server.keepAliveTimeout=1000;
server.listen(0,'127.0.0.1',async()=>{const url='http://127.0.0.1:'+server.address().port;await writeFile(process.env.DRIFTWING_READY,JSON.stringify({url,pid:process.pid})+'\n');console.log(url);});
for(const sig of ['SIGTERM','SIGINT'])process.once(sig,()=>{server.close(()=>process.exit(0));server.closeIdleConnections();});
