import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateQuote,parseHuf,fetchQuote} from './price-quote.mjs';

test('only exact future dates and explicit room and adult count are accepted', () => {
  assert.deepEqual(validateQuote({arrival:'2027-10-01',departure:'2027-10-02',cabin:'deluxe',adults:5}),{arrival:'2027-10-01',departure:'2027-10-02',cabin:'deluxe',adults:5,children:[]});
  for (const bad of [
    {arrival:'2026-02-30',departure:'2026-03-02',cabin:'deluxe',adults:5},
    {arrival:'2027-10-02',departure:'2027-10-01',cabin:'deluxe',adults:5},
    {arrival:'2027-10-01',departure:'2027-10-02',cabin:'',adults:5},
    {arrival:'2027-10-01',departure:'2027-10-02',cabin:'deluxe',adults:0},
    {arrival:'2027-10-01',departure:'2027-10-02',cabin:'deluxe',adults:2,children:[-1]}
  ]) assert.throws(() => validateQuote(bad));
});

test('price summary accepts only HUF and preserves the displayed total', () => {
  assert.equal(parseHuf('86\u00a0750 Ft'),86750);
  assert.equal(parseHuf('2 750 Ft'),2750);
  for (const invalid of ['86 750 EUR','86 750 Ft / éj','nincs ár']) assert.throws(() => parseHuf(invalid));
});

test('child price is blocked before a browser is opened', async () => {
  let launched=false;
  await assert.rejects(fetchQuote({arrival:'2027-10-01',departure:'2027-10-02',cabin:'deluxe',adults:4,children:[6]},()=>{launched=true;}),/gyermekkor/);
  assert.equal(launched,false);
});
