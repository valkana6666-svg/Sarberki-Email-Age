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
  assert.equal(BUSINESS.accommodationTypes.small.maxGuests,2);
});

test('company config is immutable at the top level',()=>{
  assert.equal(Object.isFrozen(BUSINESS),true);
  assert.equal(Object.isFrozen(BUSINESS.accommodationTypes),true);
  assert.equal(Object.isFrozen(BUSINESS.bookingProvider),true);
});
