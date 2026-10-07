import test from 'node:test';
import assert from 'node:assert/strict';
import {BUSINESS} from './business-config.mjs';
import {buildReplyDraft} from './sarberki-core.mjs';

const base={
  language:'hu',
  name:'Teszt Elek',
  arrival:'2026-10-16',
  departure:'2026-10-18',
  guests:2,
  adults:2,
  children:0,
  childAges:[],
  phone:'+36000000000',
  cabin:'Deluxe',
  brandName:BUSINESS.brandName,
  bookingRules:BUSINESS.bookingRules,
  operationalRules:BUSINESS.operationalRules,
  pricingRules:BUSINESS.pricingRules
};

test('general arrival question returns verified 14:00 standard check-in',()=>{
  const draft=buildReplyDraft({...base,original:'Mikor lehet érkezni?'});
  assert.match(draft,/14:00-tól/u);
});

test('explicit late arrival keeps 24-hour porter answer',()=>{
  const draft=buildReplyDraft({...base,original:'18:30-kor érkeznénk, megoldható?'});
  assert.match(draft,/18:30-kor megoldható/u);
  assert.match(draft,/24 órás portaszolgálat/u);
});

test('verified pet fee is stated with unit instead of pending operator check',()=>{
  const draft=buildReplyDraft({...base,original:'Kutyát is vinnénk. Mennyibe kerül a kutya?'});
  assert.match(draft,/2 000 Ft\/nap\/állat/u);
  assert.doesNotMatch(draft,/pontos díjat kezelői ellenőrzéssel/u);
});
