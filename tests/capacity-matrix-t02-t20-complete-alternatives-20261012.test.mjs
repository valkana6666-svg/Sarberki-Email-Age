import test from 'node:test';
import assert from 'node:assert/strict';
import {capacityInput} from '../booking-filter.mjs';
import {buildAvailabilityOptions} from '../netlify/functions/availability-options.mjs';
import {buildChatInquiryReply,buildEmailInquiryDraft} from '../shared-core/inquiry-channel-adapters.mjs';

// T02/T20 strengthen full alternative coverage; synthetic read-only source only.
const now=new Date('2026-10-12T10:00:00Z');
const dates={arrival:'2026-11-26',departure:'2026-11-28',inferred_year:false};
const adapters={chat:buildChatInquiryReply,email:buildEmailInquiryDraft};
async function scenario(facts,stock,unknown=[]){
 const input=capacityInput({arrival:dates.arrival,departure:dates.departure,adults:facts.adults,
  children:facts.children,guests:facts.guests,unit:facts.cabin||'',units_requested:1});
 const calls=[];
 const capacity=await buildAvailabilityOptions(input,async q=>{
  calls.push(q.cabin);
  if(unknown.includes(q.cabin))throw Error('SYNTHETIC_TIMEOUT');
  const availableUnits=stock[q.cabin]||0;
  return {...q,source:'SYNTHETIC_READ_ONLY',checkedAt:now.toISOString(),
   availability:availableUnits?'available':'unavailable',availableUnits};
 },{now:()=>now.getTime()});
 return {calls,capacity};
}
for(const [channel,adapter] of Object.entries(adapters)){
 test(`T02 requested VIP unavailable: every verified eligible alternative, no duplicate A/B / ${channel}`,async()=>{
  const facts={dates,adults:2,children:0,guests:2,child_ages:[],cabin:'VIP',units_requested:1};
  const {calls,capacity}=await scenario(facts,{vip:0,family:0,deluxe:1,small:1,splitA:1,splitC:1});
  assert.equal(calls[0],'vip');
  assert.equal(calls.filter(x=>x==='vip').length,1);
  assert.deepEqual(new Set(calls),new Set(['vip','family','deluxe','small','splitA','splitC']));
  const decision=adapter({facts,capacity,now,language:'hu'}).decision;
  assert.equal(decision.capacity.status,'AVAILABLE');
  assert.deepEqual(decision.capacity.selectedOptions.map(x=>x.key).sort(),['deluxe','small','splitAB','splitC']);
  assert.equal(decision.safety.emailSent,false);
  assert.equal(decision.safety.bookingCreated,false);
 });
 test(`T20 no named type: mixed available, unavailable, unknown filters to two verified types / ${channel}`,async()=>{
  const facts={dates,adults:4,children:0,guests:4,child_ages:[],cabin:null,units_requested:1};
  const {calls,capacity}=await scenario(facts,{vip:1,deluxe:1,family:0,splitC:0},['splitC']);
  assert.ok(calls.includes('vip')&&calls.includes('family')&&calls.includes('deluxe')&&calls.includes('splitC'));
  assert.ok(capacity.unverified_options.some(x=>x.key==='splitC'));
  const decision=adapter({facts,capacity,now,language:'hu'}).decision;
  assert.equal(decision.capacity.status,'AVAILABLE');
  assert.deepEqual(decision.capacity.selectedOptions.map(x=>x.key).sort(),['deluxe','vip']);
  assert.equal(decision.safety.bookingCreated,false);
 });
}
