import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createHash} from 'node:crypto';
import {createExactGmailReceipt} from '../shared-core/server-exact-gmail-receipt.mjs';
import {assertCloudSyntheticReadCase,assertCloudSyntheticReviewCase} from '../shared-core/cloud-synthetic-approval.mjs';
import {syntheticMailEnvelope,syntheticTubFollowupEnvelope} from '../shared-core/synthetic-mail-fixtures.mjs';
import {createCaseHandler} from '../netlify/functions/booking-cases.mjs';
import {createOperatorSessionHandler} from '../netlify/functions/operator-session.mjs';
const id='fa570d0b-1ea9-4568-a8f2-08b4dec446d0',reader='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const project='https://mojnqizbcaczstguikpv.supabase.co',origin='https://leafy-chimera-2403e5.netlify.app';
function record(){return {tenantId:'sarberki-test',caseId:id,revision:4,data:{id,tenantId:'sarberki-test',sender:syntheticMailEnvelope('hu').sender,
 state:{intent:'booking_request',approval:'pending',revision:2,values:{arrival:'2026-10-23',departure:'2026-10-25',guests:'2',adults:'2',children:'0',unit:'Deluxe'}},
 messages:[syntheticMailEnvelope('hu'),syntheticTubFollowupEnvelope()],
 drafts:[{text:'Stored fictional HU reply.\r\nNot a recomputed preview.',operatorReviewText:'Tárolt magyar ellenőrző szöveg.',revision:2,basedOnMessageCount:2}]}};}
