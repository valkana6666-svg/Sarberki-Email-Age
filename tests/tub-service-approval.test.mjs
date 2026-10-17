import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createServerCaseService} from '../shared-core/server-case-service.mjs';
import {createSupabaseCaseRepository} from '../shared-core/supabase-case-repository.mjs';
import {createServerBookingRuntime} from '../shared-core/server-booking-runtime.mjs';
import {createTubServiceApproval,createServiceApprovalAttestor,serviceApprovalMessage} from '../shared-core/server-tub-approval.mjs';
const users={approver:'11111111-1111-4111-8111-111111111111',writer:'22222222-2222-4222-8222-222222222222',reader:'33333333-3333-4333-8333-333333333333',other:'44444444-4444-4444-8444-444444444444'};
const session='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
async function fixture(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
 for(const name of ['202610090001_case_store.sql','20261016111515_service_link_resolution.sql','20261016114328_tub_service_approval.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 // Isolated fixture provision only: reuse the existing helper definition, never a cloud key.
 const legacy=await readFile(new URL('../deployment/cloud-approval/install.sql',import.meta.url),'utf8');
 await db.exec(legacy.slice(legacy.indexOf('create table if not exists public.sc_isolated_approval_key'),legacy.indexOf('-- Only this specialized RPC can approve.')));
 await db.exec("create table sc_cloud_approval_binding(singleton boolean,project_ref text);insert into sc_cloud_approval_binding values(true,'mojnqizbcaczstguikpv')");
 const key='12'.repeat(32);await db.query('insert into sc_isolated_approval_key values(true,$1)',[key]);
 for(const id of Object.values(users))await db.query('insert into auth.users values($1)',[id]);
 await db.query('insert into auth.sessions values($1,$2,null)',[session,users.approver]);
 await db.exec("insert into sc_tenants values('sarberki-test','Synthetic',true),('demo-test','Other',true)");
 for(const [role,id]of Object.entries(users))await db.query('insert into sc_memberships values($1,$2,true,$3,$4)',[role==='other'?'demo-test':'sarberki-test',id,['approver','writer'].includes(role),role==='approver']);
 // Cloud grants approve independently from write. Model that deployed constraint explicitly.
 const constraints=(await db.query("select conname from pg_constraint where conrelid='sc_memberships'::regclass and pg_get_constraintdef(oid) like '%can_approve%'")).rows;
 for(const c of constraints)await db.exec('alter table sc_memberships drop constraint '+c.conname);
 await db.exec('alter table sc_memberships add check(not can_approve or can_read)');
 let subject=users.approver,queue=Promise.resolve(),captured=null;
 const as=action=>{const actor=subject;const run=queue.then(async()=>{await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({iss:'https://mojnqizbcaczstguikpv.supabase.co/auth/v1',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,session_id:session})]);try{return await action();}finally{await db.exec('reset role');}});queue=run.catch(()=>{});return run;};
 const transport=async(path,{body}={})=>as(async()=>{
  if(path.includes('/rpc/sc_write_case'))return (await db.query('select sc_write_case($1,$2,$3,$4) as r',[body.p_tenant,body.p_case,body.p_expected,JSON.stringify(body.p_data)])).rows[0].r;
  if(path.includes('/rpc/sc_resolve_service_link'))return (await db.query('select sc_resolve_service_link($1,$2,$3,$4,$5,$6) as r',[body.p_tenant,body.p_case,body.p_expected,body.p_target,body.p_target_expected,body.p_reason])).rows[0].r;
  if(path.includes('/rpc/sc_approve_tub_service')){captured=structuredClone(body);return (await db.query('select sc_approve_tub_service($1,$2) as r',[JSON.stringify(body.p_payload),body.p_attestation])).rows[0].r;}
  const q=new URL('https://synthetic.invalid'+path).searchParams,tenant=q.get('tenant_id').slice(3);
  if(path.includes('/sc_service_approvals?'))return (await db.query('select * from sc_service_approvals where tenant_id=$1 and case_id=$2 order by approval_id desc limit 1',[tenant,q.get('case_id').slice(3)])).rows;
  if(path.includes('/sc_service_link_decisions?'))return (await db.query('select * from sc_service_link_decisions where tenant_id=$1 and review_case_id=$2 order by review_revision desc limit 1',[tenant,q.get('review_case_id').slice(3)])).rows;
  const id=q.get('case_id')?.slice(3);return (await db.query('select * from sc_cases where tenant_id=$1'+(id?' and case_id=$2':''),id?[tenant,id]:[tenant])).rows;
 });
 const repository=createSupabaseCaseRepository(transport),service=createServerCaseService({repository,resolveAuthority:async()=>{
  const rows=await as(()=>db.query('select * from sc_memberships where user_id=auth.uid()'));
  return {subject,tenants:Object.fromEntries(rows.rows.map(r=>[r.tenant_id,[r.can_read&&'read',r.can_write&&'write',r.can_approve&&'approve'].filter(Boolean)]))};
 }});
 let seq=0;const runtime=createServerBookingRuntime({service,tenantId:'sarberki-test',id:()=> 'case-service-'+(++seq)});
 const env=(id,text,thread)=>({sender:'guest@synthetic.invalid',mailbox_id:'inbox',message_id:id,thread_id:thread,text,received_at:'2026-10-16T12:00:00Z'});
 const target=await runtime.ingest(env('stay','Please book a Deluxe cabin from 2026-11-13 to 2026-11-16 for 2 adults.','base'),undefined,{expectedRevision:0,persistDraft:true});
 const request='Please add a hot tub on 2026-11-14 at 18:00 for 24 hours.';
 const normal=await runtime.ingest(env('normal',request,'base'),undefined,{expectedRevision:1,persistDraft:true});
 const review=await runtime.ingest(env('review',request,'different'),undefined,{expectedRevision:0,persistDraft:true});
 const linked=await service.resolveServiceLink({tenantId:'sarberki-test',caseId:review.record.caseId,expectedRevision:1,targetCaseId:target.record.caseId,targetRevision:2,reason:'Synthetic identity verified'});
 let version='v1',bindingVersion='b1',validity=90000,clock=()=>new Date().toISOString(),duringAvailability=null,bindingChange=null;
 const bindingProvider=async({review,target,request})=>{const now=Date.now();const b={tenantId:'sarberki-test',caseId:review.caseId,caseRevision:review.revision,targetCaseId:target.caseId,targetRevision:target.revision,requestId:review.data.serviceRequests.at(-1).sourceMessageId,houseNumber:1,resourceId:'tub-one',start:'2026-11-14T18:00:00+01:00',end:'2026-11-15T18:00:00+01:00',provenance:'synthetic-binding',reference:'binding-1',version:bindingVersion,checkedAt:new Date(now-1000).toISOString(),validUntil:new Date(now+validity).toISOString()};bindingChange?.(b);return b;};
 const provider={sourceId:'synthetic-calendar',provenance:'trusted-fixture-adapter',resourceId:'tub-one',readSnapshot:async q=>{await duringAvailability?.();const now=Date.now();return {sourceId:'synthetic-calendar',provenance:'trusted-fixture-adapter',evidenceReference:'calendar-1',version,checkedAt:new Date(now-1000).toISOString(),validUntil:new Date(now+validity).toISOString(),binding:{...q},coverage:{tenantId:q.tenantId,resourceId:q.resourceId,start:q.start,end:q.end,complete:true},bookings:[]};}};
 const attestor=createServiceApprovalAttestor(key),flow=()=>createTubServiceApproval({service,tenantId:'sarberki-test',bindingProvider,availabilityProvider:provider,attestor,clock});
 const raw=proof=>as(()=>db.query('select sc_approve_tub_service($1,$2) as result',[JSON.stringify(proof.p_payload),proof.p_attestation]));
 return {db,as,repository,service,runtime,env,flow,target:normal.record,review:linked,raw,attestor,get captured(){return captured;},set subject(v){subject=v;},set version(v){version=v;},set validity(v){validity=v;},set bindingVersion(v){bindingVersion=v;},set clock(v){clock=v;},set duringAvailability(v){duringAvailability=v;},set bindingChange(v){bindingChange=v;}};
}

