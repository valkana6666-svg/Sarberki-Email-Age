import test from 'node:test';
import assert from 'node:assert/strict';
import {createTubAvailabilityChecker} from '../shared-core/server-tub-availability.mjs';

const checkedAt='2026-10-16T15:00:00Z', validUntil='2026-10-16T15:02:00Z';
const query={tenantId:'sarberki-test',caseId:'synthetic-tub-review',caseRevision:1,houseNumber:12,resourceId:'tub-house-12',start:'2026-10-24T16:00:00Z',end:'2026-10-25T16:00:00Z'};
const booking=(resourceId,houseNumber,start,end)=>({id:'synthetic-booking-'+resourceId,tenantId:'sarberki-test',resourceId,houseNumber,start,end,status:'reserved'});
function checker(bookings,complete=true){
 const provider={sourceId:'synthetic-previo-notes',provenance:'closed-fixture',resourceId:'tub-house-12',readSnapshot:async q=>({sourceId:'synthetic-previo-notes',provenance:'closed-fixture',evidenceReference:'synthetic-calendar',version:'v1',checkedAt,validUntil,binding:{...q},coverage:{tenantId:q.tenantId,resourceId:q.resourceId,complete,start:'2026-10-23T00:00:00Z',end:'2026-10-27T00:00:00Z'},bookings})};
 return createTubAvailabilityChecker({provider,clock:()=>Date.parse('2026-10-16T15:01:00Z')});
}
test('another accommodation reserving the same fixed tub blocks overlapping time',async()=>{
 const result=await checker([booking('tub-house-12',12,'2026-10-24T16:00:00Z','2026-10-25T16:00:00Z')]).check(query);
 assert.equal(result.status,'UNAVAILABLE');assert.equal(result.conflictCount,1);assert.equal(result.confirmationAllowed,false);
});
test('different physical tub does not block house 12 tub when calendar is complete',async()=>{
 const result=await checker([booking('tub-house-11',11,'2026-10-24T16:00:00Z','2026-10-25T16:00:00Z')]).check(query);
 assert.equal(result.status,'AVAILABLE');assert.equal(result.confirmationAllowed,false);
});
test('adjacent interval without overlap does not conflict',async()=>{
 const result=await checker([booking('tub-house-12',12,'2026-10-25T16:00:00Z','2026-10-26T16:00:00Z')]).check(query);
 assert.equal(result.status,'AVAILABLE');
});
test('incomplete Previo notes cannot prove availability',async()=>{
 const result=await checker([],false).check(query);
 assert.equal(result.status,'UNKNOWN');assert.equal(result.confirmationAllowed,false);
});
