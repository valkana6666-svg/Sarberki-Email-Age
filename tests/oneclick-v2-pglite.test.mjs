// One-click V2 (owner PERM-20261112-ONECLICK, 2026-11-12): preview -> one operator step -> Previo TEST option +
// confirmation letter + approval. Real PostgreSQL (PGlite), fictional data, a fake Previo writer, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {createIntakeRequest} from '../shared-core/server-intake.mjs';
import {previewTestMailboxBooking,oneClickTestMailboxBooking} from '../shared-core/server-test-mailbox-confirm.mjs';
import {voucherFor} from '../shared-core/server-previo-reservation-write.mjs';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const REF='mojnqizbcaczstguikpv',project='https://'+REF+'.supabase.co',KEY='e5'.repeat(32),TENANT='sarberki-test';
const ids={operator:'11111111-1111-4111-8111-111111111111',approver:'22222222-2222-4222-8222-222222222222',intake:'33333333-3333-4333-8333-333333333333',writer:'44444444-4444-4444-8444-444444444444'};
const sessions=Object.fromEntries(Object.keys(ids).map((r,i)=>[r,'aaaaaaaa-aaaa-4aaa-8aaa-00000000000'+(i+1)]));
const facts={arrival:'2027-06-10',departure:'2027-06-13',adults:2,children:0,cabin:'deluxe',phone:'+36 30 000 0000',name:'Teszt Hívó',language:'hu'};
const sha=t=>createHash('sha256').update(String(t),'utf8').digest('hex');
const ARGS={sc_intake_create:['p_tenant','p_case','p_data','p_proof'],sc_tm_confirm_booking:['p_tenant','p_case','p_expected','p_booking','p_draft','p_proof'],
 sc_tm_decide:['p_tenant','p_case','p_expected','p_draft_hash','p_decision','p_reason']};

