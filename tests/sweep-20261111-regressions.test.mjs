// Regressions from the 15-letter pitfall sweep (owner request 2026-11-11, fictional letters, real ingest path).
import test from 'node:test';
import assert from 'node:assert/strict';
import {dateRangeFromText,adultCountFromText,childCountFromText,childAgesFromText,requestFlagsFromText,replySummary} from '../sarberki-core.mjs';

test('numeric range "2027.08.01-08.04" keeps the departure month (was 08-08)',()=>{
 assert.deepEqual(dateRangeFromText('2027.08.01-08.04 között'),{arrival:'2027-08-01',departure:'2027-08-04',inferredYear:false});
 assert.deepEqual(dateRangeFromText('2027.08.01-04 között'),{arrival:'2027-08-01',departure:'2027-08-04',inferredYear:false});
 assert.deepEqual(dateRangeFromText('2027.12.30-2028.01.02'),{arrival:'2027-12-30',departure:'2028-01-02',inferredYear:false});
 assert.equal(dateRangeFromText('2027.12.30-01.02'),null,'year change without a stated year is not guessed');
});

test('"4 fő, ebből 2 gyerek" -> 2 adults; children counted, never negative',()=>{
 const t='4 fő, ebből 2 gyerek (3 és 5 évesek)';
 assert.equal(adultCountFromText(t),2);assert.equal(childCountFromText(t),2);assert.deepEqual(childAgesFromText(t),[3,5]);
 assert.equal(adultCountFromText('4 Personen, davon 2 Kinder'),2);
 assert.equal(adultCountFromText('2 fő, ebből 2 gyerek'),null);
 assert.equal(adultCountFromText('3 felnőtt, 4 fő, ebből 1 gyerek'),3,'an explicit adult count wins');
});

test('a baby is a child; stated age kept (months -> 0), unstated age stays unknown',()=>{
 assert.equal(childCountFromText('3 Erwachsene und ein Baby (1 Jahr)'),1);assert.deepEqual(childAgesFromText('3 Erwachsene und ein Baby (1 Jahr)'),[1]);
 const hu='2 felnőtt és 2 gyerek (4 és 9 évesek), meg egy kisbaba (8 hónapos)';
 assert.equal(childCountFromText(hu),3);assert.deepEqual(childAgesFromText(hu),[4,9,0]);
 assert.equal(childCountFromText('2 adults and a baby'),1);assert.deepEqual(childAgesFromText('2 adults and a baby'),[]);
 assert.equal(childCountFromText('Babakocsit hozunk, 2 felnőtt, gyerek nincs'),0,'pram is not a baby');
 assert.equal(childCountFromText('2 Erwachsene und 2 Kinder (4 und 10 Jahre)'),2);
});

test('pet request is read per clause: "gyerek nincs, a kutyánkat is hoznánk" asks for a pet',()=>{
 assert.equal(requestFlagsFromText('2 felnőtt, gyerek nincs, a kutyánkat is hoznánk').petRequested,true);
 assert.equal(requestFlagsFromText('kutyát nem hozunk').petRequested,false);
 assert.equal(requestFlagsFromText('Kutya nélkül jövünk, gyerek is jön').petRequested,false);
});

test('German summary: "im Alter von 1 Jahr" (singular)',()=>{
 const de=replySummary('de',{arrival:'2027-07-14',departure:'2027-07-17',guests:4,adults:3,children:1,childAges:[1]});
 assert.match(JSON.stringify(de),/im Alter von 1 Jahr[^e]/);
});