test('only pinned exact two-message HU record gets extra read scope, never review scope',()=>{
 const r=record();assert.doesNotThrow(()=>assertCloudSyntheticReadCase(r));assert.throws(()=>assertCloudSyntheticReviewCase(r),/FORBIDDEN/);
 for(const mutate of [r=>r.caseId='another-case',r=>r.tenantId='demo-test',r=>r.data.tenantId='demo-test',r=>r.data.id='another-case',r=>r.data.sender='arbitrary@fixture.invalid',r=>r.data.messages[1].text+=' changed',r=>r.data.messages[1].mailbox_id='other',r=>r.data.messages[1].extra='untrusted',r=>r.data.messages.push(syntheticTubFollowupEnvelope()),r=>r.data.messages.reverse(),r=>r.data.state.values.arrival='2026-11-01',r=>r.data.state.approval='internally_approved']){
  const bad=record();mutate(bad);assert.throws(()=>assertCloudSyntheticReadCase(bad),/FORBIDDEN/);
 }
});
test('authenticated Reader cookie reads stored HU text and historical audit through real SQL RLS without writes',async t=>{
 const db=new PGlite();const tokens=new Map();let cookie='',csrf='',role='reader',rpcCalls=0;
 const env={URL:origin,SUPABASE_URL:project,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC_PUBLIC_KEY_12345',CASE_STORE_ENABLED:'synthetic-only',CASE_STORE_TEST_TENANTS:'sarberki-test,demo-test',CASE_APPROVAL_ENABLED:'sarberki-test-synthetic-only',ISOLATED_APPROVAL_ATTESTATION_KEY:'ab'.repeat(32),SARBERKI_OPERATOR_SESSION_KEY:'cd'.repeat(32)};
 const asUser=async(actor,fn)=>{await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:actor,role:'authenticated'})]);try{return await fn();}finally{await db.exec('reset role');}};
 const fetchImpl=async(raw,options)=>{
  const url=new URL(raw);assert.equal(url.origin,project,'no provider calls');
  if(url.pathname==='/auth/v1/token'){
   const actor=role==='reader'?reader:other;const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:actor,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.synthetic';tokens.set(token,actor);
   return {ok:true,json:async()=>({access_token:token,refresh_token:'synthetic_refresh_'+role,user:{id:actor}})};
  }
  const actor=tokens.get(options.headers.Authorization?.slice(7));assert.ok(actor);
  if(url.pathname==='/auth/v1/user')return {ok:true,json:async()=>({id:actor})};
  if(url.pathname.includes('/rpc/')){rpcCalls++;throw Error('NO_WRITE_RPC_ALLOWED');}
  assert.equal(options.method,'GET');
  const result=await asUser(actor,async()=>{
   if(url.pathname.endsWith('/sc_memberships'))return (await db.query('select * from sc_memberships where user_id=$1',[actor])).rows;
   if(url.pathname.endsWith('/sc_cases'))return (await db.query('select * from sc_cases where tenant_id=$1 and case_id=$2',[url.searchParams.get('tenant_id').slice(3),url.searchParams.get('case_id').slice(3)])).rows;
   assert.ok(url.pathname.endsWith('/sc_audit'));assert.equal(url.searchParams.get('kind'),'eq.approve_isolated_synthetic');
   return (await db.query('select revision,actor,at,kind,data_hash from sc_audit where tenant_id=$1 and case_id=$2 and kind=$3',[url.searchParams.get('tenant_id').slice(3),url.searchParams.get('case_id').slice(3),'approve_isolated_synthetic'])).rows;
  });return {ok:true,json:async()=>result};
 };
 const api=createCaseHandler({env,fetchImpl}),operator=createOperatorSessionHandler({env,fetchImpl});
 const call=async(input,{method='GET',headers={},handler=api}={})=>{
  const res=await handler({httpMethod:method,headers:{host:new URL(origin).host,origin,'sec-fetch-site':'same-origin','x-sarberki-operator':'1',...(cookie?{cookie}:{}),...(csrf?{'x-csrf-token':csrf}:{}),...headers},body:method==='POST'?JSON.stringify(input):'',queryStringParameters:method==='GET'?input:{}});
  if(res.headers['Set-Cookie'])cookie=res.headers['Set-Cookie'].split(';')[0];return {...res,json:JSON.parse(res.body)};
 };
 const login=async name=>{role=name;cookie='';csrf='';const r=await call({action:'login',email:'fictional@synthetic.invalid',password:'synthetic-only'},{method:'POST',handler:operator});assert.equal(r.statusCode,200);csrf=r.json.csrfToken;};
 const input={tenantId:'sarberki-test',caseId:id,action:'approval-state'};
 try{
  await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;");
  await db.exec(await readFile(new URL('../supabase/migrations/202610090001_case_store.sql',import.meta.url),'utf8'));
  await db.exec("insert into sc_tenants values('sarberki-test','Fictional',true),('demo-test','Other',true)");
  await db.query("insert into sc_memberships values('sarberki-test',$1,true,false,false),('demo-test',$2,true,false,false)",[reader,other]);
  const r=record();await db.query('insert into sc_cases(tenant_id,case_id,revision,data,updated_by) values($1,$2,$3,$4,$5)',[r.tenantId,id,4,JSON.stringify(r.data),reader]);
  await db.query('insert into sc_audit(tenant_id,case_id,revision,actor,kind,data_hash) values($1,$2,3,$3,$4,$5)',['sarberki-test',id,reader,'approve_isolated_synthetic','a'.repeat(64)]);
  await login('reader');
  await t.test('Reader receives byte-identical stored draft and old audit while current approval remains pending',async()=>{
   const result=await call(input);assert.equal(result.statusCode,200,result.body);const back=result.json.result;
   assert.equal(back.readOnly,true);assert.equal(back.approval,'pending');assert.equal(back.serverApproval,null);assert.equal(back.revision,4);
   assert.equal(back.storedDraft.text,r.data.drafts[0].text);assert.equal(back.storedDraft.operatorReviewText,r.data.drafts[0].operatorReviewText);assert.equal(back.storedDraft.current,true);
   assert.equal(back.auditScope,'approval-history');assert.equal(back.audit.length,1);assert.equal(back.audit[0].revision,3);assert.equal(back.audit[0].kind,'approve_isolated_synthetic');
   assert.equal(back.messages,undefined);assert.equal(back.sourceReceipt,undefined);assert.match(result.headers['Cache-Control'],/private.*no-store/);
  });
  await t.test('fresh page cookie/session restore reads same revision and exact stored text',async()=>{
   const restored=await call({}, {handler:operator});assert.equal(restored.statusCode,200);csrf=restored.json.csrfToken;
   assert.equal((await call(input)).json.result.storedDraft.text,r.data.drafts[0].text);
  });
  await t.test('read access cannot be reused for review-record, Writer or approval',async()=>{
   assert.equal((await call({...input,action:'review-record'})).statusCode,403);
   for(const action of ['review-draft','approve'])assert.equal((await call({...input,action,expectedRevision:4,reviewedDraftHash:'a'.repeat(64)},{method:'POST'})).statusCode,403);
   await db.query('update sc_memberships set can_write=true,can_approve=true where user_id=$1',[reader]);
   for(const action of ['review-draft','approve'])assert.equal((await call({...input,action,expectedRevision:4,reviewedDraftHash:'a'.repeat(64)},{method:'POST'})).statusCode,403,'even full test permission does not expand case review scope');
   await db.query('update sc_memberships set can_write=false,can_approve=false where user_id=$1',[reader]);
   assert.equal(rpcCalls,0);
  });
  await t.test('unauthenticated, foreign origin, CSRF, foreign tenant and absent membership stay forbidden',async()=>{
   for(const headers of [{cookie:''},{origin:'https://wrong.invalid'},{'x-csrf-token':'0'.repeat(64)}])assert.notEqual((await call(input,{headers})).statusCode,200);
   assert.equal((await call({...input,tenantId:'demo-test'})).statusCode,403);
   await asUser(other,async()=>{assert.equal((await db.query('select * from sc_cases')).rows.length,0);assert.equal((await db.query('select * from sc_audit')).rows.length,0);});
   await login('reader');await db.query('update sc_memberships set can_read=false where user_id=$1',[reader]);
   const denied=await call(input);assert.equal(denied.statusCode,403);assert.equal(denied.json.result,undefined);
  });
  assert.equal((await db.query('select revision from sc_cases')).rows[0].revision,4);assert.equal((await db.query('select count(*)::int n from sc_audit')).rows[0].n,1);
 }finally{await db.close();}
});

