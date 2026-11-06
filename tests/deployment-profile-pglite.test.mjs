import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

// Real PostgreSQL semantics (PGlite). Fictional data only. Slice 1 of the live case store.
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const BOOT=`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;grant select on auth.sessions to authenticated;`;
async function fresh(){const db=new PGlite();await db.exec(BOOT);await db.exec(await read('supabase/migrations/202610090001_case_store.sql'));return db;}
const TEST_REF='mojnqizbcaczstguikpv',LIVE_REF='livexprojectxrefxabc';
async function install(db,env,ref=env==='live'?LIVE_REF:TEST_REF){
 const sql=await read('deployment/deployment-profile/install.sql');
 await db.exec('begin;'+(env===undefined?'':`select set_config('sarberki.deployment_environment','${env}',true);`)+(ref===null?'':`select set_config('sarberki.deployment_project_ref','${ref}',true);`)+sql+'commit;');
}
const fails=async(promise,code,db)=>{await assert.rejects(promise,e=>e.message.includes(code)||assert.fail('expected '+code+' got '+e.message));if(db)await db.exec('rollback').catch(()=>{});};
const one=async(db,sql)=>(await db.query(sql)).rows[0];

test('deployment profile: environment is required and validated',async()=>{
 const db=await fresh();
 await fails(install(db),'DEPLOYMENT_ENVIRONMENT_REQUIRED',db);
 await fails(install(db,'prod'),'DEPLOYMENT_ENVIRONMENT_REQUIRED',db);
 assert.equal((await one(db,"select to_regclass('public.sc_deployment_profile') r")).r,null);
});

test('TEST profile: keeps check(test_only), allows only the TEST tenants, rejects a live tenant',async()=>{
 const db=await fresh();await install(db,'test');
 assert.deepEqual(await one(db,'select public.sc_deployment_tenant() t,public.sc_is_live_deployment() l'),{t:'sarberki-test',l:false});
 await db.exec("insert into sc_tenants(tenant_id,name) values('sarberki-test','Teszt'),('demo-test','Demo')");
 await fails(db.exec("insert into sc_tenants(tenant_id,name,test_only) values('sarberki-live','Éles',false)"),'TEST_TENANT_ONLY');
 assert.equal((await one(db,"select count(*)::int n from pg_constraint where conname='sc_tenants_test_only_check'")).n,1);
 await fails(db.exec("insert into sc_tenants(tenant_id,name) values('sarberki-live','Éles')"),'TEST_TENANT_ONLY');
 await fails(db.exec("insert into sc_tenants(tenant_id,name) values('other-test','X')"),'TEST_TENANT_ONLY');
 await install(db,'test');// same environment: idempotent
 await fails(install(db,'live'),'DEPLOYMENT_PROFILE_MISMATCH',db);
 assert.equal((await one(db,'select count(*)::int n from sc_deployment_profile')).n,1);
});

test('LIVE profile: empty project only, exactly one non-test tenant sarberki-live',async()=>{
 const dirty=await fresh();
 await dirty.exec("insert into sc_tenants(tenant_id,name) values('sarberki-test','Teszt')");
 await fails(install(dirty,'live'),'LIVE_PROJECT_NOT_EMPTY',dirty);
 const db=await fresh();await install(db,'live');
 assert.deepEqual(await one(db,'select public.sc_deployment_tenant() t,public.sc_is_live_deployment() l'),{t:'sarberki-live',l:true});
 await db.exec("insert into sc_tenants(tenant_id,name) values('sarberki-live','Sárberki éles')");
 assert.equal((await one(db,"select test_only from sc_tenants where tenant_id='sarberki-live'")).test_only,false);
 assert.equal((await one(db,"select count(*)::int n from pg_constraint where conname='sc_tenants_test_only_check'")).n,0);
 await fails(db.exec("insert into sc_tenants(tenant_id,name,test_only) values('sarberki-test','Teszt',true)"),'LIVE_TENANT_ONLY');
 await fails(db.exec("update sc_tenants set test_only=true where tenant_id='sarberki-live'"),'LIVE_TENANT_ONLY');
 await fails(db.exec("insert into sc_tenants(tenant_id,name,test_only) values('other-live','X',false)"),'LIVE_TENANT_ONLY');
 await fails(install(db,'test'),'DEPLOYMENT_PROFILE_MISMATCH',db);
});

