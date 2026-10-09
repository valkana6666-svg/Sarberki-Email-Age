import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAvailabilityOptions,handleAvailabilityOptions,isLiveAvailabilityEnabled,splitCapacityOptions} from '../netlify/functions/availability-options.mjs';

test('six guests respect verified nominal capacity without unverified extra beds and split manual-review combinations',async()=>{
  const free={deluxe:2,family:1,vip:1};
  const result=await buildAvailabilityOptions({arrival:'2026-10-09',departure:'2026-10-13',guests:6},async input=>({
    status:'review_required',availability:(free[input.cabin]||0)>0?'available':'unavailable',availableUnits:free[input.cabin]||0,checkedAt:new Date().toISOString(),source:'test'
  }));
  assert.deepEqual(result.available_options.map(x=>x.key).sort(),['deluxe','family']);
  assert.deepEqual(result.available_options.map(x=>x.units),[2,1]);
  const split=result.manual_review_options.map(x=>x.label).sort();
  assert.deepEqual(split,['Osztott A + Osztott C','Osztott B + Osztott C']);
  assert.ok(result.manual_review_options.every(x=>x.same_house_preferred===true));
  assert.deepEqual(result.manual_review_options[0].candidate_combinations,[['7A','7C'],['8A','8C'],['9A','9C'],['10A','10C']]);
  assert.ok(result.manual_review_options.every(x=>x.availability_verified===false));
});

test('split pooled availability can be verified while physical pairing stays manual',async()=>{
  const free={deluxe:2,family:1,vip:1,splitA:4,splitC:3};
  const result=await buildAvailabilityOptions({arrival:'2026-10-09',departure:'2026-10-13',guests:6},async input=>({
    status:'review_required',
    availability:(free[input.cabin]||0)>0?'available':'unavailable',
    availableUnits:free[input.cabin]||0,
    checkedAt:new Date().toISOString(),
    source:'test'
  }));
  assert.equal(result.split_pool_checks.splitAB.verified,true);
  assert.equal(result.split_pool_checks.splitAB.availableUnits,4);
  assert.equal(result.split_pool_checks.splitC.verified,true);
  assert.equal(result.split_pool_checks.splitC.availableUnits,3);
  for(const option of result.manual_review_options){
    assert.equal(option.pooled_availability_verified,true);
    assert.equal(option.availability_verified,false);
    assert.match(option.reason,/van elég szabad egység/u);
    assert.match(option.reason,/párosítás/u);
  }
});

test('insufficient split pool capacity never upgrades the manual-review combination',async()=>{
  const free={deluxe:2,family:1,vip:1,splitA:0,splitC:3};
  const result=await buildAvailabilityOptions({arrival:'2026-10-09',departure:'2026-10-13',guests:6},async input=>({
    status:'review_required',
    availability:(free[input.cabin]||0)>0?'available':'unavailable',
    availableUnits:free[input.cabin]||0,source:'test',checkedAt:new Date().toISOString()
  }));
  assert.ok(result.manual_review_options.every(x=>x.pooled_availability_verified===false));
  assert.ok(result.manual_review_options.every(x=>x.availability_verified===false));
});

test('same-type multi-unit option requires enough free units',async()=>{
  const result=await buildAvailabilityOptions({arrival:'2026-10-09',departure:'2026-10-13',guests:12},async input=>({
    status:'review_required',availability:'available',availableUnits:input.cabin==='family'?2:1,source:'test',checkedAt:new Date().toISOString()
  }));
  assert.equal(result.available_options.some(x=>x.key==='family'&&x.units===2),true);
  assert.equal(result.available_options.some(x=>x.key==='deluxe'),false);
});

test('availability endpoint accepts only anonymous dates and total guests',async()=>{
  const req=new Request('https://leafy-chimera-2403e5.netlify.app/api/availability-options',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({arrival:'2026-10-09',departure:'2026-10-13',guests:6})});
  const res=await handleAvailabilityOptions(req,async input=>({availability:'available',availableUnits:3,source:'test',checkedAt:new Date().toISOString(),status:'review_required',...input}),true);
  assert.equal(res.status,200);
  const body=await res.json();
  assert.ok(body.available_options.length>=3);
  const bad=new Request('https://leafy-chimera-2403e5.netlify.app/api/availability-options',{method:'POST',body:JSON.stringify({arrival:'2026-10-09',departure:'2026-10-13',guests:6,name:'Kovács István'})});
  const badRes=await handleAvailabilityOptions(bad,async()=>{throw Error('should not call');},true);
  assert.equal(badRes.status,503);
});

test('live availability is isolated to the test host',()=>{
  assert.equal(isLiveAvailabilityEnabled(new Request('https://leafy-chimera-2403e5.netlify.app/api/availability-options'),true),true);
  assert.equal(isLiveAvailabilityEnabled(new Request('https://moonlit-torrone-88b39d.netlify.app/api/availability-options')),false);
});

test('split planner never claims verified availability',()=>{
  const options=splitCapacityOptions(6);
  assert.equal(options.length,2);
  assert.ok(options.every(x=>x.availability_verified===false));
});


test('split manual review explains the verified pooled Previo type mapping boundary',()=>{
  const options=splitCapacityOptions(6);
  assert.equal(options.length,2);
  for(const option of options){
    assert.match(option.reason,/2 fős apartman pool/u);
    assert.match(option.reason,/4 fős apartman pool/u);
    assert.match(option.reason,/egyedi 7A–10C/u);
    assert.equal(option.availability_verified,false);
  }
});

test('October 23–25: C pool remains an alternative when all requested whole cabins are full',async()=>{
 const result=await buildAvailabilityOptions({arrival:'2026-10-23',departure:'2026-10-25',guests:4},async input=>({availability:input.cabin==='splitC'?'available':'unavailable',availableUnits:input.cabin==='splitC'?2:0,source:'test',checkedAt:new Date().toISOString(),...input}));
 assert.deepEqual(result.available_options.map(x=>x.key),['splitC']);
 assert.equal(result.available_options[0].individual_unit_mapping_verified,false);
 assert.ok(result.manual_review_options.every(x=>!x.same_house_pairing_verified&&!x.pooled_availability_verified));
});
for(const bad of [{availability:'unverified',availableUnits:4},{availability:'available',availableUnits:0},{availability:'available',availableUnits:1.5},{availability:'available',availableUnits:2,arrival:'2026-10-24'}]){
 test(`invalid or mismatched capacity stays unverified: ${JSON.stringify(bad)}`,async()=>{
  const result=await buildAvailabilityOptions({arrival:'2026-10-23',departure:'2026-10-25',guests:4},async()=>bad);
  assert.equal(result.available_options.length,0);assert.equal(result.unavailable_options.length,0);
  assert.equal(result.split_pool_checks.splitAB.verified,false);
 });
}
