import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {ingestTestMailboxMessage} from '../shared-core/server-test-mailbox-case.mjs';
import {askEmailAssist,validateEmailAssist,mergeEmailAssist} from '../shared-core/email-assist.mjs';
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

test('E-mail language-model step: only empty facts filled, validated, flagged for the operator',async()=>{
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
  // A free-text mail the rules cannot read fully (fictional).
  mails['38f2a0b1c2d3e8e4']={from:'Próba Péter <sarberkito@gmail.com>',subject:'Nyár',text:'Jó napot! Július 9-én jönnénk, és 12-én mennénk haza, ketten a feleségemmel, valami családias faházba. Üdv: Próba Péter',msgid:'<assist@example.test>',thread:'38f2a0b1c2d3e8e4'};
  const env={EMAIL_ASSIST_ENABLED:'test-only',OPENAI_TRANSLATION_API_KEY:'sk-test-'+'x'.repeat(20),CHAT_ASSIST_MODEL:'m'};
  const calls=[];const model=async(url,init)=>{calls.push(JSON.parse(init.body));
   return new Response(JSON.stringify({output_text:JSON.stringify({arrival:'2027-07-09',departure:'2027-07-12',adults:2,children:0,child_ages:null,unit:'Családi'})}));};
  const {caseId}=await ingestTestMailboxMessage({...common,messageId:'38f2a0b1c2d3e8e4',emailAssist:a=>askEmailAssist(a,{env,fetchImpl:model})});
  const r=(await db.query('select data from sc_cases where case_id=$1',[caseId])).rows[0].data;
  assert.equal(calls.length,1);assert.equal(calls[0].store,false);assert.equal(calls[0].text.format.type,'json_schema');
  assert.equal(r.state.values.arrival,'2027-07-09');assert.equal(r.state.values.departure,'2027-07-12');
  assert.match(r.drafts[0].operatorReviewText,/Gépi értelmezés \(nyelvi modell\)/);
  // A fully rule-read mail never calls the model.
  const before=calls.length;await ingestTestMailboxMessage({...common,messageId:'38f2a0b1c2d3e5b1',emailAssist:a=>askEmailAssist(a,{env,fetchImpl:model})});
  assert.equal(calls.length,before);
  // Model failure: the case is still created, rule values only, no note.
  mails['38f2a0b1c2d3e9f5']={...mails['38f2a0b1c2d3e8e4'],msgid:'<assist2@example.test>',thread:'38f2a0b1c2d3e9f5'};
  const {caseId:c2}=await ingestTestMailboxMessage({...common,messageId:'38f2a0b1c2d3e9f5',emailAssist:async()=>{throw Error('down');}});
  assert.doesNotMatch((await db.query('select data from sc_cases where case_id=$1',[c2])).rows[0].data.drafts[0].operatorReviewText||'',/Gépi értelmezés/);
 }finally{await db.close();}
});

test('validation: invented, past, too long, wrong cabin and day-not-in-text proposals are dropped',()=>{
 const text='Július 9-én jönnénk, 12-én mennénk.',receivedAt='2026-11-15T10:00:00Z';
 assert.deepEqual(validateEmailAssist({arrival:'2027-07-09',departure:'2027-07-12',adults:2,children:1,child_ages:[5],unit:'VIP'},{text,receivedAt}),
  {arrival:'2027-07-09',departure:'2027-07-12',adults:'2',children:'1',child_ages:'5',unit:'VIP'});
 assert.equal(validateEmailAssist({arrival:'2027-07-10',departure:'2027-07-12'},{text,receivedAt}).arrival,undefined);
 assert.equal(validateEmailAssist({arrival:'2026-07-09',departure:'2026-07-12'},{text:'július 9 12',receivedAt}).arrival,undefined);
 assert.equal(validateEmailAssist({arrival:'2027-02-30',departure:'2027-03-02'},{text:'30 2',receivedAt}).arrival,undefined);
 assert.equal(validateEmailAssist({arrival:'2027-07-09',departure:'2027-09-12'},{text,receivedAt}).arrival,undefined);
 assert.equal(validateEmailAssist({adults:0,children:2,child_ages:[5],unit:'Kastély'},{text,receivedAt}).adults,undefined);
 assert.equal(validateEmailAssist({children:2,child_ages:[5]},{text,receivedAt}).child_ages,undefined);
 assert.deepEqual(mergeEmailAssist({guests:'2'},{adults:'2'}),{values:{guests:'2',adults:'2',children:'0'},used:['adults','children']});
 assert.deepEqual(mergeEmailAssist({guests:'3'},{adults:'2'}),{values:{guests:'3'},used:[]},'adults must equal the known total');
 assert.deepEqual(mergeEmailAssist({arrival:'2027-01-01',departure:'2027-01-03',adults:'3'},{arrival:'2027-07-09',departure:'2027-07-12',adults:'2',unit:'VIP'}),
  {values:{arrival:'2027-01-01',departure:'2027-01-03',adults:'3',unit:'VIP'},used:['unit']});
});
