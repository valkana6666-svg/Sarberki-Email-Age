import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {attestTestMailboxSource} from '../shared-core/server-gmail-source.mjs';

// Real PostgreSQL (PGlite) on the same layer stack as the hosted TEST project. Fictional data only.
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const project='https://mojnqizbcaczstguikpv.supabase.co',KEY='e5'.repeat(32),TENANT='sarberki-test';
const ids={writer:'11111111-1111-4111-8111-111111111111',approver:'22222222-2222-4222-8222-222222222222',approver2:'33333333-3333-4333-8333-333333333333',reader:'44444444-4444-4444-8444-444444444444'};
const sessions=Object.fromEntries(Object.keys(ids).map((role,i)=>[role,'aaaaaaaa-aaaa-4aaa-8aaa-'+String(i+1).padStart(12,'0')]));
const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');

function fixture(n){
 const messageId='18f2a0b1c2d3e5'+String(n).padStart(2,'0');
 const source={provider:'gmail',mailbox_id:'sarberki_gmail_test',message_id:messageId,thread_id:messageId,rfc_message_id:'<fictional-ledger-'+n+'@example.test>',
  in_reply_to:null,references:[],subject:'Érdeklődés',from:'Teszt <sarberkito@gmail.com>',from_email:'sarberkito@gmail.com',to:'sarberkiprojecttest@gmail.com',received_at:'2026-11-06T08:00:00.000Z'};
 const envelope={sender:source.from_email,text:'Jó napot! Faházat szeretnénk 2 főre.',mailbox_id:source.mailbox_id,message_id:messageId,thread_id:messageId,rfc_message_id:source.rfc_message_id,references:[],received_at:source.received_at};
 const caseId='tm-ledger-'+n;
 const data={id:caseId,tenantId:TENANT,sender:source.from_email,state:{approval:'pending',values:{}},messages:[envelope],drafts:[{text:'Kedves Vendégünk! (kitalált tervezet '+n+')'}],sourceReceipt:source};
 return {caseId,data,proof:attestTestMailboxSource({key:KEY,tenantId:TENANT,source,envelope,checkedAt:new Date().toISOString()})};
}

