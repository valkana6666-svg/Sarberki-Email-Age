import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,createHmac} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

// Real PostgreSQL semantics (PGlite). Fictional data only, nothing is applied to any hosted database.
// Slice 4 of the live case store: a LIVE project gets the mailbox RPCs without the TEST-only approval package.
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const LIVE_REF='abcdefghijklmnopqrst',TEST_REF='mojnqizbcaczstguikpv',KEY='e7'.repeat(32),TENANT='sarberki-live';
const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
const ids={writer:'11111111-1111-4111-8111-111111111111',approver:'22222222-2222-4222-8222-222222222222'};
const sessions={writer:'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',approver:'aaaaaaaa-aaaa-4aaa-8aaa-000000000002'};
const BOOT=`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);
create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;grant select on auth.sessions to authenticated;`;
const block=sql=>{const a=sql.indexOf('-- Disposable server-only signing material'),b=sql.indexOf('-- Only this specialized RPC');return sql.slice(a,b).trimEnd();};

async function liveProject(){
 const db=new PGlite();await db.exec(BOOT);
 await db.exec(await read('supabase/migrations/202610090001_case_store.sql'));
 await db.exec(`begin;select set_config('sarberki.deployment_environment','live',true),set_config('sarberki.deployment_project_ref','${LIVE_REF}',true);`
  +await read('deployment/deployment-profile/install.sql')+'commit;');
 return db;
}
function fixture(n,{to='info@sarberkito.hu',scope='live-mailbox-source-v1',tenant=TENANT}={}){
 const id='18f2a0b1c2d3f5'+String(n).padStart(2,'0'),text='Jó napot! Faházat szeretnénk 2027-05-14 és 2027-05-16 között 2 felnőtt számára. (kitalált '+n+')';
 const source={provider:'gmail',mailbox_id:'sarberkito_info',message_id:id,thread_id:id,rfc_message_id:'<fictional-live-'+n+'@example.test>',
  in_reply_to:null,references:[],subject:'Érdeklődés',from:'Vendég <guest'+n+'@example.test>',from_email:'guest'+n+'@example.test',to,received_at:'2026-11-03T10:00:00.000Z'};
 const envelope={sender:source.from_email,text,mailbox_id:source.mailbox_id,message_id:id,thread_id:id,rfc_message_id:source.rfc_message_id,references:[],received_at:source.received_at};
 const checkedAt=new Date().toISOString(),bodySha256=sha(text);
 const fields=[scope,tenant,source.mailbox_id,id,id,source.rfc_message_id,source.from_email,to,source.subject,source.received_at,bodySha256,checkedAt];
 const proof={scope,checkedAt,bodySha256,attestation:createHmac('sha256',Buffer.from(KEY,'hex')).update(fields.join('\n')).digest('hex')};
 const caseId='live-case-'+n;
 return {caseId,data:{id:caseId,tenantId:tenant,sender:source.from_email,state:{approval:'pending',values:{}},messages:[envelope],drafts:[{text:'Kedves Vendégünk! (kitalált tervezet)'}],sourceReceipt:source},proof};
}

test('mailbox-attestation block is a verbatim copy of the TEST approval package',async()=>{
 const live=await read('deployment/mailbox-attestation/install.sql'),testPkg=await read('deployment/cloud-approval/install.sql');
 const shared=live.match(/-- BEGIN SHARED ATTESTATION BLOCK\n([\s\S]*?)-- END SHARED ATTESTATION BLOCK/u)[1].trimEnd();
 assert.ok(shared.length>500);assert.equal(shared,block(testPkg));
});

test('mailbox-attestation requires the deployment profile',async()=>{
 const db=new PGlite();await db.exec(BOOT);await db.exec(await read('supabase/migrations/202610090001_case_store.sql'));
 await assert.rejects(db.exec(await read('deployment/mailbox-attestation/install.sql')),/DEPLOYMENT_PROFILE_REQUIRED/);await db.exec('rollback');
 assert.equal((await db.query("select to_regclass('public.sc_isolated_approval_key') r")).rows[0].r,null);
});

