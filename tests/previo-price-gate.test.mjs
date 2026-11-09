import test from 'node:test';
import assert from 'node:assert/strict';
import {priceTestMailboxCase} from '../shared-core/server-test-mailbox-price.mjs';
import {PRICE_LINE} from '../shared-core/price-insert-sentence.mjs';
import {previoCapacityReader} from '../netlify/functions/booking-cases.mjs';

// Fictional case, key and IDs only; no network (fetch is injected).
const KEY='e5'.repeat(32);
const record=()=>({tenantId:'sarberki-test',caseId:'tm-18f2a0b1c2d3e4f0',revision:2,
 data:{state:{values:{arrival:'2027-05-14',departure:'2027-05-16',adults:2,children:0,child_ages:'',language:'hu'}},
  drafts:[{text:'Kedves Vendégünk!\n\n'+PRICE_LINE.hu+'\n\nÜdvözlettel:\nSárberki Horgásztó',operatorReviewText:'Ellenőrző szöveg.'}]}});
const quoteFn=input=>({status:'public_reference',total:128200,cabin:input.cabin,nights:2,adults:2,children:[],lines:[]});
function harness(capacityFn){
 const calls={quote:0,saved:[]};
 return {calls,run:()=>priceTestMailboxCase({record:record(),cabin:'deluxe',availabilityConfirmed:true,attestationKey:KEY,
  transport:async(path,{body})=>{calls.saved.push(body);return {case_id:body.p_case,revision:3};},
  quoteFn:i=>{calls.quote++;return quoteFn(i);},capacityFn,clock:()=>new Date().toISOString()})};
}

test('no Previo reader: exactly today\'s manual flow (no Previo line)',async()=>{
 const h=harness(null);const r=await h.run();
 assert.equal(r.previo,null);assert.doesNotMatch(h.calls.saved[0].p_draft.operatorReviewText,/Previo \(csak olvasó\)/);
});
test('Previo says no free unit: refused before any price is computed or saved',async()=>{
 const h=harness(async()=>({freeByCabin:{deluxe:0},checkedAt:'2027-01-01T00:00:00Z'}));
 await assert.rejects(h.run(),/PREVIO_NO_FREE_UNIT/);
 assert.equal(h.calls.quote,0);assert.equal(h.calls.saved.length,0);
});
test('Previo says free: priced as before, operator note records the snapshot (guest text unchanged)',async()=>{
 const h=harness(async({cabin,arrival,departure})=>{assert.deepEqual([cabin,arrival,departure],['deluxe','2027-05-14','2027-05-16']);return {freeByCabin:{deluxe:2},checkedAt:'2027-01-01T00:00:00Z'};});
 const r=await h.run();
 assert.deepEqual(r.previo,{decision:'AVAILABLE',free:2,checkedAt:'2027-01-01T00:00:00Z'});
 const d=h.calls.saved[0].p_draft;
 assert.match(d.operatorReviewText,/Previo \(csak olvasó\): 2 szabad egység/);assert.doesNotMatch(d.operatorReviewText,/NEM ellenőrizte/);assert.doesNotMatch(d.text,/Previo/,'the guest never sees Previo');
});
test('Previo read fails or is incomplete: UNKNOWN, the manual check stays in force',async()=>{
 for(const fn of [async()=>{throw Object.assign(Error('PREVIO_TIMEOUT'),{code:'PREVIO_TIMEOUT'});},async()=>({freeByCabin:{deluxe:null}})]){
  const h=harness(fn);const r=await h.run();
  assert.equal(r.previo.decision,'UNKNOWN');assert.match(h.calls.saved[0].p_draft.operatorReviewText,/kézi Previo-ellenőrzés érvényes/);
 }
});
test('server wiring: off unless the owner switch is set; sandbox only; key never echoed',async()=>{
 assert.equal(previoCapacityReader({},fetch),null);
 assert.equal(previoCapacityReader({PREVIO_READ_API_ENABLED:'true'},fetch),null);
 const base={PREVIO_READ_API_ENABLED:'sandbox-73521-only',PREVIO_API_KEY:'synthetic-previo-key-0123456789',PREVIO_HOTEL_ID:'73521',PREVIO_RATE_PLAN_ID:'800001',PREVIO_ROOM_KIND_MAP:JSON.stringify({deluxe:'900001'})};
 assert.equal(previoCapacityReader({...base,PREVIO_ROOM_KIND_MAP:'{bad'},fetch),null);
 const calls=[];
 const reader=previoCapacityReader(base,async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify([{ratePlanId:800001,availability:[{date:'2027-05-14',roomKinds:[{id:900001,availability:1}]},{date:'2027-05-15',roomKinds:[{id:900001,availability:0}]}]}]));});
 const r=await reader({cabin:'deluxe',arrival:'2027-05-14',departure:'2027-05-16'});
 assert.equal(r.freeByCabin.deluxe,0);assert.equal(calls.length,1);assert.match(calls[0].url,/^https:\/\/api\.previo\.app\/rest\/calendar\/availability\?/);
 const live=previoCapacityReader({...base,PREVIO_HOTEL_ID:'753011'},async()=>{throw Error('must not be called');});
 await assert.rejects(live({cabin:'deluxe',arrival:'2027-05-14',departure:'2027-05-16'}),/LIVE_PROPERTY_REFUSED/);
});

// Prepared 2026-11-07, NOT enabled: the live read needs its own switch and mapping; nothing else changes.
test('live read 753011: only with PREVIO_LIVE_READ=availability-only, own mapping, calendar GET only',async()=>{
 const key='synthetic-previo-key-0123456789';
 assert.equal(previoCapacityReader({PREVIO_LIVE_READ:'true',PREVIO_API_KEY:key},fetch),null);
 assert.equal(previoCapacityReader({PREVIO_LIVE_READ:'availability-only',PREVIO_API_KEY:key,PREVIO_LIVE_ROOM_KIND_MAP:'{bad'},fetch),null);
 const calls=[];
 const reader=previoCapacityReader({PREVIO_LIVE_READ:'availability-only',PREVIO_API_KEY:key,PREVIO_LIVE_RATE_PLAN_ID:'700001',PREVIO_LIVE_ROOM_KIND_MAP:JSON.stringify({deluxe:'766439'}),
  PREVIO_HOTEL_ID:'73521'},async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify([{ratePlanId:700001,availability:[{date:'2027-06-10',roomKinds:[{id:766439,availability:2}]},{date:'2027-06-11',roomKinds:[{id:766439,availability:1}]},{date:'2027-06-12',roomKinds:[{id:766439,availability:1}]}]}]));});
 const r=await reader({cabin:'deluxe',arrival:'2027-06-10',departure:'2027-06-13'});
 assert.equal(r.freeByCabin.deluxe,1);assert.equal(r.hotelId,'753011');assert.equal(r.bookingCreated,false);assert.equal(r.writeAttempted,false);
 assert.equal(calls.length,1);assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.headers['X-Previo-Hotel-Id'],'753011');
 assert.match(calls[0].url,/^https:\/\/api\.previo\.app\/rest\/calendar\/availability\?/);
 // Without the live switch the sandbox path still refuses the live id.
 const {readPrevioFreeCapacity}=await import('../shared-core/server-previo-rest-read.mjs');
 await assert.rejects(readPrevioFreeCapacity({apiKey:key,hotelId:'753011',ratePlanId:'1',mapping:{deluxe:'1'},cabins:['deluxe'],arrival:'2027-06-10',departure:'2027-06-13',fetchImpl:async()=>{throw Error('no');}}),/LIVE_PROPERTY_REFUSED/);
});
