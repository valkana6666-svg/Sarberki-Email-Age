import test from 'node:test';
import assert from 'node:assert/strict';
import {dateRangeFromText,partyCountsFromText,cabinFromText} from '../sarberki-core.mjs';
const now=new Date('2026-10-26T10:00:00Z');
test('labelled dates preserve roles even when departure is written first',()=>{
 assert.deepEqual(dateRangeFromText('Távozás: 2027-05-12. Érkezés: 2027-05-10.',now),{arrival:'2027-05-10',departure:'2027-05-12',inferredYear:false});
});
test('labelled dates accept line breaks, accents omitted and numeric separators',()=>{
 assert.deepEqual(dateRangeFromText('Erkezes: 2027.5.10.\nTavozas: 2027/5/12.',now),{arrival:'2027-05-10',departure:'2027-05-12',inferredYear:false});
});
test('labelled invalid, reversed and equal dates are not guessed',()=>{
 for(const [a,b] of [['2027-02-30','2027-03-02'],['2027-05-12','2027-05-10'],['2027-05-10','2027-05-10']])assert.equal(dateRangeFromText('Érkezés: '+a+'. Távozás: '+b+'.',now),null);
});
test('incomplete and repeated labels cannot silently select a pair',()=>{
 for(const s of ['Érkezés: 2027-05-10.','Távozás: 2027-05-12.','Érkezés: 2027-05-10. Érkezés: 2027-05-10. Távozás: 2027-05-12.'])assert.equal(dateRangeFromText(s,now),null);
});
test('conflicting additional dates stay unverified',()=>{
 assert.equal(dateRangeFromText('Érkezés: 2027-05-10. Távozás: 2027-05-12. Vagy 2027-06-10 - 2027-06-12.',now),null);
});
test('adults, children and named cabin types retain their existing interpretation',()=>{
 for(const cabin of ['VIP','Családi','Deluxe','Osztott']){
  const s='Szintetikus teszt: 2 felnőtt és 1 gyermek részére '+cabin+' faházat kérek. Érkezés: 2027-05-10. Távozás: 2027-05-12.';
  assert.deepEqual(partyCountsFromText(s),{guests:3,adults:2,children:1});
  assert.equal(cabinFromText(s),cabin);
  assert.equal(dateRangeFromText(s,now).arrival,'2027-05-10');
 }
});
