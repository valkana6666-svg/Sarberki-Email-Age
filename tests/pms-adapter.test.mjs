import test from 'node:test';
import assert from 'node:assert/strict';
import {createReadOnlyPmsAdapter,assertReadOnlyPmsAdapter} from '../shared-core/pms-adapter.mjs';

test('read-only PMS adapter exposes normalized availability and quote operations',async()=>{
  const calls=[];
  const adapter=createReadOnlyPmsAdapter({
    id:'mock-pms',
    fetchAvailability:async input=>{calls.push(['availability',input]);return {availableUnits:2};},
    fetchQuote:async input=>{calls.push(['quote',input]);return {total:100};}
  });
  assert.equal(adapter.capabilities.readAvailability,true);
  assert.equal(adapter.capabilities.createBooking,false);
  assert.deepEqual(await adapter.getAvailability({arrival:'2027-01-01'}),{availableUnits:2});
  assert.deepEqual(await adapter.getQuote({arrival:'2027-01-01'}),{total:100});
  assert.equal(calls.length,2);
  assert.equal(assertReadOnlyPmsAdapter(adapter),adapter);
});

test('booking mutation capability is rejected at adapter boundary',()=>{
  assert.throws(()=>createReadOnlyPmsAdapter({
    id:'unsafe',
    fetchAvailability:async()=>({}),
    fetchQuote:async()=>({}),
    capabilities:{createBooking:true}
  }),/read-only PMS adapter/u);
});
