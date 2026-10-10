import test from 'node:test';
import assert from 'node:assert/strict';
import {detectForeignLanguage,protectedTokens,sameProtectedTokens} from '../bilingual-preview.mjs';
test('detects clear German, English, Slovene and Hungarian samples',()=>{
 assert.equal(detectForeignLanguage('Guten Tag, wir möchten buchen'),'de');
 assert.equal(detectForeignLanguage('Hello, we would like a booking'),'en');
 assert.equal(detectForeignLanguage('Pozdravljeni, želeli bi rezervacijo'),'sl');
 assert.equal(detectForeignLanguage('Jó napot, szeretnénk foglalni'),'hu');
});
test('does not guess ambiguous language',()=>assert.equal(detectForeignLanguage('ABC'),'unknown'));
test('checks number and currency preservation before translation acceptance',()=>{
 assert.deepEqual(protectedTokens('120 000 Ft, 4 fő'),['120 000 Ft','4 fő']);
 assert.equal(sameProtectedTokens('120 000 Ft, 4 fő','120 000 Ft, 4 fő'),true);
 assert.equal(sameProtectedTokens('120 000 Ft, 4 fő','130 000 Ft, 4 fő'),false);
});
