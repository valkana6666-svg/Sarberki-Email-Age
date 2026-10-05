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
test('outside single unit capacity is blocked',()=>assert.throws(()=>validateQuote({arrival:'2026-10-16',departure:'2026-10-19',cabin:'deluxe',adults:7}),/kapacit/));
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
  assert.equal(returningGuestReview.lookbackMonths,24);
  assert.equal(returningGuestReview.possibleDiscountPercent,20);
  assert.equal(returningGuestReview.publicSiteLookbackDays,730);
});


test('dense English fishing question keeps all requested verified answers',()=>{
  const answer=fishingQuestion('What is the price of a 24-hour adult ticket for the Normal lake? Do children need a separate ticket? Are barbed hooks allowed? Are there minimum fish sizes and separate prices for fish we may take home?','en');
  assert.equal(answer.kind,'combined');
  assert.match(answer.answer,/7,500 HUF/u);
  assert.match(answer.answer,/3,750 HUF/u);
  assert.match(answer.answer,/Barbed hooks are not allowed/u);
  assert.match(answer.answer,/zander 30 cm/u);
  assert.match(answer.answer,/Take-away fish prices per kg/u);
  assert.equal(answer.accommodationTotalAffected,false);
});

test('German and Slovenian barbed-hook questions stay localized',()=>{
  assert.match(fishingQuestion('Sind Haken mit Widerhaken erlaubt?','de').answer,/nicht erlaubt/u);
  assert.match(fishingQuestion('Ali so dovoljeni trnki z zalustjo?','si').answer,/niso dovoljeni/u);
});

test('generic Hungarian fishing conditions question gets concrete verified rules',()=>{
  const answer=fishingQuestion('Horgászni szeretnénk. A horgászatnak milyen feltételei vannak?','hu');
  assert.equal(answer.kind,'general_conditions');
  assert.match(answer.answer,/állami horgászjegy/u);
  assert.match(answer.answer,/szakáll nélküli/u);
  assert.match(answer.answer,/6-os/u);
  assert.match(answer.answer,/pontybölcső/u);
  assert.match(answer.answer,/merítőháló/u);
  assert.match(answer.answer,/sebfertőtlenítő/u);
  assert.match(answer.answer,/pontyzsák/u);
});


test('plain fishing intent gets the full verified requirements in all supported languages',()=>{
  const cases=[
    ['Horgászni szeretnénk.','hu',/állami horgászjegy/u],
    ['Wir möchten angeln.','de',/staatlicher Angelschein/u],
    ['We would like to fish.','en',/state fishing licence valid in Hungary/u],
    ['Želeli bi ribolov.','si',/državna ribolovna dovolilnica/u]
  ];
  for(const [text,lang,pattern] of cases){
    const answer=fishingQuestion(text,lang);
    assert.equal(answer.kind,'general_conditions');
    assert.match(answer.answer,pattern);
  }
});
