import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syntheticMailEnvelope,closedMailRequestFromGmailRecord,syntheticTubFollowupEnvelope,syntheticTubReviewEnvelope} from '../shared-core/synthetic-mail-fixtures.mjs';
import {initOperatorLoginPanel} from '../operator-login-ui.mjs';
const ui=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const names=['operator_manual_case_id','operator_open_manual_case','operator_manual_audit','operator_login_form','operator_login_email','operator_login_password','operator_login','operator_restore','operator_logout','operator_login_status','operator_list_cases','operator_case_select','operator_open_case','operator_case_status','server_preview_case_id','server_preview_revision','operator_create_fixture','operator_fixture_status','gmail_cloud_fixture_language','gmail_cloud_fixture_load','gmail_cloud_fixture_save','gmail_cloud_fixture_status','gmail_cloud_fixture_approval','gmail_cloud_tub_followup','gmail_cloud_tub_review','service_link_target','service_link_target_revision','gmail_json','message'];
const valid=()=>({authenticated:true,tenantId:'sarberki-test',csrfToken:'ab'.repeat(32),expiresAt:new Date(Date.now()+3600_000).toISOString()});
async function harness(request){
 const map=new Map(),events=[];
 for(const name of names){
  const element={id:name,value:'',disabled:false,textContent:'',children:[],listeners:{},
   replaceChildren(...children){this.children=children;this.value='';},
   appendChild(child){this.children.push(child);},
   dispatchEvent(event){return this.listeners[event.type]?.(event);},
   addEventListener(type,fn){this.listeners[type]=fn;},
   async click(){return this.listeners.click?.();},
   async submit(){return this.listeners.submit?.({preventDefault(){}});}};
  map.set(name,element);
 }
 const documentListeners={};
 const documentRef={addEventListener:(type,fn)=>{documentListeners[type]=fn;},getElementById:id=>map.get(id),createElement:tag=>({tag,value:'',textContent:''}),dispatchEvent:event=>events.push(event.type)};
 const globalListeners={};
 const globalRef={addEventListener:(type,fn)=>{globalListeners[type]=fn;}};
 assert.equal(initOperatorLoginPanel({documentRef,globalRef,request}),true);
 for(let i=0;i<100&&map.get('operator_login').disabled;i++)await Promise.resolve();
 assert.equal(map.get('operator_login').disabled,false,'startup restore must settle');
 return {map,get:id=>map.get(id),globalRef,events,globalListeners,documentListeners,documentRef};
}
test('test booking manager has an operator login form with no stored credentials',()=>{
 for(const id of names)assert.match(ui,new RegExp('id="'+id+'"'));
 assert.match(ui,/operator-login-ui\.mjs/);
 assert.match(ui,/id="operator_login_password" type="password"/);
 assert.match(ui,/szintetikus ügyek olvasása/u);
 assert.match(ui,/szerveroldali munkamenet-beállításnak is megfelelőnek kell lennie/u);
 assert.doesNotMatch(ui,/A külön hitelesített kezelői belépés még nem aktív/u);
 assert.doesNotMatch(ui,/localStorage\.setItem\([^\n]*password/u);
});
test('login uses same-origin POST and only exposes read-only cookie-mode case client',async()=>{
 const requests=[],h=await harness(async(url,options)=>{
  requests.push({url,options});
  return {ok:true,json:async()=>valid()};
 });
 requests.length=0;
 h.get('operator_login_email').value='reader@synthetic.invalid';
 h.get('operator_login_password').value='SYNTHETIC_PASSWORD_NOT_A_REAL_SECRET';
 await h.get('operator_login_form').submit();
 assert.equal(h.get('operator_login_password').value,'');
 assert.equal(requests.length,1);
 const {url,options}=requests[0];
 assert.equal(url,'/.netlify/functions/operator-session');
 assert.equal(options.method,'POST');
 assert.equal(options.credentials,'same-origin');
 assert.equal(options.cache,'no-store');
 assert.equal(options.headers['X-Sarberki-Operator'],'1');
 assert.deepEqual(JSON.parse(options.body),{action:'login',email:'reader@synthetic.invalid',password:'SYNTHETIC_PASSWORD_NOT_A_REAL_SECRET'});
 assert.ok(h.globalRef.SarberkiCaseStoreSession);
 assert.equal(h.globalRef.SarberkiCaseStoreSession.cookieReadOnly,true);
 assert.equal(h.globalRef.SarberkiCaseStoreSession.canEditDraft,false);
 assert.equal(typeof h.globalRef.SarberkiCaseStoreSession.getAccessToken,'undefined');
 assert.equal(await h.globalRef.SarberkiCaseStoreSession.getCsrfToken(),'ab'.repeat(32));
 assert.match(h.get('operator_login_status').textContent,/olvasás aktív/u);
 assert.equal(h.get('operator_logout').disabled,false);
 assert.ok(h.events.includes('sarberki:session-changed'));
});
test('reader automatically restores once and can explicitly restore and logout with CSRF',async()=>{
 const requests=[],h=await harness(async(url,options)=>{
  requests.push({url,options});
  return {ok:true,json:async()=>options.method==='GET'?valid():{authenticated:false}};
 });
 assert.equal(requests.length,1);
 assert.equal(requests[0].options.method,'GET');
 assert.equal(requests[0].options.credentials,'same-origin');
 assert.equal(requests[0].options.body,undefined);
 assert.equal(h.globalRef.SarberkiCaseStoreSession.cookieReadOnly,true);
 await h.globalListeners.pageshow({persisted:false});
 assert.equal(requests.length,1,'ordinary pageshow must not duplicate startup restore');
 requests.length=0;
 await h.get('operator_restore').click();
 assert.equal(requests[0].options.method,'GET');
 assert.equal(requests[0].options.credentials,'same-origin');
 assert.equal(h.globalRef.SarberkiCaseStoreSession.cookieReadOnly,true);
 await h.get('operator_logout').click();
 assert.equal(requests[1].options.method,'POST');
 assert.deepEqual(JSON.parse(requests[1].options.body),{action:'logout'});
 assert.equal(requests[1].options.headers['X-CSRF-Token'],'ab'.repeat(32));
 assert.equal(h.globalRef.SarberkiCaseStoreSession,null);
 assert.equal(h.get('operator_logout').disabled,true);
 assert.match(h.get('operator_login_status').textContent,/kijelentkeztetve/u);
});
test('automatic restore fails closed for missing, revoked or unavailable sessions',async()=>{
 for(const error of ['AUTH_REQUIRED','FORBIDDEN','SESSION_SETUP_REQUIRED','SESSION_SERVICE_UNAVAILABLE']){
  const requests=[],h=await harness(async(url,options)=>{
   requests.push({url,options});
   return {ok:false,json:async()=>({error})};
  });
  assert.equal(requests.length,1);
  assert.equal(requests[0].options.method,'GET');
  assert.equal(requests[0].options.body,undefined);
  assert.equal(h.globalRef.SarberkiCaseStoreSession,null);
  assert.equal(h.get('operator_list_cases').disabled,true);
  assert.equal(h.get('operator_logout').disabled,true);
  assert.equal(h.get('operator_login').disabled,false);
  assert.doesNotMatch(h.get('operator_login_status').textContent,/olvasás aktív/u);
 }
});
test('bfcache return revalidates and clears stale access without parallel cookie refresh',async()=>{
 let calls=0,release;
 const h=await harness(async()=>{
  calls++;
  if(calls===1)return {ok:true,json:async()=>valid()};
  return new Promise(resolve=>{release=resolve;});
 });
 const pending=h.globalListeners.pageshow({persisted:true});
 for(let i=0;i<100&&!release;i++)await Promise.resolve();
 assert.equal(calls,2);
 assert.equal(h.globalRef.SarberkiCaseStoreSession,null);
 assert.equal(h.get('operator_list_cases').disabled,true);
 await h.globalListeners.pageshow({persisted:true});
 await h.get('operator_restore').click();
 assert.equal(calls,2,'busy session restoration must not rotate the cookie concurrently');
 release({ok:false,json:async()=>({error:'AUTH_REQUIRED'})});
 await pending;
 assert.equal(h.globalRef.SarberkiCaseStoreSession,null);
 assert.equal(h.get('operator_list_cases').disabled,true);
 assert.equal(h.get('operator_login').disabled,false);
 assert.doesNotMatch(h.get('operator_login_status').textContent,/olvasás aktív/u);
});
test('bad credentials, disabled setup and malformed session cannot expose a case store',async()=>{
 for(const failure of [
  {ok:false,json:async()=>({error:'AUTH_REQUIRED'})},
  {ok:false,json:async()=>({error:'SESSION_SETUP_REQUIRED'})},
  {ok:true,json:async()=>({...valid(),csrfToken:'wrong'})},
  {ok:true,json:async()=>({...valid(),tenantId:'demo-test'})}
 ]){
  const h=await harness(async()=>failure);
  h.get('operator_login_email').value='reader@synthetic.invalid';
  h.get('operator_login_password').value='NOT_REAL_PASSWORD';
  await h.get('operator_login_form').submit();
  assert.equal(h.get('operator_login_password').value,'');
  assert.equal(h.globalRef.SarberkiCaseStoreSession,null);
  assert.equal(h.get('operator_logout').disabled,true);
  assert.doesNotMatch(h.get('operator_login_status').textContent,/olvasás aktív/u);
 }
});
test('failed logout locally drops the session and does not claim remote revocation',async()=>{
 const h=await harness(async(_url,opt)=>opt.method==='GET'?{ok:true,json:async()=>valid()}:{ok:false,json:async()=>({error:'SESSION_SERVICE_UNAVAILABLE'})});
 await h.get('operator_restore').click();
 await h.get('operator_logout').click();
 assert.equal(h.globalRef.SarberkiCaseStoreSession,null);
 assert.match(h.get('operator_login_status').textContent,/nem igazolt/u);
});

test('authorized synthetic cases appear as IDs and revisions only; fake guest data is never shown',async()=>{
 const requests=[],fixtureRows=[
  {tenantId:'sarberki-test',caseId:'case-synth-one',revision:3},
  {tenantId:'sarberki-test',caseId:'case-unexpected',revision:4,data:{sender:'real@example.com',original:'NOT FOR UI'}},
  {tenantId:'demo-test',caseId:'case-other',revision:1},
  {tenantId:'sarberki-test',caseId:'bad-case',revision:2}
 ];
 const h=await harness(async(url,opt)=>{
  requests.push({url,opt});
  if(url.endsWith('/operator-session'))return {ok:true,json:async()=>valid()};
  return {ok:true,json:async()=>({result:fixtureRows})};
 });
 requests.length=0;
 await h.get('operator_restore').click();
 await h.get('operator_list_cases').click();
 assert.equal(requests.length,2);
 assert.equal(requests[1].opt.method,'GET');
 assert.equal(requests[1].opt.credentials,'same-origin');
 assert.equal(requests[1].opt.headers.Authorization,undefined);
 assert.equal(requests[1].opt.headers['X-CSRF-Token'],'ab'.repeat(32));
 assert.equal(h.get('operator_case_select').children.length,2);
 assert.match(h.get('operator_case_select').children[1].textContent,/case-synth-one · v3/);
 assert.doesNotMatch(JSON.stringify(h.get('operator_case_select').children),/PRIVATE SYNTHETIC MESSAGE|NOT FOR UI/);
 assert.equal(h.get('operator_case_select').disabled,false);
 assert.equal(h.get('operator_open_case').disabled,false);
 // Selecting fills only the pre-existing read-only preview controls.
 h.get('operator_case_select').value='case-synth-one';
 assert.equal(h.get('operator_case_select').children[1].value,'case-synth-one');
 await h.get('operator_open_case').click();
 assert.equal(h.get('server_preview_case_id').value,'case-synth-one');
 assert.equal(h.get('server_preview_revision').value,'3');
 assert.match(h.get('operator_case_status').textContent,/szintetikus ügy kiválasztva/u);
 await h.get('operator_logout').click();
 assert.equal(h.get('operator_case_select').children.length,0);
 assert.equal(h.get('operator_case_select').disabled,true);
 assert.equal(h.get('operator_open_case').disabled,true);
});
test('case-list errors clear choices without changing a real booking',async()=>{
 const h=await harness(async(url,opt)=>url.endsWith('/operator-session')?{ok:true,json:async()=>valid()}:
  {ok:false,json:async()=>({error:'CASE_STORE_DISABLED'})});
 await h.get('operator_restore').click();
 await h.get('operator_list_cases').click();
 assert.match(h.get('operator_case_status').textContent,/CASE_STORE_DISABLED/);
 assert.equal(h.get('operator_case_select').disabled,true);
 assert.equal(h.get('operator_open_case').disabled,true);
});
test('Writer fixture button sends fixed CSRF-protected request without granting editable browser access',async()=>{
 const calls=[],id='11111111-1111-4111-8111-111111111111';
 const h=await harness(async(url,opt)=>{
  calls.push({url,opt});
  if(url.endsWith('/writer-reader-fixture'))return {ok:true,json:async()=>({result:{tenantId:'sarberki-test',caseId:id,revision:1,duplicate:false,readyForReaderPreview:true}})};
  return {ok:true,json:async()=>valid()};
 });
 calls.length=0;await h.get('operator_create_fixture').click();
 assert.equal(calls.length,1);assert.equal(calls[0].url,'/.netlify/functions/writer-reader-fixture');
 assert.deepEqual(JSON.parse(calls[0].opt.body),{action:'create-reader-fixture'});
 assert.equal(calls[0].opt.credentials,'same-origin');assert.equal(calls[0].opt.redirect,'error');
 assert.equal(calls[0].opt.headers['X-CSRF-Token'],'ab'.repeat(32));assert.equal(calls[0].opt.headers.Authorization,undefined);
 assert.equal(h.get('server_preview_case_id').value,id);assert.equal(h.get('server_preview_revision').value,'1');
 assert.match(h.get('operator_fixture_status').textContent,/Mentett/);
 assert.equal(h.globalRef.SarberkiCaseStoreSession.cookieReadOnly,true);assert.equal(h.globalRef.SarberkiCaseStoreSession.canEditDraft,false);
 await h.get('operator_logout').click();assert.equal(h.get('operator_create_fixture').disabled,true);
 assert.doesNotMatch(h.get('operator_fixture_status').textContent,new RegExp(id));
});
test('Reader fixture denial preserves read-only session and never claims creation',async()=>{
 const h=await harness(async url=>url.endsWith('/writer-reader-fixture')?{ok:false,json:async()=>({error:'FORBIDDEN'})}:{ok:true,json:async()=>valid()});
 const before=h.globalRef.SarberkiCaseStoreSession;await h.get('operator_create_fixture').click();
 assert.equal(h.globalRef.SarberkiCaseStoreSession,before);assert.equal(before.cookieReadOnly,true);
 assert.match(h.get('operator_fixture_status').textContent,/Writer-jogosultság szükséges/);
 assert.equal(h.get('server_preview_case_id').value,'');
});



test('Writer fixture errors show distinct safe diagnostics without exposing server details',async()=>{
 for(const [code,expected] of [['SYNTHETIC_FIXTURE_UNVERIFIED',/A szerver válaszolt.*NEM IGAZOLT/],['AUTH_REQUIRED',/Writer-munkamenet nem igazolt/],['SESSION_SETUP_REQUIRED',/nincs megfelelően beállítva/],['SESSION_SERVICE_UNAVAILABLE',/hitelesítési szolgáltatás nem elérhető/],['SERVICE_UNAVAILABLE',/mentési szolgáltatás nem elérhető/],['INVALID_INPUT',/tesztkérés nem megfelelő/]]){
  const h=await harness(async url=>url.endsWith('/writer-reader-fixture')?{ok:false,json:async()=>({error:code})}:{ok:true,json:async()=>valid()});
  await h.get('operator_create_fixture').click();
  assert.match(h.get('operator_fixture_status').textContent,expected);
  assert.equal(h.get('server_preview_case_id').value,'');
  assert.equal(h.globalRef.SarberkiCaseStoreSession.cookieReadOnly,true);
 }
});
test('closed Gmail MIME load is explicit and cloud save shares existing session/busy gate with no client facts',async()=>{
 const calls=[];const caseId='44444444-4444-4444-8444-444444444444';
 const h=await harness(async(url,options)=>{
  calls.push({url,options});
  return {ok:true,json:async()=>url.endsWith('/operator-session')?valid():{result:{resolution:{status:'new'},record:{tenantId:'sarberki-test',caseId,revision:1}}}};
 });
 const envelope=syntheticMailEnvelope('hu');h.get('gmail_cloud_fixture_language').value='hu';
 let mime,displayed;
 h.globalRef.sarberkiGmailTransform=value=>{mime=value;return {source:{provider:'gmail',subject:'TESZT SÁRBERKI CLOSED HU',from_email:envelope.sender,message_id:envelope.message_id,thread_id:envelope.thread_id,received_at:envelope.received_at},original_message:envelope.text};};
 h.globalRef.displayGmailRecord=async value=>{displayed=value;h.get('gmail_json').value=JSON.stringify(value);h.get('message').value=value.original_message;return true;};
 calls.length=0;await h.get('gmail_cloud_fixture_load').click();
 assert.equal(calls.length,0,'load must not write or fetch live providers');assert.equal(mime.id,envelope.message_id);assert.equal(displayed.original_message,envelope.text);assert.equal(h.globalRef.SarberkiClosedSyntheticMailPreview(),true);
 await h.get('gmail_cloud_fixture_save').click();assert.equal(calls.length,1);
 assert.equal(calls[0].url,'/.netlify/functions/booking-cases');assert.deepEqual(JSON.parse(calls[0].options.body),closedMailRequestFromGmailRecord(displayed));
 assert.equal(calls[0].options.headers['X-CSRF-Token'],'ab'.repeat(32));assert.equal(calls[0].options.credentials,'same-origin');
 assert.equal(h.get('server_preview_case_id').value,caseId);assert.equal(h.get('server_preview_revision').value,'1');
 assert.equal(h.get('gmail_cloud_fixture_approval').href,'/cloud-approval.html?caseId='+caseId);
 assert.equal(h.globalRef.SarberkiCaseStoreSession.cookieReadOnly,true);
 h.get('message').value+=' changed';assert.equal(h.globalRef.SarberkiClosedSyntheticMailPreview(envelope.text),false);calls.length=0;await h.get('gmail_cloud_fixture_save').click();assert.equal(calls.length,0);
});
test('foreign loaded Gmail record and lost session cannot cause cloud write',async()=>{
 let calls=0;const h=await harness(async()=>{calls++;return {ok:true,json:async()=>valid()};});
 h.get('gmail_cloud_fixture_language').value='hu';
 h.globalRef.sarberkiGmailTransform=()=>({source:{provider:'gmail',from_email:'arbitrary@synthetic.invalid'},original_message:'anything'});
 h.globalRef.displayGmailRecord=async()=>true;
 calls=0;await h.get('gmail_cloud_fixture_load').click();await h.get('gmail_cloud_fixture_save').click();assert.equal(calls,0);assert.equal(h.get('gmail_cloud_fixture_save').disabled,true);
});

async function closedTubUi(onFollowup=null){
 const caseId='44444444-4444-4444-8444-444444444444',base=syntheticMailEnvelope('hu'),followup=syntheticTubFollowupEnvelope();let posts=0,mimeCount=0;
 const record=revision=>({tenantId:'sarberki-test',caseId,revision,data:{tenantId:'sarberki-test',id:caseId,sender:base.sender,messages:revision===1?[base]:[base,followup],state:{approval:'pending',values:{arrival:'2026-10-23',departure:'2026-10-25',guests:'2',adults:'2',children:'0',unit:'Deluxe'}}}});
 const h=await harness(async(url,options)=>{
  if(url.endsWith('/operator-session'))return {ok:true,json:async()=>valid()};
  const input=JSON.parse(options.body);posts++;
  if(input.expectedRevision>0){assert.deepEqual(input,{tenantId:'sarberki-test',action:'ingest-and-draft',caseId,expectedRevision:input.expectedRevision,envelope:followup});if(onFollowup)return onFollowup(input,()=>({ok:true,json:async()=>({result:{resolution:{status:'linked'},record:record(2)}})}));}
  return {ok:true,json:async()=>({result:{resolution:{status:input.expectedRevision===0?'new':input.expectedRevision===1?'linked':'duplicate'},record:record(input.expectedRevision===0?1:2)}})};
 });
 h.get('gmail_cloud_fixture_language').value='hu';
 h.globalRef.sarberkiGmailTransform=mime=>{mimeCount++;const e=mime.id===followup.message_id?followup:base;return {source:{provider:'gmail',subject:'TESZT SÁRBERKI CLOSED HU',from_email:e.sender,message_id:e.message_id,thread_id:e.thread_id,received_at:e.received_at},original_message:e.text};};
 h.globalRef.displayGmailRecord=async parsed=>{h.get('gmail_json').value=JSON.stringify(parsed);h.get('message').value=parsed.original_message;return true;};
 return {...h,caseId,posts:()=>posts,mimeCount:()=>mimeCount,prepare:async()=>{await h.get('gmail_cloud_fixture_load').click();await h.get('gmail_cloud_fixture_save').click();}};
}
test('fixed tub Writer button requires saved base and updates Reader revision only after exact follow-up response',async()=>{
 const h=await closedTubUi();assert.equal(h.get('gmail_cloud_tub_followup').disabled,true);await h.get('gmail_cloud_tub_followup').click();assert.equal(h.posts(),0);
 await h.prepare();assert.equal(h.get('gmail_cloud_tub_followup').disabled,false);await h.get('gmail_cloud_tub_followup').click();assert.equal(h.posts(),2);assert.equal(h.mimeCount(),2);
 assert.equal(h.get('server_preview_case_id').value,h.caseId);assert.equal(h.get('server_preview_revision').value,'2');assert.equal(h.get('gmail_cloud_fixture_approval').hidden,true);assert.match(h.get('gmail_cloud_fixture_status').textContent,/Nincs dézsa-visszaigazolás/);
 await h.get('gmail_cloud_tub_followup').click();assert.equal(h.posts(),3);assert.equal(h.get('server_preview_revision').value,'2');
 h.globalRef.SarberkiCaseStoreSession=null;await h.get('gmail_cloud_tub_followup').click();assert.equal(h.posts(),3);
});
test('tub follow-up discards changed selection before POST and during pending response',async()=>{
 const before=await closedTubUi();await before.prepare();let csrfDone;
 const after=await closedTubUi(async(_input,reply)=>new Promise(resolve=>{csrfDone=()=>resolve(reply());}));await after.prepare();
 const pending=after.get('gmail_cloud_tub_followup').click();for(let i=0;i<20&&!csrfDone;i++)await Promise.resolve();
 after.get('server_preview_case_id').value='case-another';csrfDone();await pending;
 assert.equal(after.get('server_preview_case_id').value,'case-another');assert.equal(after.get('server_preview_revision').value,'1');
 const beforePending=before.get('gmail_cloud_tub_followup').click();before.get('server_preview_case_id').value='case-another';await beforePending;assert.equal(before.posts(),1);
});

async function closedReviewUi(onReview=null){
 const caseId='44444444-4444-4444-8444-444444444444',reviewId='55555555-5555-4555-8555-555555555555',base=syntheticMailEnvelope('hu'),envelope=syntheticTubReviewEnvelope();let posts=0;
 const baseRecord={tenantId:'sarberki-test',caseId,revision:1,data:{tenantId:'sarberki-test',id:caseId,sender:base.sender,messages:[base],state:{approval:'pending',values:{arrival:'2026-10-23',departure:'2026-10-25',guests:'2',adults:'2',children:'0',unit:'Deluxe'}}}};
 const reviewRecord={tenantId:'sarberki-test',caseId:reviewId,revision:1,data:{tenantId:'sarberki-test',id:reviewId,sender:base.sender,caseKind:'service_link_review',status:'link_review_required',messages:[envelope],state:{intent:'service_request',approval:'pending',original:envelope.text,revision:1,values:{language:'hu',phone:'',cars:''}},serviceRequests:[{kind:'tub_request',serviceOnly:true,linkedCaseId:null,startDate:'2026-10-24',startTime:'18:00',durationHours:24,confirmationAllowed:false}],drafts:[{synthetic:true,basedOnMessageCount:1,revision:1}]}};
 const h=await harness(async(url,options)=>{
  if(url.endsWith('/operator-session'))return {ok:true,json:async()=>valid()};
  posts++;const input=JSON.parse(options.body);
  if(input.expectedRevision===0)return {ok:true,json:async()=>({result:{resolution:{status:'new'},record:baseRecord}})};
  assert.deepEqual(input,{tenantId:'sarberki-test',action:'ingest-and-draft',caseId,expectedRevision:1,envelope});
  const response=()=>({ok:true,json:async()=>({result:{resolution:{status:'ambiguous'},record:reviewRecord,fixtureTarget:{caseId,revision:1}}})});
  return onReview?onReview(input,response):response();
 });
 h.get('gmail_cloud_fixture_language').value='hu';
 h.globalRef.sarberkiGmailTransform=mime=>{const e=mime.id===envelope.message_id?envelope:base;return {source:{provider:'gmail',subject:'TESZT SÁRBERKI CLOSED HU',from_email:e.sender,message_id:e.message_id,thread_id:e.thread_id,received_at:e.received_at},original_message:e.text};};
 h.globalRef.displayGmailRecord=async parsed=>{h.get('gmail_json').value=JSON.stringify(parsed);h.get('message').value=parsed.original_message;return true;};
 return {...h,caseId,reviewId,posts:()=>posts,prepare:async()=>{await h.get('gmail_cloud_fixture_load').click();await h.get('gmail_cloud_fixture_save').click();}};
}
test('detached review Writer fixture opens a separate Reader case and preloads the unchanged target for human resolution',async()=>{
 const h=await closedReviewUi();assert.equal(h.get('gmail_cloud_tub_review').disabled,true);await h.get('gmail_cloud_tub_review').click();assert.equal(h.posts(),0);
 await h.prepare();assert.equal(h.get('gmail_cloud_tub_review').disabled,false);await h.get('gmail_cloud_tub_review').click();
 assert.equal(h.posts(),2);assert.equal(h.get('server_preview_case_id').value,h.reviewId);assert.equal(h.get('server_preview_revision').value,'1');assert.equal(h.get('service_link_target').value,h.caseId);assert.equal(h.get('service_link_target_revision').value,'1');assert.match(h.get('gmail_cloud_fixture_status').textContent,/Célfoglalás változatlan/);assert.equal(h.get('gmail_cloud_tub_review').disabled,true);
 await h.get('gmail_cloud_tub_review').click();assert.equal(h.posts(),2);
});
test('review fixture rejects tampered source, lost session/selection and late responses',async()=>{
 for(const change of ['source','session','selection']){
  const h=await closedReviewUi();await h.prepare();
  if(change==='source'){const transform=h.globalRef.sarberkiGmailTransform;h.globalRef.sarberkiGmailTransform=mime=>({...transform(mime),original_message:'tampered'});}
  if(change==='session')h.globalRef.SarberkiCaseStoreSession=null;if(change==='selection')h.get('server_preview_revision').value='9';
  await h.get('gmail_cloud_tub_review').click();assert.equal(h.posts(),1);
 }
 let release;const h=await closedReviewUi((_input,response)=>new Promise(resolve=>release=()=>resolve(response())));await h.prepare();const pending=h.get('gmail_cloud_tub_review').click();while(!release)await Promise.resolve();h.get('server_preview_case_id').value='case-other';release();await pending;assert.equal(h.get('server_preview_case_id').value,'case-other');assert.equal(h.get('service_link_target').value,'');
});
test('pending review CSRF wait rechecks source epoch, target selection and session before POST',async()=>{
 for(const change of ['source','target','session']){
  const h=await closedReviewUi();await h.prepare();const pending=h.get('gmail_cloud_tub_review').click();
  if(change==='source')h.get('message').dispatchEvent({type:'input'});
  if(change==='target')h.get('server_preview_revision').value='9';
  if(change==='session')h.globalRef.SarberkiCaseStoreSession=null;
  await pending;assert.equal(h.posts(),1);
 }
});

test('source input during pending review response cannot open its late review case',async()=>{
 let release;const h=await closedReviewUi((_input,response)=>new Promise(resolve=>release=()=>resolve(response())));await h.prepare();const pending=h.get('gmail_cloud_tub_review').click();while(!release)await Promise.resolve();h.get('message').dispatchEvent({type:'input'});release();await pending;assert.equal(h.get('server_preview_case_id').value,h.caseId);assert.equal(h.get('service_link_target').value,'');
});

test('background clears cloud session and queues one fresh restore after a late auth response',async()=>{
 let calls=0,release;
 const h=await harness(async()=>{calls++;if(calls===2)return new Promise(r=>release=r);return {ok:true,json:async()=>valid()};});
 const pending=h.get('operator_restore').click();
 for(let i=0;i<100&&!release;i++)await Promise.resolve();
 h.documentRef.visibilityState='hidden';h.documentListeners.visibilitychange();
 assert.equal(h.globalRef.SarberkiCaseStoreSession,null);assert.equal(h.get('operator_list_cases').disabled,true);
 h.documentRef.visibilityState='visible';h.documentListeners.visibilitychange();
 h.globalListeners.pageshow({persisted:true});assert.equal(calls,2,'no overlapping refresh');
 release({ok:true,json:async()=>valid()});await pending;
 for(let i=0;i<100&&h.get('operator_login').disabled;i++)await Promise.resolve();
 assert.equal(calls,3);assert.ok(h.globalRef.SarberkiCaseStoreSession);assert.equal(h.get('operator_list_cases').disabled,false);
});
test('late login cannot restore a hidden page and a revoked session stays closed on return',async()=>{
 let calls=0,release;
 const h=await harness(async()=>{calls++;if(calls===2)return new Promise(r=>release=r);return {ok:false,json:async()=>({error:'AUTH_REQUIRED'})};});
 h.get('operator_login_email').value='writer@synthetic.invalid';h.get('operator_login_password').value='SYNTHETIC_PASSWORD';
 const pending=h.get('operator_login_form').submit();
 for(let i=0;i<100&&!release;i++)await Promise.resolve();
 h.globalListeners.pagehide();
 release({ok:true,json:async()=>valid()});await pending;
 assert.equal(h.globalRef.SarberkiCaseStoreSession,null);assert.equal(h.get('operator_login_password').value,'');
 await h.globalListeners.pageshow({persisted:true});assert.equal(calls,3);
 assert.equal(h.globalRef.SarberkiCaseStoreSession,null);assert.equal(h.get('operator_list_cases').disabled,true);
});
test('locally expired session cannot provide a CSRF token or keep cloud access active',async t=>{
 const metadata=valid(),h=await harness(async()=>({ok:true,json:async()=>metadata}));
 const session=h.globalRef.SarberkiCaseStoreSession;
 t.mock.method(Date,'now',()=>Date.parse(metadata.expiresAt)+1);
 await assert.rejects(session.getCsrfToken(),/AUTH_REQUIRED/);
 assert.equal(h.globalRef.SarberkiCaseStoreSession,null);assert.equal(h.get('operator_list_cases').disabled,true);
 assert.match(h.get('operator_login_status').textContent,/lejárt/);
});
test('cookie case read and foreground restore share a serial transport and cancel queued stale work',async()=>{
 let release,active=0,max=0,calls=0;
 const h=await harness(async()=>{calls++;active++;max=Math.max(max,active);if(calls===2)await new Promise(r=>release=r);active--;return {ok:true,json:async()=>valid()};});
 const session=h.globalRef.SarberkiCaseStoreSession;
 const reading=session.request('/.netlify/functions/booking-cases',{method:'GET'});
 await Promise.resolve();
 const restoring=h.get('operator_restore').click();
 h.documentRef.visibilityState='hidden';h.documentListeners.visibilitychange();
 h.documentRef.visibilityState='visible';h.documentListeners.visibilitychange();
 assert.equal(calls,2);release();await Promise.all([reading,restoring]);
 for(let i=0;i<100&&h.get('operator_login').disabled;i++)await Promise.resolve();
 assert.equal(max,1);assert.equal(calls,3);assert.ok(h.globalRef.SarberkiCaseStoreSession);
});


test('window blur clears cloud access without a visibility event; focus only restores by GET',async()=>{
 const methods=[],h=await harness(async(_url,options)=>{methods.push(options.method);return {ok:true,json:async()=>valid()};});
 const old=h.globalRef.SarberkiCaseStoreSession;h.get('operator_login_password').value='SYNTHETIC';
 h.globalListeners.blur();
 assert.equal(h.globalRef.SarberkiCaseStoreSession,null);assert.equal(h.get('operator_login_password').value,'');
 assert.equal(h.get('operator_list_cases').disabled,true);await assert.rejects(old.getCsrfToken(),/AUTH_REQUIRED/);
 const invalidations=h.events.filter(x=>x==='sarberki:session-changed').length;
 await h.globalListeners.focus();
 assert.ok(h.globalRef.SarberkiCaseStoreSession);assert.notEqual(h.globalRef.SarberkiCaseStoreSession,old);
 assert.ok(h.events.filter(x=>x==='sarberki:session-changed').length>invalidations);
 assert.deepEqual(methods,['GET','GET']);
});
test('focus alone invalidates an active session even when blur and visibility were missed',async()=>{
 let calls=0,release;
 const h=await harness(async()=>{calls++;if(calls===2)return new Promise(r=>release=r);return {ok:true,json:async()=>valid()};});
 const old=h.globalRef.SarberkiCaseStoreSession,pending=h.globalListeners.focus();
 assert.equal(h.globalRef.SarberkiCaseStoreSession,null);assert.equal(h.get('operator_list_cases').disabled,true);
 await assert.rejects(old.getCsrfToken(),/AUTH_REQUIRED/);
 for(let i=0;i<100&&!release;i++)await Promise.resolve();
 await h.globalListeners.focus();assert.equal(calls,2,'duplicate focus must not start parallel session restore');
 release({ok:true,json:async()=>valid()});await pending;
 assert.ok(h.globalRef.SarberkiCaseStoreSession);assert.notEqual(h.globalRef.SarberkiCaseStoreSession,old);
});
test('failed focus revalidation stays locked and never repeats a write',async()=>{
 const calls=[],h=await harness(async(_url,options)=>{calls.push(options.method);return calls.length===1?{ok:true,json:async()=>valid()}:{ok:false,json:async()=>({error:'AUTH_REQUIRED'})};});
 await h.globalListeners.focus();
 assert.equal(h.globalRef.SarberkiCaseStoreSession,null);assert.equal(h.get('operator_list_cases').disabled,true);
 assert.deepEqual(calls,['GET','GET']);
});

test('explicit restore recovers a visible page after blur even when focus event is missing',async()=>{
 const methods=[],h=await harness(async(_url,options)=>{methods.push(options.method);return {ok:true,json:async()=>valid()};});
 h.documentRef.visibilityState='visible';const old=h.globalRef.SarberkiCaseStoreSession;
 h.globalListeners.blur();assert.equal(h.globalRef.SarberkiCaseStoreSession,null);
 await h.get('operator_restore').click();
 assert.ok(h.globalRef.SarberkiCaseStoreSession,'explicit restore must not silently do nothing on a visible returned app');
 assert.notEqual(h.globalRef.SarberkiCaseStoreSession,old);assert.deepEqual(methods,['GET','GET']);
});
test('explicit restore never treats a hidden document as foreground',async()=>{
 const methods=[],h=await harness(async(_url,options)=>{methods.push(options.method);return {ok:true,json:async()=>valid()};});
 h.documentRef.visibilityState='hidden';h.globalListeners.blur();
 await h.get('operator_restore').click();
 assert.equal(h.globalRef.SarberkiCaseStoreSession,null);assert.deepEqual(methods,['GET']);
});

test('manual typed or pasted case ID reads current revision without relying on the case list',async()=>{
 const calls=[],id='982fc2fa-1e79-478b-8241-2a59f73027b8';
 const h=await harness(async(url,options)=>{
  calls.push({url,options});
  return {ok:true,json:async()=>url.includes('/operator-session')?valid():{result:[{tenantId:'sarberki-test',caseId:id,revision:3}]}};
 });
 assert.equal(h.get('operator_open_manual_case').disabled,false);
 h.get('operator_manual_case_id').value='  '+id+'  ';
 await h.get('operator_open_manual_case').click();
 assert.equal(h.get('server_preview_case_id').value,id);
 assert.equal(h.get('server_preview_revision').value,'3');
 assert.equal(h.get('operator_manual_audit').href,'/cloud-approval.html?caseId='+id);
 assert.equal(h.get('operator_manual_audit').hidden,false);
 assert.ok(calls.every(x=>x.options.method==='GET'));
 assert.ok(calls.some(x=>x.url.includes('booking-cases?tenantId=sarberki-test')));
 assert.ok(calls.every(x=>!x.url.includes('caseId=')),'manual lookup uses permitted summaries, never forbidden raw-case GET');
});
test('manual ID cannot select mismatched server case or malformed input',async()=>{
 let requests=0;
 const h=await harness(async(url)=>{
  if(url.includes('/operator-session'))return {ok:true,json:async()=>valid()};
  requests++;return {ok:true,json:async()=>({result:[{tenantId:'other',caseId:'case-other',revision:3}]})};
 });
 h.get('operator_manual_case_id').value='not an ID';
 await h.get('operator_open_manual_case').click();assert.equal(requests,0);
 h.get('operator_manual_case_id').value='case-1234';
 await h.get('operator_open_manual_case').click();
 assert.equal(h.get('server_preview_case_id').value,'');
 assert.equal(h.get('operator_manual_audit').hidden,true);
});


test('editing a manual case ID clears stale preview selection and audit before a new lookup',async()=>{
 const id='982fc2fa-1e79-478b-8241-2a59f73027b8',calls=[];
 const h=await harness(async(url,options)=>{calls.push(options.method);return {ok:true,json:async()=>url.includes('/operator-session')?valid():{result:[{tenantId:'sarberki-test',caseId:id,revision:3}]}};});
 h.get('operator_manual_case_id').value=id;
 await h.get('operator_open_manual_case').click();
 assert.equal(h.get('server_preview_case_id').value,id);
 assert.equal(h.get('operator_manual_audit').hidden,false);
 h.get('operator_manual_case_id').value='case-1234';
 h.get('operator_manual_case_id').dispatchEvent(new Event('input'));
 assert.equal(h.get('server_preview_case_id').value,'');
 assert.equal(h.get('server_preview_revision').value,'');
 assert.equal(h.get('operator_manual_audit').hidden,true);
 h.get('operator_manual_case_id').value='not an ID';
 await h.get('operator_open_manual_case').click();
 assert.equal(h.get('server_preview_case_id').value,'');
 assert.ok(calls.every(method=>method==='GET'),'only existing authorized read calls are allowed');
});
test('switching from manually chosen case to dropdown removes the previous audit target',async()=>{
 const id='982fc2fa-1e79-478b-8241-2a59f73027b8',other='case-1234';
 const h=await harness(async(url)=>({ok:true,json:async()=>url.includes('/operator-session')?valid():{result:[{tenantId:'sarberki-test',caseId:id,revision:3},{tenantId:'sarberki-test',caseId:other,revision:2}]}}));
 h.get('operator_manual_case_id').value=id;
 await h.get('operator_open_manual_case').click();
 assert.equal(h.get('operator_manual_audit').hidden,false);
 await h.get('operator_list_cases').click();
 h.get('operator_case_select').value=other;
 await h.get('operator_open_case').click();
 assert.equal(h.get('server_preview_case_id').value,other);
 assert.equal(h.get('server_preview_revision').value,'2');
 assert.equal(h.get('operator_manual_audit').hidden,true);
});

test('manual selection rejects duplicate summaries instead of silently choosing the first revision',async()=>{
 const id='982fc2fa-1e79-478b-8241-2a59f73027b8',methods=[];
 const h=await harness(async(url,options)=>{
  methods.push(options.method);
  return {ok:true,json:async()=>url.includes('/operator-session')?valid():
   {result:[{tenantId:'sarberki-test',caseId:id,revision:2},{tenantId:'sarberki-test',caseId:id,revision:3}]}};
 });
 h.get('operator_manual_case_id').value=id;
 await h.get('operator_open_manual_case').click();
 assert.equal(h.get('server_preview_case_id').value,'');
 assert.equal(h.get('server_preview_revision').value,'');
 assert.equal(h.get('operator_manual_audit').hidden,true);
 assert.match(h.get('operator_case_status').textContent,/ellenőrzés szükséges/u);
 assert.ok(methods.every(method=>method==='GET'));
});
test('manual selection rejects extra fields, cross-tenant records and malformed summaries',async()=>{
 const id='982fc2fa-1e79-478b-8241-2a59f73027b8';
 for(const row of [
  {tenantId:'sarberki-test',caseId:id,revision:3,secret:'unexpected'},
  {tenantId:'other-tenant',caseId:id,revision:3},
  {tenantId:'sarberki-test',caseId:id,revision:0},
  {tenantId:'sarberki-test',caseId:id,revision:'3'},
 ]){
  const h=await harness(async(url,options)=>({ok:true,json:async()=>url.includes('/operator-session')?valid():{result:[row]}}));
  h.get('operator_manual_case_id').value=id;
  await h.get('operator_open_manual_case').click();
  assert.equal(h.get('server_preview_case_id').value,'');
  assert.equal(h.get('server_preview_revision').value,'');
  assert.equal(h.get('operator_manual_audit').hidden,true);
 }
});
test('manual selection picks exactly one authorized case from other nonmatching summaries',async()=>{
 const id='982fc2fa-1e79-478b-8241-2a59f73027b8';
 const h=await harness(async(url,options)=>({ok:true,json:async()=>url.includes('/operator-session')?valid():
  {result:[{tenantId:'sarberki-test',caseId:'case-other',revision:5},{tenantId:'sarberki-test',caseId:id,revision:4}]}}));
 h.get('operator_manual_case_id').value=id;
 await h.get('operator_open_manual_case').click();
 assert.equal(h.get('server_preview_case_id').value,id);
 assert.equal(h.get('server_preview_revision').value,'4');
 assert.equal(h.get('operator_manual_audit').hidden,false);
});

test('dropdown rejects conflicting case revisions and does not select an arbitrary one',async()=>{
 const id='case-synthetic-duplicate',another='case-synthetic-good',methods=[];
 const rows=[
  {tenantId:'sarberki-test',caseId:id,revision:2},
  {tenantId:'sarberki-test',caseId:id,revision:3},
  {tenantId:'sarberki-test',caseId:another,revision:4}
 ];
 const h=await harness(async(url,options)=>{methods.push(options.method);
  return {ok:true,json:async()=>url.includes('/operator-session')?valid():{result:rows}};});
 await h.get('operator_list_cases').click();
 assert.equal(h.get('operator_case_select').children.length,2);
 assert.equal(h.get('operator_case_select').children[1].value,another);
 h.get('operator_case_select').value=id;
 await h.get('operator_open_case').click();
 assert.equal(h.get('server_preview_case_id').value,'');
 assert.equal(h.get('server_preview_revision').value,'');
 h.get('operator_case_select').value=another;
 await h.get('operator_open_case').click();
 assert.equal(h.get('server_preview_case_id').value,another);
 assert.equal(h.get('server_preview_revision').value,'4');
 assert.ok(methods.every(method=>method==='GET'));
});
test('dropdown excludes an ID duplicated by malformed or cross-tenant summaries',async()=>{
 const id='case-synthetic-duplicate';
 for(const second of [
  {tenantId:'other-tenant',caseId:id,revision:8},
  {tenantId:'sarberki-test',caseId:id,revision:8,unexpected:'private'},
 ]){
  const h=await harness(async(url)=>({ok:true,json:async()=>url.includes('/operator-session')?valid():
   {result:[{tenantId:'sarberki-test',caseId:id,revision:3},second]}}));
  await h.get('operator_list_cases').click();
  assert.equal(h.get('operator_case_select').children.length,1);
  assert.equal(h.get('operator_case_select').disabled,true);
  assert.equal(h.get('operator_open_case').disabled,true);
 }
});
