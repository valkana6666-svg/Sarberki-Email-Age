// The pet-fee sentence answers a wanted or asked-about pet, never one the guest explicitly declines.
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEmailInquiryDraft} from '../shared-core/inquiry-channel-adapters.mjs';
import {requestFlagsFromText} from '../sarberki-core.mjs';
const now=new Date('2026-11-02T12:00:00Z');
const petLine=/Háziállat hozható|Pets are allowed|Haustiere sind|Hišni ljubljenčki/u;
const cases=[
 ['hu','2026. október 16-18. Deluxe, 4 fő. Kutyát hoznánk, de mégsem hozunk kutyát.',false],
 ['en','October 16-18 2026. Deluxe, 4 guests. We will not bring a dog.',false],
 ['de','Vom 3. bis 7. Juni 2027, 2 Erwachsene, ohne Hund.',false],
 ['si','Od 1. do 5. avgusta 2027, 2 odrasla, brez psa.',false],
 ['hu','2027. július 10-14. Deluxe, 2 felnőtt, kutyával jönnénk.',true],
 ['hu','2027. július 10-14. Deluxe, 2 felnőtt. Nem tudom, hozhatunk-e kutyát?',true],
 ['en','May 5-8 2027, 2 adults. Are dogs allowed?',true],
 ['de','Vom 3. bis 7. Juni 2027, 2 Erwachsene mit Hund.',true],
 ['si','Od 1. do 5. avgusta 2027, 2 odrasla, s psom.',true],
 ['si','Ali lahko pripeljemo psa?',true]
];
for(const [language,message,expected] of cases)test(`${language}: pet answer ${expected?'shown':'omitted'} – ${message}`,()=>{
 const {text,operatorReviewText}=buildEmailInquiryDraft({message,language,now});
 assert.equal(petLine.test(text),expected);
 assert.equal(/Háziállat hozható/u.test(operatorReviewText),expected);
});
test('Slovene inflected dog forms count as a pet request, negation still wins',()=>{
 for(const word of ['psa','psu','psom','psi'])assert.equal(requestFlagsFromText(`Pridemo s ${word}.`).petRequested,true,word);
 assert.equal(requestFlagsFromText('Pridemo brez psa.').petRequested,false);
});
