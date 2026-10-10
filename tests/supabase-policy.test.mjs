import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const user1='11111111-1111-4111-8111-111111111111';
const user2='22222222-2222-4222-8222-222222222222';
const user3='33333333-3333-4333-8333-333333333333';
const record=(id='case-1111',message='m1')=>({id,sender:'guest@example.invalid',tenantId:'sarberki-test',state:{values:{guests:'2'},quote:null,availability:null,approval:'pending'},messages:[{mailbox_id:'test-inbox',message_id:message}],drafts:[]});
async function fixture(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
 const sql=await readFile(new URL('../supabase/migrations/202610090001_case_store.sql',import.meta.url),'utf8');
 await db.exec(sql);await db.exec(sql); // Real PostgreSQL parses and executes the migration twice.
 await db.query('insert into auth.users values ($1),($2),($3)',[user1,user2,user3]);
 await db.exec("insert into sc_tenants values('sarberki-test','Synthetic Sárberki',true),('demo-test','Synthetic Demo',true)");
 await db.query("insert into sc_memberships values('sarberki-test',$1,true,true,false),('sarberki-test',$2,true,false,false),('demo-test',$3,true,true,false)",[user1,user2,user3]);
 let queue=Promise.resolve();
 const as=(user,action)=>{
 const run=queue.then(async()=>{
  await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
  try{return await action();}finally{await db.exec('reset role');}
 });queue=run.catch(()=>{});return run;
 };
 const write=(data,revision=0)=>db.query('select sc_write_case($1,$2,$3,$4) as ok',[data.tenantId,data.id,revision,JSON.stringify(data)]);
 return {db,as,write};
}
test('PostgreSQL RLS: separate tenants, anonymous denial and reader cannot write',async()=>{
 const {db,as,write}=await fixture();try{
  await as(user1,()=>write(record()));
  assert.equal((await as(user2,()=>db.query('select * from sc_cases'))).rows.length,1);
  assert.equal((await as(user3,()=>db.query('select * from sc_cases'))).rows.length,0);
  await assert.rejects(as(user3,()=>write(record())),/forbidden/);
  await assert.rejects(as(user2,()=>write(record('case-2222','m2'))),/forbidden/);
  await assert.rejects(as('',()=>write(record())),/forbidden/);
  await db.exec('set role anon');await assert.rejects(db.query('select * from sc_cases'),/permission denied/);await db.exec('reset role');
  await assert.rejects(as(user1,()=>db.exec("update sc_memberships set can_approve=true")),/permission denied/);
  await assert.rejects(as(user1,()=>db.exec("delete from sc_audit")),/permission denied/);
 }finally{await db.close();}
});
test('PostgreSQL CAS, audit, history and cross-case Gmail uniqueness are atomic',async()=>{
 const {db,as,write}=await fixture();try{
  assert.equal((await as(user1,()=>write(record()))).rows[0].ok,true);
  assert.equal((await as(user1,()=>write(record()))).rows[0].ok,false);
  const changed=record();changed.state.values.guests='4';
  assert.equal((await as(user1,()=>write(changed,1))).rows[0].ok,true);
  assert.equal((await as(user1,()=>write(record(),1))).rows[0].ok,false);
  await assert.rejects(as(user1,()=>write(record('case-2222'))),/different case/);
  assert.equal((await db.query('select * from sc_cases')).rows.length,1);
  assert.equal((await db.query('select * from sc_audit')).rows.length,2);
  assert.equal((await db.query('select * from sc_message_keys')).rows.length,1);
  const removed=record();removed.messages=[];
  await assert.rejects(as(user1,()=>write(removed,2)),/history removal/);
  const fake=record();fake.state.quote={approved:true,total:10};await assert.rejects(as(user1,()=>write(fake,2)),/evidence route disabled/);
  const approval=record();approval.state.approval='approved';await assert.rejects(as(user1,()=>write(approval,2)),/approval route disabled/);
 }finally{await db.close();}
});
test('PostgreSQL physical snapshot restores memberships, cases and audit checksum',async()=>{
 const {db,as,write}=await fixture();let restored;
 try{
  await as(user1,()=>write(record()));
  const before=(await db.query('select data_hash from sc_audit')).rows[0].data_hash;
  const dump=await db.dumpDataDir();assert.ok(dump.size>0);await db.close();
  restored=new PGlite({loadDataDir:dump});
  assert.equal((await restored.query('select data_hash from sc_audit')).rows[0].data_hash,before);
  assert.equal((await restored.query('select * from sc_cases')).rows.length,1);
  await restored.exec('set role authenticated');await restored.query("select set_config('request.jwt.claim.sub',$1,false)",[user3]);
  assert.equal((await restored.query('select * from sc_cases')).rows.length,0);
 }finally{if(restored)await restored.close();else await db.close();}
});
test('Netlify handler → authority → engine → repository → PostgreSQL (HTTP/Auth simulated)',async()=>{
 const {createCaseHandler}=await import('../netlify/functions/booking-cases.mjs');
 const {db,as}=await fixture();
 const token1='synthetic-token-operator-one';const token2='synthetic-token-operator-two';const token3='synthetic-token-foreign-three';
 const fetchImpl=async(raw,options)=>{
  const url=new URL(raw);const user=({[token1]:user1,[token2]:user2,[token3]:user3})[options.headers.Authorization.slice(7)];
  if(!user)return {ok:false,status:401};
  if(url.pathname==='/auth/v1/user')return {ok:true,json:async()=>({id:user})};
  try{
   const result=await as(user,async()=>{
    if(url.pathname.endsWith('/sc_memberships'))return (await db.query('select * from sc_memberships where user_id=$1',[user])).rows;
    if(url.pathname.endsWith('/sc_write_case')){const b=JSON.parse(options.body);return (await db.query('select sc_write_case($1,$2,$3,$4) as ok',[b.p_tenant,b.p_case,b.p_expected,JSON.stringify(b.p_data)])).rows[0].ok;}
    const t=url.searchParams.get('tenant_id').slice(3),c=url.searchParams.get('case_id')?.slice(3);
    return (await db.query('select * from sc_cases where tenant_id=$1'+(c?' and case_id=$2':' order by case_id'),c?[t,c]:[t])).rows;
   });return {ok:true,json:async()=>result};
  }catch{return {ok:false,status:403};}
 };
 const env={CASE_STORE_ENABLED:'synthetic-only',CASE_STORE_TEST_TENANTS:'sarberki-test,demo-test',URL:'https://leafy-chimera-2403e5.netlify.app',SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_PUBLISHABLE_KEY:'synthetic-public-key'};
 const handler=createCaseHandler({env,fetchImpl});
 const call=(token,method,input)=>handler({httpMethod:method,headers:{authorization:'Bearer '+token},...(method==='GET'?{queryStringParameters:input}:{body:JSON.stringify(input)})});
 try{
  const input={tenantId:'sarberki-test',expectedRevision:0,envelope:{sender:'guest@example.invalid',text:'Szállást kérek',mailbox_id:'test-inbox',message_id:'m1',received_at:'2026-10-09T08:00:00Z',thread_id:'thread1'},values:{arrival:'2026-11-01',departure:'2026-11-03',adults:'2',children:'0',guests:'2',unit:'Deluxe'}};
  const created=await call(token1,'POST',input);assert.equal(created.statusCode,200,created.body);
  const caseId=JSON.parse(created.body).result.record.caseId;
  const read=await call(token2,'GET',{tenantId:'sarberki-test',caseId});assert.equal(read.statusCode,200,read.body);assert.equal(JSON.parse(read.body).result.revision,1);
  const duplicate=await call(token1,'POST',input);assert.equal(JSON.parse(duplicate.body).result.resolution.status,'duplicate');
  const updated=await call(token1,'POST',{...input,expectedRevision:1,envelope:{...input.envelope,message_id:'m2'},values:{guests:'3',adults:'3'}});assert.equal(updated.statusCode,200,updated.body);
  assert.equal(JSON.parse((await call(token2,'GET',{tenantId:'sarberki-test',caseId})).body).result.revision,2);
  assert.equal((await call(token3,'GET',{tenantId:'sarberki-test',caseId})).statusCode,403);
  assert.equal((await call(token2,'POST',{...input,expectedRevision:2,envelope:{...input.envelope,message_id:'m3'}})).statusCode,403);
  const draft=await call(token1,'POST',{action:'draft',tenantId:'sarberki-test',caseId,expectedRevision:2});assert.equal(draft.statusCode,200,draft.body);assert.equal(JSON.parse(draft.body).result.data.drafts.length,1);
  const draft2=await call(token1,'POST',{action:'draft',tenantId:'sarberki-test',caseId,expectedRevision:3});assert.equal(draft2.statusCode,200,draft2.body);
  assert.deepEqual(JSON.parse(draft2.body).result.data.drafts[0],JSON.parse(draft.body).result.data.drafts[0]);
  assert.equal((await call(token1,'POST',{action:'draft',tenantId:'sarberki-test',caseId,expectedRevision:2})).statusCode,409);
  const otherBox=await call(token1,'POST',{...input,envelope:{...input.envelope,mailbox_id:'second-inbox'}});
  assert.equal(otherBox.statusCode,200,otherBox.body);assert.notEqual(JSON.parse(otherBox.body).result.record.caseId,caseId);
  const parsed=await call(token1,'POST',{tenantId:'sarberki-test',expectedRevision:0,envelope:{...input.envelope,sender:'parser@synthetic.invalid',message_id:'parsed',thread_id:'parsed',text:'Please book one Deluxe cabin from 2026-11-01 to 2026-11-03 for 2 adults and no children.'}});
  assert.equal(parsed.statusCode,200,parsed.body);const auto=JSON.parse(parsed.body).result.record;
  assert.equal(auto.data.state.values.arrival,'2026-11-01');assert.equal(auto.data.state.values.language,'en');
  const autoDraft=await call(token1,'POST',{action:'draft',tenantId:'sarberki-test',caseId:auto.caseId,expectedRevision:1});
  assert.equal(autoDraft.statusCode,200,autoDraft.body);assert.equal(JSON.parse(autoDraft.body).result.data.state.approval,'pending');
  assert.equal((await db.query('select count(*)::int as n from sc_audit')).rows[0].n,7);
 }finally{await db.close();}
});

