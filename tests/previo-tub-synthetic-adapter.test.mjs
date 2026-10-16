import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticPrevioTubAdapter} from '../shared-core/previo-tub-synthetic-adapter.mjs';
const q={tenantId:'sarberki-test',resourceId:'tub-house-12',start:'2026-10-24T16:00:00Z',end:'2026-10-25T16:00:00Z'};
const b={id:'synthetic-b1',tenantId:'sarberki-test',resourceId:'tub-house-12',accommodationHouse:8,start:'2026-10-24T18:00:00Z',end:'2026-10-25T12:00:00Z',note:'12-es dézsa 2026-10-24 20:00'};
test('another house can request a fixed tub, note is candidate only',async()=>{const r=await createSyntheticPrevioTubAdapter({bookings:[b]}).read(q);assert.equal(r.status,'CANDIDATES_ONLY');assert.equal(r.complete,false);assert.equal(r.notes.length,1)});
test('different physical tub is not returned',async()=>{const r=await createSyntheticPrevioTubAdapter({bookings:[{...b,resourceId:'tub-house-11'}]}).read(q);assert.equal(r.notes.length,0);assert.equal(r.complete,false)});
test('adjacent interval is excluded',async()=>{const r=await createSyntheticPrevioTubAdapter({bookings:[{...b,end:q.start,start:'2026-10-23T16:00:00Z'}]}).read(q);assert.equal(r.notes.length,0)});
test('tenant isolation',async()=>{const r=await createSyntheticPrevioTubAdapter({bookings:[{...b,tenantId:'other-tenant'}]}).read(q);assert.equal(r.notes.length,0)});
test('invalid fixture rejected',()=>assert.throws(()=>createSyntheticPrevioTubAdapter({bookings:[{id:'bad'}]})));

test('invalid fixture date is rejected instead of silently skipped',()=>assert.throws(()=>createSyntheticPrevioTubAdapter({bookings:[{...b,start:'invalid'}]})));
test('reversed fixture interval is rejected',()=>assert.throws(()=>createSyntheticPrevioTubAdapter({bookings:[{...b,start:b.end,end:b.start}]})));

test('invalid calendar instants reject the whole fixture rather than hiding a conflicting booking',()=>{
 for(const instant of ['2026-02-30T18:00:00Z','2026-02-29T18:00:00Z','2026-04-31T18:00:00Z','2026-10-24T24:00:00Z','2026-10-24T18:00:00+14:01','2026-10-24T18:00:00+15:00']){
  for(const field of ['start','end']){
   assert.throws(()=>createSyntheticPrevioTubAdapter({bookings:[b,{...b,id:'synthetic-invalid',start:'2026-01-01T00:00:00Z',end:'2027-01-01T00:00:00Z',[field]:instant}]}),TypeError,`${field}: ${instant}`);
  }
 }
});

test('valid leap day and repeated DST hour retain the conflicting fixed-resource note',async()=>{
 for(const interval of [
  {start:'2028-02-29T18:00:00Z',end:'2028-03-01T18:00:00Z'},
  {start:'2026-10-25T02:30:00+02:00',end:'2026-10-25T02:30:00+01:00'}
 ]){
  const result=await createSyntheticPrevioTubAdapter({bookings:[{...b,...interval}]}).read({...q,...interval});
  assert.equal(result.status,'CANDIDATES_ONLY');
  assert.equal(result.notes.length,1);
  assert.equal(result.complete,false);
 }
});
