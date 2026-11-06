import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {serverDeployment} from '../shared-core/server-deployment.mjs';
import {MAILBOX_PROFILES} from '../shared-core/server-mailbox-profiles.mjs';
import {PGlite} from '@electric-sql/pglite';
import {attestTestMailboxSource} from '../shared-core/server-gmail-source.mjs';

// Live store slice 2, step 2: the test-mailbox layer on top of an installed TEST deployment profile.
// Real PostgreSQL (PGlite), fictional data only. The legacy (no profile) path is covered by test-mailbox-sql-pglite.
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const REF='mojnqizbcaczstguikpv',project='https://'+REF+'.supabase.co',KEY='e5'.repeat(32),TENANT='sarberki-test';
const ids={writer:'11111111-1111-4111-8111-111111111111',approver:'22222222-2222-4222-8222-222222222222'};
const sessions={writer:'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',approver:'aaaaaaaa-aaaa-4aaa-8aaa-000000000002'};
const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
function fixture(n,to='sarberkiprojecttest@gmail.com'){
 const messageId='18f2a0b1c2d3e6'+String(n).padStart(2,'0');
 const source={provider:'gmail',mailbox_id:'sarberki_gmail_test',message_id:messageId,thread_id:messageId,rfc_message_id:'<fictional-profile-'+n+'@example.test>',
  in_reply_to:null,references:[],subject:'Érdeklődés',from:'Teszt <sarberkito@gmail.com>',from_email:'sarberkito@gmail.com',to,received_at:'2026-11-06T08:00:00.000Z'};
 const envelope={sender:source.from_email,text:'Jó napot! Faházat szeretnénk 2 főre.',mailbox_id:source.mailbox_id,message_id:messageId,thread_id:messageId,rfc_message_id:source.rfc_message_id,references:[],received_at:source.received_at};
 const caseId='tm-profile-'+n;
 const data={id:caseId,tenantId:TENANT,sender:source.from_email,state:{approval:'pending',values:{}},messages:[envelope],drafts:[{text:'Kedves Vendégünk! (kitalált '+n+')'}],sourceReceipt:source};
 return {caseId,data,proof:attestTestMailboxSource({key:KEY,tenantId:TENANT,source,envelope,checkedAt:new Date().toISOString()})};
}

