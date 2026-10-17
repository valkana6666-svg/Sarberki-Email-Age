// Synthetic browser transport only. Every request is fulfilled locally or blocked.
// The test origin lets the unchanged, origin-gated cloud UI initialize; no live host is contacted.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const origin='https://leafy-chimera-2403e5.netlify.app',root=resolve('.');
const caseId='case-synthetic-mobile-writer',text='SYNTHETIC deutscher Entwurf – 2 Erwachsene, Deluxe, 23.–25. Oktober 2026. NEVER SENT';
const hash=createHash('sha256').update(text).digest('hex'),csrf='ab'.repeat(32);
const report={syntheticOnly:true,liveNetwork:false,actualIPhoneVerified:false,emailSent:false,pushoverSent:false,bookingCreated:false,checks:[],blockedExternalRequests:0};
const record=revision=>({tenantId:'sarberki-test',caseId,revision,data:{state:{approval:'pending'},drafts:[{text,operatorReviewText:'Szintetikus magyar ellenőrzés.',synthetic:true,reviewStatus:'internal_review_required'}]}});
let browser;
try{
 for(const [engine,launcher] of [['chromium',chromium],['webkit',webkit]]){
  browser=await launcher.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const state={role:null,saves:0,revision:1,verified:false,approved:false,offline:false,calls:[]};
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url()),method=req.method();
   if(url.origin!==origin){report.blockedExternalRequests++;return route.abort();}
   if(url.pathname.startsWith('/.netlify/functions/')){
    if(state.offline)return route.abort('internetdisconnected');
    const body=method==='POST'?JSON.parse(req.postData()||'{}'):null,action=body?.action||url.searchParams.get('action')||'list';
    state.calls.push({method,path:url.pathname,action});
    let status=200,result;
    if(url.pathname.endsWith('/operator-session')){
     if(action==='login'){
      assert.equal(body.password,'SYNTHETIC_NOT_A_REAL_PASSWORD');
      state.role=body.email.split('@')[0];assert.ok(['writer','reader','approver'].includes(state.role));
     }else if(action==='logout'){assert.equal(req.headers()['x-csrf-token'],csrf);state.role=null;}
     if(state.role)result={authenticated:true,tenantId:'sarberki-test',csrfToken:csrf,expiresAt:new Date(Date.now()+3600000).toISOString()};
     else{status=action==='logout'?200:401;result=action==='logout'?{authenticated:false}:{error:'AUTH_REQUIRED'};}
    }else if(url.pathname.endsWith('/booking-cases')){
     assert.equal(req.headers()['x-csrf-token'],csrf);
     assert.equal(body?.tenantId||url.searchParams.get('tenantId'),'sarberki-test');
     if(!state.role){status=401;result={error:'AUTH_REQUIRED'};}
     else if(action==='ingest-and-draft'){
      assert.equal(state.role,'writer');assert.equal(body.expectedRevision,0);
      assert.match(body.envelope.text,/2026/);assert.ok(body.envelope.sender);
      state.saves++;result={result:{resolution:{status:state.saves===1?'new':'duplicate'},record:record(1)}};
     }else if(action==='list')result={result:[{tenantId:'sarberki-test',caseId,revision:state.revision}]};
     else if(action==='preview-draft')result={result:{caseId,revision:state.revision,persisted:false,approval:'pending',text,operatorReviewText:'Szintetikus magyar ellenőrzés.'}};
     else if(action==='review-draft'){
      assert.equal(state.role,'writer');assert.equal(body.expectedRevision,state.revision);
      state.revision++;result={result:{record:record(state.revision)}};
     }else if(action==='review-record'){
      if(state.role==='reader'){status=403;result={error:'FORBIDDEN'};}
      else result={result:record(state.revision)};
     }else if(action==='approve'){
      assert.equal(state.role,'approver');assert.equal(body.caseId,caseId);assert.equal(body.expectedRevision,state.revision);assert.equal(body.reviewedDraftHash,hash);
      if(!state.verified){status=409;result={error:'REVIEW_NOT_READY'};}
      else{state.approved=true;const before=state.revision++;result={result:{...record(state.revision),data:{state:{approval:'internally_approved'},serverApproval:{draftHash:hash,reviewedRevision:before}}}};}
     }else if(action==='approval-state')result={result:{caseId,revision:state.revision,approval:state.approved?'internally_approved':'pending',audit:state.approved?[{kind:'approve_isolated_synthetic',revision:state.revision,data_hash:hash}]:[]}};
     else throw Error('Unexpected case API action: '+action);
    }else{status=404;result={error:'UNKNOWN_ROUTE'};}
    return route.fulfill({status,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(result)});
   }
   assert.equal(method,'GET');
   const path=resolve(root,'.'+decodeURIComponent(url.pathname));
   if(!path.startsWith(root+sep)||!/^\/[\w./-]+\.(?:html|m?js|css|svg|png|webmanifest)$/.test(url.pathname)||url.pathname.includes('..'))return route.abort();
   try{return route.fulfill({status:200,contentType:/\.m?js$/.test(path)?'text/javascript':path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':path.endsWith('.webmanifest')?'application/manifest+json':path.endsWith('.svg')?'image/svg+xml':'image/png',body:readFileSync(path)});}catch{return route.fulfill({status:404,body:''});}
  });
  const page=await context.newPage();page.setDefaultTimeout(15000);
  await page.goto(origin+'/cloud-approval.html');
  const deadline=await page.evaluate(async()=>{
   const {createCookieJsonRequest}=await import('./shared-core/cookie-json-request.mjs');
   let calls=0,signal;
   const send=createCookieJsonRequest({timeoutMs:25,request:async(_url,options)=>{calls++;signal=options.signal;return {ok:true,status:200,json:()=>new Promise(()=>{})};}});
   try{await send('/synthetic-never-sent',{method:'POST'});return {unexpectedSuccess:true};}
   catch(error){return {code:error.message,calls,aborted:signal.aborted};}
  });
  assert.deepEqual(deadline,{code:'SERVICE_UNAVAILABLE',calls:1,aborted:true});
  report.checks.push({engine,test:'Browser JSON body deadline aborts once and never replays a write',result:'PASS'});
  await page.goto(origin+'/index.html');await page.locator('#operator_login_panel summary').click();
  await page.locator('#operator_login_email').fill('writer@synthetic.invalid');await page.locator('#operator_login_password').fill('SYNTHETIC_NOT_A_REAL_PASSWORD');await page.locator('#operator_login').click();
  await page.locator('#operator_login_status').filter({hasText:'olvasás aktív'}).waitFor();
  await page.locator('#server_preview_panel > summary').click();
  await page.locator('#server_preview_case_id').fill(caseId);await page.locator('#server_preview_revision').fill('1');
  await page.locator('#server_preview_action').click();await page.locator('#server_preview_status').filter({hasText:'Belső előnézet kész'}).waitFor();
  assert.equal(await page.locator('#server_preview_text').inputValue(),text);
  const beforeFocus=state.calls.length;
  // Explicit synthetic focus without visibility/pagehide: not a real iOS OS event.
  await page.evaluate(()=>dispatchEvent(new FocusEvent('focus')));
  assert.equal(await page.locator('#server_preview_text').inputValue(),'');
  assert.equal(await page.locator('#server_preview_hu').inputValue(),'');
  await page.locator('#operator_login_status').filter({hasText:'olvasás aktív'}).waitFor();
  assert.equal(await page.locator('#server_preview_text').inputValue(),'','session restore must not restore the stale preview');
  assert.ok(state.calls.slice(beforeFocus).every(c=>c.method==='GET'&&c.path.endsWith('/operator-session')));
  assert.equal(state.saves,0);
  report.checks.push({engine,test:'Focus-only return clears actual cloud preview and revalidates without replay',result:'PASS'});
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
  assert.equal(await page.evaluate(()=>window.SarberkiCaseStoreSession),null);
  assert.equal(await page.locator('#operator_list_cases').isDisabled(),true);
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await page.locator('#operator_login_status').filter({hasText:'olvasás aktív'}).waitFor();
  assert.equal(state.saves,0);
  report.checks.push({engine,test:'Simulated PWA hide/return clears Writer access and restores without save',result:'PASS'});
  state.offline=true;
  await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
  await page.locator('#operator_login_status').filter({hasText:'munkamenet nem igazolható'}).waitFor();
  assert.equal(await page.evaluate(()=>window.SarberkiCaseStoreSession),null);
  assert.equal(await page.locator('#operator_list_cases').isDisabled(),true);
  state.offline=false;const callsBeforeRetry=state.calls.length;
  await page.evaluate(()=>new Promise(requestAnimationFrame));assert.equal(state.calls.length,callsBeforeRetry);
  await page.locator('#operator_restore').click();await page.locator('#operator_login_status').filter({hasText:'olvasás aktív'}).waitFor();
  assert.equal(state.saves,0);
  report.checks.push({engine,test:'Disconnected Writer return fails closed and explicit retry never saves',result:'PASS'});
  await page.locator('#gmail_cloud_fixture_language').selectOption('de');await page.locator('#gmail_cloud_fixture_load').click();
  await page.locator('#gmail_cloud_fixture_status').filter({hasText:'minta betöltve'}).waitFor();
  assert.equal(state.saves,0,'Loading must never auto-save');
  await page.locator('#gmail_cloud_fixture_save').click();await page.locator('#gmail_cloud_fixture_status').filter({hasText:'Mentett szintetikus'}).waitFor();
  await page.locator('#gmail_cloud_fixture_save').click();await page.locator('#gmail_cloud_fixture_status').filter({hasText:'Meglévő szintetikus'}).waitFor();
  assert.equal(state.saves,2);assert.equal(await page.locator('#server_preview_case_id').inputValue(),caseId);
  assert.equal(await page.locator('#server_preview_revision').inputValue(),'1');
  const approvalLink=await page.locator('#gmail_cloud_fixture_approval').getAttribute('href');assert.equal(approvalLink,'/cloud-approval.html?caseId='+caseId);
  report.checks.push({engine,test:'Writer closed German MIME explicit-save and duplicate UI, no automatic POST',result:'PASS'});
  await page.goto(origin+approvalLink);await page.locator('#auth_status').filter({hasText:'Hitelesített'}).waitFor();
  await page.locator('#cloud_prepare').click();await page.locator('#readback_status').filter({hasText:'Tervezet mentve, verzió: 2'}).waitFor();
  assert.equal(state.revision,2);assert.equal(state.approved,false);
  report.checks.push({engine,test:'Writer review preparation does not approve',result:'PASS'});
  async function login(role){
   await page.locator('#email').fill(role+'@synthetic.invalid');await page.locator('#password').fill('SYNTHETIC_NOT_A_REAL_PASSWORD');await page.locator('#signin').click();
   await page.locator('#auth_status').filter({hasText:'Hitelesített'}).waitFor();
   await page.waitForFunction(()=>document.getElementById('workspace').disabled===false&&document.getElementById('password').value==='');
  }
  await login('reader');await page.locator('#isolated_approval_load').click();await page.locator('#isolated_approval_status').filter({hasText:'FORBIDDEN'}).waitFor();
  assert.equal(await page.locator('#isolated_approval_submit').isDisabled(),true);
  report.checks.push({engine,test:'Reader cannot load approval record or enable approval',result:'PASS'});
  await login('approver');
  async function load(){await page.locator('#isolated_approval_load').click();await page.locator('#isolated_approval_status').filter({hasText:'Tervezet betöltve'}).waitFor();assert.equal(await page.locator('#isolated_approval_text').inputValue(),text);}
  await load();assert.equal(await page.locator('#isolated_approval_submit').isDisabled(),true);
  await page.locator('#isolated_approval_confirm').check();
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
  assert.equal(await page.locator('#workspace').evaluate(el=>el.disabled),true);
  assert.equal(await page.locator('#isolated_approval_text').inputValue(),'');
  assert.equal(await page.locator('#isolated_approval_confirm').isChecked(),false);
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await page.waitForFunction(()=>document.getElementById('workspace').disabled===false);
  assert.equal(await page.locator('#isolated_approval_submit').isDisabled(),true);
  assert.equal(state.calls.filter(x=>x.action==='approve').length,0);
  report.checks.push({engine,test:'Simulated PWA approval return reauthenticates without restoring consent',result:'PASS'});
  await load();
  await page.locator('#isolated_approval_confirm').check();await page.locator('#isolated_approval_submit').click();
  await page.locator('#isolated_approval_status').filter({hasText:'REVIEW_NOT_READY'}).waitFor();
  assert.equal(state.approved,false);assert.equal(await page.locator('#isolated_approval_submit').isDisabled(),true);
  report.checks.push({engine,test:'Unknown price/capacity server denial clears approval, no false success',result:'PASS'});
  await load();await page.locator('#isolated_approval_confirm').check();
  const before=state.calls.filter(x=>x.action==='approve').length;
  await page.locator('#isolated_approval_case_id').fill('case-other-synthetic');
  assert.equal(await page.locator('#isolated_approval_submit').isDisabled(),true);assert.equal(state.calls.filter(x=>x.action==='approve').length,before);
  await page.locator('#isolated_approval_case_id').fill(caseId);
  report.checks.push({engine,test:'Changed case invalidates checked approval before POST',result:'PASS'});
  state.offline=true;const approvalsBeforeOffline=state.calls.filter(x=>x.action==='approve').length;
  await page.locator('#isolated_approval_load').click();
  await page.locator('#isolated_approval_status').filter({hasText:'nem tölthető be'}).waitFor();
  assert.equal(await page.locator('#isolated_approval_text').inputValue(),'');
  assert.equal(await page.locator('#isolated_approval_submit').isDisabled(),true);
  state.offline=false;
  await page.evaluate(()=>new Promise(requestAnimationFrame));assert.equal(state.calls.filter(x=>x.action==='approve').length,approvalsBeforeOffline);
  await load();assert.equal(await page.locator('#isolated_approval_confirm').isChecked(),false);
  report.checks.push({engine,test:'Disconnected approval clears review and explicit reload never replays approval',result:'PASS'});
  state.verified=true;await load();await page.locator('#isolated_approval_confirm').check();await page.locator('#isolated_approval_submit').click();
  await page.locator('#isolated_approval_status').filter({hasText:'jóváhagyás mentve'}).waitFor();assert.equal(state.approved,true);assert.equal(state.revision,3);
  await page.locator('#readback').click();await page.locator('#readback_status').filter({hasText:'approve_isolated_synthetic'}).waitFor();
  report.checks.push({engine,test:'Separate approver exact draft hash and synthetic audit readback',result:'PASS'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  for(const id of ['isolated_approval_load','isolated_approval_submit','readback'])assert.ok(await page.locator('#'+id).evaluate(el=>el.getBoundingClientRect().height)>=44);
  await page.locator('#logout').click();await page.locator('#auth_status').filter({hasText:'Kijelentkezve'}).waitFor();
  assert.equal(await page.locator('#isolated_approval_text').inputValue(),'');
  assert.equal(await page.locator('#workspace').evaluate(el=>el.disabled),true);
  assert.equal(await page.locator('#isolated_approval_load').isDisabled(),true);
  report.checks.push({engine,test:'390px approval layout, touch targets and logout clear',result:'PASS'});
  await browser.close();browser=null;
 }
 report.result='PASS';
}catch(error){report.result='FAIL';report.error=String(error.stack||error);process.exitCode=1;}
finally{
 if(browser)await browser.close();
 const directory=process.env.OPERATOR_WRITE_PROOF_DIRECTORY||'/tmp/sarberki-operator-write-proof';mkdirSync(directory,{recursive:true});writeFileSync(resolve(directory,'RESULT.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
