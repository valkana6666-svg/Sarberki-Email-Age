import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./gmail-readonly.js', import.meta.url), 'utf8');

function inquiryRegexFromSource() {
  const m = source.match(/const INQUIRY_HINT = \/(.+)\/iu;/u);
  assert.ok(m, 'INQUIRY_HINT regex must exist in gmail-readonly.js');
  return new RegExp(m[1], 'iu');
}

test('live Gmail reader has no old sender/subject allowlist restriction', () => {
  assert.equal(source.includes('ALLOWED_SUBJECTS'), false);
  assert.equal(source.includes("from.toLowerCase() === 'valkana6666@gmail.com'"), false);
  assert.match(source, /newer_than:30d/u);
  assert.match(source, /gmail\.readonly/u);
  assert.equal(source.includes('gmail.send'), false);
  assert.equal(source.includes('gmail.modify'), false);
});

test('representative Sárberki inquiry is recognized', () => {
  const hint = inquiryRegexFromSource();
  const subject = 'Sárberki élő teszt – 5 fő, Deluxe, október';
  const body = '2026. október 16-tól október 19-ig szeretnénk szállást foglalni 5 fő részére. Deluxe faház érdekelne, dézsafürdővel.';
  assert.equal(hint.test(subject + '\n' + body), true);
});

test('clearly unrelated generic mail is not classified from content hints alone', () => {
  const hint = inquiryRegexFromSource();
  assert.equal(hint.test('Számla\nKöszönjük a befizetést.'), false);
});

test('Gmail bridge imports multilingual normalization helpers', () => {
  assert.match(source, /import\('\.\/gmail-normalize\.mjs'\)/u);
  assert.match(source, /guestCountFromText\(original\)/u);
  assert.match(source, /childCountFromText\(original\)/u);
  assert.match(source, /dateRangeFromText\(original\)/u);
});
