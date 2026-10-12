import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAvailabilityOptions} from '../netlify/functions/availability-options.mjs';
import {buildChatInquiryReply,buildEmailInquiryDraft} from '../shared-core/inquiry-channel-adapters.mjs';
import {capacityInput} from '../booking-filter.mjs';

// Synthetic provider only: no live Previo traffic, booking, or email.
const now=new Date('2026-10-12T09:00:00Z');
const dates={arrival:'2026-11-26',departure:'2026-11-28',inferred_year:false};
const free={vip:1,family:2,deluxe:2,small:1,splitA:2,splitC:2};
const facts=(adults,cabin=null,children=0,child_ages=[])=>({dates,adults,children,child_ages,guests:adults+children,cabin,units_requested:1});
async function run(f,stock=free,failed=[]){
 const input=capacityInput({arrival:dates.arrival,departure:dates.departure,adults:f.adults,children:f.children,guests:f.guests,unit:f.cabin||'',units_requested:1});
 const calls=[];
 const source=async q=>{
  calls.push(q.cabin);
  if(failed.includes(q.cabin))throw Error('SYNTHETIC_PREVIO_TIMEOUT');
  const availableUnits=stock[q.cabin]||0;
  return {...q,availability:availableUnits>0?'available':'unavailable',availableUnits,checkedAt:now.toISOString(),source:'SYNTHETIC_READ_ONLY'};
 };
 const capacity=await buildAvailabilityOptions(input,source,{now:()=>now.getTime()});
 const message='2026. november 26-28. között szeretnénk szállást.';
 const chat=buildChatInquiryReply({message,now,facts:f,capacity});
 const email=buildEmailInquiryDraft({message,now,facts:f,capacity});
 assert.deepEqual(chat.decision,email.decision,'chat and email must share one business decision');
 assert.equal(chat.decision.safety.bookingCreated,false);
 assert.equal(email.decision.safety.emailSent,false);
 return {calls,capacity,decision:chat.decision};
}
for(const [name,f,expected] of [
 ['T04: four adults, no type',facts(4),['deluxe','family','vip','splitC']],
 ['T20: two adults, no type',facts(2),['deluxe','family','vip','small','splitAB','splitC']],
 ['T09: two adults and two children with ages',facts(2,null,2,[7,11]),['deluxe','family','vip','splitC']]
]){
 for(const channel of ['chat','email']){
  test(`${name} / ${channel}: all and only verified one-unit options`,async()=>{
   const {decision}=await run(f);
   assert.equal(decision.readyForCapacityCheck,true,'type is optional for availability');
   assert.deepEqual(decision.missing,[]);
   assert.equal(decision.capacity.status,'AVAILABLE');
   assert.deepEqual(decision.capacity.selectedOptions.map(x=>x.key).sort(),expected.slice().sort());
  });
 }
}
for(const channel of ['chat','email']){
 test(`T02: requested VIP unavailable, C is still a two-adult alternative / ${channel}`,async()=>{
  const {calls,capacity}=await run(facts(2,'VIP'),{...free,vip:0});
  assert.equal(calls[0],'vip');
  assert.equal(calls.filter(x=>x==='vip').length,1);
  assert.ok(calls.includes('splitC'),'C must be checked as an eligible four-base-price option for two guests');
  assert.ok(capacity.available_options.some(x=>x.key==='splitC'));
 });
 test(`T03: unknown requested VIP must not trigger fallback / ${channel}`,async()=>{
  const {calls,decision}=await run(facts(2,'VIP'),free,['vip']);
  assert.deepEqual(calls,['vip']);
  assert.equal(decision.capacity.status,'UNKNOWN');
  assert.equal(decision.capacity.selectedOptions.length,0);
 });
 test(`T10: missing child ages blocks verification / ${channel}`,async()=>{
  const {decision}=await run(facts(2,null,2,[]));
  assert.equal(decision.readyForCapacityCheck,false);
  assert.ok(decision.missing.includes('child_ages'));
  assert.equal(decision.capacity.verified,false);
 });
}

for(const adults of [6,8])for(const channel of ['chat','email']){
 test(`T${adults===6?'07':'08'}: ${adults} adults require one verified suitable unit / ${channel}`,async()=>{
  const {calls,decision}=await run(facts(adults),free);
  assert.deepEqual(calls,['family']);
  assert.equal(decision.capacity.status,'AVAILABLE');
  assert.deepEqual(decision.capacity.selectedOptions.map(x=>x.key),['family']);
  assert.equal(decision.safety.bookingCreated,false);
 });
}
