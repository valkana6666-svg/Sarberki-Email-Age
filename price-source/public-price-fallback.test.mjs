import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchPublicPriceReference} from './public-price-fallback.mjs';

test('2027 split C base reference uses signed 46000 HUF for four guests',()=>{
 const q=fetchPublicPriceReference({arrival:'2027-10-01',departure:'2027-10-03',cabin:'splitC',adults:4,children:[]});
 assert.equal(q.status,'public_reference');assert.equal(q.referenceOnly,true);
 assert.equal(q.availability,'not_checked');
 assert.equal(q.accommodation,92000);assert.equal(q.tourismTax,4400);assert.equal(q.total,96400);
});
test('2027 adult-only fifth guest uses signed 10000 HUF per night',()=>{
 const q=fetchPublicPriceReference({arrival:'2027-10-01',departure:'2027-10-03',cabin:'splitC',adults:5,children:[]});
 assert.equal(q.accommodation,112000);assert.equal(q.tourismTax,5500);assert.equal(q.total,117500);
});
test('2027 additional child fee is not silently invented',()=>{
 assert.throws(()=>fetchPublicPriceReference({arrival:'2027-10-01',departure:'2027-10-03',cabin:'splitC',adults:4,children:[5]}),/gyermekár/u);
});
test('2027 Deluxe, Family, VIP base price remains the same for 1,3,4 adults',()=>{
 for(const cabin of ['deluxe','family','vip']){
  const values=[1,3,4].map(adults=>fetchPublicPriceReference({arrival:'2027-10-01',departure:'2027-10-03',cabin,adults,children:[]}).accommodation);
  assert.deepEqual(values,[values[0],values[0],values[0]]);
 }
});
test('only 2027 children aged below 3 are explicitly free within base occupancy',()=>{
 const without=fetchPublicPriceReference({arrival:'2027-10-01',departure:'2027-10-03',cabin:'deluxe',adults:2,children:[]});
 const withInfants=fetchPublicPriceReference({arrival:'2027-10-01',departure:'2027-10-03',cabin:'deluxe',adults:2,children:[0,2]});
 assert.equal(withInfants.accommodation,without.accommodation);
 assert.equal(withInfants.total,without.total);
 assert.throws(()=>fetchPublicPriceReference({arrival:'2027-10-01',departure:'2027-10-03',cabin:'deluxe',adults:2,children:[5]}),/gyermekár/u);
});
test('2027 two full-price units have consistent breakdown for adult-only guests',()=>{
 const q=fetchPublicPriceReference({arrival:'2027-10-01',departure:'2027-10-03',cabin:'deluxe',adults:8,children:[],units:2});
 assert.equal(q.unitBreakdown.length,2);assert.equal(q.accommodation,252000);
 assert.equal(q.tourismTax,8800);assert.equal(q.total,260800);
 assert.equal(q.unitBreakdown.reduce((s,u)=>s+u.total,0),q.total);
});
test('mixed 2026-2027 extra adult is unverified rather than automatically priced',()=>{
 assert.throws(()=>fetchPublicPriceReference({arrival:'2026-12-31',departure:'2027-01-02',cabin:'deluxe',adults:5,children:[]}),/pótvendég/u);
});