test('profile is immutable and invisible to clients',async()=>{
 const db=await fresh();await install(db,'live');
 await fails(db.exec("update sc_deployment_profile set environment='test',tenant_id='sarberki-test'"),'DEPLOYMENT_PROFILE_IMMUTABLE');
 await fails(db.exec('delete from sc_deployment_profile'),'DEPLOYMENT_PROFILE_IMMUTABLE');
 await fails(db.exec('truncate sc_deployment_profile'),'DEPLOYMENT_PROFILE_IMMUTABLE');
 await fails(db.exec("insert into sc_deployment_profile(singleton,environment,tenant_id,project_ref,mailbox_address) values(true,'test','sarberki-test','mojnqizbcaczstguikpv','sarberkiprojecttest@gmail.com')"),'duplicate key');
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);
  try{
   await fails(db.query('select * from sc_deployment_profile'),'permission denied');
   await fails(db.query('select public.sc_deployment_tenant()'),'permission denied');
   await fails(db.query('select public.sc_is_live_deployment()'),'permission denied');
  }finally{await db.exec('reset role');}
 }
});

test('project ref: required, TEST = the TEST project, LIVE = any other project; issuer follows the profile',async()=>{
 const db=await fresh();
 await fails(install(db,'test',null),'DEPLOYMENT_PROJECT_REF_REQUIRED',db);
 await fails(install(db,'test',LIVE_REF),'DEPLOYMENT_PROJECT_REF_REQUIRED',db);
 await fails(install(db,'live',TEST_REF),'DEPLOYMENT_PROJECT_REF_REQUIRED',db);
 await fails(install(db,'live','Bad-Ref'),'DEPLOYMENT_PROJECT_REF_REQUIRED',db);
 await install(db,'live');
 assert.equal((await one(db,'select public.sc_deployment_issuer() i')).i,'https://'+LIVE_REF+'.supabase.co/auth/v1');
 assert.equal((await one(db,'select public.sc_deployment_mailbox() m')).m,'info@sarberkito.hu');
 await fails(install(db,'live','otherxprojectxrefxab'),'DEPLOYMENT_PROFILE_MISMATCH',db);
 await fails(db.exec("update sc_deployment_profile set project_ref='"+TEST_REF+"'"),'DEPLOYMENT_PROFILE_IMMUTABLE');
});

test('actor guard: own tenant, own issuer, unexpired unrevoked session and the asked permission only',async()=>{
 const ids={a:'11111111-1111-4111-8111-111111111111',r:'22222222-2222-4222-8222-222222222222'},sess={a:'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',r:'aaaaaaaa-aaaa-4aaa-8aaa-000000000002'};
 for(const [env,tenant,ref] of [['live','sarberki-live',LIVE_REF],['test','sarberki-test',TEST_REF]]){
  const db=await fresh();await install(db,env);
  await db.exec(`insert into sc_tenants(tenant_id,name${env==='live'?'':''}) values('${tenant}','X')`);
  for(const k of ['a','r']){await db.query('insert into auth.users values($1)',[ids[k]]);await db.query('insert into auth.sessions values($1,$2,null)',[sess[k],ids[k]]);}
  await db.query('insert into sc_memberships values($1,$2,true,true,true),($1,$3,true,false,false)',[tenant,ids.a,ids.r]);
  const claims=(k,extra={})=>({sub:ids[k],role:'authenticated',iss:'https://'+ref+'.supabase.co/auth/v1',session_id:sess[k],exp:Math.floor(Date.now()/1000)+600,...extra});
  // The guard is internal; call it as the owner with the request claims set (as a definer caller would).
  const guard=async(k,t,perm,extra)=>{await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims(k,extra))]);return (await db.query('select public.sc_deployment_actor($1,$2) a',[t,perm])).rows[0].a;};
  assert.equal(await guard('a',tenant,'approve'),ids.a,env);
  assert.equal(await guard('r',tenant,'read'),ids.r);
  await fails(guard('r',tenant,'approve'),'forbidden');
  await fails(guard('a',env==='live'?'sarberki-test':'sarberki-live','read'),'forbidden');
  await fails(guard('a',tenant,'read',{iss:'https://'+(env==='live'?TEST_REF:LIVE_REF)+'.supabase.co/auth/v1'}),'forbidden');
  await fails(guard('a',tenant,'read',{exp:Math.floor(Date.now()/1000)-1}),'forbidden');
  await db.query('update auth.sessions set not_after=now()-interval \'1 minute\' where id=$1',[sess.a]);
  await fails(guard('a',tenant,'read'),'session revoked');
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);try{await fails(db.query("select public.sc_deployment_actor('x','read')"),'permission denied');}finally{await db.exec('reset role');}}
 }
});
