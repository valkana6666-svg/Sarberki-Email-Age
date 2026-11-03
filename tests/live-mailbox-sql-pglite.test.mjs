import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,createHmac} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {installDeploymentProfile} from './deployment-profile-fixture.mjs';
import {attestTestMailboxSource} from '../shared-core/server-gmail-source.mjs';

// Slice 2b: the same mailbox-case SQL on a LIVE deployment profile (real PostgreSQL via PGlite).
// Fictional project ref, people and mail only; nothing here touches a hosted database.
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const REF='livefictionalrefaaaa',ISS='https://'+REF+'.supabase.co/auth/v1',KEY='c7'.repeat(32),TENANT='sarberki-live',MAILBOX='info@sarberkito.hu';
const ids={writer:'11111111-1111-4111-8111-111111111111',approver:'22222222-2222-4222-8222-222222222222'};
const sessions={writer:'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',approver:'aaaaaaaa-aaaa-4aaa-8aaa-000000000002'};
const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
const attest=(scope,tenant,src,text,checkedAt=new Date().toISOString())=>{
 const bodySha256=sha(text);
 const fields=[scope,tenant,src.mailbox_id,src.message_id,src.thread_id,src.rfc_message_id,src.from_email,src.to,src.subject,src.received_at,bodySha256,checkedAt];
 return {scope,checkedAt,bodySha256,attestation:createHmac('sha256',Buffer.from(KEY,'hex')).update(fields.join('\n')).digest('hex')};
};
function mail(n,{to=MAILBOX,from='guest@example.test'}={}){
 const id='19a0b1c2d3e4f5'+String(n).padStart(2,'0'),text='Jó napot! Kitalált érdeklődés '+n+'.';
 const src={provider:'gmail',mailbox_id:'sarberkito_info',message_id:id,thread_id:id,rfc_message_id:'<fictional-live-'+n+'@example.test>',in_reply_to:null,references:[],
  subject:'Kitalált érdeklődés '+n,from:'Vendég <'+from+'>',from_email:from,to,received_at:'2026-11-03T10:00:00.000Z'};
 const env={sender:from,text,mailbox_id:src.mailbox_id,message_id:id,thread_id:id,rfc_message_id:src.rfc_message_id,references:[],received_at:src.received_at};
 const caseId='live-case-'+n;
 return {caseId,src,text,data:{id:caseId,tenantId:TENANT,sender:from,state:{approval:'pending',values:{}},messages:[env],drafts:[{text:'Kitalált tervezet '+n}],sourceReceipt:src}};
}

