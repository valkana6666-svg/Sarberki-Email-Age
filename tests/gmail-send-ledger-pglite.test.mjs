import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const migration=readFileSync(new URL('../deployment/cloud-approval/gmail-send-ledger-CANDIDATE.sql',import.meta.url),'utf8');
const cid='13c8ecb7-f836-4e2c-9833-d58ee96f2dda';
const user='11111111-1111-4111-8111-111111111111';
async function makeDb(){
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated;
 create table public.sc_cloud_approval_binding(singleton boolean,project_ref text);
 create table public.sc_tenants(tenant_id text primary key,test_only boolean);
 create table public.sc_memberships(tenant_id text,user_id uuid,primary key(tenant_id,user_id));
 create table public.sc_cases(tenant_id text,case_id text,primary key(tenant_id,case_id));
 insert into public.sc_cloud_approval_binding values(true,'mojnqizbcaczstguikpv');
 insert into public.sc_tenants values('sarberki-test',true);
 insert into public.sc_memberships values('sarberki-test','${user}');
 insert into public.sc_cases values('sarberki-test','${cid}');`);
 return db;
}
async function reviewed(db) {
 await db.exec(`select set_config('sarberki.approval_install_project_ref','mojnqizbcaczstguikpv',false);
 select set_config('sarberki.approval_backup_sha256','${'a'.repeat(64)}',false);
 select set_config('sarberki.mail_schema_reviewed','yes',false);`);
}
const found=async(db,table)=>(await db.query(`select count(*)::int as n from information_schema.tables where table_schema='public' and table_name='${table}'`)).rows[0].n===1;
test('without explicit reviewed gate SQL aborts and leaves no tables',async()=>{
 const db=await makeDb();
 try{
 await assert.rejects(db.exec(migration),/test-only reviewed migration and verified restore proof required/);
 await db.exec('rollback');
 assert.equal(await found(db,'sc_mail_dispatches'),false);
 assert.equal(await found(db,'sc_mail_send_memberships'),false);
 }finally{await db.close()}
});
test('approved isolated schema creates locked-down tables and blocks duplicate ledger keys',async()=>{
 const db=await makeDb();
 try{
 await reviewed(db);await db.exec(migration);
 assert.equal(await found(db,'sc_mail_send_memberships'),true);
 assert.equal(await found(db,'sc_mail_dispatches'),true);
 const hash='b'.repeat(64);
 const insert=()=>db.query(`insert into public.sc_mail_dispatches(tenant_id,case_id,approval_revision,draft_sha256,destination,actor)
 values('sarberki-test',$1,6,$2,'sarberkiprojecttest@gmail.com',$3) returning status`,[cid,hash,user]);
 assert.equal((await insert()).rows[0].status,'reserved');
 await assert.rejects(insert(),/unique|duplicate|constraint/i);
 await assert.rejects(db.query(`insert into public.sc_mail_dispatches(tenant_id,case_id,approval_revision,draft_sha256,destination,actor) values('sarberki-test',$1,7,$2,'guest@example.test',$3)`,[cid,hash,user]),/check|constraint/i);
 const rl=await db.query(`select relrowsecurity,relforcerowsecurity from pg_class where oid='public.sc_mail_dispatches'::regclass`);
 assert.equal(rl.rows[0].relrowsecurity,true);assert.equal(rl.rows[0].relforcerowsecurity,true);
 for(const role of ['anon','authenticated']){
  for(const table of ['sc_mail_send_memberships','sc_mail_dispatches']){
   for(const privilege of ['SELECT','INSERT','UPDATE','DELETE']){
    const result=await db.query('select has_table_privilege($1,$2,$3) as allowed',[role,`public.${table}`,privilege]);
    assert.equal(result.rows[0].allowed,false,`${role} must not have ${privilege} on ${table}`);
   }
  }
 }
 assert.equal((await db.query('select count(*)::int as n from public.sc_mail_send_memberships')).rows[0].n,0);
 assert.equal((await db.query("select count(*)::int as n from pg_policies where schemaname='public' and tablename in ('sc_mail_send_memberships','sc_mail_dispatches')")).rows[0].n,0);
 }finally{await db.close()}
});
