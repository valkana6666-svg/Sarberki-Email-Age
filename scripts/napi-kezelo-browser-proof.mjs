// Isolated, fully synthetic UI proof. No real account, database, mail or PMS.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {createServerChatPreview} from '../shared-core/server-chat-preview.mjs';
const origin='https://leafy-chimera-2403e5.netlify.app',root=resolve(process.env.NAPI_PROOF_ROOT||'dist');
const report={syntheticOnly:true,externalRequests:0,blockedExternalRequests:0,unexpectedExternalRequests:0,bookingCreated:false,emailSent:false,actualIPhoneVerified:false,checks:[]};
let browser;
const check=(engine,name)=>report.checks.push({engine,test:name,result:'PASS'});
try{
 for(const [engine,launcher] of [['chromium',chromium],['webkit',webkit]]){
  if(process.env.NAPI_PROOF_ENGINE&&process.env.NAPI_PROOF_ENGINE!==engine)continue;
  browser=await launcher.launch({headless:true,...(engine==='chromium'&&process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const state={authenticated:false,revision:1,allowRead:true,caseMethods:[],previewRevisions:[],chatStatus:200,chatMessages:[],role:'reader',editable:false,draftText:'Kitalált, tárolt válasz.',approval:'pending',draftHash:null};
  const record=()=>({tenantId:'sarberki-test',caseId:'case-synthetic',revision:state.revision,
   canEditDraft:state.role==='writer'&&state.approval==='pending',canApproveDraft:state.role==='approver'&&state.approval==='pending',
   data:{state:{approval:state.approval,revision:0,values:{arrival:'2026-11-20',departure:'2026-11-22',guests:2,unit:'Deluxe'}},
    messages:[{text:'Kitalált vendégüzenet'}],drafts:state.editable?[{text:state.draftText,synthetic:true,reviewStatus:'internal_review_required',revision:0,basedOnMessageCount:1}]:[],
    ...(state.approval==='internally_approved'?{serverApproval:{draftHash:state.draftHash}}:{})}});
  const session={authenticated:true,tenantId:'sarberki-test',csrfToken:'a'.repeat(64),expiresAt:new Date(Date.now()+3600000).toISOString()};
  const chatHandler=createServerChatPreview({env:{URL:origin,SERVER_CHAT_SYNTHETIC_ONLY:'true'},
   sessionFactory:()=>({protectedRead:async event=>{assert.equal(state.authenticated,true);assert.equal(event.headers['x-csrf-token'],session.csrfToken);return {};}}),
   fetchImpl:()=>{throw Error('NO_EXTERNAL_PROVIDER');}});

  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.href==='https://accounts.google.com/gsi/client'&&new URL(request.frame().url()).pathname==='/napi-kezelo/')return route.fulfill({status:200,contentType:'text/javascript',body:'window.google={accounts:{oauth2:{initTokenClient(options){return {requestAccessToken(){options.callback({access_token:"SYNTHETIC_TOKEN"});}};}}}};'});
   if(url.origin==='https://gmail.googleapis.com'){
    assert.equal(request.method(),'GET');assert.equal(request.headers().authorization,'Bearer SYNTHETIC_TOKEN');
    const body=url.pathname.endsWith('/profile')?{emailAddress:'sarberkiprojecttest@gmail.com'}:url.pathname.endsWith('/messages')?{messages:[{id:'abcdef1234567890'}]}:{id:'abcdef1234567890',internalDate:String(Date.parse('2026-10-20T12:00:00Z')),labelIds:['INBOX'],payload:{mimeType:'text/plain',headers:[{name:'Subject',value:'Kitalált napi e-mail'},{name:'From',value:'guest@synthetic.invalid'}],body:{data:Buffer.from('Kitalált eredeti e-mail.').toString('base64url')}}};
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
   }
   if(url.origin!==origin){
    report.blockedExternalRequests++;
    // The unchanged legacy test page declares Google GSI. Abort it locally;
    // any other external attempt, or one from the daily UI, remains a failure.
    if(url.href!=='https://accounts.google.com/gsi/client'||new URL(request.frame().url()).pathname!=='/index.html')report.unexpectedExternalRequests++;
    return route.abort();
   }
   const json=(status,body)=>route.fulfill({status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)});
   if(url.pathname==='/api/server-chat-preview'){
    state.chatMessages.push(request.postDataJSON().messages);
    if(state.chatStatus!==200)return json(state.chatStatus,{error:'SYNTHETIC_FAILURE'});
    const result=await chatHandler(new Request(request.url(),{method:request.method(),headers:{...request.headers(),origin},body:request.postData()}));
    return json(result.status,await result.json());
   }
   if(url.pathname==='/.netlify/functions/operator-session'){
    if(request.method()==='POST'){
     const body=request.postDataJSON();
     if(body?.action==='login')state.authenticated=true;
     else if(body?.action==='logout'){state.authenticated=false;return json(200,{authenticated:false});}
     else return json(400,{error:'INVALID_INPUT'});
    }
    return state.authenticated?json(200,session):json(401,{error:'AUTH_REQUIRED'});
   }
   if(url.pathname==='/.netlify/functions/booking-cases'){
    state.caseMethods.push(request.method());
    if(!state.authenticated)return json(401,{error:'AUTH_REQUIRED'});
    if(!state.allowRead)return json(403,{error:'FORBIDDEN'});
    if(request.method()==='POST'){
     const input=request.postDataJSON();
     assert.equal(request.headers()['x-csrf-token'],session.csrfToken);
     if(input.tenantId!=='sarberki-test'||input.caseId!=='case-synthetic')return json(403,{error:'FORBIDDEN'});
     if(input.expectedRevision!==state.revision)return json(409,{error:'CASE_CONFLICT'});
     if(input.action==='edit-draft'&&state.role==='writer'){state.draftText=input.editedDraftText;state.draftHash=input.expectedDraftHash;state.revision++;}
     else if(input.action==='approve'&&state.role==='approver'){state.draftHash=input.reviewedDraftHash;state.approval='internally_approved';state.revision++;}
     else return json(403,{error:'FORBIDDEN'});
     return json(200,{result:record()});
    }
    if(url.searchParams.get('tenantId')!=='sarberki-test')return json(403,{error:'FORBIDDEN'});
    if(url.searchParams.get('action')==='review-record'){
     state.previewRevisions.push(state.revision);

     return json(200,{result:record()});
    }
    return json(200,{result:[{tenantId:'sarberki-test',caseId:'case-synthetic',revision:state.revision,category:state.editable?(state.approval==='pending'?'approval':'progress'):'incoming'}]});
   }
   if(request.method()!=='GET')return route.abort();
   let path=url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname;
   if(!/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:mjs|html|webmanifest|png|svg|css)$/.test(path))return route.abort();
   const file=resolve(root,'.'+path);if(!file.startsWith(root+sep))return route.abort();
   try{const type=path.endsWith('.mjs')?'text/javascript; charset=utf-8':path.endsWith('.html')?'text/html; charset=utf-8':path.endsWith('.css')?'text/css':path.endsWith('.svg')?'image/svg+xml':'application/manifest+json';
    return route.fulfill({status:200,headers:{'Content-Type':type,'Cache-Control':'no-store'},body:readFileSync(file)});
   }catch{return route.fulfill({status:404,body:''});}
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/napi-kezelo/');
  await page.locator('#session-status').filter({hasText:'bejelentkezés'}).waitFor();
  assert.equal(await page.locator('#load-cases').isDisabled(),true);
  assert.equal(await page.locator('nav button').count(),4);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.getByRole('button',{name:/Jóváhagyásra vár/}).click();
  assert.equal(await page.locator('#section-heading').innerText(),'Jóváhagyásra vár');
  assert.match(await page.locator('.section-card').innerText(),/közös ügytár/);
  await page.locator('[data-section=incoming]').click();
  check(engine,'navigation-no-fabricated-category-state');
  await page.locator('#email').fill('reader@synthetic.invalid');await page.locator('#password').fill('SYNTHETIC_PASSWORD_ONLY');
  await page.locator('#login button').click();await page.locator('#session-status').filter({hasText:'Bejelentkezve'}).waitFor();
  assert.equal(await page.locator('#password').inputValue(),'');
  assert.equal(await page.locator('#chat-form').isVisible(),false);
  check(engine,'daily-hides-developer-chat-tool');
  await page.waitForFunction(()=>Boolean(window.google?.accounts?.oauth2?.initTokenClient));
  await page.locator('#read-email').click();await page.locator('#email-list button').waitFor();
  await page.locator('#email-list button').click();
  assert.match(await page.locator('#email-detail').innerText(),/Kitalált eredeti e-mail/);
  check(engine,'daily-gmail-readonly-list-and-open');
  await page.locator('#case-list button').waitFor();
  check(engine,'login-automatically-loads-cases');
  assert.match(await page.locator('#list-status').innerText(),/kategória/);
  // The other surface changes the synthetic backing revision after listing.
  // Opening must re-read the shared current revision before requesting preview.
  state.revision=2;
  await page.locator('#case-list button').click();await page.locator('#detail-status').filter({hasText:'közös ügytárból'}).waitFor();
  assert.deepEqual(state.previewRevisions,[2]);
  assert.match(await page.locator('#detail-facts').innerText(),/2026-11-20/);
  assert.match(await page.locator('#detail-messages').innerText(),/Kitalált vendégüzenet/);
  assert.match(await page.locator('#detail-capacity').innerText(),/nem igazolt/);
  assert.doesNotMatch(await page.locator('#detail-draft').innerText(),/SYNTHETIC_DRAFT_MUST_NOT_DISPLAY/);
  assert.equal(await page.locator('#save-draft').isDisabled(),true);
  assert.equal(await page.locator('#approve-draft').isDisabled(),true);
  assert.match(await page.locator('#detail-link').getAttribute('href'),/caseId=case-synthetic/);
  check(engine,'synthetic-cookie-reader-no-unauthorized-actions');
  await page.clock.install();await page.clock.fastForward(31000);
  assert.equal(await page.locator('#case-detail').isVisible(),true);assert.equal(await page.locator('#case-list li').count(),1);
  assert.match(await page.locator('#detail-messages').innerText(),/Kitalált vendégüzenet/);
  check(engine,'reading-remains-open-beyond-thirty-seconds');
  state.revision=3;await page.locator('#load-cases').click();await page.locator('#case-list button').waitFor();
  await page.locator('#case-list button').click();await page.locator('#detail-status').filter({hasText:'közös ügytárból'}).waitFor();
  assert.deepEqual(state.previewRevisions,[2,3]);
  check(engine,'reloads-synthetic-new-revision');
  await page.reload();await page.locator('#session-status').filter({hasText:'Bejelentkezve'}).waitFor();
  assert.equal(await page.locator('#chat-output').innerText(),'');
  await page.locator('#case-list button').waitFor();
  assert.equal(await page.locator('#case-list li').count(),1);assert.equal(await page.locator('#case-detail').isHidden(),true);
  state.allowRead=false;await page.locator('#load-cases').click();await page.locator('#session-status').filter({hasText:'jogosultság'}).waitFor();
  assert.equal(await page.locator('#case-list li').count(),0);assert.equal(await page.locator('#case-detail').isHidden(),true);
  assert.equal(await page.locator('#chat-send').isDisabled(),true);
  assert.equal(await page.locator('#email-list li').count(),0);assert.equal(await page.locator('#email-detail').innerText(),'');
  assert.ok(state.caseMethods.every(method=>method==='GET'));
  assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
  assert.deepEqual(errors,[]);check(engine,'reload-denied-reader-no-cache-or-writes');
  state.allowRead=true;state.editable=true;state.role='writer';
  await page.reload();await page.locator('#session-status').filter({hasText:'Bejelentkezve'}).waitFor();
  await page.locator('[data-section=approval]').click();await page.locator('#load-cases').click();await page.locator('#case-list button').click();
  await page.locator('#draft-editor:not([disabled])').waitFor();
  assert.equal(await page.locator('#approve-confirm').isDisabled(),true);
  await page.locator('#draft-editor').fill('Elavult verzióból nem menthető.');
  await page.clock.fastForward(31000);
  assert.equal(await page.locator('#case-detail').isVisible(),true);
  assert.equal(await page.locator('#draft-editor').inputValue(),'Elavult verzióból nem menthető.');
  const oldDraft=state.draftText;state.revision++;
  await page.locator('#save-draft').click();
  await page.locator('#list-status').filter({hasText:'közben megváltozott'}).waitFor();
  assert.equal(state.draftText,oldDraft);
  check(engine,'long-reading-preserves-edits-and-rejects-stale-version');
  await page.locator('#load-cases').click();await page.locator('#case-list button').click();
  await page.locator('#draft-editor:not([disabled])').waitFor();
  await page.locator('#draft-editor').fill('Kitalált szerkesztett válasz.');await page.locator('#save-draft').click();
  await page.locator('#detail-status').filter({hasText:'Módosítás mentve és visszaolvasva'}).waitFor();
  assert.equal(state.draftText,'Kitalált szerkesztett válasz.');
  state.role='approver';await page.reload();await page.locator('#session-status').filter({hasText:'Bejelentkezve'}).waitFor();
  await page.locator('[data-section=approval]').click();await page.locator('#load-cases').click();await page.locator('#case-list button').click();
  await page.locator('#approve-confirm:not([disabled])').waitFor();assert.equal(await page.locator('#save-draft').isDisabled(),true);
  await page.locator('#approve-confirm').check();await page.locator('#approve-draft').click();
  await page.locator('#detail-status').filter({hasText:'Belső jóváhagyás mentve és visszaolvasva'}).waitFor();
  await page.locator('[data-section=progress]').click();await page.locator('#load-cases').click();await page.locator('#case-list button').waitFor();
  assert.equal(state.approval,'internally_approved');check(engine,'writer-edit-readback-independent-approval-shared-progress');
  await page.goto(origin+'/index.html');assert.equal(await page.locator('body').count(),1);
  check(engine,'existing-test-page-still-served');
  await context.close();await browser.close();browser=null;
 }
 assert.equal(report.externalRequests,0);assert.equal(report.unexpectedExternalRequests,0);report.result='PASS';
}catch(error){report.result='FAIL';report.error=String(error?.stack||error);process.exitCode=1;}
finally{if(browser)await browser.close();mkdirSync('/tmp/sarberki-daily-proof',{recursive:true});writeFileSync('/tmp/sarberki-daily-proof/DAILY-PROOF.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
