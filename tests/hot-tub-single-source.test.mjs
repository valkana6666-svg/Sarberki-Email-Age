import test from 'node:test';
import assert from 'node:assert/strict';
import {BUSINESS} from '../business-config.mjs';
import {buildReplyDraft} from '../sarberki-core.mjs';
import {PUBLIC_REPLY_DATA} from '../guest-reply/public-answer-data.mjs';

const ask={language:'hu',original:'Lehet dézsát bérelni?',arrival:'2027-07-10',departure:'2027-07-14',guests:4,adults:4,children:0,phone:'+36 30 555 1234',cabin:'Deluxe'};

test('tub tariff has one source: chatbot data equals the business rules',()=>{
 const t=BUSINESS.hotTubRentalRules,h=PUBLIC_REPLY_DATA.hotTub;
 assert.deepEqual([h.baseHufPer24Hours,h.includedPeople,h.extraPersonHufPer24Hours],[t.baseHufPer24Hours,t.includedPeople,t.extraPersonHufPer24Hours]);
});

test('confirmed tariff: one sentence with the price; unconfirmed: no amount at all',()=>{
 const priced=buildReplyDraft({...ask,operationalRules:BUSINESS.operationalRules});
 assert.match(priced,/Dézsa külön bérelhető: 30 000 Ft\/24 óra 6 főig, felette \+4 000 Ft\/fő; a szabad időpontot külön ellenőrizzük\./);
 const unpriced=buildReplyDraft({...ask,operationalRules:{...BUSINESS.operationalRules,hotTubFeeVerified:false}});
 assert.match(unpriced,/Dézsa külön bérelhető; a szabad időpontot és a díjat külön ellenőrizzük\./);
 assert.doesNotMatch(unpriced,/30 000|4 000/);
});

test('owner rule: a tub wish without a question gets no tub sentence; a question does',()=>{
 const wish=buildReplyDraft({...ask,original:'Dézsát is szeretnénk bérelni.',operationalRules:BUSINESS.operationalRules});
 assert.doesNotMatch(wish,/Dézsa külön bérelhető/);
 for(const q of ['Lehet dézsát bérelni?','Mennyibe kerül a dézsa?','Van dézsa a házhoz?'])
  assert.match(buildReplyDraft({...ask,original:q,operationalRules:BUSINESS.operationalRules}),/Dézsa külön bérelhető: 30 000 Ft/,q);
});
