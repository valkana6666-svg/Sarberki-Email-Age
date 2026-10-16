import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
import * as core from '../sarberki-core.mjs';
import {BUSINESS} from '../business-config.mjs';
import * as fishing from '../fishing-rules.mjs';
import * as policy from '../gmail-policy.mjs';
import * as splitUnits from '../split-units.mjs';
import {syntheticMailMime,syntheticMailEnvelope,syntheticTubReviewMime,syntheticTubReviewEnvelope,isClosedTubReviewRecord} from '../shared-core/synthetic-mail-fixtures.mjs';
import {createOperatorCookieSession} from '../shared-core/operator-cookie-session.mjs';
import {createCaseHandler} from '../netlify/functions/booking-cases.mjs';
const origin='https://leafy-chimera-2403e5.netlify.app',project='https://mojnqizbcaczstguikpv.supabase.co';
const users={writer:'11111111-1111-4111-8111-111111111111',reader:'22222222-2222-4222-8222-222222222222',approver:'33333333-3333-4333-8333-333333333333'};
test('actual closed MIME -> cookie Writer -> PostgreSQL review insert/dedup -> Reader -> human A resolution, with target unchanged',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  for(const file of ['202610090001_case_store.sql','20261016111515_service_link_resolution.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  for(const id of Object.values(users))await db.query('insert into auth.users values($1)',[id]);
  await db.exec("insert into sc_tenants values('sarberki-test','Synthetic closed review',true)");
  for(const [role,id]of Object.entries(users))await db.query("insert into sc_memberships values('sarberki-test',$1,true,$2,$3)",[id,role!=='reader',role==='approver']);
  const env={URL:origin,SUPABASE_URL:project,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC_PUBLIC_KEY_12345',CASE_STORE_ENABLED:'synthetic-only',CASE_STORE_TEST_TENANTS:'sarberki-test,demo-test',CASE_APPROVAL_ENABLED:'sarberki-test-synthetic-only',ISOLATED_APPROVAL_ATTESTATION_KEY:'a1'.repeat(32),SARBERKI_OPERATOR_SESSION_KEY:'ab'.repeat(32)};
  const tokens=new Map();let queue=Promise.resolve(),role='writer';
  const as=(actor,action)=>{const run=queue.then(async()=>{await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);try{return await action();}finally{await db.exec('reset role');}});queue=run.catch(()=>{});return run;};
  const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
  const fetchImpl=async(raw,options={})=>{
   const url=new URL(raw);assert.equal(url.origin,project);
   if(url.pathname.endsWith('/token')){const r=JSON.parse(options.body).refresh_token?.replace('fixture_refresh_','')||role,token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:users[r],role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.synthetic_signature';tokens.set(token,users[r]);return json({access_token:token,refresh_token:'fixture_refresh_'+r,user:{id:users[r]}});}
   const actor=tokens.get(options.headers.Authorization?.slice(7));assert.ok(actor);
   if(url.pathname.endsWith('/user'))return json({id:actor,is_anonymous:false});
   try{return json(await as(actor,async()=>{
    if(url.pathname.endsWith('/sc_memberships'))return (await db.query('select * from sc_memberships where user_id=auth.uid()')).rows;
    if(url.pathname.endsWith('/sc_write_case')){const b=JSON.parse(options.body);return (await db.query('select sc_write_case($1,$2,$3,$4) as result',[b.p_tenant,b.p_case,b.p_expected,JSON.stringify(b.p_data)])).rows[0].result;}
    if(url.pathname.endsWith('/sc_resolve_service_link')){const b=JSON.parse(options.body);return (await db.query('select sc_resolve_service_link($1,$2,$3,$4,$5,$6) as result',[b.p_tenant,b.p_case,b.p_expected,b.p_target,b.p_target_expected,b.p_reason])).rows[0].result;}
    const q=url.searchParams,tenant=q.get('tenant_id')?.slice(3);
    if(url.pathname.endsWith('/sc_service_link_decisions'))return (await db.query('select * from sc_service_link_decisions where tenant_id=$1 and review_case_id=$2 order by review_revision desc limit 1',[tenant,q.get('review_case_id').slice(3)])).rows;
    assert.ok(url.pathname.endsWith('/sc_cases'));const id=q.get('case_id')?.slice(3);return (await db.query('select * from sc_cases where tenant_id=$1'+(id?' and case_id=$2':''),id?[tenant,id]:[tenant])).rows;
   }));}catch(error){return json({error:'FIXTURE_DB_REJECTION'},error.code==='42501'?403:400);}
  };
  const session=createOperatorCookieSession({env,fetchImpl}),handler=createCaseHandler({env,fetchImpl});let cookie,csrf;
  const event=(body,method='POST')=>({httpMethod:method,headers:{host:new URL(origin).host,origin,'sec-fetch-site':'same-origin','x-sarberki-operator':'1','content-type':'application/json',...(cookie?{cookie}:{}),...(csrf?{'x-csrf-token':csrf}:{})},...(method==='POST'?{body:JSON.stringify(body)}:{queryStringParameters:body})});
  const login=async r=>{role=r;const logged=await session.login(event({}),{action:'login',email:r+'@synthetic.invalid',password:'SYNTHETIC_NOT_A_REAL_PASSWORD'});cookie=logged.setCookie.split(';')[0];csrf=logged.metadata.csrfToken;};
  const call=async(body,status=200,method='POST')=>{const result=await handler(event(body,method));assert.equal(result.statusCode,status,result.body);if(result.headers['Set-Cookie'])cookie=result.headers['Set-Cookie'].split(';')[0];return JSON.parse(result.body).result;};
  const code=(await readFile(new URL('../gmail-readonly.js',import.meta.url),'utf8')).replace(/await import\('\.\/([^']+)'\)/gu,(_,name)=>'modules['+JSON.stringify(name.split('?')[0])+']');
  const window={},element={disabled:false,textContent:'',addEventListener(){},insertAdjacentElement(){}};
  await vm.runInContext(code,vm.createContext({modules:{'sarberki-core.mjs':core,'business-config.mjs':{BUSINESS},'fishing-rules.mjs':fishing,'gmail-policy.mjs':policy,'split-units.mjs':splitUnits},window,document:{getElementById:()=>element,querySelector:()=>({content:'synthetic-client'})},console,URL,Date,Number,Intl,TextDecoder,Uint8Array,atob}));
  const parsed=(mime,expected)=>{const r=window.sarberkiGmailTransform(mime);return {...expected,text:r.original_message,sender:r.source.from_email,message_id:r.source.message_id,thread_id:r.source.thread_id,received_at:r.source.received_at};};
  await login('writer');const target=(await call({tenantId:'sarberki-test',action:'ingest-and-draft',expectedRevision:0,envelope:parsed(syntheticMailMime('hu'),syntheticMailEnvelope('hu'))})).record;
  const before=(await db.query('select * from sc_cases where case_id=$1',[target.caseId])).rows[0];
  const input={tenantId:'sarberki-test',action:'ingest-and-draft',caseId:target.caseId,expectedRevision:target.revision,envelope:parsed(syntheticTubReviewMime(),syntheticTubReviewEnvelope())};
  await call({...input,expectedRevision:99},409);await call({...input,envelope:{...input.envelope,extra:true}},403);
  await login('reader');await call(input,403);await login('writer');
  const first=await call(input);assert.equal(first.resolution.status,'ambiguous');assert.equal(isClosedTubReviewRecord(first.record),true);assert.notEqual(first.record.caseId,target.caseId);assert.deepEqual(first.fixtureTarget,{caseId:target.caseId,revision:target.revision});
  for(const key of ['arrival','departure','guests','adults','children','unit','units_requested'])assert.equal(first.record.data.state.values[key],undefined);
  const repeat=await call(input);assert.equal(repeat.resolution.status,'duplicate');assert.equal(repeat.record.caseId,first.record.caseId);assert.equal(repeat.record.revision,1);
  assert.equal((await db.query('select count(*)::int n from sc_cases')).rows[0].n,2);assert.equal((await db.query('select count(*)::int n from sc_audit')).rows[0].n,2);
  await login('reader');const preview=await call({tenantId:'sarberki-test',action:'preview-draft',caseId:first.record.caseId,expectedRevision:'1'},200,'GET');assert.equal(preview.serviceOnly,true);assert.equal(preview.serviceLink.status,'unresolved');assert.equal(preview.canResolveServiceLink,false);assert.equal(preview.serviceRequest.linkedCaseId,null);assert.match(preview.operatorReviewText,/pontosít/i);
  const basePreview=await call({tenantId:'sarberki-test',action:'preview-draft',caseId:target.caseId,expectedRevision:String(target.revision)},200,'GET');assert.equal(basePreview.serviceOnly,false);
  const resolve={tenantId:'sarberki-test',action:'resolve-service-link',caseId:first.record.caseId,expectedRevision:1,targetCaseId:target.caseId,targetRevision:target.revision,reason:'Kitalált minta: a kapcsolódó foglalási ügyet ellenőriztem.'};
  await call(resolve,403);await login('writer');await call(resolve,403);await login('approver');const resolved=await call(resolve);assert.equal(resolved.revision,2);assert.equal(resolved.data.state.approval,'pending');
  await login('writer');await call(input,409);
  assert.deepEqual((await db.query('select * from sc_cases where case_id=$1',[target.caseId])).rows[0],before);
  assert.equal((await db.query('select count(*)::int n from sc_service_link_decisions')).rows[0].n,1);assert.equal((await db.query('select count(*)::int n from sc_audit')).rows[0].n,3);
 }finally{await db.close();}
});
