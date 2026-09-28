import test from 'node:test';import assert from 'node:assert/strict';
import {cabinFromText,guestCountFromText,childCountFromText,dateRangeFromText,languageFromText,replyQuestions} from './gmail-normalize.mjs';
const now=new Date('2026-09-28T08:00:00Z');
test('HU parse',()=>{assert.equal(cabinFromText('Deluxe faház'), 'Deluxe');assert.equal(guestCountFromText('5 fő'),5);assert.deepEqual(dateRangeFromText('2026 október 16-19',now),{arrival:'2026-10-16',departure:'2026-10-19',inferredYear:false});});
test('EN parse',()=>{assert.equal(cabinFromText('family cabin'),'Családi');assert.equal(guestCountFromText('4 guests'),4);assert.equal(childCountFromText('2 children'),2);assert.deepEqual(dateRangeFromText('October 16-19 2026',now),{arrival:'2026-10-16',departure:'2026-10-19',inferredYear:false});});
test('DE parse',()=>{assert.equal(cabinFromText('Familien Unterkunft'),'Családi');assert.equal(guestCountFromText('4 Personen'),4);assert.equal(childCountFromText('2 Kinder'),2);assert.deepEqual(dateRangeFromText('Oktober 16-19 2026',now),{arrival:'2026-10-16',departure:'2026-10-19',inferredYear:false});});
test('SI parse',()=>{assert.equal(cabinFromText('Deluxe nastanitev'),'Deluxe');assert.equal(guestCountFromText('4 oseb'),4);assert.equal(childCountFromText('2 otroka'),2);assert.deepEqual(dateRangeFromText('oktober 16-19 2026',now),{arrival:'2026-10-16',departure:'2026-10-19',inferredYear:false});});
test('missing cabin is never inferred from party size',()=>assert.equal(cabinFromText('8 guests'),'? – emberi döntésre vár'));

test('HU repeated month range',()=>assert.deepEqual(dateRangeFromText('2026. október 16-tól október 19-ig',now),{arrival:'2026-10-16',departure:'2026-10-19',inferredYear:false}));
test('past yearless date rolls to next year and requires review',()=>assert.deepEqual(dateRangeFromText('augusztus 10-12',now),{arrival:'2027-08-10',departure:'2027-08-12',inferredYear:true}));
test('next-year wording is explicit inference without review flag',()=>assert.deepEqual(dateRangeFromText('jövőre október 16-19',now),{arrival:'2027-10-16',departure:'2027-10-19',inferredYear:false}));

test('language detection is conservative across HU DE EN SI',()=>{assert.equal(languageFromText('Szeretnénk szállást foglalni 4 fő részére'),'hu');assert.equal(languageFromText('Wir möchten eine Unterkunft für 4 Personen buchen'),'de');assert.equal(languageFromText('We would like accommodation for 4 guests'),'en');assert.equal(languageFromText('Želimo nastanitev za 4 oseb'),'si');assert.equal(languageFromText('Hello'),'unknown');});
test('reply questions follow detected language and only ask missing fields',()=>{assert.deepEqual(replyQuestions('de',{needPhone:true,needCabin:true}),['Bitte teilen Sie uns eine Telefonnummer mit, unter der wir Sie erreichen können.','Welchen Haustyp wünschen Sie: VIP, Családi (Familienhaus), Deluxe oder Osztott (geteiltes Haus)?']);assert.deepEqual(replyQuestions('unknown',{needPhone:true}),[]);});
