import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAvailabilityOptions} from '../netlify/functions/availability-options.mjs';
import {capacityInput} from '../booking-filter.mjs';
import {verifiedUnitBase} from '../shared-core/verified-pricing.mjs';
import {BUSINESS} from '../business-config.mjs';
import {buildChatInquiryReply,buildEmailInquiryDraft} from '../shared-core/inquiry-channel-adapters.mjs';

// Price-spec P01-P15, exercised on BOTH channels with a synthetic read-only
// capacity source and approved synthetic per-unit prices. Never live PMS rates.
const now=new Date('2026-10-12T10:00:00Z');
const tenantId='sarberki';
const dates={arrival:'2026-11-26',departure:'2026-11-28',inferred_year:false};
const adapters={chat:buildChatInquiryReply,email:buildEmailInquiryDraft};
const fact=(cabin,adults,children=0,child_ages=[])=>({dates,cabin,adults,children,child_ages,guests:adults+children,units_requested:1});
async function availability(f,{stock=[],unknown=[]}={}){
 const input=capacityInput({arrival:dates.arrival,departure:dates.departure,guests:f.guests,adults:f.adults,children:f.children,unit:f.cabin||'',units_requested:1});
 const calls=[];
 const source=async q=>{
  calls.push(q.cabin);
  if(unknown.includes(q.cabin))throw Error('SYNTHETIC_TIMEOUT');
  const availableUnits=stock.includes(q.cabin)?1:0;
  return {...q,availability:availableUnits?'available':'unavailable',availableUnits,checkedAt:now.toISOString(),source:'SYNTHETIC_PREVIO_READ_ONLY'};
 };
 const capacity=await buildAvailabilityOptions(input,source,{now:()=>now.getTime()});
 return {capacity,calls};
}
function approvedPrice(f,key,extra=0){
 const rate={tenantId,unitId:key,basis:'per_unit',nightly:40000,verified:true,source:'SYNTHETIC_APPROVED_PER_UNIT'};
 const physicalCapacity=BUSINESS.accommodationTypes[f.cabin]?.maxGuests??(key==='splitAB'?2:8);
 const base=verifiedUnitBase({tenantId,unitId:key,capacity:physicalCapacity,guests:f.guests,nights:2,rate}).amount;
 const scope={tenantId,unitId:key,arrival:dates.arrival,departure:dates.departure,guests:f.guests,adults:f.adults,children:f.children,child_ages:f.child_ages,units:1,approved:true,checkedAt:now.toISOString()};
 const amounts={base,seasonal:0,discount:0,tourismTax:0,optional:extra};
 return {...scope,components:Object.fromEntries(Object.entries(amounts).map(([k,amount])=>[k,{...scope,verified:true,source:'SYNTHETIC_APPROVED',amount}]))};
}
const priceCases=[
 ['P01 VIP 2 adults','vip',2,0,[],4,'vip',0],
 ['P02 family 3 adults','family',3,0,[],4,'family',0],
 ['P03 Deluxe 2 adults','deluxe',2,0,[],4,'deluxe',0],
 ['P04 Deluxe 3 adults','deluxe',3,0,[],4,'deluxe',0],
 ['P05 upstairs C 2 adults','splitC',2,0,[],4,'splitC',0],
 ['P06 upstairs C 4 adults','splitC',4,0,[],4,'splitC',0],
 ['P07 split A 2 adults','splitA',2,0,[],2,'splitAB',0],
 ['P08 detached two-person 2 adults','small',2,0,[],2,'small',0],
 ['P10 family 2 adults and child aged 7','family',2,1,[7],4,'family',0],
 ['P11 Deluxe 2 adults and children aged 7 and 11','deluxe',2,2,[7,11],4,'deluxe',0],
 ['P12 VIP 5 adults approved synthetic fifth-person fee','vip',5,0,[],4,'vip',5000]
];
for(const [name,cabin,adults,children,ages,minBase,key,extra] of priceCases){
 for(const [channel,adapter] of Object.entries(adapters))test(name+' / '+channel,async()=>{
  const f=fact(cabin,adults,children,ages);
  const {capacity,calls}=await availability(f,{stock:[key==='splitAB'?'splitA':key]});
  assert.deepEqual(calls,[key==='splitAB'?'splitA':key]);
  assert.equal(BUSINESS.accommodationTypes[cabin].basePriceGuests,minBase);
  const proof=approvedPrice(f,key,extra);
  const decision=adapter({facts:f,capacity,priceComponents:proof,now,tenantId}).decision;
  assert.equal(decision.capacity.status,'AVAILABLE');
  assert.equal(decision.capacity.input.guests,adults+children);
  assert.equal(decision.pricing.status,'VERIFIED');
  assert.equal(decision.pricing.breakdown.base,80000);
  assert.equal(decision.pricing.breakdown.total,80000+extra);
  assert.equal(decision.pricing.guestPriceApproved,false);
  assert.equal(decision.safety.bookingCreated,false);
  assert.equal(decision.safety.emailSent,false);
 });
}
for(const [channel,adapter] of Object.entries(adapters)){
 test('P09 four adults cannot book a two-person detached house / '+channel,async()=>{
  const f=fact('small',4);const {capacity,calls}=await availability(f,{stock:['small']});
  const decision=adapter({facts:f,capacity,now,tenantId}).decision;
  assert.deepEqual(calls,[]);
  assert.equal(decision.capacity.status,'UNKNOWN');
  assert.equal(decision.capacity.incompatible,true);
  assert.equal(decision.pricing.verified,false);
 });
 test('P13 six adults without type exclude two-person and single C units / '+channel,async()=>{
  const f=fact(null,6);const {capacity,calls}=await availability(f,{stock:['family','vip','deluxe','splitC','small','splitA']});
  const decision=adapter({facts:f,capacity,now,tenantId}).decision;
  assert.equal(decision.capacity.status,'AVAILABLE');
  assert.equal(calls.includes('splitA'),false);
  assert.equal(calls.includes('splitC'),false);
  assert.equal(calls.includes('small'),false);
  assert.ok(decision.capacity.selectedOptions.every(x=>!['small','splitAB','splitC'].includes(x.key)));
  assert.equal(decision.pricing.verified,false);
 });
 test('P14 requested unavailable VIP finds all and only verified alternatives / '+channel,async()=>{
  const f=fact('vip',2);const {capacity,calls}=await availability(f,{stock:['family','deluxe','small','splitA','splitC']});
  const decision=adapter({facts:f,capacity,now,tenantId}).decision;
  assert.equal(calls[0],'vip');
  assert.equal(calls.filter(x=>x==='vip').length,1);
  assert.equal(decision.capacity.status,'AVAILABLE');
  assert.ok(decision.capacity.selectedOptions.some(x=>x.key==='family'));
  assert.ok(decision.capacity.selectedOptions.some(x=>x.key==='deluxe'));
  assert.ok(decision.capacity.selectedOptions.some(x=>x.key==='small'));
  assert.equal(decision.capacity.selectedOptions.some(x=>x.key==='vip'),false);
  assert.equal(decision.pricing.verified,false);
 });
 test('P15 unknown requested VIP cannot authorize price or alternatives / '+channel,async()=>{
  const f=fact('vip',2);const {capacity,calls}=await availability(f,{stock:['family'],unknown:['vip']});
  const decision=adapter({facts:f,capacity,now,tenantId}).decision;
  assert.deepEqual(calls,['vip']);
  assert.equal(decision.capacity.status,'UNKNOWN');
  assert.deepEqual(decision.capacity.selectedOptions,[]);
  assert.equal(decision.pricing.verified,false);
 });
}
