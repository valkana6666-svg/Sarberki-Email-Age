import test from 'node:test';
import assert from 'node:assert/strict';
import {fishing,fishingQuestion} from './fishing-rules.mjs';
import {validateQuote,fetchQuote,returningGuestReview} from './price-quote.mjs';

for (const [cabin,adults] of [['deluxe',4],['deluxe',5],['deluxe',6],['family',4],['family',5],['vip',2],['vip',7]]) {
  test(`${cabin} ${adults}: exact occupancy is passed to quote adapter`,()=>{
    const input=validateQuote({arrival:'2026-10-16',departure:'2026-10-19',cabin,adults,children:[]});
    assert.equal(input.adults,adults);
  });
}
test('season date is preserved, never manually surcharged',()=>{
  assert.equal(validateQuote({arrival:'2027-07-01',departure:'2027-07-04',cabin:'family',adults:5}).arrival,'2027-07-01');
});
test('outside single unit capacity is blocked',()=>assert.throws(()=>validateQuote({arrival:'2026-10-16',departure:'2026-10-19',cabin:'deluxe',adults:7}),/kapacitási/));
test('child quote is blocked before launching browser',async()=>{
  let launched=false;
  await assert.rejects(fetchQuote({arrival:'2026-10-16',departure:'2026-10-19',cabin:'deluxe',adults:4,children:[8]},()=>{launched=true}),/gyermekkor/);
  assert.equal(launched,false);
});
test('normal lake adult 24h, separate source and validity',()=>{
  const answer=fishingQuestion('Mennyibe kerül 24 órára a Normál tó?');
  assert.equal(answer.kind,'normal_24h_adult');assert.equal(fishing.tickets.normal.adult.hours24,7500);
  assert.equal(answer.accommodationTotalAffected,false);assert.equal(answer.validFrom,'2026-01-01');
});
test('barbed hook is prohibited',()=>assert.match(fishingQuestion('Használhatok szakállas horgot?').answer,/nem használható/));
test('unrelated accommodation inquiry does not activate fishing',()=>assert.equal(fishingQuestion('Deluxe faház 5 fő októberben'),null));
test('returning discount remains un-applied without Previo history',()=>{
  assert.equal(returningGuestReview.applied,false);
  assert.equal(returningGuestReview.lookbackMonths,48);
  assert.equal(returningGuestReview.possibleDiscountPercent,20);
  assert.equal(returningGuestReview.publicSiteLookbackDays,730);
});
