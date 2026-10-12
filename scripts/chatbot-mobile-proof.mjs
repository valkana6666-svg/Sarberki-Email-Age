// Static synthetic operator-test page only. Browser traffic is loopback-only.
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const root=resolve(process.env.CHATBOT_PROOF_ROOT||'.'),report={syntheticOnly:true,externalRequests:0,emailSent:false,pushoverSent:false,bookingCreated:false,actualIPhoneVerified:false,homeScreenInstallationVerified:false,checks:[]};
let unavailableConfigReads=0,servedVersionOverride=null;
const messages={hu:'Van szabad Deluxe faház 2026.11.13-15 között 2 felnőtt részére, gyermek nélkül?',de:'Ist ein Deluxe Haus vom 2026-11-13 bis 2026-11-15 für 2 Erwachsene ohne Kinder frei?',en:'Is a Deluxe cabin available from 2026-11-13 to 2026-11-15 for 2 adults and no children?',si:'Ali je Deluxe hiška prosta od 2026-11-13 do 2026-11-15 za 2 odrasli osebi brez otrok?'};
const server=createServer((req,res)=>{
 try{
  const path=new URL(req.url,'http://127.0.0.1').pathname;
  if(req.method==='GET'&&path==='/.netlify/functions/chatbot-test-config'){
   unavailableConfigReads++;res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"error":"SETUP_REQUIRED"}');return;
  }
  if(req.method!=='GET'||!/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:mjs|html|webmanifest|png|json)$/.test(path))throw Error('PATH');
  const file=resolve(root,'.'+path);
  if(!file.startsWith(root+sep))throw Error('PATH');
  if(path.endsWith('.html')&&path!=='/sarberki-chatbot-project/index.html')throw Error('PATH');
  const type=path.endsWith('.mjs')?'text/javascript; charset=utf-8':path.endsWith('.html')?'text/html; charset=utf-8':path.endsWith('.webmanifest')?'application/manifest+json':path.endsWith('.png')?'image/png':'application/json';
  let content=readFileSync(file);
  if(path==='/build-info.mjs'&&servedVersionOverride)content=Buffer.from(`export const deployedCommit = "${servedVersionOverride}";\n`);
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(content);
 }catch{res.writeHead(404);res.end();}
});
let browser;
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 for(const [engine,launcher]of [['chromium',chromium],['webkit',webkit]]){
  browser=await launcher.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.addInitScript(()=>{
   window.__versionFetches=[];const request=window.fetch;
   window.fetch=function(input,options){
    const url=new URL(typeof input==='string'?input:input.url,location.href);
    if(url.pathname==='/build-info.mjs')window.__versionFetches.push({cache:options?.cache,credentials:options?.credentials});
    return request.call(this,input,options);
   };
  });
  await context.route('**/*',route=>{
   if(new URL(route.request().url()).origin===origin)return route.continue();
   report.externalRequests++;return route.abort();
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const submit=async text=>{await page.locator('#question').fill(text);await page.locator('#chatForm button[type=submit]').click();};
  for(const [language,message]of Object.entries(messages)){
   await page.goto(origin+'/sarberki-chatbot-project/index.html');
   await page.locator('#language').selectOption(language);await submit(message);
   const last=page.locator('#conversation .entry').last();
   if(language!=='hu'){
    await last.locator('.operator-review').waitFor();
    assert.match(await last.locator('.operator-review').innerText(),/kapacitás ellenőrzése még nem igazolt/);
    assert.equal(await last.locator('.operator-review').getAttribute('lang'),'hu');
   }else assert.equal(await last.locator('.operator-review').count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   report.checks.push({engine,language,mobileWidth:390,result:'PASS'});
  }
  const manifestHref=await page.locator('link[rel=manifest]').getAttribute('href');
  const manifestUrl=new URL(manifestHref,page.url());assert.equal(manifestUrl.origin,origin);assert.equal(manifestUrl.search,'');assert.equal(manifestUrl.hash,'');
  const manifestResponse=await page.request.get(manifestUrl.href);assert.equal(manifestResponse.status(),200);assert.match(manifestResponse.headers()['content-type'],/application\/manifest\+json/);
  const manifest=await manifestResponse.json();assert.match(manifest.name,/Sárberki/);assert.equal(manifest.display,'standalone');
  for(const field of ['start_url','scope']){const url=new URL(manifest[field],manifestUrl);assert.equal(url.origin,origin);assert.equal(url.search,'');assert.equal(url.hash,'');assert.ok(url.pathname.startsWith('/sarberki-chatbot-project/'));}
  const icons=manifest.icons.filter(icon=>['192x192','512x512'].includes(icon.sizes));assert.equal(icons.length,2);
  const imageSize=async src=>page.evaluate(src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve({width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>reject(Error('ICON_LOAD_FAILED'));image.src=src;}),src);
  for(const icon of icons){assert.equal(icon.type,'image/png');const url=new URL(icon.src,manifestUrl);assert.equal(url.origin,origin);const expected=Number(icon.sizes.split('x')[0]);assert.deepEqual(await imageSize(url.href),{width:expected,height:expected});}
  const appleHref=await page.locator('link[rel=apple-touch-icon]').getAttribute('href');const appleUrl=new URL(appleHref,page.url());assert.equal(appleUrl.origin,origin);assert.deepEqual(await imageSize(appleUrl.href),{width:180,height:180});
  report.checks.push({engine,test:'home-screen-manifest-and-real-icon-dimensions',result:'PASS'});
  assert.equal(await page.evaluate(async()=>navigator.serviceWorker?(await navigator.serviceWorker.getRegistrations()).length:0),0);
  report.checks.push({engine,test:'no-service-worker-cache-registered',result:'PASS'});
  await page.waitForFunction(()=>document.getElementById('deployed_version')?.dataset.versionState==='current');
  const loadedCommit=await page.evaluate(async()=>(await import('/build-info.mjs')).deployedCommit);assert.match(loadedCommit,/^[a-f0-9]{40}$/);
  assert.ok((await page.locator('#deployed_version').innerText()).includes(loadedCommit.slice(0,12)));
  assert.ok(await page.evaluate(()=>window.__versionFetches.length>0&&window.__versionFetches.every(r=>r.cache==='no-store'&&r.credentials==='omit')));
  report.checks.push({engine,test:'visible-loaded-build-version-and-no-store-current-check',result:'PASS',loadedCommit});
  servedVersionOverride=loadedCommit==='f'.repeat(40)?'e'.repeat(40):'f'.repeat(40);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await page.waitForFunction(()=>document.getElementById('deployed_version')?.dataset.versionState==='stale');
  assert.match(await page.locator('#deployed_version').innerText(),/korábbi verzió/);
  assert.equal(await page.evaluate(async()=>(await import('/build-info.mjs')).deployedCommit),loadedCommit);
  servedVersionOverride=null;
  await Promise.all([page.waitForEvent('load'),page.locator('#reload_version').click()]);
  await page.waitForFunction(()=>document.getElementById('deployed_version')?.dataset.versionState==='current');
  assert.ok((await page.locator('#deployed_version').innerText()).includes(loadedCommit.slice(0,12)));
  report.checks.push({engine,test:'bfcache-stale-version-warning-and-explicit-refresh',result:'PASS'});
  await page.locator('#operator_panel summary').click();
  const configBefore=unavailableConfigReads;
  await page.locator('#operator_email').fill('mobile-operator@synthetic.invalid');await page.locator('#operator_password').fill('synthetic-password-for-offline-proof');
  await page.locator('#operator_login button[type=submit]').click();
  await page.locator('#operator_status').filter({hasText:'Belépés nem igazolt'}).waitFor();assert.equal(unavailableConfigReads,configBefore+1);
  assert.equal((await page.locator('#operator_password').inputValue())==='',true);
  await page.locator('#server_case_id').fill('case-synthetic');await page.locator('#server_case_load').click();
  await page.locator('#server_data_status').filter({hasText:'Szerveres adat nem igazolt'}).waitFor();
  for(const id of ['server_chat_reply','server_operator_hu','server_guest_draft']){assert.equal(await page.locator('#'+id).inputValue(),'');assert.equal(await page.locator('#'+id).getAttribute('readonly')!==null,true);}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  report.checks.push({engine,test:'unavailable-config-and-unauthenticated-server-data-remain-unverified',result:'PASS'});
  await page.locator('#operator_panel summary').click();
  await page.locator('#language').selectOption('en');await page.locator('#resetChat').click();
  await submit('Is a Deluxe cabin available from 2026-11-13 to 2026-11-15?');
  assert.match(await page.locator('.operator-review').last().innerText(),/felnőtt/);
  await submit('2 adults and no children.');
  assert.match(await page.locator('.operator-review').last().innerText(),/kapacitás ellenőrzése még nem igazolt/);
  report.checks.push({engine,test:'multiturn-retains-known-facts',result:'PASS'});
  await page.locator('#resetChat').click();assert.equal(await page.locator('.operator-review').count(),0);
  await submit('Is there availability?');
  assert.match(await page.locator('.operator-review').last().innerText(),/érkez|távoz|időpont/i);
  report.checks.push({engine,test:'reset-clears-retained-facts',result:'PASS'});
  await submit('<img src=x onerror="window.__unsafe=true">');
  assert.equal(await page.evaluate(()=>window.__unsafe===true),false);
  assert.equal(await page.locator('#conversation img').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);report.checks.push({engine,test:'textContent-no-script-no-overflow-no-pageerrors',result:'PASS'});
  await browser.close();browser=null;
 }
 assert.equal(report.externalRequests,0);report.result='PASS';
}catch(error){report.result='FAIL';report.error=String(error.message);process.exitCode=1;}
finally{
 if(browser)await browser.close();await new Promise(r=>server.close(r));
 const directory=process.env.CHATBOT_PROOF_DIRECTORY||'/tmp/sarberki-chatbot-proof';mkdirSync(directory,{recursive:true});
 writeFileSync(resolve(directory,'MOBILE-PROOF.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}
