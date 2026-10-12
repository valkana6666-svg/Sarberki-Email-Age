import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedUnitBase,verifiedPriceBreakdown} from '../shared-core/verified-pricing.mjs';

// Synthetic approved prices only: no real rate, PMS, booking or email call.
const tenantId='sarberki-test';
const types=[
 ['vip',7,4],['family',8,4],['deluxe',6,4],['splitC',4,4],
 ['splitA',2,2],['splitB',2,2],['standalone15',2,2]
];
for(const [unitId,capacity,baseOccupancy] of types){
 const rate={tenantId,unitId,basis:'per_unit',verified:true,source:'SYNTHETIC_RATE',nightly:40000};
 for(const guests of [1,2,3,4,5,6,7,8].filter(n=>n<=capacity)){
  test(`fixed unit base ${unitId}: ${guests} guests (base occupancy ${baseOccupancy})`,()=>{
   const result=verifiedUnitBase({tenantId,unitId,capacity,guests,nights:2,rate});
   assert.equal(result.amount,80000);
   assert.equal(result.basis,'per_unit');
   assert.equal(result.verified,true);
  });
 }
 test(`reject over-capacity guests for ${unitId}`,()=>{
  assert.throws(()=>verifiedUnitBase({tenantId,unitId,capacity,guests:capacity+1,nights:2,rate}),/kapacitás/);
 });
}
test('extra charges are sourced separately, never guessed from party size',()=>{
 const unitId='vip',capacity=7,guests=6;
 const amounts={base:80000,seasonal:0,discount:0,tourismTax:6000,optional:12000};
 const components=Object.fromEntries(Object.entries(amounts).map(([k,amount])=>[k,{tenantId,verified:true,source:'SYNTHETIC_APPROVED',amount}]));
 const result=verifiedPriceBreakdown({tenantId,unitId,capacity,guests,components});
 assert.equal(result.base,80000);assert.equal(result.total,98000);
});
test('unverified extra fee cannot be quoted',()=>{
 const unitId='deluxe';
 const components=Object.fromEntries(['base','seasonal','discount','tourismTax','optional'].map(k=>[k,{tenantId,verified:k!=='optional',source:'SYNTHETIC',amount:0}]));
 assert.throws(()=>verifiedPriceBreakdown({tenantId,unitId,capacity:6,guests:5,components}),/Nem ellenőrzött/);
});
