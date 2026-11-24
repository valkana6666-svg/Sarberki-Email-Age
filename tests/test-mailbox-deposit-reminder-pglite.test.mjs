// Owner 2026-11-23: deposit reminder 2 days before the deadline – real PostgreSQL (PGlite), fictional data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {ingestTestMailboxMessage} from '../shared-core/server-test-mailbox-case.mjs';
import {confirmTestMailboxBooking} from '../shared-core/server-test-mailbox-confirm.mjs';
import {prepareDepositReminder,reminderDue,buildDepositReminder} from '../shared-core/server-deposit-reminder.mjs';
import {approvedTestMailboxReply} from '../shared-core/server-test-mailbox-send.mjs';

// V1 booking completion (owner/ChatGPT 2026-11-06): operator attests the manual Previo recording -> server-built
// confirmation with deposit -> 'finalized'; deposit received is a separate step. Real PostgreSQL (PGlite), fictional data.
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const REF='mojnqizbcaczstguikpv',project='https://'+REF+'.supabase.co',KEY='e5'.repeat(32),TENANT='sarberki-test';
const ids={writer:'11111111-1111-4111-8111-111111111111',approver:'22222222-2222-4222-8222-222222222222',both:'33333333-3333-4333-8333-333333333333'};
const sessions={writer:'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',approver:'aaaaaaaa-aaaa-4aaa-8aaa-000000000002',both:'aaaaaaaa-aaaa-4aaa-8aaa-000000000003'};
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