test('test-mailbox on a TEST deployment profile: same flow, issuer/session/mailbox from the profile',async()=>{
 const db=new PGlite();
 const claims=(role,extra={})=>({sub:ids[role],role:'authenticated',iss:project+'/auth/v1',session_id:sessions[role],exp:Math.floor(Date.now()/1000)+3600,...extra});
 const as=async(role,fn,extra)=>{await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims(role,extra))]);try{return await fn();}finally{await db.exec('reset role');}};
 const one=(role,sql,params,extra)=>as(role,async()=>(await db.query(sql,params)).rows[0].r,extra);
 const create=(f,extra)=>one('writer','select sc_tm_create($1,$2,$3,$4) r',[TENANT,f.caseId,JSON.stringify(f.data),JSON.stringify(f.proof)],extra);
 const denied=code=>error=>error.code===code||assert.fail('expected '+code+' got '+error.code+' '+error.message);
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;grant select on auth.sessions to authenticated;`);
  await db.exec(await read('supabase/migrations/202610090001_case_store.sql'));
  await db.exec("begin;select set_config('sarberki.deployment_environment','test',true);select set_config('sarberki.deployment_project_ref','"+REF+"',true);"+await read('deployment/deployment-profile/install.sql')+'commit;');
  await db.query("select set_config('sarberki.approval_install_project_ref',$1,false),set_config('sarberki.approval_backup_sha256',$2,false),set_config('sarberki.receipt_install_project_ref',$1,false),set_config('sarberki.receipt_backup_sha256',$2,false),set_config('sarberki.tm_install_project_ref',$1,false),set_config('sarberki.tm_backup_sha256',$2,false)",[REF,'b'.repeat(64)]);
  await db.exec("insert into sc_tenants values('sarberki-test','Fictional',true),('demo-test','Fictional other',true)");
  for(const f of ['deployment/cloud-approval/install.sql','deployment/cloud-approval/separate-approver-permission.sql','deployment/exact-receipt/install.sql'])await db.exec(await read(f));
  await db.query('insert into sc_isolated_approval_key(key_hex) values($1)',[KEY]);
  for(const [role,id] of Object.entries(ids)){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into auth.sessions values($1,$2,null)',[sessions[role],id]);}
  await db.query('insert into sc_memberships values($1,$2,true,true,false),($1,$3,true,false,true)',[TENANT,ids.writer,ids.approver]);
  const install=await read('deployment/test-mailbox/install.sql');
  await db.query("select set_config('sarberki.tm_install_project_ref','otherxprojectxrefxab',false)");
  await assert.rejects(db.exec(install),/verified test project/,'install bound to the profile project');await db.exec('rollback');
  await db.query("select set_config('sarberki.tm_install_project_ref',$1,false)",[REF]);
  await db.exec(install);await db.exec('update sc_test_mailbox_config set enabled=true');
  await t_flow();
  async function t_flow(){
   const a=fixture(1);
   assert.equal((await create(a)).revision,1);
   await one('approver','select sc_tm_decide($1,$2,$3,$4,$5,$6) r',[TENANT,a.caseId,1,sha(a.data.drafts[0].text),'approve',null]);
   assert.equal((await db.query('select data from sc_cases where case_id=$1',[a.caseId])).rows[0].data.state.approval,'approved_internal');
   // Token of another project, expired, or revoked session: refused by the profile guard.
   const b=fixture(2);
   await assert.rejects(create(b,{iss:'https://otherxprojectxrefxab.supabase.co/auth/v1'}),denied('42501'));
   await assert.rejects(create(b,{exp:Math.floor(Date.now()/1000)-5}),denied('42501'));
   await assert.rejects(one('writer','select sc_tm_create($1,$2,$3,$4) r',['demo-test',b.caseId,JSON.stringify(b.data),JSON.stringify(b.proof)]),denied('42501'),'only the profile tenant');
   // Mailbox from the profile: a source addressed elsewhere is refused.
   const c=fixture(3,'info@sarberkito.hu');
   await assert.rejects(create(c),denied('22023'));
   await db.query('update auth.sessions set not_after=now()-interval \'1 second\' where id=$1',[sessions.writer]);
   await assert.rejects(create(b),denied('42501'),'revoked session');
   await db.exec('update sc_test_mailbox_config set enabled=false');
   await assert.rejects(one('approver','select sc_tm_decide($1,$2,$3,$4,$5,$6) r',[TENANT,a.caseId,2,sha(a.data.drafts[0].text),'approve',null]),denied('42501'),'switch off');
  }
 }finally{await db.close();}
});

test('LIVE profile project: the minimal path installs and works for sarberki-live / info@ only; TEST-only routes refuse',async()=>{
 const LREF='livexprojectxrefxabc',liss='https://'+LREF+'.supabase.co/auth/v1',LT='sarberki-live';
 const db=new PGlite();
 const claims=(role,extra={})=>({sub:ids[role],role:'authenticated',iss:liss,session_id:sessions[role],exp:Math.floor(Date.now()/1000)+3600,...extra});
 const as=async(role,fn,extra)=>{await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims(role,extra))]);try{return await fn();}finally{await db.exec('reset role');}};
 const one=(role,sql,params,extra)=>as(role,async()=>(await db.query(sql,params)).rows[0].r,extra);
 const denied=code=>error=>error.code===code||assert.fail('expected '+code+' got '+error.code+' '+error.message);
 // The JS attester with a LIVE deployment (slice 2, step 4b) must produce what the database recomputes.
 const liveDeployment=serverDeployment({SARBERKI_DEPLOYMENT:'live',SARBERKI_LIVE_ORIGIN:'https://sarberki-live.example.app',SARBERKI_LIVE_SUPABASE_URL:'https://'+LREF+'.supabase.co'},
  {profiles:{...MAILBOX_PROFILES,'sarberki-live':{...MAILBOX_PROFILES['sarberki-live'],enabled:true}}});
 const liveProof=(source,envelope)=>attestTestMailboxSource({key:KEY,tenantId:LT,source,envelope,checkedAt:new Date().toISOString(),deployment:liveDeployment});
 const liveFixture=(n,to='info@sarberkito.hu')=>{
  const messageId='28f2a0b1c2d3e6'+String(n).padStart(2,'0');
  const source={provider:'gmail',mailbox_id:'sarberki_gmail_live',message_id:messageId,thread_id:messageId,rfc_message_id:'<fictional-live-'+n+'@example.test>',
   in_reply_to:null,references:[],subject:'Érdeklődés',from:'Kitalált Vendég <guest@example.test>',from_email:'guest@example.test',to,received_at:'2026-11-06T08:00:00.000Z'};
  const envelope={sender:source.from_email,text:'Jó napot! Faházat szeretnénk 2 főre. (kitalált)',mailbox_id:source.mailbox_id,message_id:messageId,thread_id:messageId,rfc_message_id:source.rfc_message_id,references:[],received_at:source.received_at};
  const caseId='tm-live-'+n;
  return {caseId,data:{id:caseId,tenantId:LT,sender:source.from_email,state:{approval:'pending',values:{}},messages:[envelope],drafts:[{text:'Kedves Vendégünk! (kitalált)'}],sourceReceipt:source},
   proof:liveProof(source,envelope)};
 };
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;grant select on auth.sessions to authenticated;`);
  await db.exec(await read('supabase/migrations/202610090001_case_store.sql'));
  await db.exec("begin;select set_config('sarberki.deployment_environment','live',true);select set_config('sarberki.deployment_project_ref','"+LREF+"',true);"+await read('deployment/deployment-profile/install.sql')+'commit;');
  await db.query("insert into sc_tenants(tenant_id,name) values($1,'Sárberki éles (kitalált próba)')",[LT]);
  await db.query("select set_config('sarberki.approval_install_project_ref','mojnqizbcaczstguikpv',false),set_config('sarberki.approval_backup_sha256',$1,false)",['b'.repeat(64)]);
  await assert.rejects(db.exec(await read('deployment/cloud-approval/install.sql')),/verified test project/,'TEST ref refused on LIVE');await db.exec('rollback');
  await db.query("select set_config('sarberki.approval_install_project_ref',$1,false),set_config('sarberki.tm_install_project_ref',$1,false),set_config('sarberki.tm_backup_sha256',$2,false)",[LREF,'b'.repeat(64)]);
  await db.exec(await read('deployment/cloud-approval/install.sql'));
  await db.exec(await read('deployment/cloud-approval/separate-approver-permission.sql'));
  await db.query('insert into sc_isolated_approval_key(key_hex) values($1)',[KEY]);
  await db.exec(await read('deployment/test-mailbox/install.sql'));await db.exec('update sc_test_mailbox_config set enabled=true');
  for(const [role,id] of Object.entries(ids)){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into auth.sessions values($1,$2,null)',[sessions[role],id]);}
  await db.query('insert into sc_memberships values($1,$2,true,true,false),($1,$3,true,false,true)',[LT,ids.writer,ids.approver]);
  const a=liveFixture(1);
  assert.equal((await one('writer','select sc_tm_create($1,$2,$3,$4) r',[LT,a.caseId,JSON.stringify(a.data),JSON.stringify(a.proof)])).revision,1);
  await one('approver','select sc_tm_decide($1,$2,$3,$4,$5,$6) r',[LT,a.caseId,1,sha(a.data.drafts[0].text),'approve',null]);
  assert.equal((await db.query('select data from sc_cases where case_id=$1',[a.caseId])).rows[0].data.state.approval,'approved_internal');
  const b=liveFixture(2,'sarberkiprojecttest@gmail.com');
  await assert.rejects(one('writer','select sc_tm_create($1,$2,$3,$4) r',[LT,b.caseId,JSON.stringify(b.data),JSON.stringify(b.proof)]),denied('22023'),'TEST mailbox refused on LIVE');
  const c=liveFixture(3);
  await assert.rejects(one('writer','select sc_tm_create($1,$2,$3,$4) r',[LT,c.caseId,JSON.stringify(c.data),JSON.stringify(c.proof)],{iss:project+'/auth/v1'}),denied('42501'),'TEST-project token refused');
  await assert.rejects(one('approver',"select sc_approve_case('sarberki-test','x',1,$1) r",['a'.repeat(64)]),()=>true,'legacy synthetic approval is TEST-only');
  await assert.rejects(db.query("insert into sc_tenants(tenant_id,name,test_only) values('sarberki-test','X',true)"),/LIVE_TENANT_ONLY/);
 }finally{await db.close();}
});
