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
async function scenario(stock,{fallback=true,failC=false}={}){
 const input={...capacityInput({arrival:dates.arrival,departure:dates.departure,adults:4,children:0,guests:4,unit:'splitC',units_requested:1}),...(fallback===false?{fallback:false}:{})};
 const calls=[];
 const source=async q=>{calls.push(q.cabin);if(failC&&q.cabin==='splitC')throw Error('SYNTHETIC_TIMEOUT');const availableUnits=stock[q.cabin]||0;
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

for(const [channel,adapter] of [['chat',buildChatInquiryReply],['email',buildEmailInquiryDraft]]){
 test(`requested C UNKNOWN never fans out or borrows whole-cabin availability: ${channel}`,async()=>{
  const {capacity,calls}=await scenario({splitC:0,deluxe:1,family:1},{failC:true});assert.deepEqual(calls,['splitC']);const decision=adapter({facts,capacity,now}).decision;assert.equal(decision.capacity.status,'UNKNOWN');assert.deepEqual(decision.capacity.selectedOptions,[]);
 });
 test(`explicitly disabled C fallback checks only requested pool: ${channel}`,async()=>{
  const {capacity,calls}=await scenario({splitC:0,deluxe:1,family:1},{fallback:false});assert.deepEqual(calls,['splitC']);const decision=adapter({facts,capacity,now,fallback:false}).decision;assert.equal(decision.capacity.status,'UNKNOWN');assert.deepEqual(decision.capacity.selectedOptions,[]);
 });
 test(`stale or wrong-date requested C proof cannot authorize fresh fallback rows: ${channel}`,async()=>{
  for(const change of [{checkedAt:'2020-01-01T00:00:00Z'},{arrival:'2026-11-25'}]){
   const {capacity}=await scenario({splitC:0,deluxe:1,family:1});capacity.split_pool_checks.splitC.evidence={...capacity.split_pool_checks.splitC.evidence,...change};const decision=adapter({facts,capacity,now}).decision;assert.equal(decision.capacity.status,'UNKNOWN');assert.deepEqual(decision.capacity.selectedOptions,[]);
  }
 });
}

test('insufficient stock for two requested C units preserves two-unit alternative count',async()=>{
 const twoFacts={...facts,adults:6,guests:6,units_requested:2};
 const input=capacityInput({arrival:dates.arrival,departure:dates.departure,adults:6,children:0,guests:6,unit:'splitC',units_requested:2});
 const calls=[];const capacity=await buildAvailabilityOptions(input,async q=>{calls.push(q.cabin);const availableUnits=q.cabin==='splitC'?1:2;return {...q,source:'SYNTHETIC_PREVIO',checkedAt:now.toISOString(),availability:'available',availableUnits};},{now:()=>now.getTime()});
 assert.equal(calls[0],'splitC');assert.equal(calls.filter(x=>x==='splitC').length,1);
 for(const adapter of [buildChatInquiryReply,buildEmailInquiryDraft]){const decision=adapter({facts:twoFacts,capacity,now}).decision;assert.equal(decision.capacity.status,'AVAILABLE');assert.ok(decision.capacity.selectedOptions.length);assert.ok(decision.capacity.selectedOptions.every(row=>row.units===2));}
});
