import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createServerCaseService} from '../shared-core/server-case-service.mjs';
import {createServerBookingRuntime} from '../shared-core/server-booking-runtime.mjs';
const writer='11111111-1111-4111-8111-111111111111',reader='22222222-2222-4222-8222-222222222222';
const envelope=(message_id,text,extra={})=>({sender:'guest@synthetic.invalid',mailbox_id:'synthetic-inbox',message_id,thread_id:'thread-one',text,received_at:'2026-10-16T12:00:00Z',...extra});
test('actual PostgreSQL service follow-up persists through normal Writer CAS/audit and Reader can only project its seven fields',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  await db.exec(await readFile(new URL('../supabase/migrations/202610090001_case_store.sql',import.meta.url),'utf8'));
  await db.query('insert into auth.users values ($1),($2)',[writer,reader]);
  await db.exec("insert into sc_tenants values ('sarberki-test','Synthetic service fixture',true)");
  await db.query("insert into sc_memberships values ('sarberki-test',$1,true,true,false),('sarberki-test',$2,true,false,false)",[writer,reader]);
  let queue=Promise.resolve();
  const as=(user,action)=>{const run=queue.then(async()=>{await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);try{return await action();}finally{await db.exec('reset role');}});queue=run.catch(()=>{});return run;};
  const map=row=>row?{tenantId:row.tenant_id,caseId:row.case_id,revision:row.revision,data:row.data,updatedBy:row.updated_by,createdAt:row.created_at,updatedAt:row.updated_at}:null;
  let subject=writer;
  const repository={
   get:(tenant,id)=>as(subject,async()=>map((await db.query('select * from sc_cases where tenant_id=$1 and case_id=$2',[tenant,id])).rows[0])),
   list:tenant=>as(subject,async()=>(await db.query('select * from sc_cases where tenant_id=$1',[tenant])).rows.map(map)),
   insert:(tenant,id,record)=>as(subject,async()=>(await db.query('select sc_write_case($1,$2,0,$3) as ok',[tenant,id,JSON.stringify(record.data)])).rows[0].ok),
   compareAndSwap:(tenant,id,revision,record)=>as(subject,async()=>(await db.query('select sc_write_case($1,$2,$3,$4) as ok',[tenant,id,revision,JSON.stringify(record.data)])).rows[0].ok)
  };
  const service=createServerCaseService({repository,resolveAuthority:async()=>{
   const rows=await as(subject,async()=>(await db.query('select * from sc_memberships where user_id=auth.uid()')).rows);
   return {subject,tenants:Object.fromEntries(rows.map(row=>[row.tenant_id,[...(row.can_read?['read']:[]),...(row.can_write?['write']:[])]]))};
  }});
  let id=0;const runtime=createServerBookingRuntime({service,tenantId:'sarberki-test',clock:()=> '2026-10-16T13:00:00Z',id:()=> 'case-tub-'+(++id)});
  const first=await runtime.ingest(envelope('m1','Please book one Deluxe cabin from 2026-11-13 to 2026-11-16 for 4 adults and no children.'),undefined,{expectedRevision:0,persistDraft:true});
  const followup=await runtime.ingest(envelope('m2','Please add a hot tub on 2026-11-14 at 18:00 for 24 hours.'),undefined,{expectedRevision:1,persistDraft:true});
  assert.equal(first.record.caseId,followup.record.caseId);assert.equal(followup.record.revision,2);
  assert.equal(followup.record.data.state.values.arrival,'2026-11-13');assert.equal(followup.record.data.state.values.departure,'2026-11-16');
  assert.equal(followup.record.data.state.approval,'pending');assert.match(followup.record.data.drafts.at(-1).text,/not a confirmation/);
  const before=JSON.stringify((await db.query('select data from sc_cases order by case_id')).rows);
  subject=reader;const preview=await runtime.previewDraft(first.record.caseId,2);
  assert.deepEqual(preview.serviceRequest,{requested:true,startDate:'2026-11-14',startTime:'18:00',durationHours:24,linkedCaseId:first.record.caseId,verificationStatus:'unverified',requiresHumanApproval:true});
  assert.equal(preview.persisted,false);assert.equal(preview.approval,'pending');
  await assert.rejects(runtime.ingest(envelope('reader-m3','Please add a hot tub.'),undefined,{expectedRevision:2,persistDraft:true}),error=>error.code==='FORBIDDEN');
  await assert.rejects(as(reader,()=>db.query('select sc_write_case($1,$2,2,$3)',['sarberki-test',first.record.caseId,JSON.stringify(followup.record.data)])),/forbidden/);
  assert.equal(JSON.stringify((await db.query('select data from sc_cases order by case_id')).rows),before);
  subject=writer;await assert.rejects(runtime.ingest(envelope('stale-m3','Please add a hot tub.'),undefined,{expectedRevision:1,persistDraft:true}),error=>error.code==='CASE_CONFLICT');
  assert.equal((await db.query('select * from sc_audit')).rows.length,2);assert.equal((await db.query('select * from sc_message_keys')).rows.length,2);
  const uncertain=await runtime.ingest(envelope('unlinked-m3','Please add a hot tub.',{sender:'other@synthetic.invalid',thread_id:'new-thread'}),undefined,{expectedRevision:0,persistDraft:true});
  assert.equal(uncertain.record.data.caseKind,'service_link_review');assert.equal(uncertain.record.data.state.values.arrival,undefined);
  assert.equal(uncertain.record.data.serviceRequests[0].linkedCaseId,null);assert.match(uncertain.record.data.drafts.at(-1).text,/Please clarify the booking reference/);
  assert.equal((await db.query('select * from sc_audit')).rows.length,3);
  const originalStay=JSON.stringify((await db.query('select * from sc_cases where case_id=$1',[first.record.caseId])).rows);
  const mixed=await runtime.ingest(envelope('mixed-cancellation','Please book one Deluxe cabin from 2026-12-11 to 2026-12-14 for 4 adults and no children. Please cancel the hot tub.',{sender:'mixed@synthetic.invalid',thread_id:'mixed-new-stay'}),undefined,{expectedRevision:0,persistDraft:true});
  assert.notEqual(mixed.record.data.caseKind,'service_link_review');
  assert.equal(mixed.record.data.state.values.arrival,'2026-12-11');
  assert.equal(mixed.record.data.state.values.departure,'2026-12-14');
  assert.equal(mixed.record.data.state.values.adults,'4');
  assert.equal(mixed.record.data.serviceRequests.at(-1).cancelled,true);
  assert.equal(mixed.record.data.state.approval,'pending');
  assert.ok(mixed.record.data.drafts.at(-1).text.length>0);
  subject=reader;
  const mixedPreview=await runtime.previewDraft(mixed.record.caseId,mixed.record.revision);
  assert.equal(mixedPreview.serviceOnly,false);
  assert.equal(mixedPreview.serviceRequest.requested,false);
  assert.equal(mixedPreview.serviceRequest.verificationStatus,'cancelled_unverified');
  assert.equal(mixedPreview.persisted,false);
  assert.equal(mixedPreview.approval,'pending');
  assert.equal(JSON.stringify((await db.query('select * from sc_cases where case_id=$1',[first.record.caseId])).rows),originalStay);
  assert.equal((await db.query('select * from sc_audit')).rows.length,4);
 }finally{await db.close();}
});
