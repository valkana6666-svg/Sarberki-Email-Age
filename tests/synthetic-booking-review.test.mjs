import test from 'node:test';import assert from 'node:assert/strict';
import {prepareSyntheticBookingReview} from '../shared-core/server-synthetic-booking-review.mjs';
const now=Date.parse('2026-10-10T08:00:00Z');
const record={tenantId:'sarberki-test',data:{id:'synthetic-review',tenantId:'sarberki-test',sender:'guest@synthetic.invalid',state:{values:{arrival:'2026-11-01',departure:'2026-11-03',guests:'2',adults:'2',children:'0',unit:'Deluxe',language:'en'}}}};
function providers(change={}){const calls=[];return {calls,now,record,availability:async q=>{calls.push('capacity');return {...q,checkedAt:new Date(now).toISOString(),source:'synthetic-fixture',availability:'available',availableUnits:1,...change};},pricing:async q=>{calls.push('price');return {...q,checkedAt:new Date(now).toISOString(),tenantId:'sarberki-test',unitId:q.cabin,capacity:4,nightly:100,basis:'per_unit',verified:true,source:'synthetic-fixture'};}};}
test('complete fixture workflow checks capacity before fixed unit calculation and waits for internal review',async()=>{const p=providers(),r=await prepareSyntheticBookingReview(p);assert.deepEqual(p.calls,['capacity','price']);assert.equal(r.status,'internal_review_required');assert.equal(r.approval,'pending');assert.equal(r.quote.base,200);assert.ok(!r.draft.includes('200'));assert.doesNotMatch(r.draft,/7A|7B|7C|Previo/);});
test('missing data prevents capacity and price calls',async()=>{const p=providers();p.record=structuredClone(record);delete p.record.data.state.values.arrival;const r=await prepareSyntheticBookingReview(p);assert.equal(r.status,'missing_data');assert.deepEqual(p.calls,[]);});
for(const [name,change] of Object.entries({unverified:{source:null},stale:{checkedAt:'2020-01-01T00:00:00Z'},wrongStay:{departure:'2026-11-04'},failed:{error:'offline'},zero:{availability:'unavailable',availableUnits:0}}))test('fixture '+name+' never reaches price or promises capacity',async()=>{const p=providers(change),r=await prepareSyntheticBookingReview(p);assert.equal(r.quote,undefined);assert.deepEqual(p.calls,['capacity']);assert.equal(r.approval,'pending');});
test('failed fixture request stays unknown instead of zero stock',async()=>{const p=providers();p.availability=async()=>{throw Error('offline');};assert.equal((await prepareSyntheticBookingReview(p)).status,'capacity_unknown');});
test('A/B/C type-pool evidence cannot promise same-house placement',async()=>{const p=providers();p.record=structuredClone(record);p.record.data.state.values.unit='Osztott';p.record.data.state.values.split_request_text='A+B same house';assert.equal((await prepareSyntheticBookingReview(p)).status,'split_manual_review');assert.deepEqual(p.calls,['capacity']);});
test('base price is fixed until verified unit capacity',async()=>{const p=providers(),one=await prepareSyntheticBookingReview(p);p.record=structuredClone(record);p.record.data.state.values.guests='4';p.record.data.state.values.adults='4';const four=await prepareSyntheticBookingReview(p);assert.equal(one.quote.base,four.quote.base);});
test('foreign tenant cannot borrow Sárberki fixture rules',async()=>{const p=providers();p.record={...record,tenantId:'demo-test'};await assert.rejects(prepareSyntheticBookingReview(p),/Synthetic case/);assert.deepEqual(p.calls,[]);});
test('two confirmed units multiply the fixed base and hot tub stays separately priced',async()=>{const p=providers({availableUnits:2});p.record=structuredClone(record);p.record.data.state.values.units_requested='2';const r=await prepareSyntheticBookingReview(p);assert.equal(r.quote.base,400);assert.deepEqual(r.excludedExtras,['hot_tub']);});
for(const [name,values] of Object.entries({invalidDate:{arrival:'2026-02-30',departure:'2026-03-03'},adultAsChild:{guests:'3',children:'1',child_ages:'18'},invalidAge:{guests:'3',children:'1',child_ages:'abc'},contradictoryNights:{nights:'4'},unknownType:{unit:'Unknown'}}))test(name+' is rejected before any provider call',async()=>{
 const p=providers();p.record=structuredClone(record);Object.assign(p.record.data.state.values,values);
 assert.equal((await prepareSyntheticBookingReview(p)).status,'missing_data');assert.deepEqual(p.calls,[]);
});
test('excluded unit capacity never reaches capacity or price providers',async()=>{
 const p=providers();p.record=structuredClone(record);Object.assign(p.record.data.state.values,{guests:'6',adults:'6'});
 assert.equal((await prepareSyntheticBookingReview(p)).status,'capacity_incompatible');assert.deepEqual(p.calls,[]);
});
for(const change of [{arrival:'2026-11-04'},{departure:'2026-11-09'},{checkedAt:'2020-01-01T00:00:00Z'},{tenantId:'demo-test'},{unitId:'VIP'},{verified:false},{nightly:NaN}])test('invalid price source cannot become a quote '+JSON.stringify(change),async()=>{
 const p=providers(),price=p.pricing;p.pricing=async q=>({...await price(q),...change});
 const result=await prepareSyntheticBookingReview(p);assert.equal(result.status,'price_unknown');assert.equal(result.quote,undefined);
});
test('pricing failure stays pending and does not expose provider details',async()=>{
 const p=providers();p.pricing=async()=>{throw Error('secret provider detail');};
 const result=await prepareSyntheticBookingReview(p);assert.equal(result.status,'price_unknown');assert.doesNotMatch(JSON.stringify(result),/secret/);
});
test('capacity expires while pricing is running and cannot be used afterwards',async()=>{
 const p=providers(),price=p.pricing;let time=now;p.currentNow=()=>time;
 p.pricing=async q=>{const r=await price(q);time+=120001;return {...r,checkedAt:new Date(time).toISOString()};};
 const result=await prepareSyntheticBookingReview(p);assert.equal(result.status,'capacity_unknown');assert.equal(result.quote,undefined);
});
