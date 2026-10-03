import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readFile} from 'node:fs/promises';

const source = fs.readFileSync(new URL('./gmail-readonly.js', import.meta.url), 'utf8');

import {APPROVED_SUBJECTS,isApprovedSubject} from './gmail-subject.mjs';

test('approved subject variants and descriptive inquiry subjects work while unrelated subjects stay rejected', () => {
  assert.deepEqual(APPROVED_SUBJECTS, [
    'érdeklődés a szállásról',
    'érdeklődés a szallasrol',
    'érdeklődés szállásról',
    'anfrage für einen aufenthalt',
    'anfrage für eine unterkunft',
    'anfrage zur unterkunft',
    'accommodation inquiry',
    'booking inquiry',
    'inquiry about accommodation',
    'povpraševanje za nastanitev',
    'povpraševanje o nastanitvi',
    'rezervacija nastanitve'
  ]);
  for (const subject of APPROVED_SUBJECTS) {
    assert.equal(isApprovedSubject(subject), true);
    assert.equal(isApprovedSubject('  ' + subject.toUpperCase() + '  '), true);
  }
  for (const subject of [
    'Érdeklődés szállásról 6 fő részére októberben',
    'Érdeklődés a szállásról – Deluxe ház',
    'Sárberki élő teszt – 5 fő, Deluxe, október',
    'Sarberki elo teszt - 2 fő',
    'Anfrage für einen Aufenthalt im Oktober',
    'Accommodation inquiry for October',
    'Booking inquiry – two Deluxe cabins',
    'Povpraševanje za nastanitev v oktobru',
    'Rezervacija nastanitve – družina'
  ]) assert.equal(isApprovedSubject(subject), true);
  for (const subject of ['Számla', 'Foglalás', 'Érdeklődés horgászjegyről', 'Sárberki', '', null]) {
    assert.equal(isApprovedSubject(subject), false);
  }
});

test('Gmail bridge enforces the predicate after inbox listing', () => {
  assert.match(source, /import\('\.\/gmail-policy\.mjs'\)/u);
  assert.match(source, /messages\.filter\(isTestInquiry\)/u);
  assert.match(source, /assertTestGmailAccount\(await profileResponse\.json\(\)\)/u);
  assert.match(source, /gmail\.readonly/u);
  assert.equal(source.includes('gmail.send'), false);
  assert.equal(source.includes('gmail.modify'), false);
});

test('Gmail bridge imports the shared Sárberki core helpers', () => {
  assert.match(source, /import\('\.\/sarberki-core\.mjs'\)/u);
  assert.match(source, /guestCountFromText\(original\)/u);
  assert.match(source, /childCountFromText\(original\)/u);
  assert.match(source, /dateRangeFromText\(original, new Date\(\), BUSINESS\.timezone\)/u);
});


test('Gmail record consumes normalized multilingual dates', () => {
  assert.match(source, /normalizedDate\.arrival/u);
  assert.match(source, /normalizedDate\.departure/u);
  assert.match(source, /normalizedDate\?\.inferredYear/u);
  assert.match(source, /Időszak, következtetett évvel/u);
});


test('Gmail draft uses the shared multilingual reply builder', () => {
  assert.match(source, /languageFromText\(original\)/u);
  assert.match(source, /buildReplyDraft\(\{language,name,original/u);
  assert.doesNotMatch(source, /replyQuestions\(language/u);
});


test('Gmail bridge recognizes multilingual hot tub dog availability and child-age wording', () => {
  assert.match(source, /hot\\s\*tub/u);
  assert.match(source, /whirlpool/u);
  assert.match(source, /badefass/u);
  assert.match(source, /verfügbar/u);
  assert.match(source, /razpolož/u);
  assert.match(source, /childAgesFromText\(original\)/u);
  assert.match(source, /childAges\.length < childCount/u);
});


test('Gmail bridge has one canonical date parser', () => {
  assert.match(source, /const normalizedDate = dateRangeFromText\(original, new Date\(\), BUSINESS\.timezone\)/u);
  assert.doesNotMatch(source, /const dateText = original\.match/u);
  assert.doesNotMatch(source, /const inferredYear =/u);
  assert.doesNotMatch(source, /const requestedYear =/u);
});


test('Gmail record exposes canonical normalized fields for UI',()=>{assert.match(source,/normalized:\{language,cabin:cabinFromGuestText\(original\),dates:normalizedDate,guests:count,adults:adultCount,children:childCount,child_ages:childAges,phone,units_requested:requestedUnits\.count\|\|null,units_open:requestedUnits\.open,pier_requested:pier,hot_tub_requested:hotTub,pet_requested:dog\}/u);});


test('parsed child ages are not falsely marked missing',()=>{
  assert.match(source,/childAges\.length < childCount/u);
  assert.doesNotMatch(source,/!\/\\d\+\\s\*\(\?:éves\|years\? old\|jahre alt\|let\)\/iu\.test\(original\)/u);
});


test('Gmail bridge can read HTML-only inquiries',()=>{
  assert.match(source,/function htmlText\(part\)/u);
  assert.match(source,/mimeType === 'text\/html'/u);
  assert.match(source,/new DOMParser\(\)\.parseFromString/u);
  assert.match(source,/return plainText\(part\) \|\| htmlText\(part\)/u);
  assert.match(source,/readableBody\(message\.payload\)/u);
});


test('reply and follow-up inquiry subjects remain readable',async()=>{
  const {isApprovedSubject}=await import('./gmail-subject.mjs');
  for(const subject of [
    'Érdeklődés 2',
    'Foglalási érdeklődés októberre',
    'Re: Érdeklődés szállásról – 6 fő',
    'AW: Anfrage zur Unterkunft',
    'Reservation inquiry for October',
    'Fwd: Booking inquiry – two Deluxe cabins',
    'Povpraševanje za družinsko hiško',
    'RE: Povpraševanje za nastanitev'
  ]) assert.equal(isApprovedSubject(subject),true,subject);
  assert.equal(isApprovedSubject('Hírlevél és akciók'),false);
  assert.equal(isApprovedSubject('Teszt 3'),false);
});


test('contradictory adult child totals are escalated to human review',()=>{
  assert.match(source,/adultCountFromText\(original\)/u);
  assert.match(source,/adultCount\+childCount!==count/u);
  assert.match(source,/Ellentmondó létszámadat/u);
});


test('generic inquiry prefixes do not admit unrelated mail',()=>{
  for(const subject of [
    'Anfrage Rechnung September',
    'Anfrage zur Rechnung',
    'Booking inquiry about invoice copy',
    'Reservation inquiry about payment receipt',
    'Povpraševanje glede računa',
    'Povprasevanje glede racuna'
  ]) assert.equal(isApprovedSubject(subject),false,subject);
  for(const subject of [
    'Anfrage Deluxe für 4 Gäste im Oktober',
    'Booking inquiry for a Deluxe cabin in October',
    'Povpraševanje za družinsko hiško v oktobru',
    'Foglalási érdeklődés Deluxe ház 4 fő'
  ]) assert.equal(isApprovedSubject(subject),true,subject);
});
