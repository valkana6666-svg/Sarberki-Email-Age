import test from 'node:test';
import assert from 'node:assert/strict';
import {adultCountFromText} from '../sarberki-core.mjs';
import {normalizeInquiryInput} from '../intake-normalize.mjs';
import {buildChatInquiryReply,buildEmailInquiryDraft} from '../shared-core/inquiry-channel-adapters.mjs';
import {createChatInquirySession} from '../sarberki-chatbot-project/chat-session.mjs';
const now=new Date('2026-10-12T12:00:00Z');
const forms={'ein Erwachsener':1,'einen Erwachsenen':1,'einem Erwachsenen':1,'eine Erwachsene':1,'zwei Erwachsene':2,'drei Erwachsene':3,'vier Erwachsene':4,'fünf Erwachsene':5,'sechs Erwachsene':6,'sieben Erwachsene':7,'acht Erwachsene':8,'neun Erwachsene':9,'zehn Erwachsene':10,'elf Erwachsene':11,'zwölf Erwachsene':12,'1 Erwachsener':1,'2 Erwachsene':2,'3 Erwachsenen':3};
for(const [phrase,count] of Object.entries(forms))test('German adult count: '+phrase,()=>{
 const message=`Guten Tag! Ist ein Familienhaus für ${phrase} verfügbar?`;
 assert.equal(adultCountFromText(message),count);
 const gmail=normalizeInquiryInput({sourceChannel:'gmail',rawText:message,now}).normalized;
 const chat=normalizeInquiryInput({sourceChannel:'web_form',rawText:message,now}).normalized;
 assert.deepEqual(chat,gmail);assert.equal(chat.adults,count);assert.equal(chat.children,0);
 const a=buildChatInquiryReply({message,language:'de',now}),b=buildEmailInquiryDraft({message,language:'de',now});
 assert.deepEqual(a.decision,b.decision);assert.equal(a.decision.facts.adults,count);
 assert.equal(a.decision.missing.includes('adults'),false);
 assert.doesNotMatch(a.text,/Wie viele Erwachsene/);assert.doesNotMatch(b.text,/Wie viele Erwachsene/);
 assert.equal(a.decision.capacity.status,'UNKNOWN');assert.equal(a.decision.pricing.verified,false);
});
for(const phrase of ['Erwachsene','ein paar Erwachsene','zwei Kinder','zwei oder drei Erwachsene','zwei bis drei Erwachsene','2–3 Erwachsene','zwei Erwachsene oder drei Erwachsene'])test('uncertain German count stays unresolved: '+phrase,()=>{
 const message='Guten Tag! Ist ein Familienhaus für '+phrase+' verfügbar?';
 assert.equal(adultCountFromText(message),null);
 const a=buildChatInquiryReply({message,language:'de',now}),b=buildEmailInquiryDraft({message,language:'de',now});
 assert.deepEqual(a.decision,b.decision);assert.ok(a.decision.missing.includes('adults'));
 assert.equal(a.decision.readyForCapacityCheck,false);assert.equal(a.decision.capacity.verified,false);
 assert.match(a.text,/Wie viele Erwachsene/);
});
test('real iPhone German words remain in memory after date clarification',()=>{
 const chat=createChatInquirySession({clock:()=>now});
 const first=chat.reply('Guten Tag! Ist ein Familienhaus für zwei Erwachsene verfügbar?');
 assert.equal(chat.language,'de');assert.equal(first.decision.facts.adults,2);
 assert.equal(first.decision.missing.includes('adults'),false);
 const next=chat.reply('2026-11-26 bis 2026-11-28');
 assert.equal(chat.language,'de');assert.equal(next.decision.facts.adults,2);
 assert.equal(next.decision.facts.cabin,'Családi');assert.equal(next.decision.facts.guests,2);
 assert.deepEqual(next.decision.missing,[]);assert.equal(next.decision.capacity.status,'UNKNOWN');
});
for(const [phrase,count] of [['két felnőtt',2],['2 adults',2],['dva odrasla',2]])test('existing HU/EN/SI adult parsing: '+phrase,()=>assert.equal(adultCountFromText(phrase),count));
