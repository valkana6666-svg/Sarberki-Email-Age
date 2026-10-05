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


test('group-size booking rules stay explicit',()=>{
  assert.equal(BUSINESS.bookingRules.depositPctUnder15Guests,50);
  assert.equal(BUSINESS.bookingRules.depositPctFrom15Guests,80);
  assert.equal(BUSINESS.bookingRules.cancellationDaysUnder15Guests,14);
  assert.equal(BUSINESS.bookingRules.cancellationDaysFrom15Guests,30);
  assert.equal(BUSINESS.operationalRules.returningGuestLookbackDays,730);
  assert.equal(BUSINESS.operationalRules.returningGuestDiscountPct,20);
  assert.equal(BUSINESS.operationalRules.checkoutBy,'10:00');
});


test('split Previo object-kind mapping is verified only at pooled type level',()=>{
  const a=BUSINESS.accommodationTypes.splitA;
  const b=BUSINESS.accommodationTypes.splitB;
  const upper=BUSINESS.accommodationTypes.splitC;
  assert.equal(a.previoTypeMappingVerified,true);
  assert.equal(b.previoTypeMappingVerified,true);
  assert.equal(upper.previoTypeMappingVerified,true);
  assert.equal(a.previoObjectKindName,'2 fős apartman');
  assert.equal(b.previoObjectKindName,'2 fős apartman');
  assert.equal(a.previoObjectKindId,766441);
  assert.equal(b.previoObjectKindId,766441);
  assert.equal(a.previoObjectKindPoolSize,8);
  assert.equal(upper.previoObjectKindName,'4 fős apartman');
  assert.equal(upper.previoObjectKindId,766443);
  assert.equal(upper.previoObjectKindPoolSize,4);
  for(const unit of [a,b,upper]){
    assert.equal(unit.previoIndividualUnitMappingVerified,false);
    assert.equal(unit.previoPairingVerified,false);
    assert.equal(unit.previoMappingVerified,false);
  }
});
