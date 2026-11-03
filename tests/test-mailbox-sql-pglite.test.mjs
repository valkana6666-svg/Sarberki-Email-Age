import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {attestTestMailboxSource} from '../shared-core/server-gmail-source.mjs';

// Real PostgreSQL semantics (PGlite) on the same layer stack as the hosted TEST project:
// case store -> cloud-approval -> separate approver -> exact-receipt -> test-mailbox. Fictional data only.
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const project='https://mojnqizbcaczstguikpv.supabase.co',KEY='e5'.repeat(32),TENANT='sarberki-test';
const ids={writer:'11111111-1111-4111-8111-111111111111',approver:'22222222-2222-4222-8222-222222222222',both:'33333333-3333-4333-8333-333333333333',
 reader:'44444444-4444-4444-8444-444444444444',outsider:'55555555-5555-4555-8555-555555555555',demo:'66666666-6666-4666-8666-666666666666',writer2:'77777777-7777-4777-8777-777777777777'};
const sessions=Object.fromEntries(Object.keys(ids).map((role,i)=>[role,'aaaaaaaa-aaaa-4aaa-8aaa-'+String(i+1).padStart(12,'0')]));
// Slice 2: the tenant comes from the immutable deployment profile, installed before test-mailbox.
const profile=async(db,env='test')=>db.exec("begin;select set_config('sarberki.deployment_environment','"+env+"',true),set_config('sarberki.deployment_project_ref','mojnqizbcaczstguikpv',true);"+await readFile(new URL('../deployment/deployment-profile/install.sql',import.meta.url),'utf8')+'commit;');
const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');

function fixture(n,{text='Jó napot! Deluxe faházat szeretnénk 2027-05-14 és 2027-05-16 között 2 felnőtt számára.',subject='Sárberki élő teszt – AI előnézet'}={}){
 const messageId=('18f2a0b1c2d3e4'+String(n).padStart(2,'0'));
 const source={provider:'gmail',mailbox_id:'sarberki_gmail_test',message_id:messageId,thread_id:messageId,rfc_message_id:'<fictional-'+n+'@example.test>',
  in_reply_to:null,references:[],subject,from:'Teszt <sender@example.test>',from_email:'sender@example.test',to:'sarberkiprojecttest@gmail.com',received_at:'2026-10-31T10:00:00.000Z'};
 const envelope={sender:source.from_email,text,mailbox_id:source.mailbox_id,message_id:messageId,thread_id:messageId,rfc_message_id:source.rfc_message_id,references:[],received_at:source.received_at};
 const caseId='tm-case-'+n;
 const data={id:caseId,tenantId:TENANT,sender:source.from_email,state:{approval:'pending',values:{}},messages:[envelope],drafts:[{text:'Kedves Vendégünk! (kitalált tervezet '+n+')'}],sourceReceipt:source};
 const proof=attestTestMailboxSource({key:KEY,tenantId:TENANT,source,envelope,checkedAt:new Date().toISOString()});
 return {caseId,source,envelope,data,proof};
}

