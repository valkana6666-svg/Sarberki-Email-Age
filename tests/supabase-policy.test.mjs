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
 const as=async(user,action)=>{
  await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
  try{return await action();}finally{await db.exec('reset role');}
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
 }finally{await db.close();}
});