test('negated withdrawal persists as unknown intent, renders a clarification draft and blocks service approval before any provider call',async()=>{
 const f=await fixture();try{
  let revision=f.target.revision,seq=0,providerCalls=0;
  f.bindingChange=()=>providerCalls++;
  f.duringAvailability=async()=>providerCalls++;
  for(const text of ['Kérjük, ne mondják le a dézsát.','Please do not cancel the hot tub.','Bitte den Badezuber nicht stornieren.','Prosimo, ne prekličite masažne kadi.','Please cancel the hot tub and add a hot tub.']){
   const result=await f.runtime.ingest({...f.env('uncertain-'+(++seq),text,'base'),received_at:'2026-10-16T12:01:00Z'},undefined,{expectedRevision:revision,persistDraft:true});
   revision=result.record.revision;
   assert.equal(result.record.caseId,f.target.caseId);
   assert.equal(result.record.data.state.approval,'pending');
   assert.equal(result.record.data.state.hotTub.requested,null);
   assert.match(result.record.data.drafts.at(-1).operatorReviewText,/szándék nem egyértelmű/u);
   const preview=await f.runtime.previewDraft(result.record.caseId,revision);
   assert.equal(preview.serviceRequest.verificationStatus,'intent_unverified');
   assert.equal(preview.serviceRequest.requested,null);
   assert.match(preview.operatorReviewText,/szándék nem egyértelmű/u);
   assert.equal((await f.flow().state(result.record.caseId,revision)).canApproveService,false);
   await assert.rejects(f.flow().approve(result.record.caseId,revision,'a'.repeat(64)),e=>e.code==='REVIEW_NOT_READY');
  }
  assert.equal(providerCalls,0);
  assert.equal((await f.db.query('select count(*)::int n from sc_service_approvals')).rows[0].n,0);
  assert.equal((await f.db.query('select count(*)::int n from sc_audit')).rows[0].n,9);
  const mixed=await f.runtime.ingest({...f.env('mixed-uncertain','Please book one Deluxe cabin from 2026-12-11 to 2026-12-14 for 4 adults. Please do not cancel the hot tub.','new-mixed'),sender:'mixed@synthetic.invalid'},undefined,{expectedRevision:0,persistDraft:true});
  assert.equal(mixed.record.data.state.values.arrival,'2026-12-11');
  assert.notEqual(mixed.record.data.caseKind,'service_link_review');
  assert.match(mixed.record.data.drafts.at(-1).text,/keep or withdraw/u);
  const mixedPreview=await f.runtime.previewDraft(mixed.record.caseId,mixed.record.revision);
  assert.equal(mixedPreview.serviceOnly,false);
  assert.match(mixedPreview.text,/keep or withdraw/u);
  assert.match(mixedPreview.operatorReviewText,/szándék nem egyértelmű/u);
  assert.equal((await f.flow().state(mixed.record.caseId,mixed.record.revision)).canApproveService,false);
  assert.equal(providerCalls,0);
 }finally{await f.db.close();}
});