test('test-mailbox SQL: attested create, independent decisions, return/reject/reopen, audit, isolation and rollback on real PostgreSQL',async t=>{
 const db=new PGlite();
 const claims=(role,extra={})=>({sub:ids[role],role:'authenticated',iss:project+'/auth/v1',session_id:sessions[role],exp:Math.floor(Date.now()/1000)+3600,...extra});
 const as=async(role,fn,extra)=>{await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims(role,extra))]);try{return await fn();}finally{await db.exec('reset role');}};
 const create=(role,f,{tenant=TENANT,proof=f.proof,data=f.data,caseId=f.caseId,extra}={})=>as(role,async()=>(await db.query('select sc_tm_create($1,$2,$3,$4) r',[tenant,caseId,JSON.stringify(data),JSON.stringify(proof)])).rows[0].r,extra);
 const redraft=(role,caseId,expected,draft,extra)=>as(role,async()=>(await db.query('select sc_tm_redraft($1,$2,$3,$4) r',[TENANT,caseId,expected,JSON.stringify(draft)])).rows[0].r,extra);
 const decide=(role,caseId,expected,hash,decision,{reason=null,extra,tenant=TENANT}={})=>as(role,async()=>(await db.query('select sc_tm_decide($1,$2,$3,$4,$5,$6) r',[tenant,caseId,expected,hash,decision,reason])).rows[0].r,extra);
 const row=async caseId=>(await db.query('select revision,data,updated_by from sc_cases where tenant_id=$1 and case_id=$2',[TENANT,caseId])).rows[0];
 const audit=async caseId=>(await db.query('select revision,actor,kind from sc_audit where tenant_id=$1 and case_id=$2 order by revision',[TENANT,caseId])).rows;
 const denied=code=>error=>error.code===code||assert.fail('expected '+code+' got '+error.code+' '+error.message);
 const latestHash=async caseId=>sha((await row(caseId)).data.drafts.at(-1).text);
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
  const memberships={writer:[TENANT,true,true,false],writer2:[TENANT,true,true,false],approver:[TENANT,true,false,true],both:[TENANT,true,true,true],reader:[TENANT,true,false,false],demo:['demo-test',true,true,true]};
  for(const [role,id] of Object.entries(ids)){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into auth.sessions values($1,$2,null)',[sessions[role],id]);
   if(memberships[role])await db.query('insert into sc_memberships values($1,$2,$3,$4,$5)',[memberships[role][0],id,...memberships[role].slice(1)]);}
  const writerBefore=(await db.query("select prosrc from pg_proc where oid='sc_write_case(text,text,bigint,jsonb)'::regprocedure")).rows[0].prosrc;
  const install=await read('deployment/test-mailbox/install.sql');
  await t.test('install requires the deployment profile, then names no tenant literal',async()=>{
   await db.query("select set_config('sarberki.tm_install_project_ref','mojnqizbcaczstguikpv',false),set_config('sarberki.tm_backup_sha256',$1,false)",['c'.repeat(64)]);
   await assert.rejects(db.exec(install),/DEPLOYMENT_PROFILE_REQUIRED/);await db.exec('rollback');
   assert.equal((await db.query("select to_regclass('public.sc_test_mailbox_config') r")).rows[0].r,null,'nothing installed without a profile');
   for(const literal of ["'sarberki-test'","'sarberkiprojecttest@gmail.com'","'mojnqizbcaczstguikpv'","'test-mailbox-source-v1'"])
    assert.equal(install.includes(literal),false,literal+' comes from the deployment profile');
   await profile(db,'test');
  });
  await t.test('install requires the verified project, backup and attestation key',async()=>{
   await db.query("select set_config('sarberki.tm_install_project_ref','wrong',false),set_config('sarberki.tm_backup_sha256',$1,false)",['c'.repeat(64)]);
   await assert.rejects(db.exec(install),/verified test project/);await db.exec('rollback');
   await db.query("select set_config('sarberki.tm_install_project_ref','mojnqizbcaczstguikpv',false),set_config('sarberki.tm_backup_sha256','',false)");
   await assert.rejects(db.exec(install),/verified test project/);await db.exec('rollback');
   await db.query("select set_config('sarberki.tm_backup_sha256',$1,false)",['c'.repeat(64)]);await db.exec(install);
   assert.equal((await db.query("select prosrc from pg_proc where oid='sc_write_case(text,text,bigint,jsonb)'::regprocedure")).rows[0].prosrc,writerBefore,'sc_write_case unchanged');
  });
  const a=fixture(1);
  await t.test('default off: nothing works until the owner enables the switch',async()=>{
   await assert.rejects(create('writer',a),denied('42501'));
   await db.exec('update sc_test_mailbox_config set enabled=true');
  });
  await t.test('clients cannot read/alter the registry or switch, nor call the internal guard; service_role cannot execute',async()=>{
   for(const role of ['authenticated','anon']){await db.exec('set role '+role);try{
    for(const sql of ['select * from sc_test_mailbox_cases','select * from sc_test_mailbox_config','update sc_test_mailbox_config set enabled=false',"select sc_tm_actor('sarberki-test','write')"])await assert.rejects(db.query(sql),denied('42501'));
   }finally{await db.exec('reset role');}}
   await db.exec('set role anon');try{await assert.rejects(db.query("select sc_tm_create('sarberki-test','x',null,null)"),denied('42501'));}finally{await db.exec('reset role');}
   const priv=(await db.query("select has_function_privilege('service_role','sc_tm_create(text,text,jsonb,jsonb)','execute') c,has_function_privilege('service_role','sc_tm_decide(text,text,bigint,text,text,text)','execute') d")).rows[0];
   assert.deepEqual(priv,{c:false,d:false});
  });
  await t.test('1. an attested fictional test mail is saved once, with registry, message key and audit',async()=>{
   const saved=await create('writer',a);assert.equal(saved.revision,1);
   const r=await row(a.caseId);assert.equal(r.data.state.approval,'pending');assert.equal(r.data.drafts[0].createdBy,ids.writer);
   assert.deepEqual(r.data.testMailbox,{scope:'test-mailbox-source-v1',checkedAt:a.proof.checkedAt,bodySha256:sha(a.envelope.text),createdBy:ids.writer});
   assert.deepEqual(r.data.decisions,[]);
   assert.equal(JSON.stringify(r.data).includes(KEY),false);assert.equal(JSON.stringify(r.data).includes(a.proof.attestation),false,'no attestation/secret stored');
   assert.equal((await db.query('select count(*)::int n from sc_test_mailbox_cases')).rows[0].n,1);
   assert.equal((await db.query('select case_id from sc_message_keys where message_id=$1',[a.source.message_id])).rows[0].case_id,a.caseId);
   const log=await audit(a.caseId);assert.equal(log.length,1);assert.equal(log[0].kind,'tm_create');assert.equal(log[0].actor,ids.writer);assert.equal(Number(log[0].revision),1);
   await assert.rejects(create('writer',a),denied('23505'),'duplicate message');
  });
  await t.test('2. forged, modified, stale or browser-made attestations are rejected',async()=>{
   const b=fixture(2),nowIso=()=>new Date().toISOString();
   const variants=[
    ['wrong attestation',{proof:{...b.proof,attestation:'0'.repeat(64)}}],
    ['browser key',{proof:attestTestMailboxSource({key:randomBytes(32).toString('hex'),tenantId:TENANT,source:b.source,envelope:b.envelope,checkedAt:nowIso()})}],
    ['modified text',{data:{...b.data,messages:[{...b.envelope,text:b.envelope.text+' módosítva'}]}}],
    ['modified subject',{data:{...b.data,sourceReceipt:{...b.source,subject:'Sárberki élő teszt – más'}}}],
    ['other scope',{proof:{...b.proof,scope:'clarification-only-v1'}}],
    ['stale checkedAt',{proof:attestTestMailboxSource({key:KEY,tenantId:TENANT,source:b.source,envelope:b.envelope,checkedAt:new Date(Date.now()-180000).toISOString()})}],
    ['future checkedAt',{proof:attestTestMailboxSource({key:KEY,tenantId:TENANT,source:b.source,envelope:b.envelope,checkedAt:new Date(Date.now()+60000).toISOString()})}],
    ['missing proof',{proof:null}]
   ];
   for(const [name,change] of variants)await assert.rejects(create('writer',b,change),denied('42501'),name);
   for(const [name,data] of [['two messages',{...b.data,messages:[b.envelope,b.envelope]}],['reserved key',{...b.data,testMailbox:{forged:true}}],['pre-approved',{...b.data,state:{approval:'approved_internal'}}],
    ['synthetic sender namespace',{...b.data,sender:'x@fixture.invalid',sourceReceipt:{...b.source,from_email:'x@fixture.invalid'},messages:[{...b.envelope,sender:'x@fixture.invalid'}]}],['reply',{...b.data,sourceReceipt:{...b.source,in_reply_to:'<a@b>'}}]])
    await assert.rejects(create('writer',b,{data}),error=>['22023','42501'].includes(error.code)||assert.fail(name+' '+error.code));
   // A correctly attested sender in the synthetic .invalid namespace is still refused (namespaces stay disjoint).
   const inv=fixture(12),invSource={...inv.source,from_email:'guest@fixture.invalid',from:'guest@fixture.invalid'},invEnvelope={...inv.envelope,sender:'guest@fixture.invalid'};
   const invProof=attestTestMailboxSource({key:KEY,tenantId:TENANT,source:invSource,envelope:invEnvelope,checkedAt:new Date().toISOString()});
   await assert.rejects(create('writer',inv,{data:{...inv.data,sender:'guest@fixture.invalid',sourceReceipt:invSource,messages:[invEnvelope]},proof:invProof}),denied('22023'));
   assert.equal(await row(b.caseId),undefined,'nothing stored');
  });
  await t.test('3. foreign tenant, reader, outsider and approver-only cannot create',async()=>{
   const c=fixture(3);
   await assert.rejects(create('writer',c,{tenant:'demo-test',data:{...c.data,tenantId:'demo-test'}}),denied('42501'));
   await assert.rejects(create('demo',c,{tenant:'demo-test',data:{...c.data,tenantId:'demo-test'}}),denied('42501'));
   for(const role of ['reader','outsider','approver'])await assert.rejects(create(role,c),denied('42501'),role);
  });
  await t.test('5. expired or revoked sessions are rejected',async()=>{
   const d=fixture(5);
   await assert.rejects(create('writer',d,{extra:{exp:Math.floor(Date.now()/1000)-1}}),denied('42501'));
   await assert.rejects(create('writer',d,{extra:{iss:'https://other.supabase.co/auth/v1'}}),denied('42501'));
   await db.query('update auth.sessions set not_after=now()-interval \'1 minute\' where id=$1',[sessions.writer]);
   await assert.rejects(create('writer',d),denied('42501'));
   await db.query('update auth.sessions set not_after=null where id=$1',[sessions.writer]);
   await assert.rejects(decide('approver',a.caseId,1,await latestHash(a.caseId),'approve',{extra:{exp:Math.floor(Date.now()/1000)-1}}),denied('42501'));
  });
  await t.test('4/6. author cannot approve own draft; stale revision, wrong hash, foreign tenant and repeated decisions fail',async()=>{
   const e=fixture(4);await create('both',e);const h=await latestHash(e.caseId);
   await assert.rejects(decide('both',e.caseId,1,h,'approve'),denied('42501'),'author with approve permission');
   for(const role of ['writer','reader','outsider'])await assert.rejects(decide(role,e.caseId,1,h,'approve'),denied('42501'),role);
   await assert.rejects(decide('demo',e.caseId,1,h,'approve',{tenant:'demo-test'}),denied('42501'));
   await assert.rejects(decide('approver',e.caseId,1,'0'.repeat(64),'approve'),denied('22023'));
   await assert.rejects(decide('approver',e.caseId,1,h,'publish'),denied('22023'));
   assert.equal(await decide('approver',e.caseId,2,h,'approve'),null,'stale/unknown revision changes nothing');
   const approved=await decide('approver',e.caseId,1,h,'approve');assert.equal(approved.revision,2);
   const r=await row(e.caseId);assert.equal(r.data.state.approval,'approved_internal');
   assert.deepEqual({...r.data.internalApproval,at:undefined},{scope:'test-mailbox-v1',actor:ids.approver,at:undefined,draftHash:h,reviewedRevision:1,capacityVerified:false,priceVerified:false,sendAllowed:false,bookingAllowed:false});
   for(const decision of ['approve','return','reject'])await assert.rejects(decide('approver',e.caseId,2,h,decision),denied('22023'),'repeat '+decision);
   await assert.rejects(redraft('writer',e.caseId,2,{text:'Utólagos módosítás'}),denied('22023'),'approved case is final in V1');
  });
  await t.test('7. after a return a changed new draft is required before an independent approval',async()=>{
   const h1=await latestHash(a.caseId);
   assert.equal((await decide('approver',a.caseId,1,h1,'return',{reason:'Kérem pontosítani a létszámot.'})).revision,2);
   assert.equal((await row(a.caseId)).data.state.approval,'returned_for_edit');
   await assert.rejects(decide('approver',a.caseId,2,h1,'approve'),denied('22023'),'no approval without a new draft');
   await assert.rejects(redraft('writer',a.caseId,2,{text:(await row(a.caseId)).data.drafts.at(-1).text}),denied('22023'),'unchanged draft');
   await assert.rejects(redraft('reader',a.caseId,2,{text:'x'}),denied('42501'));
   await assert.rejects(redraft('writer',a.caseId,2,{text:'x',decisions:[]}),denied('22023'),'cannot inject decisions');
   assert.equal(await redraft('writer',a.caseId,1,{text:'stale'}),null,'stale revision');
   assert.equal((await redraft('writer2',a.caseId,2,{text:'Javított kitalált tervezet.',operatorReviewText:'Javított.'})).revision,3);
   const h2=await latestHash(a.caseId);
   await assert.rejects(decide('writer2',a.caseId,3,h2,'approve'),denied('42501'));
   assert.equal((await decide('approver',a.caseId,3,h2,'approve')).revision,4);
   const r=await row(a.caseId);assert.equal(r.data.drafts.length,2);assert.deepEqual(r.data.decisions.map(x=>x.decision),['return','approve']);
   assert.equal(r.data.decisions[0].reason,'Kérem pontosítani a létszámot.');assert.equal(r.data.messages.length,1);
  });
  await t.test('8. reject and reopen keep the full history; approval after reopen needs an independent approver',async()=>{
   const g=fixture(8);await create('writer',g);
   await decide('approver',g.caseId,1,await latestHash(g.caseId),'reject',{reason:'Nem megfelelő.'});
   assert.equal((await row(g.caseId)).data.state.approval,'rejected');
   await assert.rejects(decide('approver',g.caseId,2,await latestHash(g.caseId),'approve'),denied('22023'));
   await redraft('writer',g.caseId,2,{text:'Újranyitott kitalált tervezet.'});
   await decide('approver',g.caseId,3,await latestHash(g.caseId),'approve');
   const r=await row(g.caseId);assert.deepEqual(r.data.decisions.map(x=>x.decision),['reject','approve']);assert.equal(r.data.drafts.length,2);
   assert.equal(r.data.drafts[0].text,g.data.drafts[0].text,'original draft kept');
  });
  await t.test('9. every successful change has exactly one audit row, append-only',async()=>{
   for(const [caseId,kinds] of [[a.caseId,['tm_create','tm_return','tm_redraft','tm_approve']],['tm-case-8',['tm_create','tm_reject','tm_redraft','tm_approve']],['tm-case-4',['tm_create','tm_approve']]]){
    const rows=await audit(caseId);assert.deepEqual(rows.map(x=>x.kind),kinds,caseId);assert.deepEqual(rows.map(x=>Number(x.revision)),kinds.map((_,i)=>i+1));
    assert.equal(Number((await row(caseId)).revision),kinds.length);
   }
   for(const role of ['authenticated']){await db.exec('set role '+role);try{await assert.rejects(db.query("delete from sc_audit"),denied('42501'));await assert.rejects(db.query("update sc_cases set data='{}'::jsonb"),e=>['42501'].includes(e.code)||assert.fail(e.code));}finally{await db.exec('reset role');}}
  });
  await t.test('existing generic paths cannot touch test-mailbox cases',async()=>{
   const r=await row(a.caseId);
   await assert.rejects(as('writer',()=>db.query('select sc_write_case($1,$2,$3,$4)',[TENANT,a.caseId,Number(r.revision),JSON.stringify({...r.data,state:{...r.data.state,approval:'pending'}})])),
    error=>/synthetic sender required/.test(error.message)||assert.fail(error.message));
   await assert.rejects(as('approver',()=>db.query('select sc_approve_case($1,$2,$3,$4,$5)',[TENANT,'tm-case-8',4,'a'.repeat(64),'{}'])),error=>error.code==='42501');
   // A case not created by sc_tm_create is never a test-mailbox case, whatever its JSON says.
   const synthetic={id:'synthetic-case-1',tenantId:TENANT,sender:'guest@fixture.invalid',state:{approval:'pending',values:{}},messages:[{sender:'guest@fixture.invalid',text:'Kitalált',mailbox_id:'fixture',message_id:'fixture-1'}],drafts:[{text:'Kitalált tervezet'}]};
   await as('writer',()=>db.query('select sc_write_case($1,$2,0,$3)',[TENANT,synthetic.id,JSON.stringify(synthetic)]));
   await assert.rejects(redraft('writer',synthetic.id,1,{text:'Átvétel kísérlete'}),error=>/test-mailbox case required/.test(error.message)||assert.fail(error.message));
   await assert.rejects(decide('approver',synthetic.id,1,sha('Kitalált tervezet'),'approve'),error=>/test-mailbox case required/.test(error.message)||assert.fail(error.message));
  });
  await t.test('10. rollback removes only the RPCs and switch; cases, audit, keys and registry stay; reinstall works',async()=>{
   const snapshot=async()=>JSON.stringify((await db.query("select (select json_agg(c order by case_id) from (select case_id,revision,data from sc_cases) c) cases,(select json_agg(a order by event_id) from sc_audit a) audit,(select json_agg(k order by message_id) from sc_message_keys k) keys,(select json_agg(m order by case_id) from (select case_id,message_id,body_sha256,created_by from sc_test_mailbox_cases) m) registry")).rows[0]);
   const before=await snapshot();
   await db.exec(await read('deployment/test-mailbox/rollback.sql'));
   assert.equal(await snapshot(),before,'no case/audit/key/registry change');
   assert.equal((await db.query("select count(*)::int n from pg_proc where proname like 'sc_tm_%'")).rows[0].n,0);
   assert.equal((await db.query('select enabled from sc_test_mailbox_config')).rows[0].enabled,false);
   assert.equal((await db.query("select prosrc from pg_proc where oid='sc_write_case(text,text,bigint,jsonb)'::regprocedure")).rows[0].prosrc,writerBefore);
   await db.exec(install);assert.equal((await db.query('select enabled from sc_test_mailbox_config')).rows[0].enabled,false,'reinstall stays off');
   await db.exec('update sc_test_mailbox_config set enabled=true');
   const h=fixture(9);assert.equal((await create('writer',h)).revision,1);assert.equal(await snapshot()!==before,true);
  });
 }finally{await db.close();}
});
