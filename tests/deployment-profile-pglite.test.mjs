import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

// Real PostgreSQL semantics (PGlite). Fictional data only. Slice 1 of the live case store.
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const BOOT=`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;grant usage on schema auth to authenticated,anon;`;
async function fresh(){const db=new PGlite();await db.exec(BOOT);await db.exec(await read('supabase/migrations/202610090001_case_store.sql'));return db;}
const REF={test:'mojnqizbcaczstguikpv',live:'livefictionalrefaaaa'};
async function install(db,env,ref=REF[env]){
 const sql=await read('deployment/deployment-profile/install.sql');
 const set=(k,v)=>v===undefined?'':`select set_config('sarberki.${k}','${v}',true);`;
 await db.exec('begin;'+set('deployment_environment',env)+set('deployment_project_ref',ref)+sql+'commit;');
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
 await fails(db.exec("insert into sc_deployment_profile(singleton,environment,tenant_id,project_ref) values(true,'test','sarberki-test','mojnqizbcaczstguikpv')"),'duplicate key');
 for(const role of ['anon','authenticated','service_role']){
  await db.exec('set role '+role);
  try{
   await fails(db.query('select * from sc_deployment_profile'),'permission denied');
   await fails(db.query('select public.sc_deployment_tenant()'),'permission denied');
   await fails(db.query('select public.sc_is_live_deployment()'),'permission denied');
  }finally{await db.exec('reset role');}
 }
});

test('project ref: required, well-formed, TEST ref only in TEST, never in LIVE; issuer derived',async()=>{
 const db=await fresh();
 await fails(install(db,'test',''),'DEPLOYMENT_PROJECT_REF_REQUIRED',db);
 await fails(install(db,'test','Bad-Ref'),'DEPLOYMENT_PROJECT_REF_REQUIRED',db);
 await fails(install(db,'test',REF.live),'DEPLOYMENT_PROJECT_REF_REQUIRED',db);
 await fails(install(db,'live',REF.test),'DEPLOYMENT_PROJECT_REF_REQUIRED',db);
 await install(db,'test');
 assert.deepEqual(await one(db,'select public.sc_deployment_project_ref() r,public.sc_deployment_issuer() i'),{r:REF.test,i:'https://mojnqizbcaczstguikpv.supabase.co/auth/v1'});
 const live=await fresh();await install(live,'live');
 assert.deepEqual(await one(live,'select public.sc_deployment_project_ref() r,public.sc_deployment_issuer() i'),{r:REF.live,i:'https://livefictionalrefaaaa.supabase.co/auth/v1'});
 await fails(install(live,'live','otherfictionalrefbbb'),'DEPLOYMENT_PROFILE_MISMATCH',live);
 await fails(live.exec("update sc_deployment_profile set project_ref='otherfictionalrefbbb'"),'DEPLOYMENT_PROFILE_IMMUTABLE');
 for(const role of ['anon','authenticated','service_role']){
  await live.exec('set role '+role);
  try{
   await fails(live.query('select public.sc_deployment_project_ref()'),'permission denied');
   await fails(live.query('select public.sc_deployment_issuer()'),'permission denied');
  }finally{await live.exec('reset role');}
 }
});

// Slice 2a: the cloud-approval binding and separate-approver migration take project and tenant from the profile.
const AUTH=`create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);`;
async function approvalSql(db,ref,files=['deployment/cloud-approval/install.sql','deployment/cloud-approval/separate-approver-permission.sql']){
 await db.query("select set_config('sarberki.approval_install_project_ref',$1,false)",[ref]);
 await db.query("select set_config('sarberki.approval_backup_sha256',$1,false)",['b'.repeat(64)]);
 for(const f of files)await db.exec(await read(f));
}

test('cloud approval binding: requires the profile; TEST binds the TEST ref unchanged',async()=>{
 const none=await fresh();await none.exec(AUTH);
 await none.exec("insert into sc_tenants values('sarberki-test','Fictional',true)");
 await fails(approvalSql(none,REF.test),'deployment profile required',none);
 const db=await fresh();await db.exec(AUTH);
 await db.exec("insert into sc_tenants values('sarberki-test','Fictional',true)");await install(db,'test');
 await fails(approvalSql(db,REF.live),'verified test project and fresh backup required',db);
 await approvalSql(db,REF.test);
 assert.equal((await one(db,'select project_ref from sc_cloud_approval_binding')).project_ref,REF.test);
 assert.equal((await one(db,"select count(*)::int n from pg_constraint where conname='sc_memberships_approve_requires_read'")).n,1);
});

test('cloud approval binding: LIVE binds its own ref and tenant, synthetic approval fails closed',async()=>{
 const empty=await fresh();await empty.exec(AUTH);await install(empty,'live');
 await fails(approvalSql(empty,REF.live),'verified live project and fresh backup required',empty);// tenant not created yet
 const db=await fresh();await db.exec(AUTH);await install(db,'live');
 await db.exec("insert into sc_tenants values('sarberki-live','Sárberki éles',false)");
 await fails(approvalSql(db,REF.test),'verified live project and fresh backup required',db);
 await approvalSql(db,REF.live);
 assert.equal((await one(db,'select project_ref from sc_cloud_approval_binding')).project_ref,REF.live);
 assert.equal((await one(db,"select count(*)::int n from pg_constraint where conname='sc_memberships_approve_requires_read'")).n,1);
 await fails(db.exec("insert into sc_cloud_approval_binding(singleton,project_ref,backup_sha256) values(true,'Bad',repeat('b',64))"),'violates');
 const user='11111111-1111-4111-8111-111111111111',session='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 await db.query('insert into auth.users values($1)',[user]);await db.query('insert into auth.sessions values($1,$2,null)',[session,user]);
 await db.query("insert into sc_memberships values('sarberki-live',$1,true,false,true)",[user]);
 await db.exec('set role authenticated');
 try{
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,iss:'https://'+REF.live+'.supabase.co/auth/v1',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,session_id:session})]);
  await fails(db.query("select public.sc_approve_case('sarberki-live','c1',1,repeat('a',64),'{}'::jsonb)"),'isolated approval only');
  await fails(db.query("select * from sc_cloud_approval_binding"),'permission denied');
 }finally{await db.exec('reset role');}
});
