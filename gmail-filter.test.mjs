import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readFile} from 'node:fs/promises';

const source = fs.readFileSync(new URL('./gmail-readonly.js', import.meta.url), 'utf8');

function subjectsFromSource() {
  const match = source.match(/const ALLOWED_SUBJECTS = new Set\(\[([^\]]+)\]\);/u);
  assert.ok(match, 'approved subject allowlist must exist');
  return [...match[1].matchAll(/'([^']+)'/gu)].map(x => x[1]);
}

test('Gmail reader requires the three approved inquiry subjects', () => {
  assert.deepEqual(subjectsFromSource(), [
    'érdeklődés a szállásról',
    'érdeklődés a szallasrol',
    'érdeklődés szállásról'
  ]);
  assert.match(source, /ALLOWED_SUBJECTS\.has\(subject\)/u);
  assert.match(source, /newer_than:30d/u);
  assert.match(source, /gmail\.readonly/u);
  assert.equal(source.includes('gmail.send'), false);
  assert.equal(source.includes('gmail.modify'), false);
});

test('broad keyword matching cannot replace the approved subject check', () => {
  assert.equal(source.includes('INQUIRY_HINT'), false);
  assert.equal(subjectsFromSource().includes('Számla'), false);
});

test('Gmail bridge imports multilingual normalization helpers', () => {
  assert.match(source, /import\('\.\/gmail-normalize\.mjs'\)/u);
  assert.match(source, /guestCountFromText\(original\)/u);
  assert.match(source, /childCountFromText\(original\)/u);
  assert.match(source, /dateRangeFromText\(original\)/u);
});


test('Gmail record consumes normalized multilingual dates', () => {
  assert.match(source, /normalizedDate\.arrival/u);
  assert.match(source, /normalizedDate\.departure/u);
  assert.match(source, /normalizedDate\?\.inferredYear/u);
  assert.match(source, /Időszak, következtetett évvel/u);
});


test('Gmail draft uses multilingual language and missing-data helpers', () => {
  assert.match(source, /languageFromText\(original\)/u);
  assert.match(source, /replyQuestions\(language/u);
  assert.match(source, /Vielen Dank für Ihre Anfrage/u);
  assert.match(source, /Thank you for your inquiry/u);
  assert.match(source, /Hvala za vaše povpraševanje/u);
  assert.match(source, /language==='unknown' \? 'hu' : language/u);
});


test('Gmail bridge recognizes multilingual hot tub dog availability and child-age wording', () => {
  assert.match(source, /hot\\s\*tub/u);
  assert.match(source, /whirlpool/u);
  assert.match(source, /badefass/u);
  assert.match(source, /verfügbar/u);
  assert.match(source, /razpolož/u);
  assert.match(source, /years\? old/u);
  assert.match(source, /jahre alt/u);
});


test('Gmail bridge has one canonical date parser', () => {
  assert.match(source, /const normalizedDate = dateRangeFromText\(original\)/u);
  assert.doesNotMatch(source, /const dateText = original\.match/u);
  assert.doesNotMatch(source, /const inferredYear =/u);
  assert.doesNotMatch(source, /const requestedYear =/u);
});


test('Gmail record exposes canonical normalized fields for UI',()=>{assert.match(source,/normalized:\{language,cabin:cabinFromGuestText\(original\),dates:normalizedDate,guests:count,children:childCount,hot_tub:hotTub,dog\}/u);});
