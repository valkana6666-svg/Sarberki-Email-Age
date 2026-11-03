import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {installDeploymentProfile} from './deployment-profile-fixture.mjs';
import {ingestTestMailboxMessage} from '../shared-core/server-test-mailbox-case.mjs';

// End-to-end on real PostgreSQL semantics (PGlite) with the hosted TEST layer stack: fictional Gmail API
// -> WP2 server read + attestation -> shared engine draft -> WP3 sc_tm_create under the operator's own
// session. No hosted service, no Gmail account, no send.
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const KEY='e5'.repeat(32),ID='18f2a0b1c2d3e4f5',TOKEN='ya29.SYNTHETIC_TEST_ONLY_TOKEN_0123456789';
const users={writer:['11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-000000000001',[true,true,false]],reader:['22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-000000000002',[true,false,false]]};
const b64=text=>Buffer.from(text).toString('base64url');
const TEXT='Jó napot! Deluxe faházat szeretnénk foglalni 2027-05-14 és 2027-05-16 között 2 felnőtt, 0 gyermek számára.';
const gmail=(subject='Sárberki élő teszt – AI előnézet')=>async url=>{
 const u=new URL(url);if(u.pathname.endsWith('/profile'))return new Response(JSON.stringify({emailAddress:'sarberkiprojecttest@gmail.com'}));
 return new Response(JSON.stringify({id:ID,threadId:ID,labelIds:['INBOX'],internalDate:String(Date.parse('2026-10-31T10:00:00Z')),payload:{mimeType:'multipart/alternative',
  headers:[{name:'Subject',value:subject},{name:'From',value:'Teszt <sender@example.test>'},{name:'To',value:'sarberkiprojecttest@gmail.com'},{name:'Message-ID',value:'<f1@example.test>'}],
  parts:[{mimeType:'text/plain',body:{data:b64(TEXT)}}]}}));
};

test('WP4a module output is accepted by sc_tm_create; reader, disabled switch, wrong key and duplicates are refused',async()=>{
 const db=new PGlite();
 const transport=role=>async(path,{body})=>{
  assert.equal(path,'/rest/v1/rpc/sc_tm_create');const [id,session]=users[role];
  await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,role:'authenticated',iss:'https://mojnqizbcaczstguikpv.supabase.co/auth/v1',session_id:session,exp:Math.floor(Date.now()/1000)+3600})]);
  try{return (await db.query('select sc_tm_create($1,$2,$3,$4) r',[body.p_tenant,body.p_case,JSON.stringify(body.p_data),JSON.stringify(body.p_proof)])).rows[0].r;}
  catch(error){throw Object.assign(Error('rpc'),{code:error.code==='42501'?'FORBIDDEN':'SQL'});}
  finally{await db.exec('reset role');}
 };
 const ingest=(role,options={})=>ingestTestMailboxMessage({token:TOKEN,messageId:ID,transport:transport(role),attestationKey:KEY,fetchImpl:gmail(),...options});
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  await db.exec(await read('supabase/migrations/202610090001_case_store.sql'));
  await db.query("select set_config('sarberki.approval_install_project_ref','mojnqizbcaczstguikpv',false),set_config('sarberki.approval_backup_sha256',$1,false),set_config('sarberki.receipt_install_project_ref','mojnqizbcaczstguikpv',false),set_config('sarberki.receipt_backup_sha256',$1,false),set_config('sarberki.tm_install_project_ref','mojnqizbcaczstguikpv',false),set_config('sarberki.tm_backup_sha256',$1,false)",['b'.repeat(64)]);
  await db.exec("insert into sc_tenants values('sarberki-test','Fictional',true)");await installDeploymentProfile(db);
  for(const file of ['deployment/cloud-approval/install.sql','deployment/cloud-approval/separate-approver-permission.sql','deployment/exact-receipt/install.sql'])await db.exec(await read(file));
  await db.query('insert into sc_isolated_approval_key(key_hex) values($1)',[KEY]);
  await db.exec(await read('deployment/test-mailbox/install.sql'));
  for(const [id,session,[r,w,a]] of Object.values(users)){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into auth.sessions values($1,$2,null)',[session,id]);await db.query("insert into sc_memberships values('sarberki-test',$1,$2,$3,$4)",[id,r,w,a]);}
  await assert.rejects(ingest('writer'),error=>error.code==='FORBIDDEN','switch off by default');
  await db.exec('update sc_test_mailbox_config set enabled=true');
  await assert.rejects(ingest('reader'),error=>error.code==='FORBIDDEN');
  await assert.rejects(ingest('writer',{attestationKey:'d4'.repeat(32)}),error=>error.code==='FORBIDDEN','key not known to the database');
  await assert.rejects(ingest('writer',{fetchImpl:gmail('Re: Sárberki élő teszt')}),error=>error.code==='NOT_MARKED_TEST_MESSAGE');
  assert.equal((await db.query('select count(*)::int n from sc_cases')).rows[0].n,0);
  const result=await ingest('writer');assert.deepEqual({...result,revision:Number(result.revision)},{caseId:'tm-'+ID,revision:1});
  const data=(await db.query('select data from sc_cases where case_id=$1',['tm-'+ID])).rows[0].data;
  assert.equal(data.state.approval,'pending');assert.equal(data.drafts.length,1);assert.equal(data.drafts[0].createdBy,users.writer[0]);
  assert.match(data.drafts[0].text,/Kedves Vendégünk/);assert.equal(data.state.values.arrival,'2027-05-14');assert.equal(data.messages[0].text,TEXT);
  for(const secret of [TOKEN,KEY])assert.equal(JSON.stringify(data).includes(secret),false);
  assert.deepEqual((await db.query('select kind from sc_audit where case_id=$1',['tm-'+ID])).rows.map(r=>r.kind),['tm_create']);
  await assert.rejects(ingest('writer'),error=>error.code==='STORAGE_FAILURE','duplicate message, fixed code only');
 }finally{await db.close();}
});
