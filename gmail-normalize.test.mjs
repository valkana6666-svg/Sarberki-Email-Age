import test from 'node:test';import assert from 'node:assert/strict';
import {cabinFromText,guestCountFromText,childCountFromText,dateRangeFromText} from './gmail-normalize.mjs';
const now=new Date('2026-09-28T08:00:00Z');
test('HU parse',()=>{assert.equal(cabinFromText('Deluxe faház'), 'Deluxe');assert.equal(guestCountFromText('5 fő'),5);assert.deepEqual(dateRangeFromText('2026 október 16-19',now),{arrival:'2026-10-16',departure:'2026-10-19',inferredYear:false});});
test('EN parse',()=>{assert.equal(cabinFromText('family cabin'),'Családi');assert.equal(guestCountFromText('4 guests'),4);assert.equal(childCountFromText('2 children'),2);assert.deepEqual(dateRangeFromText('October 16-19 2026',now),{arrival:'2026-10-16',departure:'2026-10-19',inferredYear:false});});
test('DE parse',()=>{assert.equal(cabinFromText('Familien Unterkunft'),'Családi');assert.equal(guestCountFromText('4 Personen'),4);assert.equal(childCountFromText('2 Kinder'),2);assert.deepEqual(dateRangeFromText('Oktober 16-19 2026',now),{arrival:'2026-10-16',departure:'2026-10-19',inferredYear:false});});
test('SI parse',()=>{assert.equal(cabinFromText('Deluxe nastanitev'),'Deluxe');assert.equal(guestCountFromText('4 oseb'),4);assert.equal(childCountFromText('2 otroka'),2);assert.deepEqual(dateRangeFromText('oktober 16-19 2026',now),{arrival:'2026-10-16',departure:'2026-10-19',inferredYear:false});});
test('missing cabin is never inferred from party size',()=>assert.equal(cabinFromText('8 guests'),'? – emberi döntésre vár'));