test('conditional intent and conflicting withdrawal references persist through the normal Writer without changing the target or permitting approval',async()=>{
 const f=await fixture();try{
  const targetBefore=(await f.db.query('select * from sc_cases where case_id=$1',[f.target.caseId])).rows;
  let seq=0,providerCalls=0;
  f.bindingChange=()=>providerCalls++;
  f.duringAvailability=async()=>providerCalls++;
  for(const request of ['Please cancel the hot tub.','Please do not cancel the hot tub.','If it rains, please cancel the hot tub.']){
   const result=await f.runtime.ingest({...f.env('ref-conflict-'+(++seq),'Booking reference REF-123. Reservierungsnummer OTHER-456. '+request,'base'),received_at:'2026-10-16T12:01:00Z'},undefined,{expectedRevision:0,persistDraft:true});
   assert.notEqual(result.record.caseId,f.target.caseId);
   assert.equal(result.record.data.caseKind,'service_link_review');
   assert.equal(result.record.data.linkReview.evidence,'conflicting_service_booking_references');
   assert.equal(result.record.data.serviceRequests.at(-1).bookingReferenceConflict,true);
   assert.equal(result.record.data.serviceRequests.at(-1).linkedCaseId,null);
   assert.equal(result.record.data.state.approval,'pending');
   assert.equal((await f.flow().state(result.record.caseId,result.record.revision)).canApproveService,false);
  }
  assert.deepEqual((await f.db.query('select * from sc_cases where case_id=$1',[f.target.caseId])).rows,targetBefore);
  const conditional=await f.runtime.ingest({...f.env('condition-only','If it rains, please cancel the hot tub.','base'),received_at:'2026-10-16T12:02:00Z'},undefined,{expectedRevision:f.target.revision,persistDraft:true});
  const preview=await f.runtime.previewDraft(conditional.record.caseId,conditional.record.revision);
  assert.equal(preview.serviceRequest.requested,null);
  assert.equal(preview.serviceRequest.verificationStatus,'intent_unverified');
  assert.match(preview.text,/keep or withdraw/u);
  assert.equal((await f.flow().state(conditional.record.caseId,conditional.record.revision)).canApproveService,false);
  assert.equal(providerCalls,0);
  assert.equal((await f.db.query('select count(*)::int n from sc_service_approvals')).rows[0].n,0);
  assert.equal((await f.db.query('select count(*)::int n from sc_audit')).rows[0].n,8);
 }finally{await f.db.close();}
});
test('normal and review service approvals preserve A, both cases and accommodation approval; Reader protected status, replay, source changes and encrypted restore',async()=>{
 const f=await fixture();try{
  const before=(await f.db.query('select * from sc_cases order by case_id')).rows;
  const auditBefore=(await f.db.query('select * from sc_audit order by event_id')).rows;
  await f.db.query('update sc_memberships set can_write=false where user_id=$1',[users.approver]);
  for(const row of [f.target,f.review]){
   const preview=await f.flow().state(row.caseId,row.revision);assert.equal(preview.canApproveService,true);assert.equal(preview.status,'unapproved');assert.ok(preview.preview.hash);assert.doesNotMatch(JSON.stringify(preview),/attestation|12121212/);
   const approval=await f.flow().approve(row.caseId,row.revision,preview.preview.hash);assert.equal(approval.actor,users.approver);assert.equal(approval.payload.targetCaseId,f.target.caseId);
   assert.equal((await f.flow().state(row.caseId,row.revision)).status,'current');
   await assert.rejects(f.flow().approve(row.caseId,row.revision,preview.preview.hash),e=>e.code==='CASE_CONFLICT');
  }
  assert.deepEqual((await f.db.query('select * from sc_cases order by case_id')).rows,before);assert.deepEqual((await f.db.query('select * from sc_audit order by event_id')).rows,auditBefore);
  assert.equal((await f.service.serviceLinkState({tenantId:'sarberki-test',caseId:f.review.caseId})).status,'resolved');
  f.subject=users.reader;const reader=await f.flow().state(f.review.caseId,f.review.revision);assert.equal(reader.status,'current');assert.equal(reader.canApproveService,false);await assert.rejects(f.flow().approve(f.review.caseId,f.review.revision,'a'.repeat(64)),e=>e.code==='FORBIDDEN');
  assert.equal((await f.as(()=>f.db.query('select * from sc_service_approvals'))).rows.length,2);
  await assert.rejects(f.as(()=>f.db.exec('delete from sc_service_approvals')),/permission denied/);
  f.subject=users.other;assert.equal((await f.as(()=>f.db.query('select * from sc_service_approvals'))).rows.length,0);
  f.subject=users.approver;f.version='v2';assert.equal((await f.flow().state(f.review.caseId,f.review.revision)).status,'stale');
  const fresh=await f.flow().state(f.review.caseId,f.review.revision);f.bindingVersion='b2';await assert.rejects(f.flow().approve(f.review.caseId,f.review.revision,fresh.preview.hash),e=>e.code==='REVIEW_CHANGED');
  f.clock=()=>new Date(Date.now()+120000).toISOString();assert.equal((await f.flow().state(f.target.caseId,f.target.revision)).status,'expired');
  const manifestSQL=(await readFile(new URL('../scripts/case-store-recovery-manifest.sql',import.meta.url),'utf8')).replace(/^begin.*;$/m,'').replace(/^commit;$/m,'');
  const manifest=(await f.db.query(manifestSQL)).rows[0].recovery_manifest;assert.equal(manifest.counts.service_approvals,2);assert.equal(manifest.audit_gaps,0);assert.equal(manifest.latest_hash_mismatches,0);
  const bytes=Buffer.from(await (await f.db.dumpDataDir()).arrayBuffer()),key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),encrypted=Buffer.concat([cipher.update(bytes),cipher.final()]),tag=cipher.getAuthTag();bytes.fill(0);
  const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAuthTag(tag);const plaintext=Buffer.concat([decipher.update(encrypted),decipher.final()]),restored=new PGlite({loadDataDir:new Blob([plaintext])});plaintext.fill(0);key.fill(0);try{await restored.waitReady;assert.deepEqual((await restored.query(manifestSQL)).rows[0].recovery_manifest,manifest);assert.equal((await restored.query("select has_table_privilege('authenticated','sc_service_approvals','INSERT') as allowed")).rows[0].allowed,false);}finally{await restored.close();}
 }finally{await f.db.close();}
});
test('forged proof, direct RPC roles/session/tenant, case changes, binding expiry and provider races fail closed',async()=>{
 const f=await fixture();try{
  const preview=await f.flow().state(f.review.caseId,f.review.revision);await f.flow().approve(f.review.caseId,f.review.revision,preview.preview.hash);const proof=f.captured;
  const before=(await f.db.query('select * from sc_service_approvals')).rows;
  for(const field of ['caseRevision','targetRevision','houseNumber','resourceId','start','end','evidenceReference','bindingVersion','actor']){
   const fake=structuredClone(proof);fake.p_payload[field]=typeof fake.p_payload[field]==='number'?999:'forged';await assert.rejects(f.raw(fake),/invalid service evidence/);
  }
  const actualTarget=(await f.db.query('select data from sc_cases where case_id=$1',[f.target.caseId])).rows[0].data;
  for(const change of [d=>d.caseKind='service_link_review',d=>d.state.intent='general_question',d=>d.state.values.arrival='']){
   const invalid=structuredClone(actualTarget);change(invalid);await f.db.query('update sc_cases set data=$1 where case_id=$2',[JSON.stringify(invalid),f.target.caseId]);
   assert.equal((await f.raw(proof)).rows[0].result,null);assert.equal((await f.flow().state(f.review.caseId,f.review.revision)).canApproveService,false);
  }
  await f.db.query('update sc_cases set data=$1 where case_id=$2',[JSON.stringify(actualTarget),f.target.caseId]);
  const wrongDomain={...proof,p_attestation:'ab'.repeat(32)};await assert.rejects(f.raw(wrongDomain),/invalid service evidence/);
  await f.db.exec('set role anon');try{await assert.rejects(f.db.query('select sc_approve_tub_service($1,$2)',[JSON.stringify(proof.p_payload),proof.p_attestation]),/permission denied/);}finally{await f.db.exec('reset role');}
  for(const role of ['reader','writer','other']){f.subject=users[role];await assert.rejects(f.raw(proof),/forbidden/);}
  f.subject=users.approver;
  for(const change of [p=>p.validUntil=new Date(Date.now()-1000).toISOString(),p=>p.bindingValidUntil=new Date(Date.now()-1000).toISOString(),p=>p.houseNumber=7,p=>{p.start='2026-11-14T18:00:00.001+01:00';p.end='2026-11-15T18:00:00.001+01:00';},p=>p.caseRevision++,p=>p.targetRevision++,p=>p.tenantId='demo-test']){
   const fake=structuredClone(proof);change(fake.p_payload);fake.p_attestation=f.attestor(fake.p_payload);
   try{const result=await f.raw(fake);assert.equal(result.rows[0].result,null);}catch(error){assert.match(error.message,/forbidden|invalid service scope/);}
  }
  await f.db.query('delete from auth.sessions where id=$1',[session]);await assert.rejects(f.raw(proof),/forbidden/);await f.db.query('insert into auth.sessions values($1,$2,null)',[session,users.approver]);
  assert.deepEqual((await f.db.query('select * from sc_service_approvals')).rows,before);
  const noProvider=createTubServiceApproval({service:f.service,tenantId:'sarberki-test',attestor:f.attestor});assert.equal((await noProvider.state(f.target.caseId,f.target.revision)).canApproveService,false);await assert.rejects(noProvider.approve(f.target.caseId,f.target.revision,'a'.repeat(64)),e=>e.code==='SERVICE_AVAILABILITY_UNKNOWN');
  for(const change of [b=>b.caseRevision++,b=>b.targetRevision++,b=>b.checkedAt='invalid',b=>b.validUntil=new Date(Date.now()-1000).toISOString(),b=>b.start='2026-11-14T18:00:00.001+01:00',b=>{b.start='2026-11-14T18:00:00+02:00';b.end='2026-11-15T18:00:00+02:00';}]){f.bindingChange=change;assert.equal((await f.flow().state(f.target.caseId,f.target.revision)).canApproveService,false);}
  const normalRecord=await f.repository.get('sarberki-test',f.target.caseId),malformed=structuredClone(normalRecord.data);
  malformed.messages.push({...malformed.messages.at(-1),message_id:'malformed-withdrawal',received_at:'not-a-time',text:'Please cancel the hot tub.'});
  await f.db.query('update sc_cases set data=$1 where case_id=$2',[JSON.stringify(malformed),f.target.caseId]);
  assert.equal((await f.flow().state(f.target.caseId,f.target.revision)).canApproveService,false);
  await f.db.query('update sc_cases set data=$1 where case_id=$2',[JSON.stringify(normalRecord.data),f.target.caseId]);
  f.bindingChange=null;f.version='v2';const beforeRevoke=await f.flow().state(f.target.caseId,f.target.revision);
  f.duringAvailability=async()=>{await f.db.query('update sc_memberships set can_approve=false where user_id=$1',[users.approver]);f.duringAvailability=null;};
  await assert.rejects(f.flow().approve(f.target.caseId,f.target.revision,beforeRevoke.preview.hash),e=>e.code==='FORBIDDEN');
  await f.db.query('update sc_memberships set can_approve=true where user_id=$1',[users.approver]);
  f.bindingChange=null;f.version='v3';const p=await f.flow().state(f.target.caseId,f.target.revision);
  f.duringAvailability=async()=>{await f.db.query('update sc_cases set revision=revision+1 where case_id=$1',[f.target.caseId]);f.duringAvailability=null;};
  await assert.rejects(f.flow().approve(f.target.caseId,f.target.revision,p.preview.hash),e=>e.code==='CASE_CONFLICT');
  assert.equal((await f.flow().state(f.review.caseId,f.review.revision)).status,'stale');
  assert.equal((await f.db.query('select count(*)::int n from sc_service_approvals')).rows[0].n,1);
  assert.ok(serviceApprovalMessage(proof.p_payload).startsWith('sarberki:tub-service-approval:v1\n'));
 }finally{await f.db.close();}
});

test('expired scope can be renewed with a fresh proof, while live scope and exact payload replay cannot append',async()=>{
 const f=await fixture();try{
  f.validity=1000;const p=await f.flow().state(f.target.caseId,f.target.revision);await f.flow().approve(f.target.caseId,f.target.revision,p.preview.hash);
  await new Promise(resolve=>setTimeout(resolve,1100));f.validity=90000;
  const renewed=await f.flow().state(f.target.caseId,f.target.revision);assert.equal(renewed.status,'expired');assert.equal(renewed.canApproveService,true);assert.equal(renewed.preview.hash,p.preview.hash);
  await f.flow().approve(f.target.caseId,f.target.revision,renewed.preview.hash);
  assert.equal((await f.raw(f.captured)).rows[0].result,null);
  assert.equal((await f.db.query('select count(*)::int n from sc_service_approvals')).rows[0].n,2);
  await assert.rejects(f.flow().approve(f.target.caseId,f.target.revision,p.preview.hash),e=>e.code==='CASE_CONFLICT');
 }finally{await f.db.close();}
});
