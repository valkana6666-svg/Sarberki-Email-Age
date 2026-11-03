import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

// Real PostgreSQL semantics (PGlite). Fictional data only. Slice 5 of the live case store.
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const BOOT=`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;grant usage on schema auth to authenticated,anon;`;
const constraints=async db=>(await db.query("select conname,pg_get_constraintdef(oid) def from pg_constraint where conrelid='public.sc_memberships'::regclass and contype='c' order by conname")).rows;
async function store(){const db=new PGlite();await db.exec(BOOT);await db.exec(await read('supabase/migrations/202610090001_case_store.sql'));return db;}
const profile=async(db,env,ref)=>db.exec(`begin;select set_config('sarberki.deployment_environment','${env}',true),set_config('sarberki.deployment_project_ref','${ref}',true);`+await read('deployment/deployment-profile/install.sql')+'commit;');

test('approver-role: profile required, same end state as the TEST migration, idempotent',async()=>{
 const sql=await read('deployment/approver-role/install.sql');
 const bare=await store();
 await assert.rejects(bare.exec(sql),/DEPLOYMENT_PROFILE_REQUIRED/);await bare.exec('rollback');
 const before=await constraints(bare);

 // TEST stack: cloud-approval + separate-approver-permission (the applied TEST migration).
 const testDb=await store();
 await testDb.query("select set_config('sarberki.approval_install_project_ref','mojnqizbcaczstguikpv',false),set_config('sarberki.approval_backup_sha256',$1,false)",['b'.repeat(64)]);
 await testDb.exec("insert into sc_tenants values('sarberki-test','Fictional',true)");
 await testDb.exec(await read('deployment/cloud-approval/install.sql'));
 await testDb.exec(await read('deployment/cloud-approval/separate-approver-permission.sql'));
 const expected=await constraints(testDb);
 await profile(testDb,'test','mojnqizbcaczstguikpv');await testDb.exec(sql);
 assert.deepEqual(await constraints(testDb),expected,'no-op on the TEST project');

 const live=await store();await profile(live,'live','abcdefghijklmnopqrst');
 await live.exec(sql);await live.exec(sql);
 assert.deepEqual(await constraints(live),expected,'LIVE matches the TEST end state');
 assert.notDeepEqual(before,expected);

 await live.exec("insert into sc_tenants(tenant_id,name) values('sarberki-live','Kitalált')");
 const id='22222222-2222-4222-8222-222222222222';await live.query('insert into auth.users values($1)',[id]);
 await live.query("insert into sc_memberships values('sarberki-live',$1,true,false,true)",[id]);// approve-only
 await assert.rejects(live.query("update sc_memberships set can_read=false where user_id=$1",[id]),/check constraint/);
 await assert.rejects(live.query("insert into sc_memberships values('sarberki-live',gen_random_uuid(),false,true,false)"),/check constraint|foreign key/);
});
