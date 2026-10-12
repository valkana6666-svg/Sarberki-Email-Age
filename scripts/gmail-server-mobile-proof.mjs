// Local synthetic proof of the existing Gmail page, not a real iPhone/cloud test.
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const root=resolve('.'),report={syntheticOnly:true,cloudVerified:false,actualIPhoneVerified:false,emailSent:false,pushoverSent:false,bookingCreated:false,apiMethods:[],blockedExternalRequests:0,checks:[]};
const server=createServer((req,res)=>{
 try{
  const path=new URL(req.url,'http://127.0.0.1').pathname;
  if(req.method!=='GET'||!/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\.(?:mjs|js|html|css|svg|png|webp)$/.test(path))throw Error('PATH');
  const file=resolve(root,'.'+path);if(!file.startsWith(root+sep))throw Error('PATH');
  if(path.endsWith('.html')&&path!=='/index.html')throw Error('PATH');
  res.writeHead(200,{'Content-Type':/\.(mjs|js)$/.test(path)?'text/javascript; charset=utf-8':path.endsWith('.html')?'text/html; charset=utf-8':path.endsWith('.svg')?'image/svg+xml':path.endsWith('.css')?'text/css':'image/png','Cache-Control':'no-store'});res.end(readFileSync(file));
 }catch{res.writeHead(404);res.end();}
});
let browser;
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 for(const [engine,launcher]of [['chromium',chromium],['webkit',webkit]]){
  browser=await launcher.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin===origin)return route.continue();report.blockedExternalRequests++;return route.abort();});
  const page=await context.newPage();await page.goto(origin+'/index.html');await page.locator('#server_preview_panel summary').click();
  await page.locator('#server_preview_case_id').fill('case-synthetic-mobile');await page.locator('#server_preview_revision').fill('2');
  await page.locator('#server_preview_action').click();await page.locator('#server_preview_status').filter({hasText:'bejelentkezés'}).waitFor();
  report.checks.push({engine,test:'missing-auth-no-preview',result:'PASS'});
  await page.evaluate(()=>{
   window.__previewRequests=[];
   const result={caseId:'case-synthetic-mobile',revision:2,persisted:false,approval:'pending',text:'Synthetic English guest draft: <img src=x onerror="window.__unsafe=true">',operatorReviewText:'Magyar ellenőrzés: 2 felnőtt, pontosítandó időpont.',decision:{facts:{language:'en',guests:2},missing:['dates'],contradictions:[],requiresHumanReview:true,capacity:{status:'UNKNOWN',verified:false},pricing:{verified:false}},reviewState:{caseRevision:2,factsRevision:1,latestDraftRevision:0,latestDraftMessageCount:0,messageCount:1,auditStatus:'not_verified'}};
   window.SarberkiCaseStoreSession={getAccessToken:async()=> 'synthetic-local-token',request:async(url,options)=>{window.__previewRequests.push({method:options.method,bodyPresent:options.body!==undefined});return {ok:true,json:async()=>({result})};}};
  });
  await page.locator('#server_preview_action').click();await page.locator('#server_preview_status').filter({hasText:'Belső előnézet kész'}).waitFor();
  assert.match(await page.locator('#server_preview_details').innerText(),/érkezési/);assert.match(await page.locator('#server_preview_hu').inputValue(),/Magyar ellenőrzés/);
  assert.match(await page.locator('#server_preview_capacity').innerText(),/NEM IGAZOLT/);assert.match(await page.locator('#server_preview_price').innerText(),/NEM IGAZOLT/);
  assert.match(await page.locator('#server_preview_revision_state').innerText(),/Új ellenőrzés/);assert.match(await page.locator('#server_preview_audit').innerText(),/NEM IGAZOLT/);
  assert.equal(await page.locator('#server_preview_text').getAttribute('readonly'),'');assert.equal(await page.locator('#server_preview_panel img').count(),0);assert.equal(await page.evaluate(()=>window.__unsafe===true),false);
  const requests=await page.evaluate(()=>window.__previewRequests);assert.deepEqual(requests,[{method:'GET',bodyPresent:false}]);report.apiMethods.push(...requests.map(x=>x.method));
  report.checks.push({engine,test:'common-states-Hungarian-no-false-success-readonly-GET',result:'PASS'});
  assert.equal(await page.evaluate(()=>{const p=document.getElementById('server_preview_panel');return p.scrollWidth<=p.clientWidth&&p.getBoundingClientRect().right<=innerWidth;}),true);
  const height=await page.locator('#server_preview_action').evaluate(el=>el.getBoundingClientRect().height);assert.ok(height>=44);
  report.checks.push({engine,test:'390px-touch-target-no-panel-overflow',result:'PASS'});
  await page.locator('#server_preview_revision').fill('3');assert.equal(await page.locator('#server_preview_text').inputValue(),'');assert.equal(await page.locator('#server_preview_hu').inputValue(),'');
  assert.match(await page.locator('#server_preview_capacity').innerText(),/NEM IGAZOLT/);report.checks.push({engine,test:'revision-edit-invalidates-preview',result:'PASS'});
  await browser.close();browser=null;
 }
 report.result='PASS';
}catch(error){report.result='FAIL';report.error=String(error.message);process.exitCode=1;}
finally{
 if(browser)await browser.close();await new Promise(r=>server.close(r));const directory=process.env.GMAIL_SERVER_PROOF_DIRECTORY||'/tmp/sarberki-gmail-server-proof';mkdirSync(directory,{recursive:true});writeFileSync(resolve(directory,'RESULT.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