test('mailbox-case SQL on a LIVE profile: own project, tenant, mailbox and scopes only',async t=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;grant select on auth.sessions to authenticated;`);
  await db.exec(await read('supabase/migrations/202610090001_case_store.sql'));
  const tmInstall=await read('deployment/test-mailbox/install.sql');
  await installDeploymentProfile(db,'live',REF);
  await db.exec("insert into sc_tenants values('sarberki-live','Fictional live',false)");
  await db.query("select set_config('sarberki.approval_install_project_ref',$1,false),set_config('sarberki.approval_backup_sha256',$2,false)",[REF,'b'.repeat(64)]);
  await db.exec(await read('deployment/cloud-approval/install.sql'));
  await db.exec(await read('deployment/cloud-approval/separate-approver-permission.sql'));
  await db.query('insert into sc_isolated_approval_key(key_hex) values($1)',[KEY]);
  for(const role of Object.keys(ids)){await db.query('insert into auth.users values($1)',[ids[role]]);await db.query('insert into auth.sessions values($1,$2,null)',[sessions[role],ids[role]]);}
  await db.query("insert into sc_memberships values($1,$2,true,true,false),($1,$3,true,false,true)",[TENANT,ids.writer,ids.approver]);
  const as=async(role,fn,iss=ISS)=>{await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:ids[role],role:'authenticated',iss,session_id:sessions[role],exp:Math.floor(Date.now()/1000)+3600})]);try{return await fn();}finally{await db.exec('reset role');}};
  const create=(m,proof,{iss,tenant=TENANT,data=m.data}={})=>as('writer',async()=>(await db.query('select sc_tm_create($1,$2,$3,$4) r',[tenant,m.caseId,JSON.stringify(data),JSON.stringify(proof)])).rows[0].r,iss);
  const code=c=>e=>e.code===c||assert.fail('expected '+c+' got '+e.code+' '+e.message);

  await t.test('install: the TEST ref is refused, the LIVE ref installs with the switch off',async()=>{
   await db.query("select set_config('sarberki.tm_install_project_ref','mojnqizbcaczstguikpv',false),set_config('sarberki.tm_backup_sha256',$1,false)",['c'.repeat(64)]);
   await assert.rejects(db.exec(tmInstall),/verified live project/);await db.exec('rollback');
   await db.query("select set_config('sarberki.tm_install_project_ref',$1,false)",[REF]);await db.exec(tmInstall);
   assert.equal((await db.query('select enabled from sc_test_mailbox_config')).rows[0].enabled,false);
   for(const role of ['anon','authenticated','service_role']){await db.exec('set role '+role);try{await assert.rejects(db.query('select sc_tm_profile()'),code('42501'));}finally{await db.exec('reset role');}}
   await assert.rejects(create(mail(1),attest('live-mailbox-source-v1',TENANT,mail(1).src,mail(1).text)),code('42501'),'switch off');
   await db.exec('update sc_test_mailbox_config set enabled=true');
  });
  const ok=mail(2);
  await t.test('live attested mail is saved with the live scope',async()=>{
   // JS server attestation (live profile) is exactly what the LIVE database recomputes.
   const checkedAt=new Date().toISOString(),proof=attestTestMailboxSource({key:KEY,tenantId:TENANT,source:ok.src,envelope:ok.data.messages[0],checkedAt});
   assert.deepEqual(proof,attest('live-mailbox-source-v1',TENANT,ok.src,ok.text,checkedAt));
   const saved=await create(ok,proof);
   assert.equal(saved.revision,1);assert.equal(saved.data.testMailbox.scope,'live-mailbox-source-v1');
  });
  await t.test('TEST scope, TEST mailbox, TEST tenant/issuer and own sender are refused',async()=>{
   const m=mail(3);
   await assert.rejects(create(m,attest('test-mailbox-source-v1',TENANT,m.src,m.text)),code('42501'),'test scope');
   const tm=mail(4,{to:'sarberkiprojecttest@gmail.com'});
   await assert.rejects(create(tm,attest('live-mailbox-source-v1',TENANT,tm.src,tm.text)),code('22023'),'test mailbox');
   const own=mail(5,{from:MAILBOX});
   await assert.rejects(create(own,attest('live-mailbox-source-v1',TENANT,own.src,own.text)),code('22023'),'own sender');
   await assert.rejects(create(m,attest('live-mailbox-source-v1',TENANT,m.src,m.text),{iss:'https://mojnqizbcaczstguikpv.supabase.co/auth/v1'}),code('42501'),'test issuer');
   await assert.rejects(create(m,attest('live-mailbox-source-v1','sarberki-test',m.src,m.text),{tenant:'sarberki-test',data:{...m.data,tenantId:'sarberki-test'}}),code('42501'),'test tenant');
   assert.equal((await db.query('select count(*)::int n from sc_cases')).rows[0].n,1);
  });
  await t.test('independent approval records the live internal scope, nothing sendable',async()=>{
   const r=await as('approver',async()=>(await db.query('select sc_tm_decide($1,$2,1,$3,$4) r',[TENANT,ok.caseId,sha('Kitalált tervezet 2'),'approve'])).rows[0].r);
   assert.equal(r.data.state.approval,'approved_internal');
   assert.deepEqual({scope:r.data.internalApproval.scope,send:r.data.internalApproval.sendAllowed,book:r.data.internalApproval.bookingAllowed},{scope:'live-mailbox-v1',send:false,book:false});
  });
  await t.test('rollback: TEST ref refused, LIVE ref removes RPCs and keeps cases',async()=>{
   const rollback=await read('deployment/test-mailbox/rollback.sql');
   await db.query("select set_config('sarberki.tm_install_project_ref','mojnqizbcaczstguikpv',false)");
   await assert.rejects(db.exec(rollback),/unexpected project/);await db.exec('rollback');
   await db.query("select set_config('sarberki.tm_install_project_ref',$1,false)",[REF]);await db.exec(rollback);
   assert.equal((await db.query("select count(*)::int n from pg_proc where proname in ('sc_tm_create','sc_tm_profile','sc_tm_actor')")).rows[0].n,0);
   assert.equal((await db.query('select count(*)::int n from sc_cases')).rows[0].n,1);
  });
 }finally{await db.close();}
});

test('mailbox-case install refuses a database without a deployment profile',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;');
  await db.exec(await read('supabase/migrations/202610090001_case_store.sql'));
  await db.query("select set_config('sarberki.tm_install_project_ref','mojnqizbcaczstguikpv',false),set_config('sarberki.tm_backup_sha256',$1,false)",['c'.repeat(64)]);
  await assert.rejects(db.exec(await read('deployment/test-mailbox/install.sql')),/deployment profile required/);
 }finally{await db.close();}
});