test('encrypted isolated fixture snapshot restores policies, privileges, draft history and audit sequence',async()=>{
 const {randomBytes,createCipheriv,createDecipheriv}=await import('node:crypto');
 const {db,as,write}=await fixture();let restored;
 const manifest=async conn=>({
  counts:(await conn.query("select (select count(*) from sc_cases)::int cases,(select count(*) from sc_audit)::int audit,(select count(*) from sc_memberships)::int memberships")).rows,
  policies:(await conn.query("select tablename,policyname,roles,cmd,qual from pg_policies where schemaname='public' order by tablename,policyname")).rows,
  rls:(await conn.query("select relname,relrowsecurity from pg_class where relname like 'sc_%' and relkind='r' order by relname")).rows,
  audit:(await conn.query('select revision,data_hash from sc_audit order by revision')).rows
 });
 try{
  const data=record();await as(user1,()=>write(data));data.drafts.push({text:'Synthetic internal draft',revision:1});await as(user1,()=>write(data,1));
  const sql=(await readFile(new URL('../scripts/case-store-recovery-manifest.sql',import.meta.url),'utf8')).replace('begin transaction isolation level repeatable read read only;','').replace('commit;','');
  const fullManifest=(await db.query(sql)).rows[0].recovery_manifest;assert.equal(fullManifest.audit_gaps,0);assert.equal(fullManifest.latest_hash_mismatches,0);
  const before=await manifest(db),snapshot=Buffer.from(await (await db.dumpDataDir()).arrayBuffer());
  // Fixture-only encryption key stays in test memory; this is not a cloud backup.
  const key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  const encrypted=Buffer.concat([cipher.update(snapshot),cipher.final()]),tag=cipher.getAuthTag();
  snapshot.fill(0);await db.close();
  const decrypt=bytes=>{const d=createDecipheriv('aes-256-gcm',key,iv);d.setAuthTag(tag);return Buffer.concat([d.update(bytes),d.final()]);};
  const corrupt=Buffer.from(encrypted);corrupt[0]^=1;assert.throws(()=>decrypt(corrupt));
  const plaintext=decrypt(encrypted);restored=new PGlite({loadDataDir:new Blob([plaintext])});await restored.waitReady;plaintext.fill(0);key.fill(0);
  assert.deepEqual(await manifest(restored),before);assert.deepEqual((await restored.query(sql)).rows[0].recovery_manifest,fullManifest);
  assert.equal((await restored.query("select has_table_privilege('authenticated','sc_cases','INSERT') as allowed")).rows[0].allowed,false);
  await restored.exec('set role authenticated');await restored.query("select set_config('request.jwt.claim.sub',$1,false)",[user2]);
  assert.equal((await restored.query('select * from sc_cases')).rows.length,1);
  await assert.rejects(restored.query('select sc_write_case($1,$2,2,$3)',['sarberki-test',data.id,JSON.stringify(data)]),/forbidden/);
  await restored.query("select set_config('request.jwt.claim.sub',$1,false)",[user3]);assert.equal((await restored.query('select * from sc_cases')).rows.length,0);
  await restored.query("select set_config('request.jwt.claim.sub',$1,false)",[user1]);
  const removed={...data,drafts:[]};await assert.rejects(restored.query('select sc_write_case($1,$2,2,$3)',['sarberki-test',data.id,JSON.stringify(removed)]),/history removal/);
  data.drafts.push({text:'Second internal version',revision:2});
  assert.equal((await restored.query('select sc_write_case($1,$2,2,$3) as ok',['sarberki-test',data.id,JSON.stringify(data)])).rows[0].ok,true);
  await restored.exec('reset role');const ids=(await restored.query('select event_id from sc_audit order by revision')).rows.map(r=>r.event_id);assert.equal(ids.length,3);assert.equal(new Set(ids).size,3);assert.ok(ids[2]>ids[1]);
 }finally{if(restored)await restored.close();else await db.close();}
});

