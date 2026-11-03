import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

// Real PostgreSQL semantics (PGlite). Fictional data only. Slice 1 of the live case store.
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const BOOT=`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;grant usage on schema auth to authenticated,anon;`;
async function fresh(){const db=new PGlite();await db.exec(BOOT);await db.exec(await read('supabase/migrations/202610090001_case_store.sql'));return db;}
async function install(db,env){
 const sql=await read('deployment/deployment-profile/install.sql');
 await db.exec('begin;'+(env===undefined?'':`select set_config('sarberki.deployment_environment','${env}',true);`)+sql+'commit;');
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
 await fails(db.exec("insert into sc_deployment_profile(singleton,environment,tenant_id) values(true,'test','sarberki-test')"),'duplicate key');
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);
  try{
   await fails(db.query('select * from sc_deployment_profile'),'permission denied');
   await fails(db.query('select public.sc_deployment_tenant()'),'permission denied');
   await fails(db.query('select public.sc_is_live_deployment()'),'permission denied');
  }finally{await db.exec('reset role');}
 }
});
