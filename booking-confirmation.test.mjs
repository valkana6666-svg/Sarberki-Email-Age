import test from 'node:test';
import assert from 'node:assert/strict';
import {cancellationDaysForGuests,depositPercentForGuests,generateDepositReceivedDraft} from './booking-confirmation.mjs';

test('under 15 guests uses 50 percent deposit and 14 day cancellation',()=>{
  assert.equal(depositPercentForGuests(8),50);
  assert.equal(cancellationDaysForGuests(8),14);
  const hu=generateDepositReceivedDraft({language:'HU',name:'Teszt Elek',arrival:'2026-10-30',departure:'2026-11-01',cabin:'Családi',guests:8});
  assert.match(hu,/50%-os foglaló/u);
  assert.match(hu,/foglalását véglegesítettük/u);
  assert.match(hu,/14\. napig/u);
  assert.match(hu,/2026-10-30 – 2026-11-01/u);
  assert.match(hu,/Családi/u);
});

test('15 or more guests uses configured large-group terms',()=>{
  assert.equal(depositPercentForGuests(15),80);
  assert.equal(cancellationDaysForGuests(15),30);
  const en=generateDepositReceivedDraft({language:'EN',guests:15});
  assert.match(en,/80% booking deposit/u);
  assert.match(en,/30 days before arrival/u);
});

test('all four languages generate finalized booking confirmation',()=>{
  for(const lang of ['HU','EN','DE','SL']){
    const draft=generateDepositReceivedDraft({language:lang,guests:4});
    assert.ok(draft.length>80);
  }
});
