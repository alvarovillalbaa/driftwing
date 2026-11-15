import {readdir,readFile,lstat} from 'node:fs/promises';import path from 'node:path';
import {createHash} from 'node:crypto';import {gzipSync} from 'node:zlib';
const root=process.env.DRIFTWING_OUTPUT;if(!root)throw Error('Owned proof root');
const allowed=new Set(['node-runner.json','node-inputs.json','source-before.json','source-after.json']);
let total=0;for(const name of (await readdir(root)).sort()){
 const file=path.join(root,name),s=await lstat(file);if(!s.isFile()||s.isSymbolicLink()||!allowed.has(name)&&!/^\d\d-[a-z0-9-]+\.(stdout|stderr)\.txt$/.test(name)||s.size>2*1024*1024||(total+=s.size)>8*1024*1024)throw Error('Unexpected/excessive proof');
 const b=await readFile(file),packed=gzipSync(b,{level:9,mtime:0}).toString('base64');
 console.log('DRIFTWING_GENERATED_FILE '+JSON.stringify({name,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex'),codec:'gzip-base64',chunks:Math.ceil(packed.length/3000)}));
 for(let offset=0;offset<packed.length;offset+=3000)console.log('DRIFTWING_GENERATED_CHUNK '+JSON.stringify({name,index:offset/3000,data:packed.slice(offset,offset+3000)}));
}

