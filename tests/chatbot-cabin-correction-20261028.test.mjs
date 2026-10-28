import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatInquirySession} from '../sarberki-chatbot-project/chat-session.mjs';

for(const [language,message] of Object.entries({
 hu:'Inkább Deluxe faházat szeretnénk.',
 de:'Wir möchten stattdessen ein Deluxe Haus.',
 en:'Instead we would like a Deluxe cabin.',
 si:'Želimo Deluxe hiško.'
}))test('active cabin correction retains stay and clears stale split selection: '+language,()=>{
 const chat=createChatInquirySession({language});
 chat.reply('Van szabad osztott A+B apartman 2026.11.20-22 között 4 felnőtt részére gyermek nélkül?');
 const result=chat.reply(message);
 assert.equal(result.decision.facts.cabin,'Deluxe');
 assert.equal(result.decision.facts.dates.arrival,'2026-11-20');
 assert.equal(result.decision.facts.adults,4);
 assert.equal(chat.snapshot().split_request,undefined);
 assert.equal(result.decision.capacity.verified,false);
 assert.equal(result.decision.pricing.verified,false);
 assert.equal(result.requiresApproval,true);
});
test('split correction replaces A+B with C without fresh dates or guest counts',()=>{
 const chat=createChatInquirySession();
 chat.reply('Van szabad osztott A+B apartman 2026.11.20-22 között 4 felnőtt részére gyermek nélkül?');
 const result=chat.reply('Inkább osztott C apartmant szeretnénk.');
 assert.equal(chat.snapshot().split_request.requestedAB,0);
 assert.equal(chat.snapshot().split_request.requestedC,1);
 assert.equal(result.decision.capacity.verified,false);
});
