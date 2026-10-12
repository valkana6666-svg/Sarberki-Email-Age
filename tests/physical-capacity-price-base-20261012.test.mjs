import test from 'node:test';
import assert from 'node:assert/strict';
import {BUSINESS} from '../business-config.mjs';
import {wholeCabinCandidates} from '../booking-filter.mjs';
const types=BUSINESS.accommodationTypes;
test('upstairs split C has physical maximum of four, never five or six',()=>{
 assert.equal(types.splitC.maxGuests,4);
 assert.equal(types.splitC.maxAdults,4);
 assert.equal(types.splitC.basePriceGuests,4);
});
for(const [key,base] of Object.entries({vip:4,family:4,deluxe:4,splitC:4,splitA:2,splitB:2,small:2})){
 test(`${key} configured base-price occupancy ${base}`,()=>assert.equal(types[key].basePriceGuests,base));
}
for(const [key,max] of Object.entries({vip:7,family:8,deluxe:6,small:3})){
 test(`${key} rejects over-capacity one-unit request`,()=>{
  const result=wholeCabinCandidates({guests:max+1,adults:max+1,units:1,cabin:key});
  assert.ok(result.rejected.some(x=>x.key===key));
 });
}
test('single C cannot be treated as a six-person unit',()=>{
 assert.equal(types.splitC.maxGuests<6,true);
});
