import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCentralInquiry} from '../shared-core/central-inquiry-decision.mjs';
import {normalizeInquiryInput} from '../intake-normalize.mjs';
import {capacityInput,capacityKey} from '../booking-filter.mjs';
import {buildAvailabilityOptions} from '../netlify/functions/availability-options.mjs';
import {splitRequestFromText} from '../split-units.mjs';
const now=new Date();
const arrival=new Date(now.getTime()+14*86400000).toISOString().slice(0,10);
const departure=new Date(now.getTime()+16*86400000).toISOString().slice(0,10);
const facts={dates:{arrival,departure,inferred_year:false},adults:2,children:0,guests:2,child_ages:[],cabin:'Deluxe',units_requested:1};
const source=stock=>async query=>({...query,availability:stock[query.cabin]>0?'available':'unavailable',availableUnits:stock[query.cabin]||0,checkedAt:now.toISOString(),source:'SYNTHETIC_FIXTURE'});
async function capacityFor(f=facts,stock={deluxe:1},message=''){
 const input=capacityInput({arrival:f.dates.arrival,departure:f.dates.departure,adults:f.adults,children:f.children,
  guests:f.guests,unit:f.cabin,units_requested:f.units_requested,split_request_text:message},message);
 const result=await buildAvailabilityOptions(input,source(stock));result.checkedAt=now.toISOString();return result;
}
const evaluate=(options={})=>evaluateCentralInquiry({facts,now,...options});
test('Gmail and chat envelopes yield identical central facts and decisions in four languages',()=>{
 for(const [language,message] of [['hu',`${arrival} és ${departure} között Deluxe faház 2 felnőtt, 0 gyermek.`],
  ['en',`Deluxe cabin from ${arrival} to ${departure} for 2 adults and 0 children.`],
  ['de',`Deluxe Ferienhaus ${arrival} bis ${departure}, 2 Erwachsene, 0 Kinder.`],
  ['si',`Deluxe hiška ${arrival} do ${departure}, 2 odrasli, 0 otroci.`]]){
  const email=normalizeInquiryInput({sourceChannel:'gmail',rawText:message,now}).normalized;
  const chat=normalizeInquiryInput({sourceChannel:'web_form',rawText:message,now}).normalized;
  assert.equal(email.dates?.arrival,arrival);assert.equal(email.dates?.departure,departure);
  assert.equal(email.adults,2);assert.equal(email.children,0);assert.equal(email.cabin,'Deluxe');
  assert.deepEqual(evaluateCentralInquiry({message,language,now,facts:email}),evaluateCentralInquiry({message,language,now,facts:chat}));
 }
});
test('missing accommodation, inferred year, adults zero and party contradiction never become ready',()=>{
 for(const changed of [{cabin:'? ismeretlen'},{dates:{arrival,departure,inferred_year:true}},
  {adults:0,guests:0},{guests:7},{children:2,guests:4,child_ages:[7]},
  {children:1,guests:3,child_ages:[18]},{children:0,child_ages:[7]},
  {dates:{arrival:'2026-02-30',departure:'2026-03-02'}},
  {dates:{arrival:departure,departure:arrival}},{units_open_request:true}]){
  const result=evaluate({facts:{...facts,...changed}});assert.equal(result.readyForCapacityCheck,false);assert.equal(result.capacity.verified,false);
 }
 assert.equal(evaluate({facts:{...facts,dates:{arrival,departure,inferred_year:true}},datesConfirmed:true}).readyForCapacityCheck,true);
 assert.equal(evaluate({facts:{...facts,dates:{arrival:'2020-01-01',departure:'2020-01-03'}}}).requiresHumanReview,true);
});
test('current exact selected capacity permits internal decision; missing, stale, wrong tenant/party/units do not',async()=>{
 const capacity=await capacityFor();assert.equal(evaluate({capacity}).capacity.status,'AVAILABLE');
 for(const changed of [{tenantId:'other'},{guests:3},{arrival:'2020-01-01'},
  {checkedAt:new Date(now.getTime()-120001).toISOString()},
  {checkedAt:new Date(now.getTime()+1).toISOString()},{fingerprint:'unbound'},
  {available_options:[null]}])assert.equal(evaluate({capacity:{...capacity,...changed}}).capacity.verified,false);
 const stale=structuredClone(capacity);stale.available_options[0].evidence.checkedAt=new Date(now.getTime()-120001).toISOString();
 assert.equal(evaluate({capacity:stale}).capacity.verified,false);
 assert.equal(evaluate({facts:{...facts,units_requested:2},capacity}).capacity.verified,false);
 assert.equal(evaluate().capacity.status,'UNKNOWN');
 const unavailable=await capacityFor(facts,{deluxe:0});assert.equal(evaluate({capacity:unavailable}).capacity.status,'UNAVAILABLE');
 const twoUnits={...facts,units_requested:2};
 const insufficient=await capacityFor(twoUnits,{deluxe:1});
 assert.equal(evaluate({facts:twoUnits,capacity:insufficient}).capacity.status,'UNAVAILABLE');
});
test('split pool rules stay shared: A+C allowed without adjacency, exact physical pairing not inferred',async()=>{
 const splitFacts={...facts,cabin:'Osztott',adults:6,guests:6,units_requested:2};
 const message='Osztott A+C';const capacity=await capacityFor(splitFacts,{splitA:1,splitC:1},message);
 const result=evaluate({facts:splitFacts,message,capacity});assert.equal(result.capacity.status,'AVAILABLE');
 assert.equal(result.capacity.selectedOptions[0].same_house_pairing_verified,false);
 assert.equal(evaluate({facts:{...splitFacts,split_request:splitRequestFromText(message)},message:'A telefonszám később jön.',capacity}).capacity.status,'AVAILABLE');
 for(const request of ['Osztott A+C egymás mellett','Osztott 7A+7C']){
  const requested=await capacityFor(splitFacts,{splitA:1,splitC:1},request);
  assert.equal(evaluate({facts:splitFacts,message:request,capacity:requested}).capacity.verified,false);
 }
 const stale=structuredClone(capacity);stale.split_pool_checks.splitAB.evidence.checkedAt=new Date(now.getTime()-120001).toISOString();
 assert.equal(evaluate({facts:splitFacts,message,capacity:stale}).capacity.verified,false);
});
test('only approved, full-stay party-bound components are totalled after selected capacity',async()=>{
 const capacity=await capacityFor();
 const scope={tenantId:'sarberki',unitId:'deluxe',arrival,departure,guests:2,adults:2,children:0,child_ages:[],units:1,approved:true,checkedAt:now.toISOString()};
 const amounts={base:100,seasonal:20,discount:10,tourismTax:5,optional:0};
 const priceComponents={...scope,components:Object.fromEntries(Object.entries(amounts).map(([name,amount])=>[name,{...scope,amount,verified:true,source:'SYNTHETIC_APPROVED_FIXTURE'}]))};
 const result=evaluate({capacity,priceComponents});assert.equal(result.pricing.verified,true);assert.equal(result.pricing.breakdown.total,115);
 assert.equal(result.pricing.guestPriceApproved,false);assert.equal(evaluate({priceComponents}).pricing.verified,false);
 for(const change of [{approved:false},{departure:arrival},{tenantId:'other'},{adults:1},
  {child_ages:[7]},{checkedAt:new Date(now.getTime()-120001).toISOString()}])assert.equal(evaluate({capacity,priceComponents:{...priceComponents,...change}}).pricing.verified,false);
 for(const change of [{approved:false},{unitId:'vip'},{amount:-1},{child_ages:[7]},
  {source:''},{verified:false}]){
  const bad=structuredClone(priceComponents);Object.assign(bad.components.discount,change);
  assert.equal(evaluate({capacity,priceComponents:bad}).pricing.verified,false);
 }
 assert.deepEqual(result.safety,{emailSent:false,bookingCreated:false,approval:'pending',guestPriceApproved:false});
});
test('evaluation never mutates caller facts, capacity or price proof',async()=>{
 const capacity=await capacityFor(),input=structuredClone({facts,capacity}),before=structuredClone(input);
 const result=evaluate(input);assert.deepEqual(input,before);assert.equal(Object.isFrozen(result),true);
 assert.equal(capacity.fingerprint,capacityKey(result.capacity.input));
});
