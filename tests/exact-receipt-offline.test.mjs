import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {PGlite} from '@electric-sql/pglite';
import {createExactGmailReceipt} from '../shared-core/server-exact-gmail-receipt.mjs';
import {createServerBookingRuntime} from '../shared-core/server-booking-runtime.mjs';
import {createServerCaseService} from '../shared-core/server-case-service.mjs';
import {createSupabaseCaseRepository,createSupabaseAuthority} from '../shared-core/supabase-case-repository.mjs';
import {createCaseHandler} from '../netlify/functions/booking-cases.mjs';
import {createOperatorSessionHandler} from '../netlify/functions/operator-session.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const origin='https://leafy-chimera-2403e5.netlify.app',project='https://mojnqizbcaczstguikpv.supabase.co';
const actors={writer:'11111111-1111-4111-8111-111111111111',reader:'22222222-2222-4222-8222-222222222222',approver:'33333333-3333-4333-8333-333333333333'};
// FICTIONAL equivalent only; neither personal source address nor real RFC/IDs.
const source={provider:'gmail',mailbox_id:'fictional_mailbox',message_id:'fake-google-id',thread_id:'fake-google-thread',rfc_message_id:'<fictional@example.test>',in_reply_to:null,references:[],subject:'Fictional inquiry',to:'mailbox@example.test',from:'Fictional Sender <sender@example.test>',from_email:'sender@example.test',received_at:'2026-10-03T09:23:06.000Z'};
const envelope={sender:source.from_email,text:'Hello! We would like to stay October 30 to November 1, 2026. We are 8\r\nadults and would prefer separate sleeping units if possible. Please\r\nlet us know what options are available. Best regards, Fictional Guest',mailbox_id:source.mailbox_id,message_id:source.message_id,thread_id:source.thread_id,rfc_message_id:source.rfc_message_id,references:[],received_at:source.received_at};
const config={caseId:'44444444-4444-4444-8444-444444444444',source,envelope,bodySha256:createHash('sha256').update(envelope.text).digest('hex')};
const env={URL:origin,SUPABASE_URL:project,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC_PUBLIC_KEY_12345',CASE_STORE_ENABLED:'synthetic-only',CASE_STORE_TEST_TENANTS:'sarberki-test,demo-test',CASE_APPROVAL_ENABLED:'sarberki-test-synthetic-only',ISOLATED_APPROVAL_ATTESTATION_KEY:'a1'.repeat(32),SARBERKI_OPERATOR_SESSION_KEY:'ab'.repeat(32),CASE_EXACT_RECEIPT_ENABLED:'sarberki-test-one-receipt',CASE_EXACT_RECEIPT_PRIVATE_JSON:JSON.stringify(config)};
const input={tenantId:'sarberki-test',action:'ingest-and-draft',expectedRevision:0,envelope,sourceReceipt:source};
const tamper=value=>typeof value==='string'?value+'x':value===null?'changed':['changed'];

test('private configuration is default closed and every exact field is bound',()=>{
 assert.ok(envelope.text.includes(String.fromCharCode(13,10)),'fixture must contain actual CRLF code points');
 assert.notEqual(config.bodySha256,createHash('sha256').update(envelope.text.replaceAll(String.fromCharCode(13,10),'\n')).digest('hex'));
 assert.equal(createExactGmailReceipt({}),null);
 for(const k of ['CASE_EXACT_RECEIPT_ENABLED','URL','SUPABASE_URL'])assert.equal(createExactGmailReceipt({...env,[k]:'wrong'}),null);
 for(const c of [{...config,extra:true},{...config,bodySha256:'0'.repeat(64)},{...config,source:{...source,references:['changed']}}])assert.equal(createExactGmailReceipt({...env,CASE_EXACT_RECEIPT_PRIVATE_JSON:JSON.stringify(c)}),null);
 const receipt=createExactGmailReceipt(env);assert.ok(receipt.matches(envelope,source));
 for(const [k,v] of Object.entries(source))assert.equal(receipt.matches(envelope,{...source,[k]:tamper(v)}),false,k);
 for(const [k,v] of Object.entries(envelope))assert.equal(receipt.matches({...envelope,[k]:tamper(v)},source),false,k);
 assert.equal(receipt.matches({...envelope,text:envelope.text.replaceAll('\r\n','\n')},source),false);
 assert.equal(receipt.matches({...envelope,extra:true},source),false);
 assert.equal(receipt.matches(envelope,{...source,extra:true}),false);
});

test('offline SQL candidate + cookie Writer/runtime/Reader preserve actual source and remain unapprovable',async t=>{
 let db=new PGlite(),cookie='',csrf,authMismatch=false;const tokens=new Map();let providerCalls=0;
 const asActor=async(role,fn)=>{await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:actors[role],role:'authenticated',iss:project+'/auth/v1'})]);try{return await fn();}finally{await db.exec('reset role');}};
 const transport=role=>async(path,{body}={})=>{
  if(path==='/auth/v1/user')return {id:actors[authMismatch?'reader':role]};
  return asActor(role,async()=>{
   const url=new URL(path,project);
   if(path.includes('/sc_memberships'))return (await db.query('select * from sc_memberships where user_id=$1',[url.searchParams.get('user_id')?.slice(3)||actors[role]])).rows;
   if(path.includes('/sc_write_case'))return (await db.query('select sc_write_case($1,$2,$3,$4) result',[body.p_tenant,body.p_case,body.p_expected,JSON.stringify(body.p_data)])).rows[0].result;
   assert.ok(path.includes('/sc_cases'),path);const id=url.searchParams.get('case_id')?.slice(3);
   return (await db.query('select * from sc_cases where tenant_id=$1'+(id?' and case_id=$2':''),id?['sarberki-test',id]:['sarberki-test'])).rows;
  });
 };
 const fetchImpl=async(raw,options)=>{
  const url=new URL(raw);assert.equal(url.origin,project,'no external provider network');
  if(url.pathname.endsWith('/token')){
   const b=JSON.parse(options.body),role=url.searchParams.get('grant_type')==='password'?b.email.split('@')[0]:b.refresh_token.replace('fake_refresh_','');assert.ok(actors[role]);
   const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:actors[role],role:'authenticated',iss:project+'/auth/v1',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fictional';tokens.set(token,role);
   return {ok:true,json:async()=>({access_token:token,refresh_token:'fake_refresh_'+role,user:{id:actors[role]}})};
  }
  const role=tokens.get(options.headers.Authorization?.slice(7));assert.ok(role);
  try{return {ok:true,json:async()=>await transport(role)(url.pathname+url.search,{body:options.body?JSON.parse(options.body):undefined})};}catch(error){return {ok:false,status:error.code==='42501'?403:400};}
 };
 const operator=createOperatorSessionHandler({env,fetchImpl}),api=createCaseHandler({env,fetchImpl});
 const call=async(body,{get=false,headers={},session=false,handler=api}={})=>{
  const event={httpMethod:get?'GET':'POST',headers:{host:new URL(origin).host,origin,'sec-fetch-site':'same-origin','x-sarberki-operator':'1','Content-Type':'application/json',...(cookie?{cookie}:{}),...(csrf?{'x-csrf-token':csrf}:{}),...headers},body:get?'':JSON.stringify(body),queryStringParameters:get?body:{}};
  const response=await (session?operator:handler)(event);if(response.headers['Set-Cookie'])cookie=response.headers['Set-Cookie'].split(';')[0];return {...response,json:JSON.parse(response.body)};
 };
 const login=async role=>{const r=await call({action:'login',email:role+'@fictional.invalid',password:'FICTIONAL_TEST_PASSWORD'},{session:true});assert.equal(r.statusCode,200);csrf=r.json.csrfToken;};
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  await db.exec(await read('supabase/migrations/202610090001_case_store.sql'));
  const baselineWriter=(await db.query("select prosrc from pg_proc where oid='sc_write_case(text,text,bigint,jsonb)'::regprocedure")).rows[0].prosrc;
  await db.query("select set_config('sarberki.approval_install_project_ref',$1,false),set_config('sarberki.approval_backup_sha256',$2,false)",['mojnqizbcaczstguikpv','b'.repeat(64)]);
  await db.exec("insert into sc_tenants values('sarberki-test','Fictional',true)");
  await db.exec(await read('deployment/cloud-approval/install.sql'));
  await db.exec(await read('deployment/cloud-approval/separate-approver-permission.sql'));
  await db.exec('alter default privileges grant all on tables to anon,authenticated,service_role');
  for(const [role,id] of Object.entries(actors)){await db.query('insert into auth.users values($1)',[id]);await db.query("insert into sc_memberships values('sarberki-test',$1,true,$2,$3)",[id,role==='writer',role==='approver']);}
  await db.query("select set_config('sarberki.receipt_install_project_ref',$1,false),set_config('sarberki.receipt_backup_sha256',$2,false)",['mojnqizbcaczstguikpv','b'.repeat(64)]);
  const install=await read('deployment/exact-receipt/install.sql');
  await db.query("select set_config('sarberki.receipt_install_project_ref','wrong',false)");
  await assert.rejects(db.exec(install),/verified test project/);await db.exec('rollback');
  await db.query("select set_config('sarberki.receipt_install_project_ref','mojnqizbcaczstguikpv',false)");
  await db.exec(install);
  const installedWriter=(await db.query("select prosrc from pg_proc where oid='sc_write_case(text,text,bigint,jsonb)'::regprocedure")).rows[0].prosrc;
  const guardStart=baselineWriter.indexOf(" if coalesce(p_data->>'sender','')"),guardEnd=baselineWriter.indexOf(" if coalesce(p_data->'state'->>'approval'");
  assert.ok(installedWriter.startsWith(baselineWriter.slice(0,guardStart)));
  assert.ok(installedWriter.endsWith(baselineWriter.slice(guardEnd)));
  await db.query('insert into sc_private_exact_receipt(case_id,tenant_id,expected_source,expected_message,body_sha256) values($1,$2,$3,$4,$5)',[config.caseId,'sarberki-test',JSON.stringify(source),JSON.stringify(envelope),config.bodySha256]);
  const writeDb=async(data,expected=0)=>asActor('writer',()=>db.query('select sc_write_case($1,$2,$3,$4) result',['sarberki-test',config.caseId,expected,JSON.stringify(data)]));
  const minimal={id:config.caseId,tenantId:'sarberki-test',sender:envelope.sender,state:{values:{},approval:'pending'},messages:[envelope],drafts:[],sourceReceipt:source};
  await t.test('disabled row and client roles cannot access the private allowlist',async()=>{
   await assert.rejects(writeDb(minimal),e=>e.code==='22023');
   await asActor('writer',async()=>{
    await db.exec('begin');try{
     const legacy={...minimal,id:'case-existing-synthetic',sender:'legacy@fictional.invalid',messages:[{...envelope,sender:'legacy@fictional.invalid'}]};
     assert.equal((await db.query('select sc_write_case($1,$2,$3,$4) accepted',['sarberki-test',legacy.id,0,JSON.stringify(legacy)])).rows[0].accepted,true);
    }finally{await db.exec('rollback');}
   });
   for(const role of ['anon','authenticated','service_role']){
    await db.exec('set role '+role);try{await assert.rejects(db.query('select * from sc_private_exact_receipt'),e=>e.code==='42501');await assert.rejects(db.query('update sc_private_exact_receipt set enabled=true'),e=>e.code==='42501');}finally{await db.exec('reset role');}
   }
   assert.equal((await db.query("select relrowsecurity from pg_class where oid='sc_private_exact_receipt'::regclass")).rows[0].relrowsecurity,true);
  });
  await db.exec('update sc_private_exact_receipt set enabled=true');
  await login('writer');
  await t.test('same-origin CSRF and exact server envelope reject before writes',async()=>{
   assert.equal((await call(input,{handler:createCaseHandler({env:{...env,CASE_EXACT_RECEIPT_ENABLED:''},fetchImpl})})).statusCode,403);
   assert.equal((await call({...input,tenantId:'demo-test'})).statusCode,403);
   assert.equal((await call(input,{headers:{origin:'https://wrong.example'}})).statusCode,403);
   assert.equal((await call(input,{headers:{'x-csrf-token':'0'.repeat(64)}})).statusCode,403);
   for(const [k,v] of Object.entries(source))assert.equal((await call({...input,sourceReceipt:{...source,[k]:tamper(v)}})).statusCode,403,k);
   for(const [k,v] of Object.entries(envelope))assert.equal((await call({...input,envelope:{...envelope,[k]:tamper(v)}})).statusCode,403,k);
   for(const bad of [{...input,values:{adults:'8'}},{...input,envelope:{...envelope,extra:true}},{...input,sourceReceipt:{...source,extra:true}},{...input,envelope:{...envelope,text:envelope.text.replaceAll('\r\n','\n')}}])assert.equal((await call(bad)).statusCode,403);
   authMismatch=true;try{assert.equal((await call(input)).statusCode,403);}finally{authMismatch=false;}await login('writer');
   assert.equal((await db.query('select count(*)::int n from sc_cases')).rows[0].n,0);
  });
  let record;
  await t.test('explicit Writer uses the real runtime/repository and replay stays at revision one',async()=>{
   const saved=await call(input);assert.equal(saved.statusCode,200,JSON.stringify(saved.json));record=saved.json.result.record;
   assert.equal(record.caseId,config.caseId);assert.equal(record.revision,1);assert.deepEqual(record.data.messages,[envelope]);assert.deepEqual(record.data.sourceReceipt,source);assert.equal(record.data.sender,source.from_email);assert.equal(record.data.state.approval,'pending');assert.ok(record.data.drafts[0].text);
   assert.equal((await call(input)).json.result.record.revision,1);
   assert.equal((await db.query('select count(*)::int n from sc_audit')).rows[0].n,1);
  });
  await t.test('SQL independently rejects every source/message mutation, extras, case and body mismatch',async()=>{
   for(const [k,v] of Object.entries(source))await assert.rejects(writeDb({...record.data,sourceReceipt:{...source,[k]:tamper(v)}},1),e=>e.code==='22023',k);
   for(const [k,v] of Object.entries(envelope))await assert.rejects(writeDb({...record.data,messages:[{...envelope,[k]:tamper(v)}]},1),e=>e.code==='22023',k);
   for(const d of [{...record.data,sourceReceipt:{...source,extra:true}},{...record.data,messages:[{...envelope,extra:true}]},{...record.data,messages:[{...envelope,text:envelope.text.replaceAll('\r\n','\n')}]},{...record.data,sender:'other@example.test'}])await assert.rejects(writeDb(d,1),e=>e.code==='22023');
   for(const state of [{...record.data.state,quote:{verified:true}},{...record.data.state,availability:{verified:true}},{...record.data.state,approval:'internally_approved'}])await assert.rejects(writeDb({...record.data,state},1),e=>e.code==='42501');
   await assert.rejects(db.query("update sc_private_exact_receipt set body_sha256=$1",['0'.repeat(64)]),e=>e.code==='23514');
   await assert.rejects(asActor('writer',()=>db.query('select sc_write_case($1,$2,$3,$4)',['sarberki-test','another-case',0,JSON.stringify({...record.data,id:'another-case'})])),e=>e.code==='22023');
  });
  await t.test('Reader cookie projection/preview succeed but ingest and approval stay forbidden',async()=>{
   await login('reader');const listed=await call({tenantId:'sarberki-test'},{get:true});assert.equal(listed.statusCode,200);assert.deepEqual(listed.json.result,[{tenantId:'sarberki-test',caseId:config.caseId,revision:1}]);
   const preview=await call({tenantId:'sarberki-test',caseId:config.caseId,action:'preview-draft',expectedRevision:'1'},{get:true});assert.equal(preview.statusCode,200);assert.equal(preview.json.result.persisted,false);assert.equal(preview.json.result.storedDraft.text,record.data.drafts[0].text);
   assert.equal((await call(input)).statusCode,403);
   for(const action of ['review-draft','approve'])assert.equal((await call({tenantId:'sarberki-test',caseId:config.caseId,action,expectedRevision:1})).statusCode,403);
   await assert.rejects(asActor('reader',()=>db.query('select sc_write_case($1,$2,$3,$4)',['sarberki-test',config.caseId,1,JSON.stringify(record.data)])),e=>e.code==='42501');
  });
  await t.test('existing cloud approval gate rejects the receipt and unknown providers cannot approve',async()=>{
   await login('writer');assert.equal((await call({tenantId:'sarberki-test',caseId:config.caseId,action:'approve',expectedRevision:1,reviewedDraftHash:createHash('sha256').update(record.data.drafts[0].text).digest('hex')})).statusCode,403);
   await login('approver');
   assert.equal((await call(input)).statusCode,403);
   assert.equal((await call({tenantId:'sarberki-test',caseId:config.caseId,action:'approve',expectedRevision:1,reviewedDraftHash:createHash('sha256').update(record.data.drafts[0].text).digest('hex')})).statusCode,403);
   const tr=transport('approver');const service=createServerCaseService({repository:createSupabaseCaseRepository(tr),resolveAuthority:createSupabaseAuthority(tr)});
   const runtime=createServerBookingRuntime({service,tenantId:'sarberki-test',isolatedApproval:true,reviewProviders:{availability:async()=>{providerCalls++;throw Error('UNKNOWN');},pricing:async()=>{providerCalls++;throw Error('UNKNOWN');}}});
   await assert.rejects(runtime.approve(config.caseId,1,createHash('sha256').update(record.data.drafts[0].text).digest('hex')),e=>e.code==='INVALID_DRAFT');
   assert.equal(providerCalls,0);assert.equal((await db.query('select revision from sc_cases')).rows[0].revision,1);
  });
  await t.test('rollback preserves the case and audit while restoring the original fail-closed sender guard',async()=>{
   await db.exec(await read('deployment/exact-receipt/rollback.sql'));
   await assert.rejects(writeDb(record.data,1),e=>e.code==='22023');
   assert.equal((await db.query('select count(*)::int n from sc_cases')).rows[0].n,1);assert.equal((await db.query('select count(*)::int n from sc_audit')).rows[0].n,1);
   assert.equal((await db.query("select prosrc from pg_proc where oid='sc_write_case(text,text,bigint,jsonb)'::regprocedure")).rows[0].prosrc,baselineWriter);
  });
 }finally{await db.close();}
});

test('static output omits the private receipt validator',async()=>{
 const buildInfo=new URL('../build-info.mjs',import.meta.url),previous=await readFile(buildInfo).catch(()=>null);
 try{
  execFileSync(process.execPath,['scripts/build-static.cjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,COMMIT_REF:'f'.repeat(40)},stdio:'pipe'});
  await access(new URL('../dist/index.html',import.meta.url));
  await assert.rejects(access(new URL('../dist/shared-core/server-exact-gmail-receipt.mjs',import.meta.url)));
 }finally{if(previous)await writeFile(buildInfo,previous);else await rm(buildInfo,{force:true});}
});
