import test from 'node:test';
import assert from 'node:assert/strict';
import {BUSINESS} from './business-config.mjs';

test('business config contains reusable company boundary',()=>{
  assert.equal(BUSINESS.brandName,'Sárberki Horgásztó');
  assert.equal(BUSINESS.currency,'HUF');
  assert.equal(BUSINESS.bookingProvider.kind,'previo-public-booking');
  assert.equal(BUSINESS.bookingProvider.hotelId,'753011');
  assert.equal(BUSINESS.accommodationTypes.deluxe.maxGuests,6);
  assert.equal(BUSINESS.accommodationTypes.family.maxGuests,8);
  assert.equal(BUSINESS.accommodationTypes.vip.maxGuests,7);
  assert.equal(BUSINESS.accommodationTypes.small.maxGuests,3);
});

test('company config is immutable at the top level',()=>{
  assert.equal(Object.isFrozen(BUSINESS),true);
  assert.equal(Object.isFrozen(BUSINESS.accommodationTypes),true);
  assert.equal(Object.isFrozen(BUSINESS.bookingProvider),true);
  assert.equal(Object.isFrozen(BUSINESS.pricingRules),true);
});

test('all current public nightly base prices are mapped',()=>{
  assert.equal(BUSINESS.accommodationTypes.family.publicListedNightlyHuf,52000);
  assert.equal(BUSINESS.accommodationTypes.deluxe.publicListedNightlyHuf,60000);
  assert.equal(BUSINESS.accommodationTypes.vip.publicListedNightlyHuf,60000);
  assert.equal(BUSINESS.accommodationTypes.small.publicListedNightlyHuf,30000);
  assert.equal(BUSINESS.accommodationTypes.splitA.publicListedNightlyHuf,23000);
  assert.equal(BUSINESS.accommodationTypes.splitB.publicListedNightlyHuf,23000);
  assert.equal(BUSINESS.accommodationTypes.splitC.publicListedNightlyHuf,44000);
});

test('standard extra guest rules are shared by all expandable four-person units',()=>{
  assert.equal(BUSINESS.pricingRules.extraAdultNightlyHuf,4500);
  assert.equal(BUSINESS.pricingRules.child0to3NightlyHuf,0);
  assert.equal(BUSINESS.pricingRules.child3to8NightlyHuf,2250);
  for(const key of ['family','deluxe','vip','splitC']){
    assert.equal(BUSINESS.accommodationTypes[key].basePriceGuests,4);
    assert.equal(BUSINESS.accommodationTypes[key].extraAdultPricing,'standard');
  }
  for(const key of ['splitA','splitB','small']){
    assert.notEqual(BUSINESS.accommodationTypes[key].extraAdultPricing,'standard');
  }
});

test('split unit capacities and public prices stay distinct',()=>{
  assert.equal(BUSINESS.accommodationTypes.splitA.maxGuests,2);
  assert.equal(BUSINESS.accommodationTypes.splitB.maxGuests,2);
  assert.equal(BUSINESS.accommodationTypes.splitC.maxGuests,5);
  assert.equal(BUSINESS.accommodationTypes.splitA.publicPriceLabel,'2 fős apartman');
  assert.equal(BUSINESS.accommodationTypes.splitC.publicPriceLabel,'4 fős apartman');
});
