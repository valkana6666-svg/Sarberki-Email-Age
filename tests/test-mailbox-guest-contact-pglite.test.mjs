import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {ingestTestMailboxMessage} from '../shared-core/server-test-mailbox-case.mjs';
import {confirmTestMailboxBooking,markTestMailboxDepositReceived,cancelTestMailboxBooking,attestModification} from '../shared-core/server-test-mailbox-confirm.mjs';

// Owner 2026-11-15: the guest's name is required for a V2 booking; sc_tm_set_guest_contact completes name/e-mail.
// Real PostgreSQL (PGlite), fictional data.
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const REF='mojnqizbcaczstguikpv',project='https://'+REF+'.supabase.co',KEY='e5'.repeat(32),TENANT='sarberki-test';
const ids={writer:'11111111-1111-4111-8111-111111111111',approver:'22222222-2222-4222-8222-222222222222'};
const sessions={writer:'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',approver:'aaaaaaaa-aaaa-4aaa-8aaa-000000000002'};
const sha=t=>createHash('sha256').update(t,'utf8').digest('hex');
const b64=t=>Buffer.from(t,'utf8').toString('base64url');
const THREAD='38f2a0b1c2d3e4a0';
const mails={
 [THREAD]:{from:'Kis Anna <sarberkito@gmail.com>',subject:'Foglalás',text:'Jó napot! 2027. június 10-től 13-ig jönnénk 2 felnőtt, gyerek nélkül, a Deluxe faházba. Telefon: +36 30 000 0000. Üdv: Kis Anna',msgid:'<first@example.test>'},
 '38f2a0b1c2d3e6c2':{from:'Teszt Csoport <sarberkito@gmail.com>',subject:'Két ház',text:'Jó napot! 2027. június 10-től 13-ig jönnénk 8 felnőtt, gyerek nélkül, 2 Deluxe faházba. Üdv: Teszt Csoport',msgid:'<multi@example.test>',thread:'38f2a0b1c2d3e6c2'},
 '38f2a0b1c2d3e5b1':{from:'Teszt Elek <sarberkito@gmail.com>',subject:'Másik foglalás',text:'Jó napot! 2027. június 12-től 14-ig jönnénk 2 felnőtt, gyerek nélkül, a Deluxe faházba. Üdv: Teszt Elek',msgid:'<second@example.test>',thread:'38f2a0b1c2d3e5b1'}
};
const gmailFetch=async url=>{
 const u=String(url);if(u.endsWith('/profile'))return new Response(JSON.stringify({emailAddress:'sarberkiprojecttest@gmail.com'}));
 const id=u.split('/').at(-1).split('?')[0],m=mails[id];
 const headers=[{name:'From',value:m.from},{name:'To',value:'sarberkiprojecttest@gmail.com'},{name:'Subject',value:m.subject},{name:'Message-ID',value:m.msgid},...(m.inReplyTo?[{name:'In-Reply-To',value:m.inReplyTo},{name:'References',value:m.inReplyTo}]:[])];
 return new Response(JSON.stringify({id,threadId:m.thread||THREAD,labelIds:['INBOX'],internalDate:String(Date.parse('2026-11-06T10:00:00Z')+Object.keys(mails).indexOf(id)*60000),payload:{mimeType:'text/plain',headers,body:{data:b64(m.text)}}}));
};

