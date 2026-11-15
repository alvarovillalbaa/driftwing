import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const origin='https://driftwing-alvaro.vercel.app',out=process.env.DRIFTWING_OUTPUT;
assert.equal(process.env.CI,'true');assert.equal(process.env.DRIFTWING_HOSTED_ORIGIN,origin);
assert.match(process.env.DRIFTWING_RELEASE_SOURCE,/^[a-f0-9]{40}$/);
assert.match(process.env.DRIFTWING_DEPLOYMENT,/^dpl_[A-Za-z0-9]+$/);
const end=Date.now()+28000;
const report={schema:'driftwing.generated-hosted.v1',qaSource:process.env.SOURCE_COMMIT,releaseSource:process.env.DRIFTWING_RELEASE_SOURCE,
 deployment:process.env.DRIFTWING_DEPLOYMENT,origin,passed:false,errors:[],boundaries:[],visuals:[],cleanup:{}};
let server,browser,context,child;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function within(action,seconds=5,cleanup=false){let timer;const available=cleanup?seconds*1000:Math.min(seconds*1000,end-Date.now());assert.ok(available>0);
 try{return await Promise.race([action(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Owned H01 deadline')),available);})]);}finally{clearTimeout(timer);}}
async function mode(page,value){while(Date.now()<end){if(await page.locator('body').getAttribute('data-mode')===value)return;await pause(50);}throw Error('Mode '+value+' not observed');}
async function fit(page){return page.evaluate(()=>{const c=document.getElementById('sky'),r=c.getBoundingClientRect();return{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,canvas:{x:r.x,y:r.y,width:r.width,height:r.height},attributes:c.getContext('2d').getContextAttributes()};});}
try{
 const {chromium}=await import(pathToFileURL(process.env.DRIFTWING_PLAYWRIGHT_MODULE).href);
 server=await within(()=>chromium.launchServer({headless:true,channel:'chromium',timeout:10000}),12);
 child=server.process();assert.ok(child?.pid);report.browserExecutable=fs.realpathSync(chromium.executablePath());
 assert.ok(report.browserExecutable.startsWith(process.env.PLAYWRIGHT_BROWSERS_PATH+'/'));
 browser=await within(()=>chromium.connect(server.wsEndpoint()),5);report.chromium=browser.version();
 context=await within(()=>browser.newContext({viewport:{width:320,height:844},hasTouch:true,isMobile:true,locale:'en-US',serviceWorkers:'block',acceptDownloads:false}),5);
 context.setDefaultTimeout(7000);context.setDefaultNavigationTimeout(10000);
 const routes=new Set(['/','/index.html','/styles.css','/favicon.svg','/src/game.js','/src/flight.js','/src/records.js','/src/renderer.js','/src/audio.js']);
 await context.route('**/*',async route=>{const req=route.request(),u=new URL(req.url()),h=await req.allHeaders();
  if(u.origin!==origin||u.search||!routes.has(u.pathname)||!['GET','HEAD'].includes(req.method())||req.postDataBuffer()?.length||h.cookie||h.authorization){report.boundaries.push('unexpected native request');await route.abort();return;}await route.continue();});
 await context.routeWebSocket('**/*',r=>{report.boundaries.push('websocket');r.close();});
 context.on('requestfailed',r=>report.boundaries.push('requestfailed '+new URL(r.url()).pathname));
 context.on('response',r=>{if(r.status()>=400)report.boundaries.push('HTTP '+r.status());});
 const page=await context.newPage();page.on('pageerror',e=>report.boundaries.push('pageerror '+String(e.message).slice(0,300)));
 page.on('console',m=>{if(m.type()==='error')report.boundaries.push('consoleerror '+m.text().slice(0,300));});
 page.on('dialog',d=>{report.boundaries.push('unexpected dialog');void d.dismiss();});
 const response=await within(()=>page.goto(origin+'/',{waitUntil:'load'}),12);assert.equal(response.status(),200);assert.equal(response.url(),origin+'/');await mode(page,'menu');
 assert.equal(await page.locator('#course-options button').count(),6);assert.equal(await page.locator('#error-overlay').isVisible(),false);
 report.generatedIdentity=await page.locator('#saved-levels').inputValue();
 const bounds=await fit(page);assert.equal(bounds.width,320);assert.equal(bounds.scrollWidth,320);assert.deepEqual(bounds.canvas,{x:0,y:0,width:320,height:844});assert.equal(bounds.attributes.desynchronized,false);report.initial=bounds;
 await page.locator('#start-button').tap();await mode(page,'flying');
 const began=Date.now();let actualEvent=null;
 while(Date.now()-began<9000&&Date.now()<end){actualEvent=await page.locator('#flight-event').textContent();if(await page.locator('#flight-event').evaluate(e=>e.classList.contains('visible')))break;await pause(100);}
 assert.ok(actualEvent&&await page.locator('#flight-event').evaluate(e=>e.classList.contains('visible')),'native earned ring announcement');
 report.earnedAnnouncement=actualEvent;
 await page.locator('#pause-button').tap();await mode(page,'paused');await page.locator('#pause-menu-button').tap();await mode(page,'menu');
 assert.equal(await page.locator('#flight-event').evaluate(e=>getComputedStyle(e).display),'none');report.returnedMenu=await fit(page);
 assert.equal(report.returnedMenu.scrollWidth,320);assert.equal(await page.locator('#start-button').isVisible(),true);
 const b=await within(()=>page.screenshot({type:'png',fullPage:false}),5);assert.ok(b.length>0&&b.length<2097152);
 const file='h01-menu-320.png';fs.writeFileSync(path.join(out,file),b,{flag:'wx'});report.visuals.push({file,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex'),kind:'untouched native viewport'});
 await page.reload({waitUntil:'load'});await mode(page,'menu');assert.equal(await page.locator('#saved-levels').inputValue(),report.generatedIdentity);
 assert.match(report.generatedIdentity,/^v2-coast-[1-9]\d*-1$/);assert.equal(await page.locator('#flight-event').evaluate(e=>getComputedStyle(e).display),'none');
 report.passed=true;
}catch(error){report.errors.push(String(error.message).slice(0,1200));}
finally{
 try{
  if(context){let observed=false;context.on('close',()=>{observed=true;});await within(()=>context.close(),3,true);report.cleanup.contextClosed=observed;assert.equal(observed,true);}
  if(browser){await within(()=>browser.close(),3,true);report.cleanup.browserCloseAcknowledged=true;}
  if(server){await within(()=>server.close(),4,true);let absent=false;try{process.kill(child.pid,0);}catch(e){absent=e.code==='ESRCH';}
   report.cleanup.native={pid:child.pid,exitCode:child.exitCode,absent,stdoutEnded:child.stdout?.readableEnded??null,stderrEnded:child.stderr?.readableEnded??null};
   assert.equal(child.exitCode,0);assert.equal(absent,true);}
 }catch(error){report.errors.push('normal cleanup: '+String(error.message).slice(0,500));}
 report.passed=Boolean(report.passed&&!report.errors.length&&!report.boundaries.length&&report.cleanup.contextClosed&&report.cleanup.browserCloseAcknowledged&&report.cleanup.native?.exitCode===0&&report.cleanup.native.absent);
 fs.writeFileSync(path.join(out,'hosted-browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 process.exit(report.passed?0:1);
}
