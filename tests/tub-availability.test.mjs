import test from 'node:test';
import assert from 'node:assert/strict';
import {createTubAvailabilityChecker} from '../shared-core/server-tub-availability.mjs';
import {AVAILABILITY,EVIDENCE_TTL_MS} from '../shared-core/availability-model.mjs';
const now=Date.parse('2026-10-16T12:00:00Z');
const query={tenantId:'sarberki-test',caseId:'case-synthetic',caseRevision:3,houseNumber:1,resourceId:'tub-one',start:'2026-11-14T18:00:00+01:00',end:'2026-11-16T18:00:00+01:00'};
function fixture(change=()=>{},clock=()=>now){
 let calls=0;
 const provider={sourceId:'synthetic-calendar',provenance:'injected-server-fixture',resourceId:'tub-one',readSnapshot:async q=>{
  calls++;const data={sourceId:'synthetic-calendar',provenance:'injected-server-fixture',evidenceReference:'snapshot-42',version:'v7',checkedAt:'2026-10-16T11:59:30Z',validUntil:'2026-10-16T12:01:00Z',binding:{...q},coverage:{tenantId:q.tenantId,resourceId:q.resourceId,start:q.start,end:q.end,complete:true},bookings:[]};
  change(data);return data;
 }};
 return {checker:createTubAvailabilityChecker({provider,clock}),calls:()=>calls,provider};
}
const booking=(extra={})=>({id:'reservation-1',tenantId:'sarberki-test',resourceId:'tub-one',houseNumber:11,start:'2026-11-15T10:00:00+01:00',end:'2026-11-15T12:00:00+01:00',status:'reserved',...extra});
test('no default provider and client source/verified flags never establish availability',async()=>{
 assert.equal((await createTubAvailabilityChecker().check(query)).status,AVAILABILITY.UNKNOWN);
 for(const provider of [{sourceId:'trusted',verified:true},{readSnapshot:()=>({verified:true})}])assert.equal((await createTubAvailabilityChecker({provider}).check(query)).valid,false);
 const {checker,calls}=fixture();assert.equal((await checker.check({...query,verified:true})).status,AVAILABILITY.UNKNOWN);assert.equal(calls(),0);
});
test('eligible free complete resource calendar returns short-lived evidence, never approval',async()=>{
 const {checker}=fixture();const result=await checker.check(query);
 assert.equal(result.status,AVAILABILITY.AVAILABLE);assert.equal(result.valid,true);assert.equal(result.confirmationAllowed,false);assert.equal(result.version,'v7');assert.deepEqual(result.query,query);
 assert.ok(Object.isFrozen(result));assert.ok(Object.isFrozen(result.query));
});
test('config eligibility excludes 7–10 and invalid houses without asking a provider',async()=>{
 const {checker,calls}=fixture();
 for(const houseNumber of [0,7,8,9,10,16,'1','7A'])assert.equal((await checker.check({...query,houseNumber})).valid,false);
 assert.equal(calls(),0);
 for(const houseNumber of [1,2,3,4,5,6,11,12,13,14,15])assert.equal((await checker.check({...query,houseNumber})).status,AVAILABILITY.AVAILABLE);
});
test('entire multi-day period and same resource at another house conflict; half-open boundaries stay free',async()=>{
 for(const [entry,status] of [[booking(),AVAILABILITY.UNAVAILABLE],[booking({status:'blocked'}),AVAILABILITY.UNAVAILABLE],
  [booking({start:'2026-11-13T10:00:00+01:00',end:query.start}),AVAILABILITY.AVAILABLE],
  [booking({start:query.end,end:'2026-11-17T10:00:00+01:00'}),AVAILABILITY.AVAILABLE],
  [booking({resourceId:'tub-two'}),AVAILABILITY.AVAILABLE],[booking({status:'cancelled'}),AVAILABILITY.AVAILABLE],
  [booking({start:'2026-11-14T17:00:00Z',end:'2026-11-14T19:00:00Z'}),AVAILABILITY.UNAVAILABLE]]){
  const {checker}=fixture(s=>s.bookings=[entry]);assert.equal((await checker.check(query)).status,status);
 }
});
test('impossible/ambiguous/local dates, invalid offsets and inverted intervals fail before provider calls',async()=>{
 const {checker,calls}=fixture();
 for(const start of ['2026-11-14','2026-11-14T18:00:00','2026-02-30T18:00:00Z','2026-11-14T24:00:00Z','2026-11-14T18:00:60Z','2026-11-14T18:00:00+14:01','2026-11-14T18:00:00+25:00','2026-11-14T18:00:00 Europe/Budapest',query.end])assert.equal((await checker.check({...query,start})).valid,false,start);
 assert.equal(calls(),0);
});
test('tenant/case/revision/house/resource/time binding cannot be reused',async()=>{
 for(const field of Object.keys(query)){
  const {checker}=fixture(s=>{s.binding[field]=typeof s.binding[field]==='number'?999:'different';});
  assert.equal((await checker.check(query)).status,AVAILABILITY.UNKNOWN,field);
 }
 const {checker,calls}=fixture();assert.equal((await checker.check({...query,resourceId:'tub-other'})).valid,false);assert.equal(calls(),0);
});
test('source identity, provenance, evidence reference and version are required independently of verified flags',async()=>{
 for(const field of ['sourceId','provenance','evidenceReference','version'])for(const value of [undefined,'','guest supplied']){
  const {checker}=fixture(s=>{s[field]=value;s.verified=true;});assert.equal((await checker.check(query)).valid,false,field);
 }
 const {checker}=fixture(s=>s.provenance='different-source');assert.equal((await checker.check(query)).valid,false);
});
test('expired/future/malformed timestamps and excessive validity windows remain unknown at TTL boundaries',async()=>{
 for(const change of [s=>s.checkedAt='2026-10-16T12:00:01Z',s=>s.checkedAt='2026-10-16T11:58:00Z',s=>s.checkedAt='2026-10-16T11:59:30',s=>s.validUntil='2026-10-16T12:00:00Z',s=>s.validUntil='2026-10-16T12:02:00Z',s=>s.validUntil=s.checkedAt])assert.equal((await fixture(change).checker.check(query)).valid,false);
 for(const clock of [()=>NaN,()=>Infinity,()=>now+60000])assert.equal((await fixture(()=>{},clock).checker.check(query)).valid,false);
 for(const deadline of [now+60000,now+EVIDENCE_TTL_MS,NaN]){let tick=0;assert.equal((await fixture(()=>{},()=>++tick===1?now:deadline).checker.check(query)).valid,false);}

});
test('partial coverage and malformed/incomplete booking lists never claim free resource',async()=>{
 for(const change of [s=>delete s.coverage,s=>s.coverage.complete=false,s=>s.coverage.tenantId='demo-test',s=>s.coverage.resourceId='tub-two',s=>s.coverage.start='2026-11-15T18:00:00+01:00',s=>s.coverage.end='2026-11-15T18:00:00+01:00',s=>s.bookings=null])assert.equal((await fixture(change).checker.check(query)).valid,false);
 for(const extra of [{start:'invalid'},{end:'2026-11-14T18:00:00+01:00'},{tenantId:'demo-test'},{resourceId:null},{status:'unknown'},{houseNumber:'11'},{id:''}])assert.equal((await fixture(s=>s.bookings=[booking(extra)]).checker.check(query)).valid,false);
 assert.equal((await fixture(s=>s.bookings=[booking(),booking()]).checker.check(query)).valid,false);
});
test('provider failure is safely unknown and no retry is attempted',async()=>{
 let calls=0;const checker=createTubAvailabilityChecker({clock:()=>now,provider:{sourceId:'source',provenance:'server',resourceId:'tub-one',readSnapshot:()=>{calls++;throw Error('provider private detail');}}});
 const result=await checker.check(query);assert.equal(result.status,AVAILABILITY.UNKNOWN);assert.equal(result.error,'PROVIDER_FAILURE');assert.equal(calls,1);assert.doesNotMatch(JSON.stringify(result),/private detail/);
});

test('provider and caller mutations cannot rewrite the returned evidence or frozen binding',async()=>{
 let snapshot;const f=fixture(s=>snapshot=s),input={...query};
 const result=await f.checker.check(input);
 snapshot.bookings.push(booking());snapshot.binding.houseNumber=7;snapshot.version='tampered';snapshot.sourceId='tampered';
 input.houseNumber=7;f.provider.sourceId='tampered';
 assert.equal(result.status,AVAILABILITY.AVAILABLE);assert.equal(result.query.houseNumber,1);assert.equal(result.version,'v7');assert.equal(result.sourceId,'synthetic-calendar');
 assert.throws(()=>result.status=AVAILABILITY.UNAVAILABLE,TypeError);assert.throws(()=>result.query.caseRevision=999,TypeError);
 // Trusted identity was captured at construction; source text changes cannot reconfigure it.
 assert.equal((await f.checker.check(query)).sourceId,'synthetic-calendar');
});