test('send ledger: one claim per approved draft, failed may retry, unknown never, roles and isolation on real PostgreSQL',async t=>{
 const db=new PGlite();
 const claims=(role,extra={})=>({sub:ids[role],role:'authenticated',iss:project+'/auth/v1',session_id:sessions[role],exp:Math.floor(Date.now()/1000)+3600,...extra});
 const as=async(role,fn)=>{await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims(role))]);try{return await fn();}finally{await db.exec('reset role');}};
 const one=(role,sql,params)=>as(role,async()=>(await db.query(sql,params)).rows[0].r);
 const claim=(role,caseId,rev,hash)=>one(role,'select sc_tm_send_claim($1,$2,$3,$4) r',[TENANT,caseId,rev,hash]);
 const finish=(role,id,status,gmail=null)=>one(role,'select sc_tm_send_finish($1,$2,$3,$4) r',[TENANT,id,status,gmail]);
 const denied=code=>error=>error.code===code||assert.fail('expected '+code+' got '+error.code+' '+error.message);
 const approved=async n=>{
  const f=fixture(n);
  await one('writer','select sc_tm_create($1,$2,$3,$4) r',[TENANT,f.caseId,JSON.stringify(f.data),JSON.stringify(f.proof)]);
  const hash=sha(f.data.drafts[0].text);
  await one('approver','select sc_tm_decide($1,$2,$3,$4,$5,$6) r',[TENANT,f.caseId,1,hash,'approve',null]);
  return {caseId:f.caseId,hash,rev:2};
 };
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;grant select on auth.sessions to authenticated;`);
  await db.exec(await read('supabase/migrations/202610090001_case_store.sql'));
  await db.query("select set_config('sarberki.approval_install_project_ref',$1,false),set_config('sarberki.approval_backup_sha256',$2,false)",['mojnqizbcaczstguikpv','b'.repeat(64)]);
  await db.exec("insert into sc_tenants values('sarberki-test','Fictional',true),('demo-test','Fictional other',true)");
  await db.exec(await read('deployment/cloud-approval/install.sql'));
  await db.exec(await read('deployment/cloud-approval/separate-approver-permission.sql'));
  await db.query("select set_config('sarberki.receipt_install_project_ref',$1,false),set_config('sarberki.receipt_backup_sha256',$2,false)",['mojnqizbcaczstguikpv','b'.repeat(64)]);
  await db.exec(await read('deployment/exact-receipt/install.sql'));
  await db.query('insert into sc_isolated_approval_key(key_hex) values($1)',[KEY]);
  const memberships={writer:[true,true,false],approver:[true,false,true],approver2:[true,false,true],reader:[true,false,false]};
  for(const [role,id] of Object.entries(ids)){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into auth.sessions values($1,$2,null)',[sessions[role],id]);
   await db.query('insert into sc_memberships values($1,$2,$3,$4,$5)',[TENANT,id,...memberships[role]]);}
  const ledger=await read('deployment/test-mailbox/send-ledger.sql');
  await t.test('install requires the test-mailbox layer, the verified project and a fresh backup',async()=>{
   await db.query("select set_config('sarberki.tm_install_project_ref','mojnqizbcaczstguikpv',false),set_config('sarberki.tm_backup_sha256',$1,false)",['c'.repeat(64)]);
   await assert.rejects(db.exec(ledger),/test-mailbox install required/);await db.exec('rollback');
   await db.exec(await read('deployment/test-mailbox/install.sql'));
   await db.exec('update sc_test_mailbox_config set enabled=true');
   await db.query("select set_config('sarberki.tm_install_project_ref','wrong',false)");
   await assert.rejects(db.exec(ledger),/verified test project/);await db.exec('rollback');
   await db.query("select set_config('sarberki.tm_install_project_ref','mojnqizbcaczstguikpv',false)");
   await db.exec(ledger);await db.exec(ledger);
  });
  await t.test('first claim wins; every later claim sees the state; sent is final',async()=>{
   const c=await approved(1);
   const first=await claim('approver',c.caseId,c.rev,c.hash);
   assert.equal(first.status,'claimed');assert.match(first.claimId,/^[0-9a-f-]{36}$/);
   assert.deepEqual(await claim('approver',c.caseId,c.rev,c.hash),{status:'sending'});
   assert.deepEqual(await claim('approver2',c.caseId,c.rev,c.hash),{status:'sending'},'a second approver cannot start a parallel send');
   assert.equal(await finish('approver2',first.claimId,'sent','msg-abc123'),false,'only the claimer finishes');
   assert.equal(await finish('approver',first.claimId,'sent','msg-abc123'),true);
   assert.equal(await finish('approver',first.claimId,'failed'),false,'terminal');
   assert.deepEqual(await claim('approver',c.caseId,c.rev,c.hash),{status:'sent'});
   const row=(await db.query('select status,gmail_message_id,claimed_by from sc_tm_send_ledger where case_id=$1',[c.caseId])).rows[0];
   assert.deepEqual(row,{status:'sent',gmail_message_id:'msg-abc123',claimed_by:ids.approver});
  });
  await t.test('failed (refused before sending) may be claimed again; outcome_unknown never',async()=>{
   const c=await approved(2);
   const a=await claim('approver',c.caseId,c.rev,c.hash);
   assert.equal(await finish('approver',a.claimId,'failed'),true);
   const b=await claim('approver2',c.caseId,c.rev,c.hash);
   assert.equal(b.status,'claimed');assert.notEqual(b.claimId,a.claimId);
   assert.equal(await finish('approver',a.claimId,'sent','msg-old111'),false,'old claim id is dead');
   assert.equal(await finish('approver2',b.claimId,'outcome_unknown'),true);
   assert.deepEqual(await claim('approver',c.caseId,c.rev,c.hash),{status:'outcome_unknown'});
  });
  await t.test('only an approved latest draft at the exact revision; wrong role, hash or revision refused',async()=>{
   const c=await approved(3);
   assert.equal(await claim('approver',c.caseId,1,c.hash),null,'stale revision');
   await assert.rejects(claim('approver',c.caseId,c.rev,'0'.repeat(64)),denied('22023'));
   await assert.rejects(claim('approver',c.caseId,c.rev,'bad'),denied('22023'));
   for(const role of ['writer','reader'])await assert.rejects(claim(role,c.caseId,c.rev,c.hash),denied('42501'),role);
   const f=fixture(4);
   await one('writer','select sc_tm_create($1,$2,$3,$4) r',[TENANT,f.caseId,JSON.stringify(f.data),JSON.stringify(f.proof)]);
   await assert.rejects(claim('approver',f.caseId,1,sha(f.data.drafts[0].text)),denied('22023'),'pending case');
   await assert.rejects(finish('approver',null,'sent','msg-abc123'),denied('22023'));
   await assert.rejects(finish('approver','00000000-0000-4000-8000-000000000000','sent'),denied('22023'),'sent needs the Gmail id');
  });
  await t.test('switch off blocks; clients cannot write the ledger; readers may read; service_role has nothing',async()=>{
   const c=await approved(5);
   await db.exec('update sc_test_mailbox_config set enabled=false');
   await assert.rejects(claim('approver',c.caseId,c.rev,c.hash),denied('42501'));
   await db.exec('update sc_test_mailbox_config set enabled=true');
   await as('approver',async()=>{
    for(const sql of ["insert into sc_tm_send_ledger(tenant_id,case_id,draft_hash,claim_id,claimed_by) values('sarberki-test','tm-ledger-5','"+'a'.repeat(64)+"',gen_random_uuid(),'"+ids.approver+"')",
     "update sc_tm_send_ledger set status='failed'","delete from sc_tm_send_ledger"])await assert.rejects(db.query(sql),denied('42501'));
   });
   assert.ok((await as('reader',async()=>(await db.query('select count(*)::int n from sc_tm_send_ledger')).rows[0].n))>=2);
   const priv=(await db.query("select has_table_privilege('service_role','sc_tm_send_ledger','select') s,has_function_privilege('service_role','sc_tm_send_claim(text,text,bigint,text)','execute') c,has_function_privilege('anon','sc_tm_send_claim(text,text,bigint,text)','execute') a")).rows[0];
   assert.deepEqual(priv,{s:false,c:false,a:false});
  });
  await t.test('rollback removes the functions and keeps the record of what was sent',async()=>{
   const before=(await db.query('select count(*)::int n from sc_tm_send_ledger')).rows[0].n;
   await db.exec(await read('deployment/test-mailbox/send-ledger-rollback.sql'));
   assert.equal((await db.query("select to_regprocedure('public.sc_tm_send_claim(text,text,bigint,text)') is null x")).rows[0].x,true);
   assert.equal((await db.query('select count(*)::int n from sc_tm_send_ledger')).rows[0].n,before);
  });
 }finally{await db.close();}
});
