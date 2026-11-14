// V3-3/V3-4 switch-on (owner 2026-11-14): enable-chat.sql = intake install + the dedicated intake account in the
// registry (by its Supabase Auth e-mail), never with an operator membership. Real PostgreSQL (PGlite), no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const REF='mojnqizbcaczstguikpv',project='https://'+REF+'.supabase.co',KEY='e5'.repeat(32),TENANT='sarberki-test';
// psql \ir is resolved here by inlining the included file (the install workflow runs psql).
const inline=async path=>{let s=await read(path);const dir=path.replace(/[^/]+$/,'');
 for(const m of [...s.matchAll(/^\\ir (\S+)$/gm)]){const inc=await read(dir+m[1]);s=s.replace(m[0],()=>inc);}return s;};

test('enable-chat: registers exactly the intake account, refuses a missing or operator account, verify passes',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;grant select on auth.sessions to authenticated;`);
  await db.exec(await read('supabase/migrations/202610090001_case_store.sql'));
  await db.query("select set_config('sarberki.approval_install_project_ref',$1,false),set_config('sarberki.approval_backup_sha256',$2,false),set_config('sarberki.receipt_install_project_ref',$1,false),set_config('sarberki.receipt_backup_sha256',$2,false),set_config('sarberki.tm_install_project_ref',$1,false),set_config('sarberki.tm_backup_sha256',$2,false)",[REF,'b'.repeat(64)]);
  await db.exec("insert into sc_tenants values('sarberki-test','Fictional',true),('demo-test','Fictional other',true)");
  await db.exec('alter table auth.users add column email text');
  for(const f of ['deployment/cloud-approval/install.sql','deployment/cloud-approval/separate-approver-permission.sql','deployment/exact-receipt/install.sql'])await db.exec(await read(f));
  await db.query('insert into sc_isolated_approval_key(key_hex) values($1)',[KEY]);
  for(const f of ['deployment/test-mailbox/install.sql','deployment/test-mailbox/booking-status.sql','deployment/test-mailbox/booking-unit.sql','deployment/test-mailbox/booking-cancel.sql','deployment/test-mailbox/booking-multiunit.sql'])await db.exec(await read(f));
  const sql=await inline('deployment/intake/enable-chat.sql'),verify=await inline('deployment/intake/enable-chat.verify.sql');
  // Account not created yet: refused, nothing registered.
  await assert.rejects(db.exec(sql),/intake account intake-test@sarberki.invalid missing/);await db.exec('rollback').catch(()=>{});
  const intake='33333333-3333-4333-8333-333333333333',op='11111111-1111-4111-8111-111111111111';
  await db.query("insert into auth.users(id,email) values($1,'Intake-Test@sarberki.invalid'),($2,'operator@sarberki.invalid')",[intake,op]);
  await db.exec(sql);
  const v=(await db.exec(verify)).at(-1).rows[0];assert.equal(v.result,'VERIFY PASS');assert.equal(Number(v.intake_actors),1);
  await db.exec(sql);assert.equal(Number((await db.query('select count(*) n from sc_intake_actors')).rows[0].n),1,'idempotent');
  // An operator membership on the intake account is refused by the verify.
  await db.query('insert into sc_memberships values($1,$2,true,false,false)',[TENANT,intake]);
  await assert.rejects(db.exec(verify),/intake account has a membership/);
 }finally{await db.close();}
});
