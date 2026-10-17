import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('restore-only service rollback fixture checks actual SQL success, authority, replay and tenant boundaries without retaining records',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  for(const name of ['202610090001_case_store.sql','20261016111515_service_link_resolution.sql','20261016114328_tub_service_approval.sql'])await db.exec(await read('supabase/migrations/'+name));
  const legacy=await read('deployment/cloud-approval/install.sql');
  await db.exec(legacy.slice(legacy.indexOf('create table if not exists public.sc_isolated_approval_key'),legacy.indexOf('-- Only this specialized RPC can approve.')));
  await db.exec("insert into sc_isolated_approval_key values(true,repeat('12',32));create table sc_cloud_approval_binding(singleton boolean,project_ref text);insert into sc_cloud_approval_binding values(true,'mojnqizbcaczstguikpv');insert into sc_tenants values('sarberki-test','Synthetic',true),('demo-test','Other',true);");
  const constraints=(await db.query("select conname from pg_constraint where conrelid='sc_memberships'::regclass and pg_get_constraintdef(oid) like '%can_approve%'")).rows;
  for(const c of constraints)await db.exec('alter table sc_memberships drop constraint '+c.conname);
  await db.exec('alter table sc_memberships add check(not can_approve or can_read)');
  const result=await db.exec(await read('scripts/restored-service-rollback.sql'));
  assert.equal(result.at(-1).rows[0]['?column?'],'RESTORED_SERVICE_ROLLBACK_PASS');
  for(const table of ['sc_cases','sc_service_approvals','sc_service_link_decisions','sc_audit','sc_memberships','auth.users','auth.sessions'])assert.equal((await db.query('select count(*)::int n from '+table)).rows[0].n,0,table);
 }finally{await db.close();}
});
