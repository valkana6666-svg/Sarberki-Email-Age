import test from 'node:test';
import assert from 'node:assert/strict';
import {capacityInput} from '../booking-filter.mjs';
import {buildAvailabilityOptions} from '../netlify/functions/availability-options.mjs';
import {buildChatInquiryReply,buildEmailInquiryDraft} from '../shared-core/inquiry-channel-adapters.mjs';

// T05/T06: a published six-person Deluxe limit is not sufficient proof of
// six physically verified places. Inventory currently proves only five.
// Keep six-person Deluxe/VIP and single C fail-closed until extra beds are verified.
// A suitable family cabin still needs its own current capacity evidence.
const now=new Date('2026-10-12T11:00:00Z');
const dates={arrival:'2026-11-26',departure:'2026-11-28',inferred_year:false};
const facts={dates,adults:6,children:0,guests:6,child_ages:[],cabin:'Deluxe',units_requested:1};
const input=capacityInput({arrival:dates.arrival,departure:dates.departure,adults:6,children:0,guests:6,unit:'Deluxe',units_requested:1});
const channels={chat:buildChatInquiryReply,email:buildEmailInquiryDraft};
for(const [channel,adapter] of Object.entries(channels)){
 test(`T05 six adults requesting one Deluxe: unverified extra bed cannot be advertised / ${channel}`,async()=>{
  const calls=[];
  const capacity=await buildAvailabilityOptions({...input,fallback:false},async q=>{calls.push(q.cabin);throw Error('UNEXPECTED');},{now:()=>now.getTime()});
  assert.deepEqual(calls,[]);
  const decision=adapter({facts,capacity,now,language:'hu'}).decision;
  assert.equal(decision.capacity.status,'UNKNOWN');
  assert.equal(decision.capacity.incompatible,true);
  assert.deepEqual(decision.capacity.selectedOptions,[]);
  assert.equal(decision.safety.bookingCreated,false);
  assert.equal(decision.safety.emailSent,false);
 });
 test(`T06 six adults: incompatible Deluxe triggers only verified one-unit alternatives / ${channel}`,async()=>{
  const calls=[];
  const capacity=await buildAvailabilityOptions(input,async q=>{
   calls.push(q.cabin);
   return {...q,source:'SYNTHETIC_READ_ONLY',checkedAt:now.toISOString(),availability:'available',availableUnits:1};
  },{now:()=>now.getTime()});
  assert.deepEqual(calls,['family']);
  const decision=adapter({facts,capacity,now,language:'hu'}).decision;
  assert.equal(decision.capacity.status,'AVAILABLE');
  assert.deepEqual(decision.capacity.selectedOptions.map(x=>x.key),['family']);
  assert.equal(decision.safety.bookingCreated,false);
  assert.equal(decision.safety.emailSent,false);
 });
 for(const [name,response] of Object.entries({
  unknown:q=>({...q,availability:'unknown',availableUnits:null}),
  failed:()=>{throw Error('SYNTHETIC_SOURCE_FAILURE');},
  wrongDates:q=>({...q,arrival:'2026-11-27',availability:'available',availableUnits:1}),
  unavailable:q=>({...q,availability:'unavailable',availableUnits:0})
 })){
  test(`T06 family ${name}: no unverified or multi-unit offer / ${channel}`,async()=>{
   const calls=[];
   const capacity=await buildAvailabilityOptions(input,async q=>{
    calls.push(q.cabin);
    return {source:'SYNTHETIC_READ_ONLY',checkedAt:now.toISOString(),...response(q)};
   },{now:()=>now.getTime()});
   assert.deepEqual(calls,['family']);
   const decision=adapter({facts,capacity,now,language:'hu'}).decision;
   assert.equal(decision.capacity.status,'UNKNOWN');
   assert.deepEqual(decision.capacity.selectedOptions,[]);
   assert.deepEqual(capacity.available_options,[]);
   assert.equal(capacity.unverified_options.length,name==='unavailable'?0:1);
   assert.equal(capacity.unavailable_options.length,name==='unavailable'?1:0);
  });
 }
}