test('Guest contact (owner 2026-11-15): Writer completes name/e-mail before booking; booking needs a name',async()=>{
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
   const args={sc_tm_create:['p_tenant','p_case','p_data','p_proof'],sc_tm_followup:['p_tenant','p_case','p_expected','p_message','p_values','p_draft','p_proof'],sc_tm_decide:['p_tenant','p_case','p_expected','p_draft_hash','p_decision','p_reason'],sc_tm_confirm_booking:['p_tenant','p_case','p_expected','p_booking','p_draft','p_proof'],sc_tm_deposit_received:['p_tenant','p_case','p_expected','p_received_on'],sc_tm_cancel_booking:['p_tenant','p_case','p_expected','p_reason'],sc_tm_modify_booking:['p_tenant','p_case','p_expected','p_change','p_draft','p_proof']}[fn]||(fn==='sc_tm_set_guest_contact'?['p_tenant','p_case','p_expected','p_name','p_email']:undefined);
   const vals=args.map(k=>typeof body[k]==='object'&&body[k]!==null?JSON.stringify(body[k]):body[k]??null);
   return (await db.query(`select ${fn}(${vals.map((_,i)=>'$'+(i+1)).join(',')}) r`,vals)).rows[0].r;
  }catch(error){throw Object.assign(Error(error.code==='42501'?'FORBIDDEN':'DB'),{code:error.code==='42501'?'FORBIDDEN':'DB',detail:error.message});}
  finally{await db.exec('reset role');}
 };
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;grant select on auth.sessions to authenticated;`);
  await db.exec(await read('supabase/migrations/202610090001_case_store.sql'));
  await db.query("select set_config('sarberki.approval_install_project_ref',$1,false),set_config('sarberki.approval_backup_sha256',$2,false),set_config('sarberki.receipt_install_project_ref',$1,false),set_config('sarberki.receipt_backup_sha256',$2,false),set_config('sarberki.tm_install_project_ref',$1,false),set_config('sarberki.tm_backup_sha256',$2,false)",[REF,'b'.repeat(64)]);
  await db.exec("insert into sc_tenants values('sarberki-test','Fictional',true),('demo-test','Fictional other',true)");
  for(const f of ['deployment/cloud-approval/install.sql','deployment/cloud-approval/separate-approver-permission.sql','deployment/exact-receipt/install.sql'])await db.exec(await read(f));
  await db.query('insert into sc_isolated_approval_key(key_hex) values($1)',[KEY]);
  for(const f of ['deployment/test-mailbox/install.sql','deployment/test-mailbox/booking-status.sql','deployment/test-mailbox/booking-unit.sql','deployment/test-mailbox/booking-cancel.sql','deployment/test-mailbox/booking-multiunit.sql','deployment/test-mailbox/booking-deposit-tz.sql','deployment/test-mailbox/booking-modify.sql','deployment/test-mailbox/guest-contact.sql'])await db.exec(await read(f));
  await db.exec('update sc_test_mailbox_config set enabled=true');
  for(const [role,id] of Object.entries(ids)){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into auth.sessions values($1,$2,null)',[sessions[role],id]);}
  await db.query('insert into sc_memberships values($1,$2,true,true,false),($1,$3,true,false,true)',[TENANT,ids.writer,ids.approver]);
  assert.equal((await db.exec(await read('deployment/test-mailbox/booking-status.verify.sql'))).at(-1).rows[0].result,'VERIFY PASS');
  assert.equal((await db.exec(await read('deployment/test-mailbox/booking-unit.verify.sql'))).at(-1).rows[0].result,'VERIFY PASS');
  assert.equal((await db.exec(await read('deployment/test-mailbox/booking-cancel.verify.sql'))).at(-1).rows[0].result,'VERIFY PASS');
  assert.equal((await db.exec(await read('deployment/test-mailbox/booking-multiunit.verify.sql'))).at(-1).rows[0].result,'VERIFY PASS');
  assert.equal((await db.exec(await read('deployment/test-mailbox/booking-deposit-tz.verify.sql'))).at(-1).rows[0].result,'VERIFY PASS');
  assert.equal((await db.exec(await read('deployment/test-mailbox/booking-modify.verify.sql'))).at(-1).rows[0].result,'VERIFY PASS');
  const common={token:'t'.repeat(40),transport:transportFor('writer'),attestationKey:KEY,fetchImpl:gmailFetch};
  assert.equal((await db.exec(await read('deployment/test-mailbox/guest-contact.verify.sql'))).at(-1).rows[0].result,'VERIFY PASS');
  // A mail without a signature name (fictional).
  mails['38f2a0b1c2d3e7d3']={from:'<sarberkito@gmail.com>',subject:'Kérdés',text:'Jó napot! 2027. június 20-tól 22-ig jönnénk 2 felnőtt, gyerek nélkül, a Deluxe faházba.',msgid:'<noname@example.test>',thread:'38f2a0b1c2d3e7d3'};
  const {caseId}=await ingestTestMailboxMessage({...common,messageId:'38f2a0b1c2d3e7d3'});
  const load=async()=>{const r=(await db.query('select * from sc_cases where case_id=$1',[caseId])).rows[0];return {tenantId:r.tenant_id,caseId:r.case_id,revision:Number(r.revision),data:r.data};};
  let record=await load();
  record.data.state.values.name='';
  await db.query('update sc_cases set data=$1 where case_id=$2',[JSON.stringify(record.data),caseId]);record=await load();
  // V2 auto booking without a name: refused before any Previo write.
  let wrote=0;const writer={create:async()=>{wrote++;throw Error('no');}};
  await assert.rejects(confirmTestMailboxBooking({record,previoAuto:true,previoWriter:writer,unit:'11',attestationKey:KEY,transport:transportFor('writer')}),/NAME_REQUIRED/);
  assert.equal(wrote,0);
  const call=(role,p)=>transportFor(role)('/rest/v1/rpc/sc_tm_set_guest_contact',{method:'POST',body:{p_tenant:TENANT,p_case:caseId,...p}});
  // Invalid input, wrong revision, approver-only member: refused / no change.
  await assert.rejects(call('writer',{p_expected:record.revision,p_name:'',p_email:''}),/DB/);
  await assert.rejects(call('writer',{p_expected:record.revision,p_name:'<script>',p_email:''}),/DB/);
  await assert.rejects(call('writer',{p_expected:record.revision,p_name:'',p_email:'nem-email'}),/DB/);
  assert.equal(await call('writer',{p_expected:record.revision+5,p_name:'Teszt Vendég',p_email:''}),null);
  await assert.rejects(call('approver',{p_expected:record.revision,p_name:'Teszt Vendég',p_email:''}),/FORBIDDEN|DB/);
  // Writer saves the name and e-mail: revision +1, audit row.
  const saved=await call('writer',{p_expected:record.revision,p_name:'  Teszt Vendég ',p_email:'SarberkiTo@gmail.com'});
  assert.equal(Number(saved.revision),record.revision+1);
  record=await load();
  assert.equal(record.data.state.values.name,'Teszt Vendég');assert.equal(record.data.state.values.email,'sarberkito@gmail.com');
  assert.equal((await db.query("select count(*)::int n from sc_audit where case_id=$1 and kind='tm_guest_contact'",[caseId])).rows[0].n,1);
  // Booked case: the contact is fixed.
  await confirmTestMailboxBooking({record,previoReference:'TEST-73521-9',previoRecorded:true,unit:'11',attestationKey:KEY,transport:transportFor('writer')});
  record=await load();
  await assert.rejects(call('writer',{p_expected:record.revision,p_name:'Más Név',p_email:''}),/DB/);
  // Rollback removes the function.
  await db.exec(await read('deployment/test-mailbox/guest-contact-rollback.sql'));
  assert.equal((await db.query("select to_regprocedure('public.sc_tm_set_guest_contact(text,text,bigint,text,text)') p")).rows[0].p,null);
 }finally{await db.close();}
});
