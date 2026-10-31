import test, {before,after,mock} from 'node:test';
// Freeze the fictional stay, evidence, JWTs and embedded PostgreSQL together.
// This clock exists only in this isolated test file; application guards stay real-time.
before(()=>mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-17T12:00:00Z')}));
after(()=>mock.timers.reset());
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import * as core from '../sarberki-core.mjs';
import {BUSINESS} from '../business-config.mjs';
import * as fishing from '../fishing-rules.mjs';
import * as policy from '../gmail-policy.mjs';
import * as splitUnits from '../split-units.mjs';
import {syntheticMailMime,syntheticMailEnvelope} from '../shared-core/synthetic-mail-fixtures.mjs';
import {initOperatorLoginPanel} from '../operator-login-ui.mjs';
import {createOperatorSessionHandler} from '../netlify/functions/operator-session.mjs';
import {createCaseHandler} from '../netlify/functions/booking-cases.mjs';
import {createCaseStoreClient} from '../shared-core/case-store-client.mjs';

// NO network. Only controlled fake GIS/Gmail/Auth HTTP responses are allowed.
// The actual read callbacks/controller/cookie handler and PostgreSQL SQL are used.
const origin='https://leafy-chimera-2403e5.netlify.app',project='https://mojnqizbcaczstguikpv.supabase.co';
const actors={writer:'11111111-1111-4111-8111-111111111111',reader:'22222222-2222-4222-8222-222222222222',approver:'33333333-3333-4333-8333-333333333333'};
const sessions={writer:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',reader:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',approver:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'};
const csrfHeaders=csrf=>({'X-Sarberki-Operator':'1','X-CSRF-Token':csrf,'Content-Type':'application/json'});
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
function dom(){
 const nodes=new Map(),listeners=new Map();
 const element=id=>{
  if(nodes.has(id))return nodes.get(id);
  const node={id,value:'',textContent:'',disabled:false,hidden:false,style:{},children:[],events:new Map(),
   addEventListener(type,fn){this.events.set(type,fn);},dispatchEvent(event){return this.events.get(event.type)?.(event);},
   async click(){return this.events.get('click')?.();},replaceChildren(){this.children=[];this.value='';},
   appendChild(child){this.children.push(child);},querySelector(selector){return element(selector.slice(1));},
   insertAdjacentElement(_where,child){nodes.set(child.id,child);},removeAttribute(name){delete this[name];}};
  Object.defineProperty(node,'innerHTML',{set(value){this.children=[];for(const match of value.matchAll(/id="([^"]+)"/g))element(match[1]);}});
  nodes.set(id,node);return node;
 };
 const document={getElementById:id=>id==='gmail_message_picker_wrap'?(nodes.get(id)||null):element(id),createElement:()=>element('temporary-'+nodes.size),querySelector:()=>({content:'synthetic-oauth-client'}),
  addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},
  dispatchEvent(event){for(const fn of listeners.get(event.type)||[])fn(event);}};
 return {element,document};
}
async function gmailReadHarness({ui=dom(),onDisplay,messages,account=policy.TEST_GMAIL_ACCOUNT}){
 const storage=new Map(),calls=[],oauthOptions=[];let callback;
 const oauth={initTokenClient(options){oauthOptions.push(options);callback=options.callback;return {requestAccessToken(input){assert.equal(input.prompt,'');assert.equal(Object.keys(input).length,1);}};}};
 const window={google:{accounts:{oauth2:oauth}},addEventListener(){}};
 const fakeToken='SYNTHETIC_READONLY_GMAIL_TOKEN_TEST_ONLY';
 const fetchImpl=async(raw,options={})=>{
  const url=new URL(raw);calls.push(url.href);
  assert.equal(url.origin,'https://gmail.googleapis.com');assert.equal(options.method||'GET','GET');
  assert.equal(options.headers.Authorization,'Bearer '+fakeToken);assert.equal(options.cache,'no-store');
  if(url.pathname.endsWith('/profile'))return {ok:true,json:async()=>({emailAddress:account})};
  if(url.pathname.endsWith('/messages')){
   assert.equal(url.searchParams.get('q'),policy.INBOX_QUERY);
   const page=url.searchParams.get('pageToken');assert.ok(page===null||page==='synthetic-page-2');
   const selected=page?messages.slice(2):messages.slice(0,2);
   return {ok:true,json:async()=>({messages:selected.map(message=>({id:message.id})),...(!page&&messages.length>2?{nextPageToken:'synthetic-page-2'}:{})})};
  }
  const id=decodeURIComponent(url.pathname.split('/').at(-1)),message=messages.find(message=>message.id===id);
  assert.ok(message,'unexpected Gmail message request');assert.equal(url.searchParams.get('format'),'full');
  return {ok:true,json:async()=>structuredClone(message)};
 };
 const source=(await read('gmail-readonly.js')).replace(/await import\('\.\/([^']+)'\)/gu,(_,name)=>'modules['+JSON.stringify(name.split('?')[0])+']');
 const context=vm.createContext({modules:{'sarberki-core.mjs':core,'business-config.mjs':{BUSINESS},'fishing-rules.mjs':fishing,'gmail-policy.mjs':policy,'split-units.mjs':splitUnits},document:ui.document,window,google:window.google,
  fetch:fetchImpl,displayGmailRecord:onDisplay,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},console,URL,Date,Number,Intl,TextDecoder,Uint8Array,atob,Event,AbortController,setTimeout,clearTimeout,
  setInterval:()=>assert.fail('reading must never start Pushover polling'),clearInterval(){}});
 await vm.runInContext(source,context);
 return {ui,window,storage,calls,oauthOptions,async read(){await ui.element('read_gmail').click();await callback({access_token:fakeToken});assert.equal(oauthOptions.at(-1).scope,'https://www.googleapis.com/auth/gmail.readonly');assert.equal(oauthOptions.at(-1).include_granted_scopes,false);assert.equal(oauthOptions.at(-1).hint,policy.TEST_GMAIL_ACCOUNT);},
  assertNoTokenStored(){assert.ok(!JSON.stringify([...storage]).includes(fakeToken));assert.equal(Object.hasOwn(window,'currentToken'),false);}};
}
test('wrong Gmail account blocks list/message reads; failed display leaves local read marker unset',async()=>{
 for(const failure of ['wrong-account','false','throw']){
  let displayed=0;const h=await gmailReadHarness({messages:[syntheticMailMime('de')],account:failure==='wrong-account'?'other@synthetic.invalid':policy.TEST_GMAIL_ACCOUNT,
   onDisplay:async()=>{displayed++;if(failure==='throw')throw Error('synthetic processing failure');return false;}});
  await h.read();assert.equal(h.storage.size,0);h.assertNoTokenStored();
  if(failure==='wrong-account'){assert.equal(displayed,0);assert.equal(h.calls.length,1);assert.match(h.ui.element('gmail_auth_status').textContent,/tesztfiók/);}
  else {assert.equal(displayed,1);assert.match(h.ui.element('gmail_auth_status').textContent,/nem jelölt|sikertelen/);}
 }
});
test('actual fake GIS read -> exact registry staging -> explicit cookie Writer -> PostgreSQL -> Reader -> HU/DE/SI/EN Writer correction -> independent approval',async t=>{
 let db=new PGlite(),cookie='',metadata,casePosts=0;const ids=[];const tokens=new Map();
 const env={URL:origin,SUPABASE_URL:project,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC_PUBLIC_KEY_12345',CASE_STORE_ENABLED:'synthetic-only',CASE_STORE_TEST_TENANTS:'sarberki-test,demo-test',CASE_APPROVAL_ENABLED:'sarberki-test-synthetic-only',ISOLATED_APPROVAL_ATTESTATION_KEY:'a1'.repeat(32),SARBERKI_OPERATOR_SESSION_KEY:'ab'.repeat(32)};
 const jwt=role=>{const claims={sub:actors[role],role:'authenticated',iss:project+'/auth/v1',exp:Math.floor(Date.now()/1000)+3600,session_id:sessions[role]};const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.synthetic_signature';tokens.set(token,claims);return token;};
 const asClaims=async(claims,fn)=>{await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims)]);try{return await fn();}finally{await db.exec('reset role');}};
 const authFetch=async(raw,options)=>{
  const url=new URL(raw);assert.equal(url.origin,project);
  if(url.pathname.endsWith('/token')){
   const body=JSON.parse(options.body),role=url.searchParams.get('grant_type')==='password'?body.email.split('@')[0]:body.refresh_token.replace('synthetic_refresh_','');
   assert.ok(Object.hasOwn(actors,role));return {ok:true,json:async()=>({access_token:jwt(role),refresh_token:'synthetic_refresh_'+role,user:{id:actors[role]}})};
  }
  if(url.pathname.endsWith('/logout'))return {ok:true,status:204};
  const claims=tokens.get(options.headers.Authorization?.slice(7));assert.ok(claims);
  if(url.pathname.endsWith('/user'))return {ok:true,json:async()=>({id:claims.sub})};
  try{const result=await asClaims(claims,async()=>{
   if(url.pathname.endsWith('/sc_memberships'))return (await db.query('select * from sc_memberships where user_id=$1',[claims.sub])).rows;
   if(url.pathname.endsWith('/sc_write_case')){const b=JSON.parse(options.body);return (await db.query('select sc_write_case($1,$2,$3,$4) result',[b.p_tenant,b.p_case,b.p_expected,JSON.stringify(b.p_data)])).rows[0].result;}
   if(url.pathname.endsWith('/sc_approve_case')){const b=JSON.parse(options.body);return (await db.query('select sc_approve_case($1,$2,$3,$4,$5) result',[b.p_tenant,b.p_case,b.p_expected,b.p_draft_hash,JSON.stringify(b.p_evidence)])).rows[0].result;}
   const tenant=url.searchParams.get('tenant_id')?.slice(3),id=url.searchParams.get('case_id')?.slice(3);
   if(url.pathname.endsWith('/sc_audit'))return (await db.query("select revision,actor,kind,data_hash from sc_audit where tenant_id=$1 and case_id=$2 and kind='approve_isolated_synthetic'",[tenant,id])).rows;
   assert.ok(url.pathname.endsWith('/sc_cases'));return (await db.query('select * from sc_cases where tenant_id=$1'+(id?' and case_id=$2':''),id?[tenant,id]:[tenant])).rows;
  });return {ok:true,json:async()=>result};}catch(error){return {ok:false,status:error.code==='42501'?403:400};}
 };
 const operator=createOperatorSessionHandler({env,fetchImpl:authFetch}),cases=createCaseHandler({env,fetchImpl:authFetch});
 const browserFetch=async(raw,options={})=>{
  const url=new URL(raw,origin);assert.equal(url.origin,origin,'no third-party or provider network');
  if(url.pathname.endsWith('/booking-cases')&&options.method==='POST')casePosts++;
  const headers=Object.fromEntries(Object.entries(options.headers||{}).map(([key,value])=>[key.toLowerCase(),value]));
  const event={httpMethod:options.method||'GET',headers:{...headers,host:new URL(origin).host,origin,'sec-fetch-site':'same-origin',...(cookie?{cookie}:{})},body:options.body||'',queryStringParameters:Object.fromEntries(url.searchParams)};
  const result=await (url.pathname.endsWith('/operator-session')?operator(event):cases(event));
  if(result.headers['Set-Cookie'])cookie=result.headers['Set-Cookie'].split(';')[0];
  return {ok:result.statusCode>=200&&result.statusCode<300,status:result.statusCode,json:async()=>JSON.parse(result.body)};
 };
 const login=async role=>{const response=await browserFetch('/.netlify/functions/operator-session',{method:'POST',headers:{'X-Sarberki-Operator':'1','Content-Type':'application/json'},body:JSON.stringify({action:'login',email:role+'@synthetic.invalid',password:'SYNTHETIC_NOT_A_REAL_PASSWORD'})});assert.equal(response.status,200);metadata=await response.json();};
 const post=async(input,expected=200)=>{const response=await browserFetch('/.netlify/functions/booking-cases',{method:'POST',headers:csrfHeaders(metadata.csrfToken),body:JSON.stringify(input)});assert.equal(response.status,expected);return (await response.json()).result;};
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  await db.exec(await read('supabase/migrations/202610090001_case_store.sql'));await db.exec("insert into sc_tenants values('sarberki-test','Synthetic',true),('demo-test','Foreign',true)");
  await db.query("select set_config('sarberki.approval_install_project_ref',$1,false),set_config('sarberki.approval_backup_sha256',$2,false)",['mojnqizbcaczstguikpv','b'.repeat(64)]);
  await db.exec(await read('deployment/cloud-approval/install.sql'));await db.exec(await read('deployment/cloud-approval/separate-approver-permission.sql'));
  await db.query('insert into sc_isolated_approval_key(key_hex) values($1)',[env.ISOLATED_APPROVAL_ATTESTATION_KEY]);
  for(const role of Object.keys(actors)){await db.query('insert into auth.users values($1)',[actors[role]]);await db.query('insert into auth.sessions values($1,$2,null)',[sessions[role],actors[role]]);await db.query("insert into sc_memberships values('sarberki-test',$1,true,$2,$3)",[actors[role],role==='writer',role!=='reader']);}
  await login('writer');const ui=dom();
  const messages=['de','si','en','hu'].map(syntheticMailMime);
  const dePayload=messages[0].payload;messages[0].payload={mimeType:'multipart/alternative',headers:dePayload.headers,parts:[{mimeType:'text/html',body:{data:btoa('<div>ignored alternative</div>')}},{mimeType:'text/plain',body:dePayload.body}]};
  messages.push({...syntheticMailMime('de'),id:'excluded-sent-fixture',labelIds:['SENT']});
  messages.push({...syntheticMailMime('en'),id:'excluded-old-fixture',internalDate:String(Date.parse('2026-09-24'))});
  const h=await gmailReadHarness({ui,messages,onDisplay:async record=>{
   // The legacy index display is mocked, explicitly. Actual controller event
   // listener MUST stage it; the callback never bypasses it or writes cloud.
   ui.element('gmail_json').value=JSON.stringify(record);ui.element('message').value=record.original_message;
   ui.document.dispatchEvent(new CustomEvent('sarberki:gmail-normalized',{detail:{message_id:record.source.message_id}}));return true;
  }});
  assert.equal(initOperatorLoginPanel({documentRef:ui.document,globalRef:h.window,request:browserFetch}),true);
  for(let i=0;i<100&&ui.element('operator_login').disabled;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.ok(h.window.SarberkiCaseStoreSession);await h.read();h.assertNoTokenStored();
  assert.equal(ui.element('gmail_message_picker').children.length,4,'only policy-matching INBOX messages enter the picker');
  assert.equal(h.calls.filter(raw=>new URL(raw).pathname.endsWith('/messages')).length,2,'the unchanged callback follows Gmail list pagination');
  await t.test('ordinary, changed and mismatched Gmail events cannot stage cloud save',async()=>{
   const valid=h.window.sarberkiGmailTransform(syntheticMailMime('de'));
   const variants=[{record:{...valid,source:{...valid.source,from_email:'unregistered@synthetic.invalid'}},id:valid.source.message_id},
    {record:{...valid,source:{...valid.source,subject:'ordinary inquiry'}},id:valid.source.message_id},
    {record:{...valid,original_message:valid.original_message+' changed'},id:valid.source.message_id},
    {record:valid,id:'mismatched-message-id'}];
   for(const variant of variants){
    ui.element('gmail_json').value=JSON.stringify(variant.record);ui.element('message').value=variant.record.original_message;
    ui.document.dispatchEvent(new CustomEvent('sarberki:gmail-normalized',{detail:{message_id:variant.id}}));
    assert.equal(ui.element('gmail_cloud_fixture_save').disabled,true);
    await ui.element('gmail_cloud_fixture_save').click();assert.equal((await db.query('select count(*)::int n from sc_cases')).rows[0].n,0);
   }
   assert.equal(casePosts,0,'invalid staging must not attempt any cloud POST');
   await ui.element('operator_logout').click();
   ui.element('gmail_json').value=JSON.stringify(valid);ui.element('message').value=valid.original_message;
   ui.document.dispatchEvent(new CustomEvent('sarberki:gmail-normalized',{detail:{message_id:valid.source.message_id}}));
   assert.equal(ui.element('gmail_cloud_fixture_save').disabled,true);await ui.element('gmail_cloud_fixture_save').click();assert.equal(casePosts,0);
   await login('writer');await ui.element('operator_restore').click();
  });
  for(const language of ['hu','si','de','en'])await t.test(language+' actual picker/display stages explicit cloud save, Writer correction and independent approval',async()=>{
   const mime=syntheticMailMime(language);ui.element('gmail_message_picker').value=mime.id;await ui.element('gmail_open_selected').click();
   assert.equal(ui.element('gmail_cloud_fixture_save').disabled,false,'an exact Gmail-read record must stage the existing explicit save control');
   await ui.element('gmail_cloud_fixture_save').click();const id=ui.element('server_preview_case_id').value;
   assert.match(id,/^[a-f0-9-]{36}$/);ids.push(id);assert.equal(ui.element('server_preview_revision').value,'1');
   const savedResponse=await browserFetch('/.netlify/functions/booking-cases?'+new URLSearchParams({tenantId:'sarberki-test',caseId:id,action:'review-record'}),{headers:csrfHeaders(metadata.csrfToken)});
   assert.equal(savedResponse.status,200);const saved=(await savedResponse.json()).result,values=saved.data.state.values;
   assert.equal(values.language,language);assert.equal(values.arrival,'2026-10-23');assert.equal(values.departure,'2026-10-25');
   assert.equal(values.adults,'2');assert.equal(values.children,'0');assert.equal(values.unit,'Deluxe');assert.equal(values.phone,core.phoneFromText(syntheticMailEnvelope(language).text));
   assert.equal(saved.data.messages[0].message_id,mime.id);
   assert.match(saved.data.drafts[0].text,{hu:/^Kedves Vendégünk/u,de:/^Guten Tag/u,si:/^Pozdravljeni/u,en:/^Dear Guest/u}[language]);
   assert.match(saved.data.drafts[0].operatorReviewText,/^Kedves Vendégünk/u);

   await ui.element('gmail_open_selected').click();await ui.element('gmail_cloud_fixture_save').click();assert.equal(ui.element('server_preview_revision').value,'1');
   await post({tenantId:'sarberki-test',action:'review-draft',caseId:id,expectedRevision:1});
   await login('reader');const reader=createCaseStoreClient({cookieReadOnly:true,getCsrfToken:()=>metadata.csrfToken,request:browserFetch});
   assert.ok((await reader.list('sarberki-test')).some(row=>row.caseId===id));const preview=await reader.previewDraft('sarberki-test',id,2);assert.ok(preview.storedDraft.text);assert.equal(preview.persisted,false);
   const hash=createHash('sha256').update(preview.storedDraft.text).digest('hex');
   await post({tenantId:'sarberki-test',action:'review-draft',caseId:id,expectedRevision:2},403);
   await post({tenantId:'sarberki-test',action:'ingest-and-draft',envelope:syntheticMailEnvelope(language),expectedRevision:0},403);
   assert.equal((await reader.previewDraft('sarberki-test',id,2)).revision,2,'Reader denied ingest must preserve saved version');

   await post({tenantId:'sarberki-test',action:'approve',caseId:id,expectedRevision:2,reviewedDraftHash:hash},403);
   // Returned for correction: the Writer saves a new version; the case stays open and pending.
   const corrected=preview.storedDraft.text+'\n\nSynthetic operator correction '+language+'.',correctedHash=createHash('sha256').update(corrected).digest('hex');
   const edit={tenantId:'sarberki-test',action:'edit-draft',caseId:id,expectedRevision:2,expectedDraftHash:hash,editedDraftText:corrected};
   await post(edit,403);
   await login('writer');await post({...edit,tenantId:'demo-test'},403);await post({...edit,expectedRevision:1},409);
   const edited=await post(edit);assert.equal(edited.revision,3);assert.equal(edited.data.state.approval,'pending');assert.ok(!edited.data.serverApproval);
   assert.equal(edited.data.drafts.at(-1).text,corrected);assert.equal(edited.data.drafts.at(-1).editedBy,actors.writer);assert.equal(edited.data.drafts.length,3);
   assert.equal((await db.query("select kind from sc_audit where case_id=$1 and revision=3",[id])).rows[0].kind,'update');
   // The Writer also holds approve permission here: this 403 proves editor/approver independence.
   await post({tenantId:'sarberki-test',action:'approve',caseId:id,expectedRevision:3,reviewedDraftHash:correctedHash},403);
   await login('approver');await post({tenantId:'sarberki-test',action:'review-draft',caseId:id,expectedRevision:3},403);
   await post({tenantId:'sarberki-test',action:'approve',caseId:id,expectedRevision:3,reviewedDraftHash:hash},400);
   await post({tenantId:'sarberki-test',action:'approve',caseId:id,expectedRevision:2,reviewedDraftHash:correctedHash},409);
   assert.equal((await db.query("select count(*)::int n from sc_audit where case_id=$1 and kind='approve_isolated_synthetic'",[id])).rows[0].n,0);
   const approved=await post({tenantId:'sarberki-test',action:'approve',caseId:id,expectedRevision:3,reviewedDraftHash:correctedHash});assert.equal(approved.revision,4);assert.equal(approved.data.state.approval,'internally_approved');
   assert.equal(approved.data.serverApproval.draftHash,correctedHash);assert.equal(approved.data.serverApproval.actor,actors.approver);
   await post({tenantId:'sarberki-test',action:'approve',caseId:id,expectedRevision:3,reviewedDraftHash:correctedHash},409);
   await login('writer');await ui.element('operator_restore').click();
  });
  const before=(await db.query("select * from sc_audit where kind='approve_isolated_synthetic' order by case_id")).rows;assert.equal(before.length,4);assert.ok(before.every(row=>row.actor===actors.approver&&row.revision===4));
  const snapshot=await db.dumpDataDir();await db.close();db=new PGlite({loadDataDir:snapshot});
  await login('reader');
  for(const id of ids){const response=await browserFetch('/.netlify/functions/booking-cases?'+new URLSearchParams({tenantId:'sarberki-test',caseId:id,action:'approval-state'}),{headers:csrfHeaders(metadata.csrfToken)});assert.equal(response.status,200);const back=(await response.json()).result;assert.equal(back.approval,'internally_approved');assert.equal(back.audit.length,1);assert.equal(back.audit[0].actor,actors.approver);}
  h.assertNoTokenStored();assert.equal((await db.query('select count(*)::int n from sc_cases')).rows[0].n,4);
 }finally{await db.close();}
});