test('expanded Auth probe reaches every assertion with PostgreSQL-backed fixture transport (Auth simulated)',async()=>{
 const {createHandler}=await import('../netlify/functions/supabase-auth-test.mjs');
 const {db,as}=await fixture();const sessions=new Map();let number=0;
 const emails={'writer@sarberki-test.invalid':user1,'reader@sarberki-test.invalid':user2,'operator@demo-test.invalid':user3};
 const respond=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>body});
 const fetchImpl=async(raw,options)=>{
  const url=new URL(raw),body=options.body?JSON.parse(options.body):{};
  if(url.searchParams.get('grant_type')==='password'){
   const token='fixture-access-'+(++number),refresh='fixture-refresh-'+number; sessions.set(token,{user:emails[body.email],email:body.email,refresh,revoked:false});
   return respond(200,{access_token:token,refresh_token:refresh,user:{email:body.email}});
  }
  if(url.searchParams.get('grant_type')==='refresh_token')return respond(400,{code:'refresh_token_not_found'});
  const token=options.headers.Authorization?.slice(7),session=sessions.get(token);
  if(!session)return respond(401,{});
  if(url.pathname==='/auth/v1/logout'){session.revoked=true;return respond(204,{});}
  if(url.pathname==='/auth/v1/user')return respond(200,{id:session.user});
  if(options.method==='PATCH'||(url.pathname.endsWith('/sc_cases')&&options.method==='POST'))return respond(403,{code:'42501'});
  try{
   const result=await as(session.user,async()=>{
    if(url.pathname.endsWith('/sc_memberships'))return (await db.query('select * from sc_memberships where user_id=$1',[session.user])).rows;
    if(url.pathname.endsWith('/sc_write_case'))return (await db.query('select sc_write_case($1,$2,$3,$4) as ok',[body.p_tenant,body.p_case,body.p_expected,JSON.stringify(body.p_data)])).rows[0].ok;
    const tenant=url.searchParams.get('tenant_id')?.slice(3),id=url.searchParams.get('case_id')?.slice(3);
    if(url.pathname.endsWith('/sc_audit'))return (await db.query('select * from sc_audit where tenant_id=$1 and case_id=$2 order by revision',[tenant,id])).rows;
    return (await db.query('select * from sc_cases where tenant_id=$1'+(id?' and case_id=$2':''),id?[tenant,id]:[tenant])).rows;
   });return respond(200,result);
  }catch(error){return respond(error.code==='42501'?403:400,{code:error.code});}
 };
 const env={CASE_STORE_ENABLED:'disabled',URL:'https://leafy-chimera-2403e5.netlify.app',SUPABASE_URL:'https://mojnqizbcaczstguikpv.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',SUPABASE_AUTH_TEST_UNTIL:'2026-10-10T09:00:00Z'};
 try{
  const handler=createHandler({env,fetchImpl,now:()=>Date.parse('2026-10-10T08:00:00Z')});
  const result=await handler({httpMethod:'POST',headers:{origin:env.URL,'content-type':'application/x-www-form-urlencoded'},body:'password0=fixture1&password1=fixture2&password2=fixture3'});
  assert.equal(result.statusCode,200,result.body);assert.equal((result.body.match(/PASS —/g)||[]).length,36);
  assert.equal(sessions.size,4);assert.ok([...sessions.values()].every(s=>s.revoked));
  assert.doesNotMatch(result.body,/fixture-access|fixture-refresh|fixture1|fixture2|fixture3/);
  assert.equal((await db.query('select count(*)::int as n from sc_cases')).rows[0].n,3);
  assert.equal((await db.query('select count(*)::int as n from sc_audit')).rows[0].n,8);
 }finally{await db.close();}
});

