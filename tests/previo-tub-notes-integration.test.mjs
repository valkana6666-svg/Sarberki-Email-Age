import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticPrevioTubAdapter} from '../shared-core/previo-tub-synthetic-adapter.mjs';
import {createTubAvailabilityChecker} from '../shared-core/server-tub-availability.mjs';
const q={tenantId:'sarberki-test',caseId:'synthetic-case',caseRevision:1,houseNumber:12,resourceId:'tub-house-12',start:'2026-10-24T16:00:00Z',end:'2026-10-25T16:00:00Z'};
test('synthetic Previo notes cannot prove complete availability',async()=>{
 const notes=createSyntheticPrevioTubAdapter({bookings:[]});
 const provider={sourceId:'synthetic-notes',provenance:'incomplete-fixture',resourceId:q.resourceId,readSnapshot:async query=>{
  const data=await notes.read(query);
  return {sourceId:'synthetic-notes',provenance:'incomplete-fixture',evidenceReference:'synthetic',version:'v1',checkedAt:'2026-10-16T15:00:00Z',validUntil:'2026-10-16T15:02:00Z',binding:{...query},coverage:{tenantId:query.tenantId,resourceId:query.resourceId,complete:data.complete,start:query.start,end:query.end},bookings:[]};
 }};
 const result=await createTubAvailabilityChecker({provider,clock:()=>Date.parse('2026-10-16T15:01:00Z')}).check(q);
 assert.equal(result.status,'UNKNOWN');
 assert.equal(result.error,'INCOMPLETE_CALENDAR');
 assert.equal(result.confirmationAllowed,false);
});

test('two accommodation houses requesting same fixed tub remain unverified from notes alone',async()=>{
 const bookings=[8,10].map((accommodationHouse,i)=>({id:'synthetic-cross-house-'+i,tenantId:q.tenantId,resourceId:q.resourceId,accommodationHouse,start:q.start,end:q.end,note:'12-es dézsa 2026-10-24 18:00'}));
 const reader=createSyntheticPrevioTubAdapter({bookings});
 const notes=await reader.read(q);
 assert.equal(notes.notes.length,2);
 assert.equal(notes.complete,false);
 const provider={sourceId:'synthetic-notes',provenance:'incomplete-fixture',resourceId:q.resourceId,readSnapshot:async query=>({
  sourceId:'synthetic-notes',provenance:'incomplete-fixture',evidenceReference:'synthetic',version:'v1',checkedAt:'2026-10-16T15:00:00Z',validUntil:'2026-10-16T15:02:00Z',binding:{...query},
  coverage:{tenantId:query.tenantId,resourceId:query.resourceId,complete:notes.complete,start:query.start,end:query.end},bookings:[]
 })};
 const result=await createTubAvailabilityChecker({provider,clock:()=>Date.parse('2026-10-16T15:01:00Z')}).check(q);
 assert.equal(result.status,'UNKNOWN');
 assert.equal(result.error,'INCOMPLETE_CALENDAR');
 assert.equal(result.confirmationAllowed,false);
});
