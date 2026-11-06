import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {ingestTestMailboxMessage} from '../shared-core/server-test-mailbox-case.mjs';
import {appendTestMailboxFollowup,triageTestMailboxMessages} from '../shared-core/server-test-mailbox-followup.mjs';
import {markTestMailboxUnavailable} from '../shared-core/server-test-mailbox-unavailable.mjs';

// Owner decision 2026-11-06: a guest's reply continues the case in the operator system. Real PostgreSQL
// (PGlite), fictional mails only, the real server modules end to end (Gmail is a fixture).
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const REF='mojnqizbcaczstguikpv',project='https://'+REF+'.supabase.co',KEY='e5'.repeat(32),TENANT='sarberki-test';
const ids={writer:'11111111-1111-4111-8111-111111111111',approver:'22222222-2222-4222-8222-222222222222'};
const sessions={writer:'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',approver:'aaaaaaaa-aaaa-4aaa-8aaa-000000000002'};
const sha=t=>createHash('sha256').update(t,'utf8').digest('hex');
const b64=t=>Buffer.from(t,'utf8').toString('base64url');
const THREAD='38f2a0b1c2d3e4a0';
const mails={
 [THREAD]:{from:'Kiss Anna <sarberkito@gmail.com>',subject:'Érdeklődés',text:'Jó napot! Május 20-23 között jönnénk ketten. Kiss Anna',msgid:'<first@example.test>'},
 '38f2a0b1c2d3e4a1':{from:'Kiss Anna <sarberkito@gmail.com>',subject:'Re: Érdeklődés',text:'Köszönjük! 2027-ben, 2 felnőtt, a Deluxe faház lenne jó.',msgid:'<second@example.test>',inReplyTo:'<reply-from-us@example.test>'},
 '38f2a0b1c2d3e4a2':{from:'Valaki <other@example.test>',subject:'Re: Érdeklődés',text:'Más feladó.',msgid:'<third@example.test>',inReplyTo:'<x@y>'},
 '38f2a0b1c2d3e4a3':{from:'Kiss Anna <sarberkito@gmail.com>',subject:'Re: Másik',text:'Másik szál.',msgid:'<fourth@example.test>',inReplyTo:'<x@y>',thread:'38f2a0b1c2d3e4ff'},
 '38f2a0b1c2d3e4a4':{from:'Kiss Anna <sarberkito@gmail.com>',subject:'Új kérdés',text:'Jó napot! 2027. augusztus 1-től 4-ig jönnénk hárman.',msgid:'<fifth@example.test>',thread:'38f2a0b1c2d3e4a4'},
 '38f2a0b1c2d3e4a5':{from:'Kiss Anna <sarberkito@gmail.com>',subject:'Még egy kérdés',text:'Szia! 2027. augusztus 1-től 4-ig van stég a házhoz?',msgid:'<sixth@example.test>',thread:'38f2a0b1c2d3e4a5'}
};
const gmailFetch=async url=>{
 const u=String(url);if(u.endsWith('/profile'))return new Response(JSON.stringify({emailAddress:'sarberkiprojecttest@gmail.com'}));
 const id=u.split('/').at(-1).split('?')[0],m=mails[id];
 const headers=[{name:'From',value:m.from},{name:'To',value:'sarberkiprojecttest@gmail.com'},{name:'Subject',value:m.subject},{name:'Message-ID',value:m.msgid},...(m.inReplyTo?[{name:'In-Reply-To',value:m.inReplyTo},{name:'References',value:m.inReplyTo}]:[])];
 return new Response(JSON.stringify({id,threadId:m.thread||THREAD,labelIds:['INBOX'],internalDate:String(Date.parse('2026-11-06T10:00:00Z')+Object.keys(mails).indexOf(id)*60000),payload:{mimeType:'text/plain',headers,body:{data:b64(m.text)}}}));
};

