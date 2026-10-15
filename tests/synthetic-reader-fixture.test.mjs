import test from 'node:test';
import assert from 'node:assert/strict';
import {createServerCaseService} from '../shared-core/server-case-service.mjs';
import {createServerBookingRuntime} from '../shared-core/server-booking-runtime.mjs';
import {createCaseStoreClient} from '../shared-core/case-store-client.mjs';
import {syntheticCaseSummaries} from '../netlify/functions/booking-cases.mjs';
import {ensureSyntheticReaderFixture,syntheticReaderFixtureRequest} from '../shared-core/synthetic-reader-fixture.mjs';

function fixture(){
 const rows=new Map();
 const repository={
  get:async(t,c)=>structuredClone(rows.get(t+':'+c)||null),
  list:async t=>structuredClone([...rows.values()].filter(r=>r.tenantId===t)),
  insert:async(t,c,r)=>{if(rows.has(t+':'+c))return false;rows.set(t+':'+c,structuredClone(r));return true;},
  compareAndSwap:async(t,c,v,r)=>{if(rows.get(t+':'+c)?.revision!==v)return false;rows.set(t+':'+c,structuredClone(r));return true;}
 };
 const service=createServerCaseService({repository,resolveAuthority:async context=>context});
 const writer={subject:'writer-synthetic',tenants:{'sarberki-test':['read','write']}};
 const reader={subject:'reader-synthetic',tenants:{'sarberki-test':['read']}};
 const runtime=createServerBookingRuntime({service,tenantId:'sarberki-test',requestContext:writer,
  clock:()=>'2026-10-12T12:00:00Z'});
 const readRuntime=createServerBookingRuntime({service,tenantId:'sarberki-test',requestContext:reader,
  clock:()=>'2026-10-12T12:00:00Z'});
 const client={
  ingestAndDraft:async input=>{
   assert.deepEqual(Object.keys(input).sort(),['action','envelope','expectedRevision','tenantId']);
   assert.equal(input.tenantId,'sarberki-test');assert.equal(input.action,'ingest-and-draft');
   return runtime.ingest(input.envelope,undefined,{expectedRevision:input.expectedRevision,persistDraft:true});
  }
 };
 return {rows,service,writer,reader,runtime,readRuntime,client};
}
test('synthetic reader fixture is a reproducible fixed fictional inquiry without client-supplied facts',()=>{
 const first=syntheticReaderFixtureRequest(),next=syntheticReaderFixtureRequest();
 assert.deepEqual(first,next);assert.notEqual(first.envelope,next.envelope);
 assert.equal(first.expectedRevision,0);assert.equal(first.action,'ingest-and-draft');
 assert.equal(first.tenantId,'sarberki-test');assert.equal('values' in first,false);
 assert.match(first.envelope.sender,/\.invalid$/);assert.match(first.envelope.text,/2026-10-23/);
});
test('authorized writer stores UUID synthetic case and Reader lists + previews exact saved pending draft',async()=>{
 const f=fixture();
 const first=await ensureSyntheticReaderFixture(f.client);
 assert.equal(first.tenantId,'sarberki-test');assert.equal(first.readyForReaderPreview,true);
 assert.match(first.caseId,/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
 assert.equal(first.revision,1);assert.equal(first.duplicate,false);
 const records=await f.service.listCases({requestContext:f.reader,tenantId:'sarberki-test'});
 const summaries=syntheticCaseSummaries(records);
 assert.deepEqual(summaries,[{tenantId:'sarberki-test',caseId:first.caseId,revision:1}]);
 assert.equal(Object.hasOwn(summaries[0],'data'),false);
 const preview=await f.readRuntime.previewDraft(first.caseId,first.revision);
 assert.equal(preview.storedDraft?.status,'manual_review_required');
 assert.ok(preview.storedDraft?.text?.length>20);
 assert.equal(preview.approval,'pending');
 assert.equal(preview.persisted,false);
 assert.ok(!preview.decision?.pricing?.verified);
 assert.ok(!preview.decision?.capacity?.verified);
 const again=await ensureSyntheticReaderFixture(f.client);
 assert.deepEqual(again,{...first,duplicate:true});
 assert.equal(f.rows.size,1);
 assert.equal((await f.service.getCase({requestContext:f.reader,tenantId:'sarberki-test',caseId:first.caseId})).revision,1);
 await assert.rejects(f.readRuntime.editDraft(first.caseId,first.revision,'unauthorized'),e=>e.code==='FORBIDDEN');
});
test('read-only cookie client can never seed fixture or send a server POST',async()=>{
 let calls=0;
 const client=createCaseStoreClient({cookieReadOnly:true,getCsrfToken:async()=> 'synthetic-csrf',
  request:async()=>{calls++;throw Error('No request expected');}});
 await assert.rejects(ensureSyntheticReaderFixture(client),e=>e.message==='READ_ONLY');
 assert.equal(calls,0);
});
test('fixture validation rejects mismatched tenant, legacy ID, no draft, or unsafe approval',async()=>{
 const f=fixture();const result=await f.client.ingestAndDraft(syntheticReaderFixtureRequest());
 const changed=[
  {...result,record:{...result.record,caseId:'auth_probe_12345'}},
  {...result,record:{...result.record,tenantId:'demo-test'}},
  {...result,record:{...result.record,data:{...result.record.data,drafts:[]}}},
  {...result,record:{...result.record,data:{...result.record.data,state:{...result.record.data.state,approval:'internally_approved'}}}},
  {...result,record:{...result.record,data:{...result.record.data,state:{...result.record.data.state,quote:{total:999}}}}}
 ];
 for(const item of changed)
  await assert.rejects(ensureSyntheticReaderFixture({ingestAndDraft:async()=>item}),e=>e.message==='SYNTHETIC_FIXTURE_UNVERIFIED');
 assert.equal(f.rows.size,1);
});

test('Writer probe isolates the historical approved v1 fixture and never overwrites its evidence',async()=>{
 const f=fixture();
 const legacy=syntheticReaderFixtureRequest();
 Object.assign(legacy.envelope,{sender:'guest@reader-fixture.invalid',mailbox_id:'sarberki_reader_fixture',message_id:'reader-preview-20261012-v1',thread_id:'reader-preview-synthetic-thread-v1'});
 const old=await f.client.ingestAndDraft(legacy);
 const key='sarberki-test:'+old.record.caseId;
 const approved=f.rows.get(key);
 approved.revision=4;approved.data.state.approval='internally_approved';
 approved.data.serverApproval={synthetic:true};
 const before=structuredClone(approved);
 const created=await ensureSyntheticReaderFixture(f.client);
 assert.equal(created.duplicate,false);assert.equal(created.revision,1);
 assert.notEqual(created.caseId,old.record.caseId);
 assert.deepEqual(f.rows.get(key),before);
 assert.equal(f.rows.size,2);
 const again=await ensureSyntheticReaderFixture(f.client);
 assert.deepEqual(again,{...created,duplicate:true});
 assert.deepEqual(f.rows.get(key),before);assert.equal(f.rows.size,2);
});
