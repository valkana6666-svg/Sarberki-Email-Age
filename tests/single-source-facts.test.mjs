import test from 'node:test';
import assert from 'node:assert/strict';
import {BUSINESS} from '../business-config.mjs';
import {FISHING_GENERAL_TEXT,fishingQuestion} from '../fishing-rules.mjs';
import {hotTubSentence} from '../sarberki-core.mjs';
import {renderChatbotIntent} from '../chatbot-v1.mjs';
import {PUBLIC_REPLY_DATA} from '../guest-reply/public-answer-data.mjs';

const LANGS=['hu','de','en','si'];

test('chatbot facts come from the central sources in every language',()=>{
 const o=BUSINESS.operationalRules;
 for(const l of LANGS){
  assert.equal(renderChatbotIntent('hotTub',l),hotTubSentence(l),l);
  assert.equal(renderChatbotIntent('fishing',l),FISHING_GENERAL_TEXT[l],l);
  const c=renderChatbotIntent('checkin',l).replace(/\./g,':');
  assert.ok(c.includes(o.checkinFrom)&&c.includes(o.checkoutBy),l+': '+c);
  const d=renderChatbotIntent('deposit',l);
  assert.ok(d.includes(String(BUSINESS.bookingRules.depositLeadDaysBoundary))&&d.includes(String(BUSINESS.bookingRules.depositShortWindowHours)),l);
 }
});

test('public reply panel and email use the same fishing sentence and operations values',()=>{
 assert.equal(PUBLIC_REPLY_DATA.fishing.text,FISHING_GENERAL_TEXT);
 for(const k of ['checkinFrom','checkoutBy','petFeeHufPerPetPerDay'])assert.equal(PUBLIC_REPLY_DATA.operations[k],BUSINESS.operationalRules[k],k);
 assert.ok(fishingQuestion('Milyen horgászati szabályok vannak?','hu').answer.includes(FISHING_GENERAL_TEXT.hu));
});
