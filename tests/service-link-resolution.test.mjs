import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createServerCaseService} from '../shared-core/server-case-service.mjs';
import {createServerBookingRuntime} from '../shared-core/server-booking-runtime.mjs';
import {createSupabaseCaseRepository} from '../shared-core/supabase-case-repository.mjs';
const ids={approver:'11111111-1111-4111-8111-111111111111',writer:'22222222-2222-4222-8222-222222222222',reader:'33333333-3333-4333-8333-333333333333',outsider:'44444444-4444-4444-8444-444444444444'};
test('protected service link PostgreSQL RPC: permissions, CAS, tenant, JSON spoof, audit, target preservation and recovery manifest',async()=>{
 const db=new PGlite();let subject=ids.approver;
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  await db.exec(await readFile(new URL('../supabase/migrations/202610090001_case_store.sql',import.meta.url),'utf8'));
  const migration=(await readdir(new URL('../supabase/migrations/',import.meta.url))).find(n=>n.endsWith('_service_link_resolution.sql'));
  await db.exec(await readFile(new URL('../supabase/migrations/'+migration,import.meta.url),'utf8'));
  for(const id of Object.values(ids))await db.query('insert into auth.users values ($1)',[id]);
  await db.exec("insert into sc_tenants values ('sarberki-test','Synthetic',true),('demo-test','Other',true)");
  for(const [role,id]of Object.entries(ids))await db.query('insert into sc_memberships values ($1,$2,true,$3,$4)',[role==='outsider'?'demo-test':'sarberki-test',id,['approver','writer'].includes(role),role==='approver']);
  let queue=Promise.resolve();const as=action=>{const actor=subject,run=queue.then(async()=>{await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);try{return await action();}finally{await db.exec('reset role');}});queue=run.catch(()=>{});return run;};
  const transport=async(path,{body}={})=>as(async()=>{
   if(path.includes('/rpc/sc_write_case'))return (await db.query('select sc_write_case($1,$2,$3,$4) as result',[body.p_tenant,body.p_case,body.p_expected,JSON.stringify(body.p_data)])).rows[0].result;
   if(path.includes('/rpc/sc_resolve_service_link'))return (await db.query('select sc_resolve_service_link($1,$2,$3,$4,$5,$6) as result',[body.p_tenant,body.p_case,body.p_expected,body.p_target,body.p_target_expected,body.p_reason])).rows[0].result;
   const url=new URL('https://synthetic.invalid'+path),q=url.searchParams,tenant=q.get('tenant_id')?.slice(3),id=q.get('case_id')?.slice(3);
   if(path.includes('/sc_service_link_decisions?'))return (await db.query('select * from sc_service_link_decisions where tenant_id=$1 and review_case_id=$2 order by review_revision desc limit 1',[tenant,q.get('review_case_id').slice(3)])).rows;
   return (await db.query('select * from sc_cases where tenant_id=$1'+(id?' and case_id=$2':''),id?[tenant,id]:[tenant])).rows;
  });
  const repository=createSupabaseCaseRepository(transport),service=createServerCaseService({repository,resolveAuthority:async()=>({subject,tenants:{'sarberki-test':subject===ids.outsider?[]:subject===ids.approver?['read','write','approve']:subject===ids.writer?['read','write']:['read']}})});
  let seq=0;const runtime=createServerBookingRuntime({service,tenantId:'sarberki-test',id:()=> 'case-link-'+(++seq)});
  const env=(id,text,thread)=>({sender:'guest@synthetic.invalid',mailbox_id:'inbox',message_id:id,thread_id:thread,text,received_at:'2026-10-16T12:00:00Z'});
  const target=await runtime.ingest(env('base','Please book a Deluxe cabin from 2026-11-13 to 2026-11-16 for 2 adults.','base'),undefined,{expectedRevision:0,persistDraft:true});
  const review=await runtime.ingest(env('tub','Please add a hot tub on 2026-11-14 at 18:00 for 24 hours.','other'),undefined,{expectedRevision:0,persistDraft:true});
  const resolve=(expected=1,targetExpected=1,targetId=target.record.caseId)=>service.resolveServiceLink({tenantId:'sarberki-test',caseId:review.record.caseId,expectedRevision:expected,targetCaseId:targetId,targetRevision:targetExpected,reason:'Synthetic operator verified identity'});
  const direct=(expected=1,targetExpected=1,targetId=target.record.caseId)=>as(()=>db.query('select sc_resolve_service_link($1,$2,$3,$4,$5,$6) as result',['sarberki-test',review.record.caseId,expected,targetId,targetExpected,'Synthetic operator verified identity']));
  for(const role of ['reader','writer','outsider']){subject=ids[role];await assert.rejects(resolve(),e=>e.code==='FORBIDDEN');await assert.rejects(direct(),/forbidden/);}
  subject=ids.reader;assert.equal((await runtime.previewDraft(review.record.caseId,1)).canResolveServiceLink,false);
  for(const sql of ['insert into sc_service_link_decisions select * from sc_service_link_decisions','update sc_service_link_decisions set reason=reason','delete from sc_service_link_decisions'])await assert.rejects(as(()=>db.exec(sql)),/permission denied/);
  subject=ids.approver;
  const spoof=structuredClone(review.record.data);spoof.serviceLinkResolution={targetCaseId:target.record.caseId,actor:ids.approver,verified:true};spoof.serviceRequests[0].linkedCaseId=target.record.caseId;
  await service.updateCase({tenantId:'sarberki-test',caseId:review.record.caseId,expectedRevision:1,bookingCase:spoof});
  const spoofPreview=await runtime.previewDraft(review.record.caseId,2);assert.equal(spoofPreview.serviceLink.status,'unresolved');assert.equal(spoofPreview.serviceRequest.linkedCaseId,null);assert.equal(spoofPreview.approval,'pending');
  await assert.rejects(resolve(1),e=>e.code==='CASE_CONFLICT');await assert.rejects(resolve(2,99),e=>e.code==='CASE_CONFLICT');await assert.rejects(resolve(2,2,review.record.caseId),e=>e.code==='INVALID_INPUT');
  const snapshot=async()=>JSON.stringify((await db.query("select (select jsonb_agg(to_jsonb(c) order by case_id) from sc_cases c) as cases,(select jsonb_agg(to_jsonb(d)) from sc_service_link_decisions d) as decisions,(select jsonb_agg(to_jsonb(a) order by event_id) from sc_audit a) as audit")).rows);
  const beforeInvalid=await snapshot();
  await db.exec('set role anon');
  try{await assert.rejects(db.query('select sc_resolve_service_link($1,$2,$3,$4,$5,$6)',['sarberki-test',review.record.caseId,2,target.record.caseId,1,'Synthetic reason']),/permission denied/);}finally{await db.exec('reset role');}
  for(const change of [{sender:'other@synthetic.invalid'},{caseKind:'service_link_review'},{state:{...target.record.data.state,values:{...target.record.data.state.values,arrival:''}}}]){
   // Owner-only fixture mutation simulates independent pre-existing bad targets.
   const altered={...target.record.data,...change};await db.query('update sc_cases set data=$1 where case_id=$2',[JSON.stringify(altered),target.record.caseId]);
   const frozen=await snapshot();await assert.rejects(direct(2),/invalid service link/);assert.equal(await snapshot(),frozen);
   await db.query('update sc_cases set data=$1 where case_id=$2',[JSON.stringify(target.record.data),target.record.caseId]);
  }
  assert.equal(await snapshot(),beforeInvalid);
  const targetBefore=JSON.stringify(await repository.get('sarberki-test',target.record.caseId));
  const saved=await resolve(2);assert.equal(saved.revision,3);assert.equal(saved.data.state.approval,'pending');assert.equal(saved.data.serverApproval,undefined);
  assert.equal(JSON.stringify(await repository.get('sarberki-test',target.record.caseId)),targetBefore);
  const preview=await runtime.previewDraft(review.record.caseId,3);assert.equal(preview.serviceLink.status,'resolved');assert.equal(preview.serviceRequest.linkedCaseId,target.record.caseId);assert.equal(preview.canResolveServiceLink,false);assert.equal(preview.approval,'pending');assert.equal(preview.serviceRequest.verificationStatus,'unverified');
  await assert.rejects(resolve(3),e=>e.code==='CASE_CONFLICT');
  subject=ids.reader;assert.equal((await service.serviceLinkState({tenantId:'sarberki-test',caseId:review.record.caseId})).actor,ids.approver);
  subject=ids.outsider;assert.equal((await as(()=>db.query('select * from sc_service_link_decisions'))).rows.length,0);
  subject=ids.approver;
  const targetCurrent=await repository.get('sarberki-test',target.record.caseId);await service.updateCase({tenantId:'sarberki-test',caseId:target.record.caseId,expectedRevision:1,bookingCase:targetCurrent.data});
  assert.equal((await runtime.previewDraft(review.record.caseId,3)).serviceLink.status,'stale');
  await resolve(3,2);
  const current=await repository.get('sarberki-test',review.record.caseId);current.data.messages.push({...current.data.messages[0],message_id:'inbox:new-message'});
  await service.updateCase({tenantId:'sarberki-test',caseId:review.record.caseId,expectedRevision:4,bookingCase:current.data});
  const stale=await runtime.previewDraft(review.record.caseId,5);assert.equal(stale.serviceLink.status,'stale');assert.equal(stale.serviceRequest.linkedCaseId,null);assert.equal(stale.approval,'pending');
  const audit=(await db.query("select * from sc_audit where kind='resolve_service_link' order by revision")).rows;assert.equal(audit.length,2);assert.ok(audit.every(x=>x.actor===ids.approver));
  const manifest=await db.query((await readFile(new URL('../scripts/case-store-recovery-manifest.sql',import.meta.url),'utf8')).replace(/^begin.*;$/m,'').replace(/^commit;$/m,''));
  const proof=manifest.rows[0].recovery_manifest;assert.equal(proof.audit_gaps,0);assert.equal(proof.latest_hash_mismatches,0);assert.equal(proof.counts.service_link_decisions,2);assert.ok(proof.tables.some(t=>t.relname==='sc_service_link_decisions'&&t.relrowsecurity));assert.ok(proof.functions.some(f=>f.name==='sc_resolve_service_link'));
  for(const file of ['owner-encrypted-backup.py','owner-encrypted-backup.ps1'])assert.match(await readFile(new URL('../scripts/'+file,import.meta.url),'utf8'),/sc_service_link_decisions/);
 }finally{await db.close();}
});