test('deposit reminder on real PostgreSQL: window, attestation, approve rights, once only',async()=>{
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
   const args={sc_tm_deposit_reminder:['p_tenant','p_case','p_expected','p_draft','p_proof'],sc_tm_create:['p_tenant','p_case','p_data','p_proof'],sc_tm_followup:['p_tenant','p_case','p_expected','p_message','p_values','p_draft','p_proof'],sc_tm_decide:['p_tenant','p_case','p_expected','p_draft_hash','p_decision','p_reason'],sc_tm_confirm_booking:['p_tenant','p_case','p_expected','p_booking','p_draft','p_proof'],sc_tm_deposit_received:['p_tenant','p_case','p_expected','p_received_on'],sc_tm_cancel_booking:['p_tenant','p_case','p_expected','p_reason'],sc_tm_modify_booking:['p_tenant','p_case','p_expected','p_change','p_draft','p_proof']}[fn];
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
  for(const f of ['deployment/test-mailbox/install.sql','deployment/test-mailbox/booking-status.sql','deployment/test-mailbox/booking-unit.sql','deployment/test-mailbox/booking-cancel.sql','deployment/test-mailbox/booking-multiunit.sql','deployment/test-mailbox/booking-deposit-tz.sql','deployment/test-mailbox/booking-modify.sql','deployment/test-mailbox/deposit-reminder.sql','deployment/test-mailbox/deposit-reminder-2.sql'])await db.exec(await read(f));
  await db.exec('update sc_test_mailbox_config set enabled=true');
  for(const [role,id] of Object.entries(ids)){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into auth.sessions values($1,$2,null)',[sessions[role],id]);}
  await db.query('insert into sc_memberships values($1,$2,true,true,false),($1,$3,true,false,true),($1,$4,true,true,true)',[TENANT,ids.writer,ids.approver,ids.both]);
  assert.equal((await db.exec(await read('deployment/test-mailbox/deposit-reminder-2.verify.sql'))).at(-1).rows[0].result,'VERIFY PASS');
  const common={token:'t'.repeat(40),transport:transportFor('writer'),attestationKey:KEY,fetchImpl:gmailFetch};
  const {caseId}=await ingestTestMailboxMessage({...common,messageId:THREAD});
  const load=async()=>{const r=(await db.query('select * from sc_cases where case_id=$1',[caseId])).rows[0];return {tenantId:r.tenant_id,caseId:r.case_id,revision:Number(r.revision),data:r.data};};
  let record=await load();
  // Not finalized yet: refused by the server and by the database.
  await assert.rejects(prepareDepositReminder({record,attestationKey:KEY,transport:transportFor('both')}),/NOT_FINALIZED/);
  await confirmTestMailboxBooking({record,previoReference:'TEST-73521-9',previoRecorded:true,unit:'11',attestationKey:KEY,transport:transportFor('writer')});
  record=await load();
  const deadline=Date.parse(record.data.booking.deposit.deadlineUtc);
  assert.equal(reminderDue(record.data.booking,Date.now()),false,'7 days left: not yet due');
  await assert.rejects(prepareDepositReminder({record,attestationKey:KEY,transport:transportFor('both')}),/REMINDER_NOT_DUE/);
  // The database checks the window itself (server clock moved forward, DB clock not): refused.
  await assert.rejects(prepareDepositReminder({record,attestationKey:KEY,transport:transportFor('both'),now:()=>deadline-86400000}),/DB/);
  // Move the deadline into the window (fictional fixture), then: prepared + approved, once only.
  await db.query("update sc_cases set data=jsonb_set(data,'{booking,deposit,deadlineUtc}',to_jsonb((now()+interval '1 day')::text)) where case_id=$1",[caseId]);
  record=await load();
  // A forged attestation key and a writer without approve rights.
  await assert.rejects(prepareDepositReminder({record,attestationKey:'f0'.repeat(32),transport:transportFor('both')}),/FORBIDDEN/);
  await assert.rejects(prepareDepositReminder({record,attestationKey:KEY,transport:transportFor('approver')}),/FORBIDDEN|DB/);
  const r=await prepareDepositReminder({record,attestationKey:KEY,transport:transportFor('both')});
  assert.equal(r.approved,true);
  record=await load();
  const latest=record.data.drafts.at(-1);
  assert.equal(latest.depositReminder,true);assert.equal(latest.machineDraft,true);assert.equal(record.data.state.approval,'approved_internal');
  assert.match(latest.text,/^Kedves Kis Anna!/);assert.match(latest.text,/Foglaló: 94 500 Ft/);assert.match(latest.text,/közeleg a foglaló befizetési határideje/);
  assert.ok(record.data.booking.depositReminder?.preparedAt,'marked once');assert.equal(record.data.booking.status,'finalized','booking unchanged');
  // The send path accepts it (approved latest draft) with the reminder subject; the reply goes to the guest's thread.
  const reply=approvedTestMailboxReply(record);assert.equal(reply.text,latest.text);
  assert.equal(r.kind,'first');assert.equal(latest.reminderKind,'first');
  // The first one once only.
  await assert.rejects(prepareDepositReminder({record,attestationKey:KEY,transport:transportFor('both')}),/REMINDER_ALREADY_SENT/);
  // Owner 2026-11-24: the second ("final") reminder on the deadline day – here just after the deadline – also once.
  await db.query("update sc_cases set data=jsonb_set(data,'{booking,deposit,deadlineUtc}',to_jsonb((now()-interval '1 hour')::text)) where case_id=$1",[caseId]);
  record=await load();
  const f=await prepareDepositReminder({record,attestationKey:KEY,transport:transportFor('both')});
  assert.equal(f.kind,'final');assert.equal(f.approved,true);
  record=await load();
  assert.match(record.data.drafts.at(-1).text,/ma lejárt, és a foglaló még nem érkezett meg/);assert.ok(record.data.booking.depositReminderFinal?.preparedAt);
  assert.equal(record.data.drafts.at(-1).reminderKind,'final');assert.equal(approvedTestMailboxReply(record).text,record.data.drafts.at(-1).text,'e-mail case: sent in its own thread');
  await assert.rejects(prepareDepositReminder({record,attestationKey:KEY,transport:transportFor('both')}),/REMINDER_ALREADY_SENT/);
  // 12 hours after the deadline: nothing any more.
  await db.query("update sc_cases set data=jsonb_set(data #- '{booking,depositReminderFinal}','{booking,deposit,deadlineUtc}',to_jsonb((now()-interval '13 hours')::text)) where case_id=$1",[caseId]);
  record=await load();
  await assert.rejects(prepareDepositReminder({record,attestationKey:KEY,transport:transportFor('both')}),/REMINDER_NOT_DUE/);
  const raw=async()=>transportFor('both')('/rest/v1/rpc/sc_tm_deposit_reminder',{method:'POST',body:{p_tenant:TENANT,p_case:caseId,p_expected:record.revision,p_draft:{text:'x'},p_proof:{scope:'test-mailbox-deposit-reminder-v1',checkedAt:new Date().toISOString(),attestation:'0'.repeat(64)}}});
  await assert.rejects(raw(),/DB|FORBIDDEN/);
  // Deposit received afterwards still works.
  const kinds=(await db.query("select kind from sc_audit where case_id=$1 and kind like 'tm_deposit_reminder%' order by revision",[caseId])).rows.map(r=>r.kind);
  assert.deepEqual(kinds,['tm_deposit_reminder_first','tm_deposit_reminder_final']);
 }finally{await db.close();}
});

