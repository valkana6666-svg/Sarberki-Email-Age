// Owner 2026-11-27: an optional PRELIMINARY confirmation letter while Previo shows an option, and the FINAL letter once
// the staff switched the option to a confirmed booking in Previo. Real PostgreSQL (PGlite), fictional data, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {prepareFinalLetter,confirmationLetterKind} from '../shared-core/server-test-mailbox-confirm.mjs';
import {buildBookingConfirmation} from '../shared-core/booking-confirmation-draft.mjs';
import {fetchPublicPriceReference} from '../price-source/public-price-fallback.mjs';
import {voucherFor} from '../shared-core/server-previo-reservation-write.mjs';
import {nextStepFor} from '../napi-kezelo/napi-next.mjs';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const REF='mojnqizbcaczstguikpv',project='https://'+REF+'.supabase.co',KEY='e5'.repeat(32),TENANT='sarberki-test';
const ids={writer:'11111111-1111-4111-8111-111111111111'},sessions={writer:'aaaaaaaa-aaaa-4aaa-8aaa-000000000001'};
const CASE='tm-'+'ab'.repeat(12);
const values={arrival:'2027-08-02',departure:'2027-08-05',adults:'2',children:'0',unit:'Családi',name:'Teszt Anna',language:'hu',email:'sarberkito@gmail.com'};
const quote=fetchPublicPriceReference({arrival:'2027-08-02',departure:'2027-08-05',cabin:'family',adults:2,children:[]});
const recordedAt='2026-11-27T15:00:00.000Z';
const prelim=buildBookingConfirmation({values,quote,previo:{reference:'V2-118646289',recordedAt},language:'hu',bookingNumber:voucherFor({tenantId:TENANT,caseId:CASE})});

test('letter kinds: the first confirmation draft decides; a final letter marks the booking final',()=>{
 assert.equal(confirmationLetterKind({drafts:[{text:'x'},{text:prelim.text,confirmation:true}]}),'preliminary');
 const fin=buildBookingConfirmation({values,quote,previo:{reference:'V2-1',recordedAt},language:'hu',bookingNumber:voucherFor({tenantId:TENANT,caseId:CASE}),confirmed:true});
 assert.equal(confirmationLetterKind({drafts:[{text:fin.text,confirmation:true}]}),'final');
 assert.equal(confirmationLetterKind({drafts:[{text:prelim.text,confirmation:true}],booking:{finalLetter:{}}}),'final');
 assert.equal(confirmationLetterKind({drafts:[{text:'x'}]}),null);
});

