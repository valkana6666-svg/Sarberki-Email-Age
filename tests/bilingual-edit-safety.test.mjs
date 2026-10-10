import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {fixtureTranslation,detectForeign} from '../bilingual-clone-preview.mjs';
const source=readFileSync(new URL('../bilingual-clone-preview.mjs',import.meta.url),'utf8');
test('Hungarian edit is not sent or automatically copied into foreign guest reply',()=>{
 assert.match(source,/pendingForeign=foreign/);assert.match(source,/accept\.addEventListener\('click'/);
 assert.match(source,/typeof translate!=='function'/);
 assert.doesNotMatch(source,/fetch\s*\(/);
 assert.doesNotMatch(source,/sendMessage|sendEmail|Gmail\.send/);
});
test('edit safeguard checks protected numbers and defers approval',()=>{
 assert.match(source,/sameProtectedTokens\(original,foreign\)/);
 assert.match(source,/approval\.disabled=true/);
 assert.match(source,/event\.stopImmediatePropagation\(\)/);
 assert.match(source,/manualRevision/);
});
test('synthetic examples and unknown translation are clearly distinct',()=>{
 assert.equal(fixtureTranslation('not a fixture','en','reply'),null);
 assert.equal(detectForeign('HU',{languageFromText:()=> 'hu'}),null);
 assert.match(source,/biztonságos visszafordító nincs bekötve/);
});
