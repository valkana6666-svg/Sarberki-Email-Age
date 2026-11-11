import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {ingestTestMailboxMessage} from '../shared-core/server-test-mailbox-case.mjs';
import {confirmTestMailboxBooking,markTestMailboxDepositReceived,cancelTestMailboxBooking} from '../shared-core/server-test-mailbox-confirm.mjs';

// V1 booking completion (owner/ChatGPT 2026-11-06): operator attests the manual Previo recording -> server-built
// confirmation with deposit -> 'finalized'; deposit received is a separate step. Real PostgreSQL (PGlite), fictional data.
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const REF='mojnqizbcaczstguikpv',project='https://'+REF+'.supabase.co',KEY='e5'.repeat(32),TENANT='sarberki-test';
const ids={writer:'11111111-1111-4111-8111-111111111111',approver:'22222222-2222-4222-8222-222222222222'};
const sessions={writer:'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',approver:'aaaaaaaa-aaaa-4aaa-8aaa-000000000002'};
const sha=t=>createHash('sha256').update(t,'utf8').digest('hex');
const b64=t=>Buffer.from(t,'utf8').toString('base64url');
const THREAD='38f2a0b1c2d3e4a0';
const mails={
 [THREAD]:{from:'Kis Anna <sarberkito@gmail.com>',subject:'Foglalás',text:'Jó napot! 2027. június 10-től 13-ig jönnénk 2 felnőtt, gyerek nélkül, a Deluxe faházba. Telefon: +36 30 000 0000. Üdv: Kis Anna',msgid:'<first@example.test>'},
 '38f2a0b1c2d3e5b1':{from:'Teszt Elek <sarberkito@gmail.com>',subject:'Másik foglalás',text:'Jó napot! 2027. június 12-től 14-ig jönnénk 2 felnőtt, gyerek nélkül, a Deluxe faházba. Üdv: Teszt Elek',msgid:'<second@example.test>',thread:'38f2a0b1c2d3e5b1'}
};
const gmailFetch=async url=>{
 const u=String(url);if(u.endsWith('/profile'))return new Response(JSON.stringify({emailAddress:'sarberkiprojecttest@gmail.com'}));
 const id=u.split('/').at(-1).split('?')[0],m=mails[id];
 const headers=[{name:'From',value:m.from},{name:'To',value:'sarberkiprojecttest@gmail.com'},{name:'Subject',value:m.subject},{name:'Message-ID',value:m.msgid},...(m.inReplyTo?[{name:'In-Reply-To',value:m.inReplyTo},{name:'References',value:m.inReplyTo}]:[])];
 return new Response(JSON.stringify({id,threadId:m.thread||THREAD,labelIds:['INBOX'],internalDate:String(Date.parse('2026-11-06T10:00:00Z')+Object.keys(mails).indexOf(id)*60000),payload:{mimeType:'text/plain',headers,body:{data:b64(m.text)}}}));
};

