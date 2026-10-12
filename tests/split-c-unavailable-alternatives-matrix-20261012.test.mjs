import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAvailabilityOptions} from '../netlify/functions/availability-options.mjs';
import {buildChatInquiryReply,buildEmailInquiryDraft} from '../shared-core/inquiry-channel-adapters.mjs';
import {capacityInput} from '../booking-filter.mjs';

// T11/T12 from docs/capacity-alternatives-regression-matrix-2026-10-12.md.
// Synthetic Previo responses only; no network, sending or booking.
const now=new Date('2026-10-12T10:00:00Z');
const dates={arrival:'2026-11-26',departure:'2026-11-28',inferred_year:false};
const facts={dates,adults:4,children:0,guests:4,child_ages:[],cabin:'splitC',units_requested:1};
async function scenario(stock){
 const input=capacityInput({arrival:dates.arrival,departure:dates.departure,adults:4,children:0,guests:4,unit:'splitC',units_requested:1});
 const calls=[];
 const source=async q=>{calls.push(q.cabin);const availableUnits=stock[q.cabin]||0;
  return {...q,source:'SYNTHETIC_PREVIO',checkedAt:now.toISOString(),availability:availableUnits?'available':'unavailable',availableUnits};};
 const capacity=await buildAvailabilityOptions(input,source,{now:()=>now.getTime()});
 return {capacity,calls};
}
for(const [channel,adapter] of [['chat',buildChatInquiryReply],['email',buildEmailInquiryDraft]]){
 test(`T11 requested available upstairs C checks only C: ${channel}`,async()=>{
  const {capacity,calls}=await scenario({splitC:1,deluxe:1,family:1});
  assert.deepEqual(calls,['splitC']);
  const decision=adapter({facts,capacity,now,language:'hu'}).decision;
  assert.equal(decision.capacity.status,'AVAILABLE');
  assert.deepEqual(decision.capacity.selectedOptions.map(x=>x.key),['splitC']);
 });
 test(`T12 verified unavailable upstairs C checks all eligible whole-cabin alternatives: ${channel}`,async()=>{
  const {capacity,calls}=await scenario({splitC:0,deluxe:1,family:1});
  assert.equal(calls[0],'splitC');
  assert.equal(calls.filter(x=>x==='splitC').length,1);
  assert.ok(calls.includes('deluxe'));
  assert.ok(calls.includes('family'));
  const decision=adapter({facts,capacity,now,language:'hu'}).decision;
  assert.equal(decision.capacity.status,'AVAILABLE');
  assert.deepEqual(decision.capacity.selectedOptions.map(x=>x.key).sort(),['deluxe','family']);
  assert.equal(decision.safety.bookingCreated,false);
  assert.equal(decision.safety.emailSent,false);
 });
}
