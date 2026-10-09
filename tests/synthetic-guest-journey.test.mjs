import test from 'node:test';
import assert from 'node:assert/strict';
import { createBookingCaseStore } from '../booking-cases.mjs';
import { createBookingRuntime } from '../booking-runtime.mjs';
import { capacityInput } from '../booking-filter.mjs';
import { buildAvailabilityOptions } from '../netlify/functions/availability-options.mjs';
import { availabilitySentence } from '../availability-recommend.mjs';

// All addresses, messages, stock values and prices in this file are invented.
// This test never contacts Gmail, Netlify or Previo.
const dates = {arrival:'2026-11-09',departure:'2026-11-13',guests:'6',adults:'6',children:'0',language:'HU'};
const makeSource = stock => async query => {
  const n = stock[query.cabin] ?? 0;
  return {...query,availability:n>0?'available':'unavailable',availableUnits:n,
    source:'SYNTHETIC_FIXTURE',checkedAt:new Date().toISOString()};
};
const envelope = (message_id,text,received_at) => ({
  sender:'six-guests@fixture.invalid',mailbox_id:'synthetic_mailbox',
  thread_id:'synthetic_thread',message_id,text,received_at
});

test('six-person inquiry offers only verified A/B plus C, never physical unit numbers',async()=>{
  const store=createBookingCaseStore({id:()=> 'six-guests-case'});
  const initial=store.ingest(envelope('m1','Hat felnőttnek keresünk szállást november 9–13-ig. Horgásznánk és autóval jövünk.','2026-10-10T08:00:00Z'),dates);
  assert.equal(initial.resolution.status,'new');
  const input=capacityInput(initial.bookingCase.state.values,initial.bookingCase.state.original);
  const capacity=await buildAvailabilityOptions(input,makeSource({splitA:1,splitC:1}));
  assert.equal(capacity.bookingCompleted,false);
  assert.ok(capacity.available_options.some(o=>o.key==='splitCombination'&&o.availability_verified===true&&o.requiredAB===1&&o.requiredC===1));
  assert.ok(capacity.available_options.every(o=>o.key==='splitCombination'));
  const guestText=availabilitySentence(capacity,'hu');
  assert.match(guestText,/ellenőrzött, szabad lehetőségek/u);
  assert.match(guestText,/Osztott/u);
  assert.doesNotMatch(guestText,/\b(?:7|8|9|10)[ABC]\b/u);
});

test('phone-only follow-up preserves case, while changed stay revokes previous evidence and quote',()=>{
  const store=createBookingCaseStore({id:()=> 'six-guests-case'});
  const a=store.ingest(envelope('m1','Első érdeklődés','2026-10-10T08:00:00Z'),dates);
  store.save(a.bookingCase.id,{...a.bookingCase.state,
    availability:{verified:true,checkedAt:new Date().toISOString()},
    quote:{total:123456,approved:true}});
  const b=store.ingest(envelope('m2','A telefonszámom +36 30 123 4567.','2026-10-10T08:02:00Z'),{phone:'+36 30 123 4567'});
  assert.equal(b.resolution.status,'linked');
  assert.equal(b.bookingCase.id,a.bookingCase.id);
  assert.equal(b.bookingCase.state.quote.total,123456);
  assert.equal(b.bookingCase.state.availability.verified,true);
  const c=store.ingest(envelope('m3','Más időpontot szeretnénk.','2026-10-10T08:04:00Z'),
    {arrival:'2026-11-16',departure:'2026-11-20'});
  assert.equal(c.bookingCase.id,a.bookingCase.id);
  assert.equal(c.bookingCase.state.values.arrival,'2026-11-16');
  assert.equal(c.bookingCase.state.quote,null);
  assert.equal(c.bookingCase.state.availability,null);
  assert.equal(c.bookingCase.messages.length,3);
});

test('approval checks fresh inventory and rejects previously available mixed placement after stock changes',async()=>{
  const stock={splitA:1,splitC:1};
  const runtime=createBookingRuntime({request:q=>buildAvailabilityOptions(q,makeSource(stock))});
  const values={...dates,unit:'Osztott',split_request_text:'Osztott A+C'};
  const first=await runtime.check(values);
  assert.ok(first.available_options.some(o=>o.key==='splitCombination'));
  stock.splitA=0;
  const fresh=await runtime.beforeApproval(values);
  assert.equal(fresh.allowed,false);
  assert.equal(fresh.data.bookingCompleted,false);
  assert.equal(runtime.metrics.requests,2);
});

test('failed source is unverified, not silently presented as sold out, in four languages',async()=>{
  const query=capacityInput({...dates,unit:'Osztott',split_request_text:'Osztott A+C'});
  const result=await buildAvailabilityOptions(query,async()=>{throw Error('synthetic source offline');});
  assert.equal(result.available_options.length,0);
  assert.ok(result.unverified_options.length>0);
  assert.equal(result.unavailable_options.length,0);
  for(const [language,phrase] of [
    ['hu',/nem sikerült hitelesen megállapítani/u],
    ['de',/nicht zuverlässig bestätigt/u],
    ['en',/could not be reliably verified/u],
    ['si',/ni bilo mogoče zanesljivo potrditi/u]
  ]){
    const message=availabilitySentence(result,language);
    assert.match(message,phrase);
    assert.doesNotMatch(message,/\b(?:7|8|9|10)[ABC]\b/u);
  }
});

test('an explicit same-house request is not confirmed by aggregated Previo pools',async()=>{
  const input=capacityInput({...dates,unit:'Osztott',split_request_text:'Osztott A+C egymás mellett'});
  assert.equal(input.placement.adjacent,true);
  const result=await buildAvailabilityOptions(input,makeSource({splitA:1,splitC:1}));
  assert.equal(result.available_options.length,0);
  assert.ok(result.unverified_options.some(o=>o.requires_adjacent===true));
  assert.match(availabilitySentence(result,'hu'),/nem sikerült hitelesen megállapítani/u);
});

test('confirmed zero capacity retains the unavailable wording, distinct from unknown',async()=>{
  const input=capacityInput({...dates,unit:'Deluxe'});
  const result=await buildAvailabilityOptions({...input,fallback:false},makeSource({deluxe:0}));
  assert.equal(result.available_options.length,0);
  assert.ok(result.unavailable_options.some(o=>o.key==='deluxe'));
  assert.equal(result.unverified_options.length,0);
  assert.match(availabilitySentence(result,'en'),/not found/u);
});
