import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAvailabilityOptions,handleAvailabilityOptions,isLiveAvailabilityEnabled,splitCapacityOptions} from '../netlify/functions/availability-options.mjs';

test('six guests produce verified single-house options and split manual-review combinations',async()=>{
  const free={deluxe:2,family:1,vip:1};
  const result=await buildAvailabilityOptions({arrival:'2026-10-09',departure:'2026-10-13',guests:6},async input=>({
    status:'review_required',availability:(free[input.cabin]||0)>0?'available':'unavailable',availableUnits:free[input.cabin]||0,checkedAt:'2026-10-03T13:06:00Z',source:'test'
  }));
  assert.deepEqual(result.available_options.map(x=>x.key).sort(),['deluxe','family','vip']);
  assert.deepEqual(result.available_options.map(x=>x.units),[1,1,1]);
  const split=result.manual_review_options.map(x=>x.label).sort();
  assert.deepEqual(split,['Osztott A + Osztott C','Osztott B + Osztott C']);
  assert.ok(result.manual_review_options.every(x=>x.availability_verified===false));
});

test('split pooled availability can be verified while physical pairing stays manual',async()=>{
  const free={deluxe:2,family:1,vip:1,splitA:4,splitC:3};
  const result=await buildAvailabilityOptions({arrival:'2026-10-09',departure:'2026-10-13',guests:6},async input=>({
    status:'review_required',
    availability:(free[input.cabin]||0)>0?'available':'unavailable',
    availableUnits:free[input.cabin]||0,
    checkedAt:'2026-10-05T13:00:00Z',
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
    availableUnits:free[input.cabin]||0
  }));
  assert.ok(result.manual_review_options.every(x=>x.pooled_availability_verified===false));
  assert.ok(result.manual_review_options.every(x=>x.availability_verified===false));
});

test('same-type multi-unit option requires enough free units',async()=>{
  const result=await buildAvailabilityOptions({arrival:'2026-10-09',departure:'2026-10-13',guests:12},async input=>({
    status:'review_required',availability:'available',availableUnits:input.cabin==='family'?2:1
  }));
  assert.equal(result.available_options.some(x=>x.key==='family'&&x.units===2),true);
  assert.equal(result.available_options.some(x=>x.key==='deluxe'),false);
});

test('availability endpoint accepts only anonymous dates and total guests',async()=>{
  const req=new Request('https://leafy-chimera-2403e5.netlify.app/api/availability-options',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({arrival:'2026-10-09',departure:'2026-10-13',guests:6})});
  const res=await handleAvailabilityOptions(req,async input=>({availability:'available',availableUnits:3,status:'review_required',...input}),true);
  assert.equal(res.status,200);
  const body=await res.json();
  assert.ok(body.available_options.length>=3);
  const bad=new Request('https://leafy-chimera-2403e5.netlify.app/api/availability-options',{method:'POST',body:JSON.stringify({arrival:'2026-10-09',departure:'2026-10-13',guests:6,name:'Kovács István'})});
  const badRes=await handleAvailabilityOptions(bad,async()=>{throw Error('should not call');},true);
  assert.equal(badRes.status,503);
});

test('live availability is isolated to the test host',()=>{
  assert.equal(isLiveAvailabilityEnabled(new Request('https://leafy-chimera-2403e5.netlify.app/api/availability-options')),true);
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
