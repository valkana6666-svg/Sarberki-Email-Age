// A single explicit date plus one explicit night count is a stay; English day-first ranges are read.
// Ambiguous lengths or several dates stay unknown, so the reply asks instead of guessing.
import test from 'node:test';
import assert from 'node:assert/strict';
import {dateRangeFromText} from '../sarberki-core.mjs';
const now=new Date('2026-11-02T12:00:00Z');
const range=text=>{const r=dateRangeFromText(text,now);return r?`${r.arrival}>${r.departure}`:null;};
test('single date with an explicit night count (HU/EN/DE/SI)',()=>{
 for(const [text,expected] of [['2027.06.12-én egy éjszakára','2027-06-12>2027-06-13'],['2027.06.12-től 3 éjszakára','2027-06-12>2027-06-15'],
  ['on 2027-06-20 for 1 night','2027-06-20>2027-06-21'],['am 12.06.2027 für eine Nacht','2027-06-12>2027-06-13'],['od 2027-08-01 za dve noči','2027-08-01>2027-08-03']])
  assert.equal(range(text),expected,text);
});
test('English day-first ranges with "to" and ordinals',()=>{
 for(const text of ['from 5 to 8 May 2027','from 5th to 8th May 2027','5th-8th May 2027','from the 5th to the 8th of May 2027'])assert.equal(range(text),'2027-05-05>2027-05-08',text);
 assert.equal(range('vom 3. bis 7. Juni 2027'),'2027-06-03>2027-06-07');
});
test('negative: undecided length, several dates, no date, out-of-range nights, people counts',()=>{
 for(const text of ['2027.06.12-én 1 vagy 2 éjszakára','on 2027-06-20 for 1-2 nights','am 12.06.2027 für eine oder zwei Nächte','2027.06.12 vagy 2027.06.19, egy éjszaka',
  'egy éjszaka, valamikor júniusban','30 nights from 2027-06-12','5 to 8 people in May 2027'])assert.equal(range(text),null,text);
});
