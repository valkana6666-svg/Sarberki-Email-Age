import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixtureTranslation,detectForeign,LANGS} from '../bilingual-clone-preview.mjs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('bilingual clone only loads in the separate test UI',()=>{assert.match(html,/bilingual-clone-preview\.mjs/);assert.match(html,/HUMAN_APPROVAL_REQUIRED/);});
test('recognizes supported foreign languages and excludes Hungarian',()=>{
 const detector={languageFromText:t=>({DE:'de',EN:'en',SI:'si',HU:'hu'})[t]};
 assert.equal(detectForeign('DE',detector),'de');assert.equal(detectForeign('EN',detector),'en');assert.equal(detectForeign('SI',detector),'si');
 assert.equal(detectForeign('HU',detector),null);
 assert.deepEqual(Object.keys(LANGS).sort(),['de','en','si','sl']);
});
test('uses only explicit exact synthetic translation fixtures; never fabricates arbitrary translations',()=>{
 const en='Hello! We would like to book a Deluxe cabin for two adults from 16 to 18 October 2026. Is it available?';
 assert.match(fixtureTranslation(en,'en','incoming'),/két felnőtt/);
 assert.equal(fixtureTranslation(en+' Another question','en','incoming'),null);
 assert.equal(fixtureTranslation('Actual private guest text','de','incoming'),null);
 assert.equal(fixtureTranslation('Hello','hu','reply'),null);
});
