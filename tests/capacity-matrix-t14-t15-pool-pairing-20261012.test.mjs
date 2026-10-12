import test from 'node:test';
import assert from 'node:assert/strict';
import {capacityInput} from '../booking-filter.mjs';
import {buildAvailabilityOptions} from '../netlify/functions/availability-options.mjs';
import {buildChatInquiryReply,buildEmailInquiryDraft} from '../shared-core/inquiry-channel-adapters.mjs';

// Matrix T14/T15: synthetic pool-level Previo proof, never a physical unit promise.
const now=new Date('2026-10-12T10:00:00Z');
const dates={arrival:'2026-11-26',departure:'2026-11-28',inferred_year:false};
const channels={chat:buildChatInquiryReply,email:buildEmailInquiryDraft};
async function check(facts,message){
 const input=capacityInput({arrival:dates.arrival,departure:dates.departure,adults:facts.adults,
  children:0,guests:facts.guests,unit:facts.cabin,units_requested:facts.units_requested,
  split_request_text:message},message);
 const calls=[];
 const capacity=await buildAvailabilityOptions(input,async query=>{
  calls.push(query.cabin);
  return {...query,source:'SYNTHETIC_READ_ONLY',checkedAt:now.toISOString(),
   availability:'available',availableUnits:2};
 },{now:()=>now.getTime()});
 return {capacity,calls};
}
for(const [channel,adapter] of Object.entries(channels)){
 test(`T14 one two-person A/B: only pooled availability, no physical ID / ${channel}`,async()=>{
  const facts={dates,adults:2,children:0,guests:2,child_ages:[],cabin:'splitA',units_requested:1};
  const message='Egy osztott A apartmant kérünk két felnőtt részére.';
  const {capacity,calls}=await check(facts,message);
  assert.deepEqual(calls,['splitA']);
  const decision=adapter({facts,message,now,language:'hu'}).decision;
  const verified=adapter({facts,message,capacity,now,language:'hu'}).decision;
  assert.equal(decision.capacity.status,'UNKNOWN');
  assert.equal(verified.capacity.status,'AVAILABLE');
  assert.deepEqual(verified.capacity.selectedOptions.map(row=>row.key),['splitAB']);
  assert.ok(verified.capacity.selectedOptions.every(row=>row.individual_unit_mapping_verified===false));
  assert.equal(verified.safety.bookingCreated,false);
 });
 test(`T15 adjacent A+B: two pooled units cannot verify same-house placement / ${channel}`,async()=>{
  const message='Két 2 fős osztott apartman egymás mellett, 4 felnőtt részére.';
  const facts={dates,adults:4,children:0,guests:4,child_ages:[],cabin:'Osztott',units_requested:2,
   split_request:{isSplit:true,requestedAB:2,requestedC:0,exactUnitIds:[],requiresAdjacent:true}};
  const {capacity,calls}=await check(facts,message);
  assert.deepEqual(calls,['splitA']);
  assert.equal(capacity.split_pool_checks.splitAB.verified,true);
  assert.equal(capacity.split_pool_checks.splitAB.availableUnits,2);
  assert.equal(capacity.available_options.some(row=>row.key==='splitAB'),false);
  assert.ok(capacity.manual_review_options.some(row=>row.business_placement_requires_human_approval===true));
  const decision=adapter({facts,message,capacity,now,language:'hu'}).decision;
  assert.equal(decision.readyForCapacityCheck,true);
  assert.equal(decision.capacity.status,'UNKNOWN');
  assert.deepEqual(decision.capacity.selectedOptions,[]);
  assert.equal(decision.safety.bookingCreated,false);
  assert.equal(decision.safety.emailSent,false);
 });
}