test('final letter after a preliminary one: same booking number, price and deadline; once; only a writer; Previo is the source',async()=>{
 const db=new PGlite();
 const claims=role=>({sub:ids[role],role:'authenticated',iss:project+'/auth/v1',session_id:sessions[role],exp:Math.floor(Date.now()/1000)+3600});
 const transport=async(path,{body}={})=>{
  await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims('writer'))]);
  try{
   const fn=path.split('/').at(-1),args={sc_tm_final_letter:['p_tenant','p_case','p_expected','p_draft','p_proof'],sc_tm_decide:['p_tenant','p_case','p_expected','p_draft_hash','p_decision','p_reason']}[fn];
   const vals=args.map(k=>typeof body[k]==='object'&&body[k]!==null?JSON.stringify(body[k]):body[k]??null);
   const casts={p_expected:'::bigint'};
   return (await db.query(`select ${fn}(${args.map((k,i)=>'$'+(i+1)+(casts[k]||'')).join(',')}) r`,vals)).rows[0].r;
  }catch(error){throw Object.assign(Error(error.code==='42501'?'FORBIDDEN':'DB'),{code:error.code==='42501'?'FORBIDDEN':'DB',detail:error.message});}
  finally{await db.exec('reset role');}
 };
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;grant select on auth.sessions to authenticated;`);
  await db.exec(await read('supabase/migrations/202610090001_case_store.sql'));
  await db.query("select set_config('sarberki.approval_install_project_ref',$1,false),set_config('sarberki.approval_backup_sha256',$2,false),set_config('sarberki.receipt_install_project_ref',$1,false),set_config('sarberki.receipt_backup_sha256',$2,false),set_config('sarberki.tm_install_project_ref',$1,false),set_config('sarberki.tm_backup_sha256',$2,false)",[REF,'b'.repeat(64)]);
  await db.exec("insert into sc_tenants values('sarberki-test','Fictional',true)");
  for(const f of ['deployment/cloud-approval/install.sql','deployment/cloud-approval/separate-approver-permission.sql','deployment/exact-receipt/install.sql'])await db.exec(await read(f));
  await db.query('insert into sc_isolated_approval_key(key_hex) values($1)',[KEY]);
  for(const f of ['deployment/test-mailbox/install.sql','deployment/test-mailbox/final-letter.sql'])await db.exec(await read(f));
  assert.equal((await db.exec(await read('deployment/test-mailbox/final-letter.verify.sql'))).at(-1).rows[0].result,'VERIFY PASS');
  await db.exec('update sc_test_mailbox_config set enabled=true');
  await db.query('insert into auth.users values($1)',[ids.writer]);await db.query('insert into auth.sessions values($1,$2,null)',[sessions.writer,ids.writer]);
  await db.query('insert into sc_memberships values($1,$2,true,true,true)',[TENANT,ids.writer]);
  // A finalized booking whose (only) confirmation letter was the PRELIMINARY one.
  const data={id:CASE,tenantId:TENANT,sender:'intake:phone',sourceReceipt:{provider:'phone'},messages:[{text:'Telefonos foglalási igény'}],
   state:{approval:'approved_internal',values},drafts:[{text:'gépi tervezet'},{text:prelim.text,confirmation:true,machineDraft:true,createdBy:ids.writer}],
   booking:{status:'finalized',unit:'2',previo:{reference:'V2-118646289',recordedAt},deposit:{pct:prelim.deposit.pct,amount:prelim.deposit.amount,deadlineUtc:prelim.deposit.receiptDeadlineUtc}}};
  await db.query('insert into sc_cases(tenant_id,case_id,revision,data,updated_by) values($1,$2,4,$3,$4)',[TENANT,CASE,JSON.stringify(data),ids.writer]);
  await db.query("insert into sc_test_mailbox_cases values($1,$2,'intake:phone','voice_conv_x1',$3,$4,now())",[TENANT,CASE,'c'.repeat(64),ids.writer]);
  const record=async()=>{const r=(await db.query('select revision,data from sc_cases where case_id=$1',[CASE])).rows[0];return {tenantId:TENANT,caseId:CASE,revision:Number(r.revision),data:r.data};};
  const previo={resId:118646289,unit:'2',from:'2027-08-02',to:'2027-08-05',price:quote.accommodation};
  // Previo is the source: other dates / another price stop before anything is saved.
  await assert.rejects(prepareFinalLetter({record:await record(),previo:{...previo,from:'2027-08-03'},attestationKey:KEY,transport}),/PREVIO_DATES_EDITED/);
  await assert.rejects(prepareFinalLetter({record:await record(),previo:{...previo,price:1},attestationKey:KEY,transport}),/PREVIO_PRICE_EDITED/);
  // A forged proof is refused by the database.
  await assert.rejects(prepareFinalLetter({record:await record(),previo,attestationKey:'f0'.repeat(32),transport}),/FORBIDDEN/);
  const r=await prepareFinalLetter({record:await record(),previo,attestationKey:KEY,transport});
  assert.equal(r.approved,true);
  const after=await record();
  const last=after.data.drafts.at(-1);
  assert.match(last.text,/Foglalását megerősítettük/);assert.match(last.text,/SC-[0-9A-F]{16}/);
  assert.ok(last.text.includes(prelim.text.match(/Kérjük, hogy ([^(]+)/)[1]),'same deposit deadline as the preliminary letter');
  assert.equal(last.finalLetter,true);assert.equal(after.data.state.approval,'approved_internal');assert.equal(after.data.booking.status,'finalized');
  assert.equal(confirmationLetterKind(after.data),'final');
  // Once per booking.
  await assert.rejects(prepareFinalLetter({record:after,previo,attestationKey:KEY,transport}),/FINAL_LETTER_ALREADY_SENT/);
  // Rollback removes the function.
  await db.exec(await read('deployment/test-mailbox/final-letter-rollback.sql'));
  assert.equal((await db.query("select to_regprocedure('public.sc_tm_final_letter(text,text,bigint,jsonb,jsonb)') f")).rows[0].f,null);
 }finally{await db.close();}
});

test('the deposit step stays the next step otherwise (the daily view brings the final letter first only after Previo confirmed it)',()=>{
 const s=nextStepFor({booking:{status:'finalized',letterKind:'preliminary'},canMarkDeposit:true});
 assert.equal(s.kind,'deposit');
});
