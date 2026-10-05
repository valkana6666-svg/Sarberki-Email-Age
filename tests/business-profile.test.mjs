import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccommodationBusinessProfile} from '../shared-core/business-profile.mjs';
import {SARBERKI_PROFILE} from '../business/sarberki/profile.mjs';

test('generic business profile contains no hard-coded accommodation business',()=>{
  const demo=createAccommodationBusinessProfile({
    id:'demo',
    brandName:'Demo Lodge',
    locale:'en-GB',
    timezone:'Europe/London',
    currency:'GBP',
    bookingRules:{depositPct:25},
    operationalRules:{parking:true},
    pricingRules:{tax:0},
    accommodationTypes:{room:{maxGuests:2}},
    bookingProvider:{kind:'mock'}
  });
  assert.equal(demo.id,'demo');
  assert.equal(demo.brandName,'Demo Lodge');
  assert.equal(demo.currency,'GBP');
});

test('Sárberki values are supplied through its business profile',()=>{
  assert.equal(SARBERKI_PROFILE.id,'sarberki');
  assert.equal(SARBERKI_PROFILE.brandName,'Sárberki Horgásztó');
  assert.ok(SARBERKI_PROFILE.accommodationTypes.deluxe);
  assert.equal(SARBERKI_PROFILE.bookingRules.depositDueDays,10);
});