test('an exact Gmail receipt match does not grant synthetic approval/review access',()=>{
 const source={provider:'gmail',mailbox_id:'fictional_mailbox',message_id:'fictional-id',thread_id:'fictional-thread',rfc_message_id:'<fictional@example.test>',in_reply_to:null,references:[],subject:'Fictional',to:'test@example.test',from:'Fictional <sender@example.test>',from_email:'sender@example.test',received_at:'2026-10-26T10:00:00Z'};
 const envelope={sender:source.from_email,text:'Fictional exact message',mailbox_id:source.mailbox_id,message_id:source.message_id,thread_id:source.thread_id,rfc_message_id:source.rfc_message_id,references:[],received_at:source.received_at};
 const config={caseId:'13c8ecb7-f836-4e2c-9833-d58ee96f2dda',source,envelope,bodySha256:createHash('sha256').update(envelope.text).digest('hex')};
 const receipt=createExactGmailReceipt({URL:origin,SUPABASE_URL:project,CASE_EXACT_RECEIPT_ENABLED:'sarberki-test-one-receipt',CASE_EXACT_RECEIPT_PRIVATE_JSON:JSON.stringify(config)});
 const exact={tenantId:'sarberki-test',caseId:config.caseId,revision:1,data:{tenantId:'sarberki-test',sender:envelope.sender,messages:[envelope],sourceReceipt:source}};
 assert.equal(receipt.matchesRecord(exact),true);
 assert.throws(()=>assertCloudSyntheticReviewCase(exact),/FORBIDDEN/);
 assert.throws(()=>assertCloudSyntheticReadCase(exact),/FORBIDDEN/);
});
