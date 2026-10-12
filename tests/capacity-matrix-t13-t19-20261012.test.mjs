import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAvailabilityOptions} from '../netlify/functions/availability-options.mjs';
import {capacityInput} from '../booking-filter.mjs';
import {buildChatInquiryReply,buildEmailInquiryDraft} from '../shared-core/inquiry-channel-adapters.mjs';

// Explicit T13/T16/T17/T18/T19 acceptance cases from the issue #2 matrix.
// No live Previo, guest messages, booking, sending or production writes.
const now=new Date('2026-10-12T10:00:00Z');
const dates={arrival:'2026-11-26',departure:'2026-11-28',inferred_year:false};
const adapters={chat:buildChatInquiryReply,email:buildEmailInquiryDraft};
const facts=(cabin,adults=2)=>({dates,adults,children:0,child_ages:[],guests:adults,cabin,units_requested:1});
async function run(f,{available=[],unknown=[]}={}){
 const input=capacityInput({arrival:f.dates.arrival,departure:f.dates.departure,adults:f.adults,children:f.children,guests:f.guests,unit:f.cabin,units_requested:1});
 const calls=[];
 const source=async q=>{
  calls.push(q.cabin);
  if(unknown.includes(q.cabin))throw Error('SYNTHETIC_TIMEOUT');
  const availableUnits=available.includes(q.cabin)?1:0;
  return {...q,source:'SYNTHETIC_READ_ONLY',checkedAt:now.toISOString(),availability:availableUnits?'available':'unavailable',availableUnits};
 };
 const capacity=await buildAvailabilityOptions(input,source,{now:()=>now.getTime()});
 return {calls,capacity};
}
for(const [channel,adapter] of Object.entries(adapters)){
 test(`T13 detached two-person house only; no internal house number in guest status / ${channel}`,async()=>{
  const f=facts('small');const {calls,capacity}=await run(f,{available:['small']});
  const reply=adapter({facts:f,capacity,now,language:'hu'});
  assert.deepEqual(calls,['small']);
  assert.equal(reply.decision.capacity.status,'AVAILABLE');
  assert.deepEqual(reply.decision.capacity.selectedOptions.map(x=>x.key),['small']);
  assert.doesNotMatch(reply.text,/\b15(?:-ös)?\b/u);
 });
 test(`T16 no guest name or phone must not block requested VIP capacity / ${channel}`,async()=>{
  const f=facts('VIP');const {calls,capacity}=await run(f,{available:['vip']});
  const reply=adapter({facts:f,capacity,now,language:'hu'});
  assert.deepEqual(calls,['vip']);
  assert.equal(reply.decision.readyForCapacityCheck,true);
  assert.equal(reply.decision.capacity.status,'AVAILABLE');
  assert.ok(!reply.decision.missing.includes('phone'));
  assert.ok(!reply.decision.missing.includes('name'));
  assert.equal(reply.decision.safety.bookingCreated,false);
  assert.equal(reply.decision.safety.emailSent,false);
 });
 test(`T17 invalid date is never capacity-ready / ${channel}`,()=>{
  const f={...facts('VIP',4),dates:{arrival:'2026-02-30',departure:'2026-03-03',inferred_year:false}};
  const decision=adapter({facts:f,now,language:'hu'}).decision;
  assert.equal(decision.readyForCapacityCheck,false);
  assert.equal(decision.capacity.verified,false);
  assert.ok(decision.contradictions.length>0);
 });
 test(`T18 requested family unavailable and alternatives unknown: no fabricated offer / ${channel}`,async()=>{
  const f=facts('family',4);
  const {calls,capacity}=await run(f,{unknown:['vip','deluxe','small','splitA','splitC']});
  const decision=adapter({facts:f,capacity,now,language:'hu'}).decision;
  assert.equal(calls[0],'family');
  assert.equal(calls.filter(x=>x==='family').length,1);
  assert.equal(decision.capacity.status,'UNAVAILABLE');
  assert.deepEqual(decision.capacity.selectedOptions,[]);
  assert.equal(decision.safety.bookingCreated,false);
 });
 test(`T19 requested VIP available: exactly one source call, no alternative / ${channel}`,async()=>{
  const f=facts('VIP');const {calls,capacity}=await run(f,{available:['vip','family','deluxe','small','splitC']});
  const decision=adapter({facts:f,capacity,now,language:'hu'}).decision;
  assert.deepEqual(calls,['vip']);
  assert.deepEqual(decision.capacity.selectedOptions.map(x=>x.key),['vip']);
  assert.equal(decision.capacity.status,'AVAILABLE');
 });
}
