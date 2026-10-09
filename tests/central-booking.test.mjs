import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAvailabilityOptions} from '../netlify/functions/availability-options.mjs';
import {createBookingRuntime} from '../booking-runtime.mjs';
import {createBookingCaseStore,resolveBookingCase} from '../booking-cases.mjs';
import {createCaseState,updateCaseState,caseFingerprint} from '../case-state.mjs';
import {splitRequestFromText} from '../split-units.mjs';
import {capacityInput,capacityKey,capacityFresh,stageFacts} from '../booking-filter.mjs';
const stay={arrival:'2026-10-23',departure:'2026-10-25',guests:4,adults:4};
const source=(counts,calls=[])=>async input=>{calls.push(input.cabin);const n=counts[input.cabin]??0;return {...input,availability:n>0?'available':'unavailable',availableUnits:n,source:'MOCK',checkedAt:new Date().toISOString()};};
for(const cabin of ['vip','deluxe'])test(`${cabin}: confirmed zero never offers or queries price`,async()=>{
 const calls=[];const runtime=createBookingRuntime({request:input=>buildAvailabilityOptions(input,source({},calls))});
 await assert.rejects(runtime.beforePrice({...stay,cabin,children:[]}),/nem igazoltan/);assert.deepEqual(calls,[cabin]);
});
test('general four adults can use one C',async()=>{const r=await buildAvailabilityOptions(stay,source({splitC:1}));assert.deepEqual(r.available_options.map(x=>x.key),['splitC']);});
for(const adjacent of [false,true])test(`two pooled AB with unknown placement adjacent=${adjacent}`,async()=>{
 const r=await buildAvailabilityOptions({...stay,cabin:'split',fallback:false,placement:{ab:2,c:0,adjacent,exactIds:[]}},source({splitA:2}));assert.equal(r.available_options.length,adjacent?0:1);assert.equal(r.unverified_options.length,adjacent?1:0);assert.equal(r.available_options[0]?.same_house_pairing_verified||false,false);
});
test('different physical houses remain valid without proximity promise',async()=>{
 const r=await buildAvailabilityOptions({...stay,placement:{ab:2,c:0,adjacent:false,exactIds:[]}},source({splitA:2}));const o=r.available_options.find(x=>x.key==='splitAB');assert.equal(o.cross_house_fallback_allowed,true);assert.equal(o.cross_house_fallback_requires_human_approval,false);
});
for(const text of ['Osztott A+C','Osztott B+C'])test(`${text}: independent pools suffice`,async()=>{const p=splitRequestFromText(text);const r=await buildAvailabilityOptions({...stay,guests:6,placement:{ab:p.requestedAB,c:p.requestedC,adjacent:false,exactIds:[]}},source({splitA:1,splitC:1}));assert.ok(r.available_options.some(x=>x.key==='splitCombination'));});
test('failed source stays unverified, not zero',async()=>{const r=await buildAvailabilityOptions(stay,async()=>{throw Error('offline');});assert.equal(r.unavailable_options.length,0);assert.ok(r.unverified_options.every(x=>x.availableUnits===null));});
test('contradictory source is unverified',async()=>{const r=await buildAvailabilityOptions(stay,async()=>({availability:'available',availableUnits:0}));assert.equal(r.available_options.length,0);assert.ok(r.unverified_options.length);});
const values={...stay,guests:'4',adults:'2',children:'2',unit:'Deluxe',child_ages:'',phone:''};
function store(){let n=0;return createBookingCaseStore({id:()=>`case-${++n}`});}
const env=(id,more={})=>({sender:'guest@example.test',message_id:id,thread_id:'thread-1',rfc_message_id:`<${id}>`,text:'Deluxe',...more});
for(const [name,change]of [['date',{arrival:'2026-11-06',departure:'2026-11-08'}],['guest count',{adults:'3'}]])test(`${name} followup invalidates capacity and quote`,()=>{
 const s=store(),a=s.ingest(env('one'),values);const state={...a.bookingCase.state,quote:{total:100},availability:{verified:true}};s.save(a.bookingCase.id,state);
 const b=s.ingest(env('two'),change);assert.equal(b.bookingCase.id,a.bookingCase.id);assert.equal(b.bookingCase.state.quote,null);assert.equal(b.bookingCase.state.availability,null);
});
test('ages on second and third messages preserve known facts and capacity',()=>{
 const s=store(),a=s.ingest(env('one'),values);s.save(a.bookingCase.id,{...a.bookingCase.state,availability:{verified:true},quote:{total:100}});
 const b=s.ingest(env('two'),{child_ages:'7'}),c=s.ingest(env('three'),{child_ages:'11'});assert.equal(c.bookingCase.state.values.child_ages,'7, 11');assert.equal(c.bookingCase.state.values.arrival,stay.arrival);assert.equal(b.bookingCase.state.quote,null);assert.equal(c.bookingCase.state.availability.verified,true);
});
test('same Gmail thread links without sender-only inference',()=>{const s=store(),a=s.ingest(env('one'),values),b=s.ingest(env('two'),{phone:'123'});assert.equal(a.bookingCase.id,b.bookingCase.id);});
test('RFC references link a separate thread',()=>{const s=store(),a=s.ingest(env('one'),values),b=s.ingest(env('two',{thread_id:'new',in_reply_to:'<one>'}),{phone:'123'});assert.equal(a.bookingCase.id,b.bookingCase.id);});
test('same sender new independent letter is never automatically merged',()=>{const s=store(),a=s.ingest(env('one'),values),b=s.ingest(env('two',{thread_id:'new'}),values);assert.equal(b.resolution.status,'ambiguous');assert.notEqual(a.bookingCase.id,b.bookingCase.id);});
test('one sender can have two different stay cases',()=>{const s=store(),a=s.ingest(env('one'),values),b=s.ingest(env('two',{thread_id:'new'}),{...values,arrival:'2026-12-01',departure:'2026-12-03'});assert.equal(b.resolution.status,'new');assert.notEqual(a.bookingCase.id,b.bookingCase.id);});
test('ambiguous references require human choice',()=>{const s=store(),a=s.ingest(env('one'),values),b=s.ingest(env('two',{thread_id:'new'}),{...values,arrival:'2026-12-01'});assert.equal(resolveBookingCase(s.list(),env('three',{thread_id:'none',references:['<one>','<two>']})).status,'ambiguous');});
test('fresh approval rechecks and revokes earlier positive capacity',async()=>{
 let available=1;const runtime=createBookingRuntime({request:i=>buildAvailabilityOptions(i,source({deluxe:available}))});const v={...stay,unit:'Deluxe'};
 assert.equal((await runtime.check(v)).available_options.some(x=>x.key==='deluxe'),true);available=0;assert.equal((await runtime.beforeApproval(v)).allowed,false);assert.equal(runtime.metrics.requests,2);
 const s=createCaseState({values:v});s.quote={total:100};const next=updateCaseState(s,{type:'availability',fingerprint:caseFingerprint(v),verified:false,requestedAvailable:false});assert.equal(next.quote,null);
});
test('phone-only update preserves capacity and pricing',()=>{const s=createCaseState({values});s.quote={total:100};s.availability={verified:true};const n=updateCaseState(s,{type:'facts',values:{phone:'123'}});assert.deepEqual(n.quote,s.quote);assert.deepEqual(n.availability,s.availability);});
test('duplicate message is idempotent',()=>{const s=store();s.ingest(env('one'),values);s.ingest(env('one'),{adults:'9'});assert.equal(s.list()[0].state.values.adults,'2');assert.equal(s.list()[0].messages.length,1);});
test('persisted case survives new store instance',()=>{const m=new Map(),storage={getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v)};createBookingCaseStore({storage,id:()=> 'case-p'}).ingest(env('one'),values);assert.equal(createBookingCaseStore({storage}).list()[0].id,'case-p');});
test('coordinator avoids duplicate request and caches relevant fresh facts',async()=>{let calls=0;const runtime=createBookingRuntime({request:async i=>{calls++;return buildAvailabilityOptions(i,source({splitC:1}));}});await Promise.all([runtime.check(stay),runtime.check(stay)]);await runtime.check({...stay,phone:'123'});assert.equal(calls,1);assert.equal(runtime.metrics.coalesced,1);assert.equal(runtime.metrics.reused,1);});
test('input keeps uncertainty separate and binds placement',()=>{assert.equal(stageFacts({guests:4,adults:3,children:2}).guests.status,'contradictory');const i=capacityInput({...stay,unit:'Osztott'},'Osztott A+B egymás mellett');assert.equal(i.placement.adjacent,true);assert.equal(capacityFresh({fingerprint:capacityKey(i),checkedAt:new Date(0).toISOString()},i),false);});
test('explicit available cabin checks only that cabin',async()=>{const calls=[];const r=await buildAvailabilityOptions({...stay,cabin:'deluxe'},source({deluxe:1},calls));assert.deepEqual(calls,['deluxe']);assert.deepEqual(r.available_options.map(x=>x.key),['deluxe']);});
test('missing child age reply asks only outstanding age in all supported languages',async()=>{const {buildReplyDraft}=await import('../sarberki-core.mjs');for(const language of ['hu','de','en','si']){const draft=buildReplyDraft({language,...stay,adults:2,children:2,childAges:[7],cabin:'Deluxe'});assert.match(draft,/1 (?:gyermek|Kinder|children|otrok)/u);}});
test('single-age contextual second and third letters fill outstanding children',()=>{const s=store();s.ingest(env('one'),values);s.ingest(env('two',{text:'Az egyik 7 éves.'}),{});const r=s.ingest(env('three',{text:'A másik 11 éves.'}),{});assert.equal(r.bookingCase.state.values.child_ages,'7, 11');});
test('direct server price route skips quote source on zero or unknown capacity',async()=>{const {handlePriceQuote}=await import('../netlify/functions/price-quote.mjs');for(const cabin of ['deluxe','splitC'])for(const status of ['zero','unknown']){let calls=0;const req=new Request('https://example.test',{method:'POST',body:JSON.stringify({...stay,guests:undefined,cabin,children:[]})});const r=await handlePriceQuote(req,async()=>{calls++;},true,async()=>{},async()=>{if(status==='unknown')throw Error('offline');return {availability:'unavailable',availableUnits:0,source:'MOCK',checkedAt:new Date().toISOString()};});assert.equal(calls,0);assert.equal((await r.json()).status,status==='zero'?'unavailable':'unverified');}});