test('reviewed synthetic drafts pass deployed PostgreSQL policy, append history and audit atomically',async()=>{
 const {createServerCaseService}=await import('../shared-core/server-case-service.mjs');
 const {createServerBookingRuntime}=await import('../shared-core/server-booking-runtime.mjs');
 const {db,as,write}=await fixture();
 try{
  const map=r=>r?{tenantId:r.tenant_id,caseId:r.case_id,revision:r.revision,createdAt:r.created_at,data:r.data}:null;
  const repository={
   get:async(t,c)=>map((await as(user1,()=>db.query('select * from sc_cases where tenant_id=$1 and case_id=$2',[t,c]))).rows[0]),
   list:async t=>(await as(user1,()=>db.query('select * from sc_cases where tenant_id=$1',[t]))).rows.map(map),
   insert:async(t,c,r)=>(await as(user1,()=>write(r.data))).rows[0].ok,
   compareAndSwap:async(t,c,v,r)=>(await as(user1,()=>write(r.data,v))).rows[0].ok
  };
  const service=createServerCaseService({repository,resolveAuthority:async()=>({subject:user1,tenants:{'sarberki-test':['read','write']}})});
  const at='2026-10-10T08:00:00Z';
  const runtime=createServerBookingRuntime({service,tenantId:'sarberki-test',requestContext:{},clock:()=>at,reviewProviders:{
   availability:async q=>({...q,source:'synthetic-fixture',checkedAt:at,availability:'available',availableUnits:1}),
   pricing:async q=>({...q,source:'synthetic-fixture',checkedAt:at,tenantId:'sarberki-test',unitId:q.cabin,capacity:4,nightly:100,basis:'per_unit',verified:true})
  }});
  const first=await runtime.ingest({sender:'review@fixture.invalid',text:'Please book one Deluxe cabin from 2026-11-01 to 2026-11-03 for 2 adults and no children.',mailbox_id:'fixture',message_id:'review',received_at:at},undefined,{expectedRevision:0});
  const one=await runtime.reviewAndDraft(first.record.caseId,1);
  const results=await Promise.allSettled([runtime.reviewAndDraft(first.record.caseId,2),runtime.reviewAndDraft(first.record.caseId,2)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(results.find(x=>x.status==='rejected').reason.code,'CASE_CONFLICT');
  const stored=(await db.query('select * from sc_cases')).rows[0];
  assert.equal(stored.revision,3);assert.equal(stored.data.state.quote,null);assert.equal(stored.data.state.approval,'pending');
  assert.deepEqual(stored.data.drafts[0],one.record.data.drafts[0]);assert.equal(stored.data.drafts.length,2);
  const audit=(await db.query('select revision,data_hash from sc_audit order by revision')).rows;
  assert.deepEqual(audit.map(a=>a.revision),[1,2,3]);
  const hash=(await db.query("select encode(sha256(convert_to(data::text,'UTF8')),'hex') as hash from sc_cases")).rows[0].hash;
  assert.equal(audit.at(-1).data_hash,hash);
 }finally{await db.close();}
});