async function fixture(){
 const db=new PGlite();
 const claims=role=>({sub:ids[role],role:'authenticated',iss:project+'/auth/v1',session_id:sessions[role],exp:Math.floor(Date.now()/1000)+3600});
 const transportFor=role=>async(path,{method='GET',body}={})=>{
  await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims(role))]);
  try{
   const url=new URL('https://x'+path);
   if(method==='GET'&&url.pathname==='/rest/v1/sc_cases')return (await db.query('select * from sc_cases where tenant_id=$1',[TENANT])).rows;
   const fn=url.pathname.split('/').at(-1),vals=ARGS[fn].map(k=>typeof body[k]==='object'&&body[k]!==null?JSON.stringify(body[k]):body[k]??null);
   return (await db.query(`select ${fn}(${vals.map((_,i)=>'$'+(i+1)).join(',')}) r`,vals)).rows[0].r;
  }catch(error){throw Object.assign(Error(error.code==='42501'?'FORBIDDEN':'DB'),{code:error.code==='42501'?'FORBIDDEN':'DB',detail:error.message});}
  finally{await db.exec('reset role');}
 };
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;grant select on auth.sessions to authenticated;`);
 await db.exec(await read('supabase/migrations/202610090001_case_store.sql'));
 await db.query("select set_config('sarberki.approval_install_project_ref',$1,false),set_config('sarberki.approval_backup_sha256',$2,false),set_config('sarberki.receipt_install_project_ref',$1,false),set_config('sarberki.receipt_backup_sha256',$2,false),set_config('sarberki.tm_install_project_ref',$1,false),set_config('sarberki.tm_backup_sha256',$2,false)",[REF,'b'.repeat(64)]);
 await db.exec("insert into sc_tenants values('sarberki-test','Fictional',true),('demo-test','Fictional other',true)");
 for(const f of ['deployment/cloud-approval/install.sql','deployment/cloud-approval/separate-approver-permission.sql','deployment/exact-receipt/install.sql'])await db.exec(await read(f));
 await db.query('insert into sc_isolated_approval_key(key_hex) values($1)',[KEY]);
 for(const f of ['deployment/test-mailbox/install.sql','deployment/test-mailbox/booking-status.sql','deployment/test-mailbox/booking-unit.sql','deployment/test-mailbox/booking-cancel.sql','deployment/test-mailbox/booking-multiunit.sql','deployment/intake/install.sql'])await db.exec(await read(f));
 await db.exec('update sc_test_mailbox_config set enabled=true');
 for(const [role,id] of Object.entries(ids)){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into auth.sessions values($1,$2,null)',[sessions[role],id]);}
 // Today's TEST shape: Writer (read+write), Approver (read+approve, no write). "operator" starts as an Approver too.
 await db.query('insert into sc_memberships values($1,$2,true,true,false)',[TENANT,ids.writer]);
 await db.query('insert into sc_memberships values($1,$2,true,false,true)',[TENANT,ids.approver]);
 await db.query('insert into sc_memberships values($1,$2,true,false,true)',[TENANT,ids.operator]);
 await db.query('insert into sc_intake_actors(tenant_id,user_id) values($1,$2)',[TENANT,ids.intake]);
 const newCase=async externalId=>{
  const {caseId}=await createIntakeRequest({channel:'phone',externalId,facts,summary:'Deluxe faház 2027. június 10–13., 2 felnőtt.',attestationKey:KEY,tenantId:TENANT,transport:transportFor('intake')});
  const row=(await db.query('select * from sc_cases where case_id=$1',[caseId])).rows[0];
  return {tenantId:TENANT,caseId,revision:Number(row.revision),data:row.data};
 };
 return {db,transportFor,newCase};
}
const fakeWriter=()=>{const calls=[];return {calls,sendContact:false,
 createOption:async a=>{calls.push(['create',a]);return {resId:900001,voucher:voucherFor({tenantId:a.tenantId,caseId:a.caseId}),created:true};},
 setStatus:async a=>{calls.push(['status',a]);return true;}};};
const free=async()=>({status:'free',referenceFound:false});

test('DB: the one-click grant gives the Approver write (logged), verify passes, rollback removes exactly that',async()=>{
 const {db}=await fixture();
 try{
  await assert.rejects(db.exec("select set_config('sarberki.tm_install_project_ref','abcdefghijklmnopqrst',false);"+await read('deployment/test-mailbox/oneclick-approver-write.sql')),/verified TEST project/);
  await db.exec('rollback');
  await db.query("select set_config('sarberki.tm_install_project_ref',$1,false)",[REF]);
  await db.exec(await read('deployment/test-mailbox/oneclick-approver-write.sql'));
  const v=(await db.exec(await read('deployment/test-mailbox/oneclick-approver-write.verify.sql'))).at(-1).rows[0];
  assert.equal(v.result,'VERIFY PASS');assert.equal(Number(v.approve_and_write),2);assert.equal(Number(v.write_only),1,'Writer unchanged (still no approve)');assert.equal(Number(v.logged_grants),2);
  await db.exec(await read('deployment/test-mailbox/oneclick-approver-write.sql'));
  assert.equal(Number((await db.query('select count(*) n from sc_oneclick_write_grants')).rows[0].n),2,'idempotent');
  await db.exec(await read('deployment/test-mailbox/oneclick-approver-write-rollback.sql'));
  const rows=(await db.query('select user_id::text u,can_read,can_write,can_approve from sc_memberships order by user_id')).rows;
  assert.deepEqual(rows.map(r=>[r.can_read,r.can_write,r.can_approve]),[[true,false,true],[true,false,true],[true,true,false]]);
  assert.equal((await db.query("select to_regclass('public.sc_oneclick_write_grants') r")).rows[0].r,null);
 }finally{await db.close();}
});

test('one-click: preview -> one step -> Previo option, finalized, letter approved; nothing sent',async()=>{
 const {db,transportFor,newCase}=await fixture();
 try{
  await db.exec(await read('deployment/test-mailbox/oneclick-approver-write.sql'));
  const record=await newCase('call_oneclick_0001'),t=transportFor('operator');
  const p=await previewTestMailboxBooking({record,unit:'11',transport:t,unitCheckFn:free,priceCheckFn:async()=>({status:'read',total:null}),previoWriterOn:true});
  assert.equal(p.voucher,voucherFor({tenantId:TENANT,caseId:record.caseId}));assert.match(p.letterText,new RegExp(p.voucher));
  assert.equal(p.price.status,'mismatch');assert.equal(p.ready,false,'a Previo price difference blocks the button');
  const ok=await previewTestMailboxBooking({record,unit:'11',transport:t,unitCheckFn:free,priceCheckFn:async()=>({status:'read',total:p.total}),previoWriterOn:true});
  assert.equal(ok.ready,true);assert.deepEqual(ok.blockers,[]);assert.equal(ok.price.status,'match');assert.equal(ok.previewHash,p.previewHash);
  assert.doesNotMatch(ok.letterText,/Egység|egység: 11|11-es/,'no internal unit number in the guest letter');
  const w=fakeWriter();
  const r=await oneClickTestMailboxBooking({record,unit:'11',previewHash:ok.previewHash,oneClickConfirmed:true,previoWriter:w,attestationKey:KEY,transport:t,unitCheckFn:free});
  assert.equal(r.approved,true);assert.equal(w.calls.filter(c=>c[0]==='create').length,1);
  const row=(await db.query('select * from sc_cases where case_id=$1',[record.caseId])).rows[0];
  assert.equal(Number(row.revision),record.revision+2);assert.equal(row.data.state.approval,'approved_internal');assert.equal(row.data.booking.status,'finalized');
  assert.equal(row.data.booking.previo.reference,'V2-900001');assert.equal(row.data.internalApproval.draftHash,sha(row.data.drafts.at(-1).text));
  assert.equal(row.data.internalApproval.sendAllowed,false);
  const kinds=(await db.query('select kind from sc_audit where case_id=$1 order by event_id',[record.caseId])).rows.map(x=>x.kind);
  assert.equal(kinds.at(-1),'tm_approve');assert.equal(kinds.length,3,'create, finalize, approve');
  // Second press: already finalized -> refused before any Previo call.
  const again=await db.query('select * from sc_cases where case_id=$1',[record.caseId]);
  await assert.rejects(oneClickTestMailboxBooking({record:{...record,revision:Number(again.rows[0].revision),data:again.rows[0].data},unit:'11',previewHash:ok.previewHash,oneClickConfirmed:true,previoWriter:w,attestationKey:KEY,transport:t,unitCheckFn:free}),/ALREADY_FINALIZED/);
  assert.equal(w.calls.length,1);
 }finally{await db.close();}
});

test('one-click stops BEFORE any Previo write: changed preview, unverified unit, missing confirmation',async()=>{
 const {db,transportFor,newCase}=await fixture();
 try{
  await db.exec(await read('deployment/test-mailbox/oneclick-approver-write.sql'));
  const record=await newCase('call_oneclick_0002'),t=transportFor('operator'),w=fakeWriter();
  const ok=await previewTestMailboxBooking({record,unit:'11',transport:t,unitCheckFn:free,previoWriterOn:true});
  const base={record,unit:'11',previewHash:ok.previewHash,oneClickConfirmed:true,previoWriter:w,attestationKey:KEY,transport:t,unitCheckFn:free};
  await assert.rejects(oneClickTestMailboxBooking({...base,unit:'12'}),/PREVIEW_CHANGED/,'another unit than previewed');
  await assert.rejects(oneClickTestMailboxBooking({...base,record:{...record,data:{...record.data,state:{...record.data.state,values:{...record.data.state.values,adults:'3',guests:'3'}}}}}),/PREVIEW_CHANGED/,'facts changed');
  await assert.rejects(oneClickTestMailboxBooking({...base,unitCheckFn:async()=>({status:'unknown'})}),/PREVIO_UNIT_UNVERIFIED/);
  await assert.rejects(oneClickTestMailboxBooking({...base,unitCheckFn:async()=>{throw Error('down');}}),/PREVIO_UNIT_UNVERIFIED/);
  await assert.rejects(oneClickTestMailboxBooking({...base,unitCheckFn:async()=>({status:'taken'})}),/UNIT_TAKEN_IN_PREVIO/);
  await assert.rejects(oneClickTestMailboxBooking({...base,unitCheckFn:null}),/PREVIO_UNIT_UNVERIFIED/);
  await assert.rejects(oneClickTestMailboxBooking({...base,oneClickConfirmed:false}),/ONECLICK_NOT_CONFIRMED/);
  await assert.rejects(oneClickTestMailboxBooking({...base,previewHash:'x'}),/PREVIEW_CHANGED/);
  assert.equal(w.calls.length,0,'no Previo write in any of these');
  assert.equal(Number((await db.query('select revision from sc_cases where case_id=$1',[record.caseId])).rows[0].revision),record.revision);
  const pu=await previewTestMailboxBooking({record,unit:'11',transport:t,unitCheckFn:async()=>({status:'unknown'}),previoWriterOn:false});
  assert.deepEqual(pu.blockers,['PREVIO_WRITE_DISABLED','PREVIO_UNIT_UNVERIFIED']);
 }finally{await db.close();}
});

test('without the grant (Approver has no write) the DB refuses the finalize; the Previo option is cancelled again',async()=>{
 const {db,transportFor,newCase}=await fixture();
 try{
  const record=await newCase('call_oneclick_0003'),t=transportFor('operator'),w=fakeWriter();
  const ok=await previewTestMailboxBooking({record,unit:'11',transport:t,unitCheckFn:free,previoWriterOn:true});
  await assert.rejects(oneClickTestMailboxBooking({record,unit:'11',previewHash:ok.previewHash,oneClickConfirmed:true,previoWriter:w,attestationKey:KEY,transport:t,unitCheckFn:free}),/FORBIDDEN/);
  assert.deepEqual(w.calls.map(c=>c[0]),['create','status']);assert.equal(w.calls[1][1].status,'cancelled');
  // A Writer without approve: finalize succeeds, approval refused -> safe middle state (finalized, letter pending).
  const record2=await newCase('call_oneclick_0004'),tw=transportFor('writer'),w2=fakeWriter();
  const ok2=await previewTestMailboxBooking({record:record2,unit:'12',transport:tw,unitCheckFn:free,previoWriterOn:true});
  const r=await oneClickTestMailboxBooking({record:record2,unit:'12',previewHash:ok2.previewHash,oneClickConfirmed:true,previoWriter:w2,attestationKey:KEY,transport:tw,unitCheckFn:free});
  assert.equal(r.approved,false);assert.equal(r.saved.data.booking.status,'finalized');assert.equal(r.saved.data.state.approval,'pending');
 }finally{await db.close();}
});

test('owner 2026-11-13: one-click also works AFTER the inquiry reply was approved (the real order of the day)',async()=>{
 const {db,transportFor,newCase}=await fixture();
 try{
  await db.exec(await read('deployment/test-mailbox/oneclick-approver-write.sql'));
  const first=await newCase('call_oneclick_after_approve'),t=transportFor('operator');
  assert.ok(first.data.drafts?.length,'the intake case has its inquiry draft');
  await t('/rest/v1/rpc/sc_tm_decide',{method:'POST',body:{p_tenant:TENANT,p_case:first.caseId,p_expected:first.revision,p_draft_hash:sha(first.data.drafts.at(-1).text),p_decision:'approve',p_reason:null}});
  const row0=(await db.query('select * from sc_cases where case_id=$1',[first.caseId])).rows[0];
  assert.equal(row0.data.state.approval,'approved_internal');
  const record={tenantId:TENANT,caseId:first.caseId,revision:Number(row0.revision),data:row0.data};
  const ok=await previewTestMailboxBooking({record,unit:'11',transport:t,unitCheckFn:free,priceCheckFn:async()=>({status:'not_comparable'}),previoWriterOn:true});
  assert.deepEqual(ok.blockers,[]);assert.equal(ok.ready,true);
  const r=await oneClickTestMailboxBooking({record,unit:'11',previewHash:ok.previewHash,oneClickConfirmed:true,previoWriter:fakeWriter(),attestationKey:KEY,transport:t,unitCheckFn:free});
  assert.equal(r.approved,true);
  const row=(await db.query('select * from sc_cases where case_id=$1',[first.caseId])).rows[0];
  assert.equal(row.data.state.approval,'approved_internal');assert.equal(row.data.booking.status,'finalized');
  assert.match(row.data.drafts.at(-1).text,/VOUCHER/);assert.equal(row.data.internalApproval.draftHash,sha(row.data.drafts.at(-1).text));
 }finally{await db.close();}
});

test('owner 2026-11-13: automatic unit choice skips units taken here or in Previo; never guesses',async()=>{
 const {pickFreeUnits}=await import('../shared-core/server-test-mailbox-confirm.mjs');
 const {db,transportFor,newCase}=await fixture();
 try{
  await db.exec(await read('deployment/test-mailbox/oneclick-approver-write.sql'));
  const t=transportFor('operator');
  // A finalized booking of ours on unit 11 for the same dates.
  const a=await newCase('call_auto_taken_here');
  await oneClickTestMailboxBooking({record:a,unit:'11',previewHash:(await previewTestMailboxBooking({record:a,unit:'11',transport:t,unitCheckFn:free,priceCheckFn:async()=>({status:'not_comparable'}),previoWriterOn:true})).previewHash,
   oneClickConfirmed:true,previoWriter:fakeWriter(),attestationKey:KEY,transport:t,unitCheckFn:free});
  const b=await newCase('call_auto_pick');
  const asked=[];const previo=async({unit})=>{asked.push(unit);return {status:unit==='12'?'taken':'free'};};
  assert.deepEqual(await pickFreeUnits({record:b,transport:t,unitCheckFn:previo}),['13']);
  assert.deepEqual(asked,['12','13'],'11 is skipped without a Previo call (ours), 12 is taken in Previo');
  await assert.rejects(pickFreeUnits({record:b,transport:t,unitCheckFn:async()=>({status:'unknown'})}),/NO_FREE_UNIT/);
  await assert.rejects(pickFreeUnits({record:b,transport:t,unitCheckFn:null}),/AUTO_UNIT_UNAVAILABLE/);
  // Every house type: a generic "Osztott" request is placed by party size (2 guests -> A/B, 3-5 -> C, more -> never guessed).
  const withValues=v=>({...b,data:{...b.data,state:{...b.data.state,values:{...b.data.state.values,unit:'Osztott',...v}}}});
  assert.match((await pickFreeUnits({record:withValues({adults:2,children:0}),transport:t,unitCheckFn:free}))[0],/^(7|8|9|10)\/[AB]$/);
  assert.match((await pickFreeUnits({record:withValues({adults:4,children:1}),transport:t,unitCheckFn:free}))[0],/^(7|8|9|10)\/C$/);
  await assert.rejects(pickFreeUnits({record:withValues({adults:6,children:0}),transport:t,unitCheckFn:free}),/AUTO_UNIT_UNAVAILABLE/);
  const two=await pickFreeUnits({record:withValues({adults:4,children:0,units_requested:2}),transport:t,unitCheckFn:free});
  assert.equal(two.length,2);assert.ok(two.every(u=>/\/[AB]$/.test(u)),'2 x 2 guests -> two A/B units');
 }finally{await db.close();}
});