test('V1 completion: Previo attestation -> confirmation with deposit -> finalized; deposit received separately',async()=>{
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
   const args={sc_tm_create:['p_tenant','p_case','p_data','p_proof'],sc_tm_followup:['p_tenant','p_case','p_expected','p_message','p_values','p_draft','p_proof'],sc_tm_decide:['p_tenant','p_case','p_expected','p_draft_hash','p_decision','p_reason'],sc_tm_confirm_booking:['p_tenant','p_case','p_expected','p_booking','p_draft','p_proof'],sc_tm_deposit_received:['p_tenant','p_case','p_expected','p_received_on'],sc_tm_cancel_booking:['p_tenant','p_case','p_expected','p_reason']}[fn];
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
  for(const f of ['deployment/test-mailbox/install.sql','deployment/test-mailbox/booking-status.sql','deployment/test-mailbox/booking-unit.sql','deployment/test-mailbox/booking-cancel.sql'])await db.exec(await read(f));
  await db.exec('update sc_test_mailbox_config set enabled=true');
  for(const [role,id] of Object.entries(ids)){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into auth.sessions values($1,$2,null)',[sessions[role],id]);}
  await db.query('insert into sc_memberships values($1,$2,true,true,false),($1,$3,true,false,true)',[TENANT,ids.writer,ids.approver]);
  assert.equal((await db.exec(await read('deployment/test-mailbox/booking-status.verify.sql'))).at(-1).rows[0].result,'VERIFY PASS');
  assert.equal((await db.exec(await read('deployment/test-mailbox/booking-unit.verify.sql'))).at(-1).rows[0].result,'VERIFY PASS');
  assert.equal((await db.exec(await read('deployment/test-mailbox/booking-cancel.verify.sql'))).at(-1).rows[0].result,'VERIFY PASS');
  const common={token:'t'.repeat(40),transport:transportFor('writer'),attestationKey:KEY,fetchImpl:gmailFetch};
  const {caseId}=await ingestTestMailboxMessage({...common,messageId:THREAD});
  const load=async()=>{const r=(await db.query('select * from sc_cases where case_id=$1',[caseId])).rows[0];return {tenantId:r.tenant_id,caseId:r.case_id,revision:Number(r.revision),data:r.data};};
  let record=await load();
  assert.equal(record.data.state.values.unit,'Deluxe');assert.equal(record.data.state.values.adults,'2');
  // Deposit before finalization: refused (server and database).
  await assert.rejects(markTestMailboxDepositReceived({record,receivedOn:'2026-11-06',depositConfirmed:true,transport:transportFor('writer')}),/NOT_FINALIZED/);
  await assert.rejects(transportFor('writer')('/rest/v1/rpc/sc_tm_deposit_received',{method:'POST',body:{p_tenant:TENANT,p_case:caseId,p_expected:record.revision,p_received_on:'2026-11-06'}}),/DB/);
  // Without the operator's Previo attestation: refused.
  await assert.rejects(confirmTestMailboxBooking({record,previoReference:'P-1',previoRecorded:false,unit:'11',attestationKey:KEY,transport:transportFor('writer')}),/PREVIO_RECORDING_REQUIRED/);
  // Approver-only member cannot write; a forged/foreign proof is refused.
  await assert.rejects(confirmTestMailboxBooking({record,previoReference:'P-1',previoRecorded:true,unit:'11',attestationKey:KEY,transport:transportFor('approver')}),/FORBIDDEN|DB/);
  await assert.rejects(confirmTestMailboxBooking({record,previoReference:'P-1',previoRecorded:true,unit:'11',attestationKey:'f0'.repeat(32),transport:transportFor('writer')}),/FORBIDDEN/);
  // Finalize.
  const {saved,deposit}=await confirmTestMailboxBooking({record,previoReference:'TEST-73521-1',previoRecorded:true,unit:'11',attestationKey:KEY,transport:transportFor('writer')});
  assert.equal(saved.revision,record.revision+1);assert.deepEqual([deposit.pct,deposit.amount,deposit.windowHours],[50,94500,168]);
  record=await load();
  assert.equal(record.data.booking.status,'finalized');assert.equal(record.data.booking.previo.reference,'TEST-73521-1');
  assert.equal(record.data.booking.deposit.amount,94500);assert.equal(record.data.state.approval,'pending','confirmation still needs human approval');
  const draft=record.data.drafts.at(-1);assert.equal(draft.confirmation,true);
  assert.match(draft.text,/^Kedves Kis Anna!/); // name from the signature (fixed 2026-11-07)
  assert.match(draft.text,/összesen: 192 300 Ft/);assert.match(draft.text,/50%-a: 94 500 Ft/);
  assert.doesNotMatch(draft.text,/TEST-73521-1/);
  // Twice: refused.
  await assert.rejects(confirmTestMailboxBooking({record,previoReference:'TEST-73521-2',previoRecorded:true,unit:'11',attestationKey:KEY,transport:transportFor('writer')}),/ALREADY_FINALIZED/);
  await assert.rejects(confirmTestMailboxBooking({record:{...record,data:{...record.data,booking:undefined}},previoReference:'TEST-73521-2',previoRecorded:true,unit:'11',attestationKey:KEY,transport:transportFor('writer')}),/DB/);
  // Collision protection (V2 step 1b): a second booking overlapping on unit 11 is refused (server pre-check and
  // database under lock); a different Deluxe unit is accepted; a unit of another type is refused.
  const second=await ingestTestMailboxMessage({...common,messageId:'38f2a0b1c2d3e5b1'});
  const r2=(await db.query('select * from sc_cases where case_id=$1',[second.caseId])).rows[0];
  let rec2={tenantId:r2.tenant_id,caseId:r2.case_id,revision:Number(r2.revision),data:r2.data};
  await assert.rejects(confirmTestMailboxBooking({record:rec2,previoReference:'TEST-2',previoRecorded:true,unit:'11',attestationKey:KEY,transport:transportFor('writer')}),/UNIT_TAKEN/);
  const noPrecheck=async(path,o={})=>path.startsWith('/rest/v1/sc_cases')?[]:transportFor('writer')(path,o);
  await assert.rejects(confirmTestMailboxBooking({record:rec2,previoReference:'TEST-2',previoRecorded:true,unit:'11',attestationKey:KEY,transport:noPrecheck}),/DB/);
  await assert.rejects(confirmTestMailboxBooking({record:rec2,previoReference:'TEST-2',previoRecorded:true,unit:'7/A',attestationKey:KEY,transport:transportFor('writer')}),/UNIT_NOT_IN_TYPE/);
  // V2 step 4: Previo itself says another reservation holds the unit -> refused before any write.
  await assert.rejects(confirmTestMailboxBooking({record:rec2,previoReference:'TEST-2',previoRecorded:true,unit:'12',attestationKey:KEY,transport:transportFor('writer'),
   unitCheckFn:async()=>({status:'taken',referenceFound:false,conflicts:[{from:'2027-06-12',to:'2027-06-13',statusId:2}]})}),/UNIT_TAKEN_IN_PREVIO/);
  const seen=[];
  const ok2=await confirmTestMailboxBooking({record:rec2,previoReference:'TEST-2',previoRecorded:true,unit:'12',attestationKey:KEY,transport:transportFor('writer'),
   unitCheckFn:async a=>{seen.push(a);return {status:'free',referenceFound:true,conflicts:[]};}});
  assert.deepEqual(seen,[{unit:'12',arrival:'2027-06-12',departure:'2027-06-14',previoReference:'TEST-2'}]);
  assert.match(ok2.saved.data.drafts.at(-1).operatorReviewText,/TEST-2 foglalás megtalálható a\(z\) 12 egységen/);
  assert.doesNotMatch(ok2.saved.data.drafts.at(-1).text,/Previo/);
  assert.equal(ok2.saved.data.booking.unit,'12');
  assert.doesNotMatch(ok2.saved.data.drafts.at(-1).text,/\b12\b.*egység|Egység: 12/,'unit number never in the guest letter');
  assert.match(ok2.saved.data.drafts.at(-1).operatorReviewText,/Egység: 12/);
  // Deposit received: future date refused; today accepted; separate state.
  await assert.rejects(transportFor('writer')('/rest/v1/rpc/sc_tm_deposit_received',{method:'POST',body:{p_tenant:TENANT,p_case:caseId,p_expected:record.revision,p_received_on:'2999-01-01'}}),/DB/);
  const today=new Date().toISOString().slice(0,10);
  await markTestMailboxDepositReceived({record,receivedOn:today,depositConfirmed:true,transport:transportFor('writer')});
  record=await load();
  assert.equal(record.data.booking.status,'deposit_received');assert.equal(record.data.booking.depositReceived.on,today);
  const audit=(await db.query('select kind from sc_audit where case_id=$1 order by revision',[caseId])).rows.map(r=>r.kind);
  assert.deepEqual(audit,['tm_create','tm_booking_finalized','tm_deposit_received']);
  assert.equal(record.data.booking.unit,'11');
  // V2 cancellation (owner 2026-11-11): reason required; manual (V1) reference -> no Previo call; status 'cancelled'.
  await assert.rejects(cancelTestMailboxBooking({record,reason:' ',cancelConfirmed:true,transport:transportFor('writer')}),/INVALID_REASON/);
  await assert.rejects(transportFor('approver')('/rest/v1/rpc/sc_tm_cancel_booking',{method:'POST',body:{p_tenant:TENANT,p_case:caseId,p_expected:record.revision,p_reason:'x'}}),/FORBIDDEN|DB/);
  const cancelled=await cancelTestMailboxBooking({record,reason:'Vendég lemondta (teszt)',cancelConfirmed:true,transport:transportFor('writer')});
  assert.equal(cancelled.previoSync,'manual');
  record=await load();
  assert.equal(record.data.booking.status,'cancelled');assert.equal(record.data.booking.cancelled.reason,'Vendég lemondta (teszt)');assert.equal(record.data.booking.cancelled.previousStatus,'deposit_received');
  await assert.rejects(cancelTestMailboxBooking({record,reason:'újra',cancelConfirmed:true,transport:transportFor('writer')}),/NOT_ACTIVE_BOOKING/);
  await assert.rejects(transportFor('writer')('/rest/v1/rpc/sc_tm_cancel_booking',{method:'POST',body:{p_tenant:TENANT,p_case:caseId,p_expected:record.revision,p_reason:'újra'}}),/DB/);
  assert.deepEqual((await db.query('select kind from sc_audit where case_id=$1 order by revision',[caseId])).rows.map(r=>r.kind),['tm_create','tm_booking_finalized','tm_deposit_received','tm_booking_cancelled']);
  // anon has no execute.
  assert.equal((await db.query("select has_function_privilege('anon','public.sc_tm_confirm_booking(text,text,bigint,jsonb,jsonb,jsonb)','execute') a")).rows[0].a,false);
 }finally{await db.close();}
});
