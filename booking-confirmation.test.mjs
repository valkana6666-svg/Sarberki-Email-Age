import test from 'node:test';
import assert from 'node:assert/strict';
import {cancellationDaysForGuests,depositPercentForGuests,generateDepositReceivedDraft} from './booking-confirmation.mjs';
const fixture={name:'Teszt Elek',arrival:'2026-10-30',departure:'2026-11-01',cabin:'Deluxe',guests:4};
test('deposit simulation respects approved 14/15/16 guest boundary',()=>{
  for(const [n,pct] of [[14,50],[15,50],[16,80]])assert.equal(depositPercentForGuests(n),pct);
});
test('guest count cannot invent cancellation terms',()=>{
  for(const n of [4,15,16])assert.throws(()=>cancellationDaysForGuests(n),/dátum/u);
});
test('empty and incomplete simulation cannot produce a finalized letter',()=>{
  assert.throws(()=>generateDepositReceivedDraft({guests:4}),/név/u);
  for(const field of ['name','arrival','departure','cabin'])assert.throws(()=>generateDepositReceivedDraft({...fixture,[field]:''}),/szimulációhoz/u);
});
test('invalid, reversed and same-day intervals are rejected',()=>{
  for(const change of [{arrival:'2026-02-30'},{departure:'2026-10-29'},{departure:fixture.arrival}])assert.throws(()=>generateDepositReceivedDraft({...fixture,...change}),/időszak/u);
});
test('four languages mark every output as simulation and deny actual finalization',()=>{
  const markers={HU:/SZIMULÁCIÓ/u,EN:/SIMULATION/u,DE:/SIMULATION/u,SL:/SIMULACIJA/u};
  for(const language of Object.keys(markers)){
    const draft=generateDepositReceivedDraft({...fixture,language,guests:16});
    assert.match(draft,markers[language]);assert.match(draft,/80\s?%/u);
    assert.match(draft,/2026-10-30 – 2026-11-01/u);
    assert.doesNotMatch(draft,/foglalását véglegesítettük|has now been finalized|endgültig bestätigt wurde|s tem dokončno potrjena|30 days|14\. napig/u);
  }
});
test('invalid guest counts and unsupported language fail closed',()=>{
  for(const guests of [0,-1,1.5,'unknown'])assert.throws(()=>generateDepositReceivedDraft({...fixture,guests}));
  assert.throws(()=>generateDepositReceivedDraft({...fixture,language:'xx'}));
});
