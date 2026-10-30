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
  const page=await context.newPage();await page.goto(origin+'/index.html');await page.locator('#server_preview_panel > details > summary').click();
  await page.locator('#server_preview_case_id').fill('case-synthetic-mobile');await page.locator('#server_preview_revision').fill('2');
  await page.locator('#server_preview_action').click();await page.locator('#server_preview_status').filter({hasText:'bejelentkezés'}).waitFor();
  report.checks.push({engine,test:'missing-auth-no-preview',result:'PASS'});
  await page.evaluate(()=>{
   window.__previewRequests=[];
   const result={caseId:'case-synthetic-mobile',revision:2,persisted:false,approval:'pending',text:'Synthetic English guest draft: <img src=x onerror="window.__unsafe=true">',operatorReviewText:'Magyar ellenőrzés: 2 felnőtt, pontosítandó időpont.',decision:{facts:{language:'en',guests:2},missing:['dates'],contradictions:[],requiresHumanReview:true,capacity:{status:'UNKNOWN',verified:false},pricing:{verified:false}},reviewState:{caseRevision:2,factsRevision:1,latestDraftRevision:0,latestDraftMessageCount:0,messageCount:1,auditStatus:'not_verified'}};
   window.SarberkiCaseStoreSession={getAccessToken:async()=> 'synthetic-local-token',request:async(url,options)=>{window.__previewRequests.push({method:options.method,bodyPresent:options.body!==undefined});return {ok:true,json:async()=>({result})};}};
  });
  await page.locator('#server_preview_action').click();await page.locator('#server_preview_status').filter({hasText:'Nincs mentés, jóváhagyás'}).waitFor();
  assert.match(await page.locator('#server_preview_details').innerText(),/érkezési/);assert.match(await page.locator('#server_preview_generated_hu').inputValue(),/Magyar ellenőrzés/);
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
  // Full Gmail manager login -> synthetic case picker -> stored draft preview -> logout,
  // exercised in both 390px Chromium and WebKit; only an intercepted mock transport.
  const mock={authenticated:false,calls:[],expiresAt:null},csrf='ab'.repeat(32),caseId='case-synthetic-mobile';
  await context.route('**/.netlify/functions/**',async route=>{
   const req=route.request(),url=new URL(req.url()),method=req.method();
   const body=method==='POST'?JSON.parse(req.postData()||'{}'):null;
   const record={method,path:url.pathname,action:body?.action||url.searchParams.get('action')||'list'};
   mock.calls.push(record);
   let code=200,payload;
   if(url.pathname.endsWith('/operator-session')){
    if(method==='POST'&&body?.action==='login'){
     assert.equal(body.email,'reader@synthetic.invalid');
     assert.equal(body.password,'SYNTHETIC_BROWSER_PASSWORD_NOT_REAL');
     mock.authenticated=true;mock.expiresAt=new Date(Date.now()+3600000).toISOString();
     payload={authenticated:true,tenantId:'sarberki-test',csrfToken:csrf,expiresAt:mock.expiresAt};
    }else if(method==='GET'&&mock.authenticated){
     record.action='restore';payload={authenticated:true,tenantId:'sarberki-test',csrfToken:csrf,expiresAt:mock.expiresAt};
    }else if(method==='POST'&&body?.action==='logout'){
     assert.equal(req.headers()['x-csrf-token'],csrf);
     mock.authenticated=false;payload={authenticated:false};
    }else{code=401;payload={error:'AUTH_REQUIRED'};}
   }else if(url.pathname.endsWith('/booking-cases')){
    if(method!=='GET'){code=403;payload={error:'FORBIDDEN'};}
    else if(!mock.authenticated){code=401;payload={error:'AUTH_REQUIRED'};}
    else if(url.searchParams.get('action')==='preview-draft'){
     assert.equal(url.searchParams.get('tenantId'),'sarberki-test');
     assert.equal(url.searchParams.get('caseId'),caseId);
     assert.equal(url.searchParams.get('expectedRevision'),'2');
     payload={result:{caseId,revision:2,persisted:false,approval:'pending',
      text:'SYNTHETIC read-only reply – NEVER SENT',
      operatorReviewText:'Magyar ellenőrzés – NEM IGAZOLT kapacitás.',
      storedDraft:{text:'SYNTHETIC stored draft – internal only',caseRevision:2,edited:false,status:'manual_review_required'},
      reviewState:{caseRevision:2,factsRevision:1,latestDraftRevision:1,latestDraftMessageCount:1,messageCount:1,storedApproval:'pending',auditStatus:'not_verified'},
      decision:{facts:{language:'hu',guests:2},missing:['dates'],contradictions:[],
       capacity:{status:'UNKNOWN',verified:false},pricing:{verified:false}}}};
    }else{
     assert.equal(url.searchParams.get('tenantId'),'sarberki-test');
     payload={result:[{tenantId:'sarberki-test',caseId,revision:2}]};
    }
   }else{code=404;payload={error:'UNKNOWN_ROUTE'};}
   await route.fulfill({status:code,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(payload)});
  });
  await page.locator('#operator_login_panel summary').click();
  assert.equal(await page.locator('#operator_list_cases').isDisabled(),true);
  await page.locator('#operator_login_email').fill('reader@synthetic.invalid');
  await page.locator('#operator_login_password').fill('SYNTHETIC_BROWSER_PASSWORD_NOT_REAL');
  await page.locator('#operator_login').click();
  await page.locator('#operator_login_status').filter({hasText:'olvasás aktív'}).waitFor();
  assert.equal(await page.locator('#operator_login_password').inputValue(),'');
  assert.equal(await page.evaluate(()=>window.SarberkiCaseStoreSession?.cookieReadOnly===true&&
    window.SarberkiCaseStoreSession?.canEditDraft===false&&
    !window.SarberkiCaseStoreSession?.getAccessToken),true);
  await page.locator('#operator_list_cases').click();
  await page.locator('#operator_case_status').filter({hasText:'1 ellenőrzött tesztügy'}).waitFor();
  await page.locator('#operator_case_select').selectOption(caseId);
  await page.locator('#operator_open_case').click();
  assert.equal(await page.locator('#server_preview_case_id').inputValue(),caseId);
  assert.equal(await page.locator('#server_preview_revision').inputValue(),'2');
  await page.locator('#server_preview_action').click();
  await page.locator('#server_preview_status').filter({hasText:'Nincs mentés, jóváhagyás'}).waitFor();
  assert.match(await page.locator('#server_preview_text').inputValue(),/SYNTHETIC stored draft/);
  assert.match(await page.locator('#server_edit_text').inputValue(),/SYNTHETIC stored draft/);
  assert.equal(await page.locator('#server_edit_action').isDisabled(),true);
  assert.match(await page.locator('#server_preview_capacity').innerText(),/NEM IGAZOLT/);
  report.checks.push({engine,test:'mock-operator-login-case-list-and-pending-draft-preview-read-only',result:'PASS',auth:'synthetic'});
  await page.locator('#operator_logout').click();
  await page.locator('#operator_login_status').filter({hasText:'kijelentkeztetve'}).waitFor();
  assert.equal(await page.locator('#server_preview_text').inputValue(),'');
  assert.equal(await page.locator('#server_edit_text').inputValue(),'');
  assert.equal(await page.locator('#operator_case_select').isDisabled(),true);
  assert.equal(await page.evaluate(()=>window.SarberkiCaseStoreSession===null),true);
  assert.deepEqual(mock.calls.map(x=>x.method),['POST','GET','GET','GET','POST']);
  assert.deepEqual(mock.calls.map(x=>x.action),['login','restore','list','preview-draft','logout']);
  report.apiMethods.push(...mock.calls.map(x=>x.method));
  report.checks.push({engine,test:'mock-logout-clears-preview-and-prevents-write',result:'PASS',auth:'synthetic'});
  // Exercise the actual message picker: conversion failures must be recoverable
  // on manual reopening too, without any real OAuth or Gmail network access.
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
  await page.route('https://gmail.googleapis.com/**',async route=>{
   assert.equal(route.request().method(),'GET');
   const path=new URL(route.request().url()).pathname;
   const payload=path.endsWith('/profile')?{emailAddress:'sarberkiprojecttest@gmail.com'}:
    path.endsWith('/messages')?{messages:[{id:'synthetic-empty-body'}]}:
    {id:'synthetic-empty-body',threadId:'synthetic-empty-thread',labelIds:['INBOX'],internalDate:String(Date.parse('2026-10-30T08:00:00Z')),payload:{headers:[],mimeType:'text/plain',body:{}}};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
  });
  await page.evaluate(()=>{
   localStorage.removeItem('sarberki.gmail.read-message-ids.v1');
   window.google={accounts:{oauth2:{initTokenClient:options=>({requestAccessToken:()=>{void options.callback({access_token:'SYNTHETIC_LOCAL_ONLY'});}})}}};
  });
  await page.locator('#read_gmail').click();
  await page.locator('#gmail_auth_status').filter({hasText:'nincs olvasható szöveges része'}).waitFor();
  await page.evaluate(()=>{document.getElementById('gmail_auth_status').textContent='Megnyitás ellenőrzése';});
  await page.locator('#gmail_open_selected').click();
  await page.locator('#gmail_auth_status').filter({hasText:'nincs olvasható szöveges része'}).waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem('sarberki.gmail.read-message-ids.v1')),null);
  assert.deepEqual(pageErrors,[]);
  report.checks.push({engine,test:'unreadable-mail-manual-reopen-reports-error-without-read-marker',result:'PASS',auth:'synthetic'});
  await browser.close();browser=null;
 }
 report.result='PASS';
}catch(error){report.result='FAIL';report.error=String(error.message);process.exitCode=1;}
finally{
 if(browser)await browser.close();await new Promise(r=>server.close(r));const directory=process.env.GMAIL_SERVER_PROOF_DIRECTORY||'/tmp/sarberki-gmail-server-proof';mkdirSync(directory,{recursive:true});writeFileSync(resolve(directory,'RESULT.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