test('reminder text: 4 languages, booking number, amount and Hungarian-time deadline; first and final windows, each once',async()=>{
 const values={name:'Teszt Lili',arrival:'2027-07-05',departure:'2027-07-08',unit:'Családi'};
 const booking={status:'finalized',deposit:{amount:90750,deadlineUtc:'2026-11-30T21:13:21.000Z'}};
 const hu=buildDepositReminder({values,booking,bookingNumber:'SC-D3BE7E9BC94D1838'});
 assert.match(hu,/^Kedves Teszt Lili!/);assert.match(hu,/2027\.07\.05\. – 2027\.07\.08\., Családi, foglalási szám: SC-D3BE7E9BC94D1838/);
 assert.match(hu,/Foglaló: 90 750 Ft/);assert.match(hu,/Határidő: 2026\.11\.30\. 22:13 \(magyarországi idő\)/);
 for(const [lang,re] of [['de',/Anzahlung: 90 750 HUF/],['en',/Deposit: 90 750 HUF/],['si',/Predplačilo: 90 750 HUF/]])assert.match(buildDepositReminder({values,booking,language:lang}),re);
 const t=Date.parse(booking.deposit.deadlineUtc);
 const {reminderKind}=await import('../shared-core/server-deposit-reminder.mjs');
 assert.equal(reminderKind(booking,t-3*86400000),null);assert.equal(reminderKind(booking,t-86400000),'first');
 assert.equal(reminderKind(booking,Date.parse('2026-11-30T07:00:00Z')),'final','same Budapest day');
 assert.equal(reminderKind(booking,t+1),'final');assert.equal(reminderKind(booking,t+13*3600000),null);
 assert.equal(reminderKind({...booking,depositReminder:{preparedAt:'x'}},t-86400000),null);assert.equal(reminderKind({...booking,depositReminder:{preparedAt:'x'}},t+1),'final');
 assert.equal(reminderKind({...booking,depositReminderFinal:{preparedAt:'x'}},t+1),null);assert.equal(reminderDue({...booking,status:'deposit_received'},t-86400000),false);
 const fin=buildDepositReminder({values,booking,kind:'final',nowMs:t-3600000});
 assert.match(fin,/a foglaló befizetési határideje ma lejár\./);assert.match(fin,/Kérjük, ha még nem tette meg, utalja el a foglalót/);
});

test('chat/phone case: the reminder subjects say what they are (first / final)',()=>{
 const rec=kind=>({caseId:'tm-1a1a32e75c490832',data:{state:{approval:'approved_internal',values:{email:'sarberkito@gmail.com',language:'hu'}},sourceReceipt:{provider:'chat'},
  booking:{status:'finalized'},drafts:[{text:'x',depositReminder:true,reminderKind:kind}],internalApproval:{scope:'test-mailbox-v1',draftHash:createHash('sha256').update('x','utf8').digest('hex')}}});
 assert.equal(approvedTestMailboxReply(rec('first')).subject,'Sárberki Horgásztó – emlékeztető: foglaló');
 assert.equal(approvedTestMailboxReply(rec('final')).subject,'Sárberki Horgásztó – ma lejár a foglaló határideje');
});