test('a reply in the case thread from the same guest is appended; facts merged; new draft pending; strangers refused',async()=>{
 const db=new PGlite();
 const claims=role=>({sub:ids[role],role:'authenticated',iss:project+'/auth/v1',session_id:sessions[role],exp:Math.floor(Date.now()/1000)+3600});
 const transportFor=role=>async(path,{method='GET',body}={})=>{
  await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims(role))]);
  try{
   const url=new URL('https://x'+path);
   if(method==='GET'&&url.pathname==='/rest/v1/sc_cases'){
    const thread=url.searchParams.get('data->sourceReceipt->>thread_id')?.slice(3);
    return (await db.query("select * from sc_cases where tenant_id=$1 and ($2::text is null or data->'sourceReceipt'->>'thread_id'=$2)",[url.searchParams.get('tenant_id').slice(3),thread??null])).rows;
   }
   const fn=url.pathname.split('/').at(-1);
   const args={sc_tm_create:['p_tenant','p_case','p_data','p_proof'],sc_tm_followup:['p_tenant','p_case','p_expected','p_message','p_values','p_draft','p_proof'],sc_tm_decide:['p_tenant','p_case','p_expected','p_draft_hash','p_decision','p_reason'],sc_tm_unavailable_redraft:['p_tenant','p_case','p_expected','p_draft','p_proof']}[fn];
   const vals=args.map(k=>typeof body[k]==='object'&&body[k]!==null?JSON.stringify(body[k]):body[k]??null);
   return (await db.query(`select ${fn}(${vals.map((_,i)=>'$'+(i+1)).join(',')}) r`,vals)).rows[0].r;
  }catch(error){throw Object.assign(Error('DB'),{code:error.code==='42501'?'FORBIDDEN':'DB',detail:error.message});}
  finally{await db.exec('reset role');}
 };
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;grant select on auth.sessions to authenticated;`);
  await db.exec(await read('supabase/migrations/202610090001_case_store.sql'));
  await db.query("select set_config('sarberki.approval_install_project_ref',$1,false),set_config('sarberki.approval_backup_sha256',$2,false),set_config('sarberki.receipt_install_project_ref',$1,false),set_config('sarberki.receipt_backup_sha256',$2,false),set_config('sarberki.tm_install_project_ref',$1,false),set_config('sarberki.tm_backup_sha256',$2,false)",[REF,'b'.repeat(64)]);
  await db.exec("insert into sc_tenants values('sarberki-test','Fictional',true),('demo-test','Fictional other',true)");
  for(const f of ['deployment/cloud-approval/install.sql','deployment/cloud-approval/separate-approver-permission.sql','deployment/exact-receipt/install.sql'])await db.exec(await read(f));
  await db.query('insert into sc_isolated_approval_key(key_hex) values($1)',[KEY]);
  for(const f of ['deployment/test-mailbox/install.sql','deployment/test-mailbox/followup.sql'])await db.exec(await read(f));
  await db.exec('update sc_test_mailbox_config set enabled=true');
  for(const [role,id] of Object.entries(ids)){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into auth.sessions values($1,$2,null)',[sessions[role],id]);}
  await db.query('insert into sc_memberships values($1,$2,true,true,false),($1,$3,true,false,true)',[TENANT,ids.writer,ids.approver]);
  assert.equal((await db.exec(await read('deployment/test-mailbox/followup.verify.sql'))).at(-1).rows[0].result,'VERIFY PASS');
  const common={token:'t'.repeat(40),transport:transportFor('writer'),attestationKey:KEY,fetchImpl:gmailFetch};
  // 1. New inquiry (year-less) -> case, approve it (as if replied), then the guest answers in the thread.
  const created=await ingestTestMailboxMessage({...common,messageId:THREAD});
  const caseId=created.caseId;
  let row=(await db.query('select * from sc_cases where case_id=$1',[caseId])).rows[0];
  assert.equal(row.data.state.values.arrival,undefined,'year-less date not a fact yet');
  await transportFor('approver')('/rest/v1/rpc/sc_tm_decide',{method:'POST',body:{p_tenant:TENANT,p_case:caseId,p_expected:1,p_draft_hash:sha(row.data.drafts[0].text),p_decision:'approve',p_reason:null}});
  const appended=await appendTestMailboxFollowup({...common,messageId:'38f2a0b1c2d3e4a1'});
  assert.deepEqual(appended,{caseId,revision:3});
  row=(await db.query('select * from sc_cases where case_id=$1',[caseId])).rows[0];
  assert.equal(row.data.messages.length,2);assert.equal(row.data.state.approval,'pending','reopened for a new decision');
  assert.equal(row.data.internalApproval,undefined);assert.equal(row.data.latestReceipt.rfc_message_id,'<second@example.test>');
  assert.equal(row.data.drafts.length,2);assert.deepEqual([row.data.drafts[1].machineDraft,row.data.drafts[1].followup],[true,true]);
  assert.equal(row.data.state.values.adults,'2');assert.equal(row.data.state.values.unit,'Deluxe');
  const audit=(await db.query('select kind from sc_audit where case_id=$1 order by revision',[caseId])).rows.map(r=>r.kind);
  assert.deepEqual(audit,['tm_create','tm_approve','tm_followup']);
  // 2. Duplicate, other sender, other thread, a non-reply, reader role: refused.
  await assert.rejects(appendTestMailboxFollowup({...common,messageId:'38f2a0b1c2d3e4a1'}),/ALREADY_IN_CASE/);
  await assert.rejects(appendTestMailboxFollowup({...common,messageId:'38f2a0b1c2d3e4a2'}),/NOT_TEST_PAIR_INQUIRY/);
  await assert.rejects(appendTestMailboxFollowup({...common,messageId:'38f2a0b1c2d3e4a3'}),/FOLLOWUP_CASE_NOT_FOUND/);
  await assert.rejects(appendTestMailboxFollowup({...common,messageId:THREAD}),/NOT_A_FOLLOWUP/);
  // 2b. Server triage for the daily page: stored, not allowed, uncertain reply, new inquiry.
  const triage=await triageTestMailboxMessages({token:'t'.repeat(40),transport:transportFor('writer'),fetchImpl:gmailFetch,messageIds:[THREAD,'38f2a0b1c2d3e4a1','38f2a0b1c2d3e4a2','38f2a0b1c2d3e4a3','38f2a0b1c2d3e4a4']});
  assert.deepEqual(triage.map(r=>[r.kind,r.caseId??r.reason??null]),[['stored',caseId],['stored',caseId],['not_allowed',null],['uncertain','reply_without_booking'],['new',null]]);
  await assert.rejects(triageTestMailboxMessages({token:'t'.repeat(40),transport:transportFor('writer'),fetchImpl:gmailFetch,messageIds:[]}),/INVALID_INPUT/);
  await ingestTestMailboxMessage({...common,messageId:'38f2a0b1c2d3e4a4'});
  const same=await triageTestMailboxMessages({token:'t'.repeat(40),transport:transportFor('writer'),fetchImpl:gmailFetch,messageIds:['38f2a0b1c2d3e4a5']});
  assert.deepEqual(same,[{messageId:'38f2a0b1c2d3e4a5',kind:'uncertain',reason:'same_guest_same_dates',caseIds:['tm-38f2a0b1c2d3e4a4']}],'same guest, new thread, same stay: the operator decides');
  // 2c. Owner video 2026-11-06: TEST DB without sc_tm_unavailable_redraft -> the button fails; the minimal
  // install restores it and the button works end to end (server-built, attested, no price).
  await db.exec('drop function sc_tm_unavailable_redraft(text,text,bigint,jsonb,jsonb)');
  const nb=(await db.query('select * from sc_cases where case_id=$1',['tm-38f2a0b1c2d3e4a4'])).rows[0];
  const recordOf=r=>({tenantId:r.tenant_id,caseId:r.case_id,revision:Number(r.revision),data:r.data});
  await assert.rejects(markTestMailboxUnavailable({record:recordOf(nb),unavailableConfirmed:true,attestationKey:KEY,transport:transportFor('writer')}),/DB/,'missing function');
  await db.exec(await read('deployment/test-mailbox/unavailable.sql'));
  assert.equal((await db.exec(await read('deployment/test-mailbox/unavailable.verify.sql'))).at(-1).rows[0].result,'VERIFY PASS');
  const marked=await markTestMailboxUnavailable({record:recordOf(nb),unavailableConfirmed:true,attestationKey:KEY,transport:transportFor('writer')});
  assert.equal(marked.revision,2);assert.match(marked.data.drafts.at(-1).text,/nincs a megadott létszámnak megfelelő szabad faházunk/);
  assert.doesNotMatch(marked.data.drafts.at(-1).text,/Ft\b/);
  // 3. The database alone refuses a forged message for another thread or guest, even with a valid writer session.
  const forged={sender:'sarberkito@gmail.com',text:'x',mailbox_id:row.data.sourceReceipt.mailbox_id,message_id:'38f2a0b1c2d3e4a9',thread_id:'38f2a0b1c2d3e4ff',rfc_message_id:'<f@x>',references:[],received_at:'2026-11-06T10:10:00.000Z'};
  await assert.rejects(transportFor('writer')('/rest/v1/rpc/sc_tm_followup',{method:'POST',body:{p_tenant:TENANT,p_case:caseId,p_expected:3,p_message:forged,p_values:{},p_draft:{text:'y'},p_proof:{}}}),e=>e.detail.includes('does not belong'));
  await assert.rejects(transportFor('writer')('/rest/v1/rpc/sc_tm_followup',{method:'POST',body:{p_tenant:TENANT,p_case:caseId,p_expected:3,p_message:{...forged,thread_id:THREAD},p_values:{},p_draft:{text:'y'},p_proof:{scope:'test-mailbox-followup-v1',checkedAt:new Date().toISOString(),attestation:'0'.repeat(64)}}}),e=>e.code==='FORBIDDEN','unattested');
 }finally{await db.close();}
});