test('LIVE project: profile → attestation → mailbox RPCs; only the live tenant, mailbox, scope and issuer are accepted',async t=>{
 const db=await liveProject();
 const claims=(role,ref=LIVE_REF)=>({sub:ids[role],role:'authenticated',iss:`https://${ref}.supabase.co/auth/v1`,session_id:sessions[role],exp:Math.floor(Date.now()/1000)+3600});
 const as=async(role,fn,ref)=>{await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims(role,ref))]);try{return await fn();}finally{await db.exec('reset role');}};
 const create=(f,{role='writer',tenant=TENANT,ref}={})=>as(role,async()=>(await db.query('select sc_tm_create($1,$2,$3,$4) r',[tenant,f.caseId,JSON.stringify(f.data),JSON.stringify(f.proof)])).rows[0].r,ref);
 const denied=code=>error=>error.code===code||assert.fail('expected '+code+' got '+error.code+' '+error.message);
 await db.exec("insert into sc_tenants(tenant_id,name) values('sarberki-live','Sárberki (kitalált próba)')");
 await db.exec(await read('deployment/mailbox-attestation/install.sql'));
 await db.query('insert into sc_isolated_approval_key(key_hex) values($1)',[KEY]);
 for(const role of Object.keys(ids)){await db.query('insert into auth.users values($1)',[ids[role]]);await db.query('insert into auth.sessions values($1,$2,null)',[sessions[role],ids[role]]);}
 await db.exec(await read('deployment/approver-role/install.sql'));// approve-only role (no write) like on TEST
 await db.query("insert into sc_memberships values('sarberki-live',$1,true,true,false),('sarberki-live',$2,true,false,true)",[ids.writer,ids.approver]);
 const install=await read('deployment/test-mailbox/install.sql');
 await t.test('install binds to the live project ref, not the TEST one',async()=>{
  await db.query("select set_config('sarberki.tm_install_project_ref',$1,false),set_config('sarberki.tm_backup_sha256',$2,false)",[TEST_REF,'c'.repeat(64)]);
  await assert.rejects(db.exec(install),/verified test project/);await db.exec('rollback');
  await db.query("select set_config('sarberki.tm_install_project_ref',$1,false)",[LIVE_REF]);
  await db.exec(install);
  assert.equal(await db.query("select to_regclass('public.sc_cloud_approval_binding') r").then(r=>r.rows[0].r),null,'no TEST approval package in LIVE');
  assert.equal(await db.query("select to_regprocedure('public.sc_approve_case(text,text,bigint,text,jsonb)') r").then(r=>r.rows[0].r),null);
 });
 await t.test('default off, then a live-attested fictional message is saved once',async()=>{
  const a=fixture(1);
  await assert.rejects(create(a),denied('42501'));
  await db.exec('update sc_test_mailbox_config set enabled=true');
  const saved=await create(a);assert.equal(saved.revision,1);
  const row=(await db.query('select data from sc_cases where tenant_id=$1 and case_id=$2',[TENANT,a.caseId])).rows[0].data;
  assert.equal(row.testMailbox.scope,'live-mailbox-source-v1');assert.equal(row.state.approval,'pending');
  await assert.rejects(create(a),denied('23505'));
 });
 await t.test('negatives: TEST scope, TEST mailbox, TEST tenant, TEST issuer, forged attestation',async()=>{
  await assert.rejects(create(fixture(2,{scope:'test-mailbox-source-v1'})),denied('42501'));
  await assert.rejects(create(fixture(3,{to:'sarberkiprojecttest@gmail.com'})),denied('22023'));
  await assert.rejects(create(fixture(4,{tenant:'sarberki-test'}),{tenant:'sarberki-test'}),denied('42501'));
  await assert.rejects(create(fixture(5),{ref:TEST_REF}),denied('42501'));
  const forged=fixture(6);forged.proof.attestation='0'.repeat(64);
  await assert.rejects(create(forged),denied('42501'));
  assert.equal((await db.query('select count(*)::int n from sc_cases')).rows[0].n,1);
 });
 await t.test('independent decision: the draft author cannot approve, an approve-only member can (internal only)',async()=>{
  const id='live-case-1',hash=sha('Kedves Vendégünk! (kitalált tervezet)');
  const decide=role=>as(role,async()=>(await db.query('select sc_tm_decide($1,$2,1,$3,$4,null) r',[TENANT,id,hash,'approve'])).rows[0].r);
  await assert.rejects(decide('writer'),denied('42501'));
  const result=await decide('approver');
  assert.equal(result.data.state.approval,'approved_internal');
  assert.deepEqual([result.data.internalApproval.sendAllowed,result.data.internalApproval.bookingAllowed],[false,false]);
 });
});
