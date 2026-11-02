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
test('month-name start date with a night count; a missing year is marked inferred',()=>{
 for(const [text,expected] of [['Érdeklődnék, hogy 2027. július 3-án érkezve 4 éjszakára 2 fő részére','2027-07-03>2027-07-07'],['3 July 2027 for 2 nights','2027-07-03>2027-07-05'],
  ['July 3, 2027, two nights','2027-07-03>2027-07-05'],['am 3. Juli 2027 für 2 Nächte','2027-07-03>2027-07-05'],['od 3. julija 2027 za dve noči','2027-07-03>2027-07-05']]){
  assert.equal(range(text),expected,text);assert.equal(dateRangeFromText(text,now).inferredYear,false,text);
 }
 const noYear=dateRangeFromText('július 3-án érkeznénk 2 éjszakára',now);
 assert.equal(`${noYear.arrival}>${noYear.departure}`,'2027-07-03>2027-07-05');assert.equal(noYear.inferredYear,true);
 assert.equal(range('július 3. vagy július 10., egy éjszakára'),null);
});
test('accentless month abbreviations (jul, jun, apr, marc) are read and marked inferred without a year',()=>{
 for(const [text,expected] of [['jul 10-14','2027-07-10>2027-07-14'],['jun 3-5','2027-06-03>2027-06-05'],['apr 3-5','2027-04-03>2027-04-05'],['marc 3-5','2027-03-03>2027-03-05']]){
  assert.equal(range(text),expected,text);assert.equal(dateRangeFromText(text,now).inferredYear,true,text);
 }
});
