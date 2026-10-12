import test from 'node:test';import assert from 'node:assert/strict';
import {createChatInquirySession} from '../sarberki-chatbot-project/chat-session.mjs';
import {buildEmailInquiryDraft,buildChatInquiryReply} from '../shared-core/inquiry-channel-adapters.mjs';
const now=new Date('2026-10-11T12:00:00Z');
const cases={hu:'Van szabad Deluxe faház 2026.11.13-15 között 2 felnőtt részére, gyermek nélkül?',de:'Ist ein Deluxe Haus vom 2026-11-13 bis 2026-11-15 für 2 Erwachsene ohne Kinder frei?',en:'Is a Deluxe cabin available from 2026-11-13 to 2026-11-15 for 2 adults and no children?',si:'Ali je Deluxe hiška prosta od 2026-11-13 do 2026-11-15 za 2 odrasli osebi brez otrok?'};
for(const [language,message]of Object.entries(cases))test('email/chat decision and pending safety are identical in '+language,()=>{
 const a=buildEmailInquiryDraft({message,language,now}),b=buildChatInquiryReply({message,language,now});
 assert.deepEqual(a.decision,b.decision);assert.equal(a.channel,'email');assert.equal(b.channel,'chat');
 assert.equal(a.requiresApproval,true);assert.equal(b.decision.safety.bookingCreated,false);assert.equal(b.decision.capacity.verified,false);
});
test('chat remembers known dates and cabin without asking again, reset clears isolated memory',()=>{
 const chat=createChatInquirySession({clock:()=>now});
 const first=chat.reply('Van szabad Deluxe faház 2026.11.13-15 között?');
 assert.equal(first.decision.facts.cabin,'Deluxe');assert.ok(first.decision.missing.includes('adults'));
 const second=chat.reply('2 felnőtt, gyermek nélkül.');
 assert.equal(second.decision.facts.cabin,'Deluxe');assert.equal(second.decision.facts.dates.arrival,'2026-11-13');assert.equal(second.decision.facts.adults,2);
 assert.equal(second.decision.missing.includes('dates'),false);assert.equal(second.decision.missing.includes('accommodation'),false);
 assert.equal(second.decision.capacity.verified,false);
 const copy=chat.snapshot();copy.cabin='VIP';assert.equal(chat.snapshot().cabin,'Deluxe');
 chat.reset();assert.deepEqual(chat.snapshot(),{});
});
test('two chats cannot leak retained facts and input bounds fail closed',()=>{
 const a=createChatInquirySession(),b=createChatInquirySession();a.reply('Van szabad Deluxe faház?');assert.deepEqual(b.snapshot(),{});
 assert.throws(()=>b.reply('x'.repeat(1001)),/CHAT_INPUT_LIMIT/);
});
test('Hungarian ISO dates and separate child-age turn preserve all already known data',()=>{
 const chat=createChatInquirySession({clock:()=>now});
 const first=chat.reply('2026-11-20 és 2026-11-23 között Deluxe faház');
 assert.equal(first.decision.facts.dates.arrival,'2026-11-20');
 chat.reply('2 felnőtt és 2 gyermek');
 const last=chat.reply('A gyermekek 7 és 10 évesek');
 assert.deepEqual(last.decision.facts.child_ages,[7,10]);assert.equal(last.decision.facts.guests,4);assert.equal(last.decision.readyForCapacityCheck,true);assert.deepEqual(last.decision.missing,[]);assert.equal(last.decision.capacity.status,'UNKNOWN');
});
test('separate sibling-age turns fill outstanding ages using the existing booking merge',()=>{
 const chat=createChatInquirySession({clock:()=>now});
 chat.reply('Van szabad Deluxe faház 2026.11.13-15 között 2 felnőtt és 2 gyermek részére?');
 const first=chat.reply('Az egyik 7 éves.');
 assert.deepEqual(first.decision.facts.child_ages,[7]);assert.equal(first.decision.readyForCapacityCheck,false);
 const second=chat.reply('A másik 10 éves.');
 assert.deepEqual(second.decision.facts.child_ages,[7,10]);assert.equal(second.decision.readyForCapacityCheck,true);
 assert.equal(second.decision.facts.guests,4);
 const correction=chat.reply('Javítás: a gyermekek 8 és 11 évesek.');
 assert.deepEqual(correction.decision.facts.child_ages,[8,11]);
});
test('changed child count clears stale ages and recalculates known total, while explicit contradictory total remains flagged',()=>{
 const chat=createChatInquirySession({clock:()=>now});
 chat.reply('Van szabad Deluxe faház 2026.11.13-15 között 2 felnőtt és 2 gyermek részére?');
 chat.reply('A gyermekek 7 és 10 évesek.');
 const changed=chat.reply('Most 3 gyermek jön.');
 assert.deepEqual(changed.decision.facts.child_ages,[]);assert.equal(changed.decision.facts.guests,5);
 assert.ok(changed.decision.missing.includes('child_ages'));assert.equal(changed.decision.readyForCapacityCheck,false);
 const adults=chat.reply('3 felnőtt jön.');assert.equal(adults.decision.facts.guests,6);
 const contradictory=chat.reply('Összesen 9 fő, 3 felnőtt és 3 gyermek.');
 assert.equal(contradictory.decision.facts.guests,9);assert.ok(contradictory.decision.contradictions.some(x=>x.code==='guest_total_mismatch'));
});

test('Hungarian conjunction before a party count cannot manufacture departure date',()=>{
 const chat=createChatInquirySession({clock:()=>now});
 const result=chat.reply('Van szabad Deluxe faház 2026-11-01 és 2 felnőtt részére?');
 assert.ok(result.decision.missing.includes('dates'));assert.equal(result.decision.capacity.verified,false);
});
for(const [language,question] of Object.entries({hu:'Van dézsa?',de:'Kann ich einen Badezuber mieten?',en:'Can I rent a hot tub?',si:'Ali je masažna kad na voljo?'}))test('FAQ detour retains the stay and returns the existing FAQ in '+language,()=>{
 const chat=createChatInquirySession({language,clock:()=>now});
 chat.reply(cases[language]);const before=chat.snapshot();
 const result=chat.reply(question);
 assert.equal(result.response.intent,'hotTub');assert.equal(result.text,result.response.reply);
 assert.equal(result.decision,null);assert.match(result.operatorReviewText,/külön bérelhető/);
 assert.deepEqual(chat.snapshot(),before);
 const next=chat.reply(cases[language]);
 assert.equal(next.decision.facts.dates.arrival,'2026-11-13');assert.equal(next.decision.facts.adults,2);
 assert.deepEqual(next.decision.missing,[]);assert.equal(next.decision.capacity.verified,false);
});
test('empty greeting during an active inquiry does not discard facts or normalize empty input',()=>{
 const chat=createChatInquirySession({clock:()=>now});chat.reply(cases.hu);
 const before=chat.snapshot(),result=chat.reply('');
 assert.equal(result.response.intent,'welcome');assert.deepEqual(chat.snapshot(),before);
});

const iphoneInquiry='Jó napot! November 26-tól 28-ig szeretnénk egy Deluxe faházat foglalni 2 felnőtt részére. Van szabad hely?';
test('Hungarian booking date confirmation continues the active iPhone inquiry',()=>{
 const chat=createChatInquirySession({clock:()=>now});
 const first=chat.reply(iphoneInquiry);
 assert.ok(first.decision.missing.includes('dates_confirmation'));
 const result=chat.reply('2026. november 26-tól 28-ig szeretnénk foglalni.');
 assert.ok(result.decision);
 assert.deepEqual(result.decision.facts.dates,{arrival:'2026-11-26',departure:'2026-11-28',inferred_year:false});
 assert.equal(result.decision.facts.adults,2);
 assert.equal(result.decision.facts.cabin,'Deluxe');
 assert.equal(result.decision.facts.units_requested,1);
 assert.deepEqual(result.decision.missing,[]);
 assert.equal(result.decision.capacity.status,'UNKNOWN');
 assert.equal(result.decision.pricing.verified,false);
 assert.match(result.text,/kapacitás ellenőrzése még nem igazolt/u);
 assert.equal(result.decision.safety.bookingCreated,false);
 assert.equal(result.decision.safety.emailSent,false);
});
test('booking party correction retains the confirmed stay and one Deluxe unit',()=>{
 const chat=createChatInquirySession({clock:()=>now});
 chat.reply('Van szabad egy Deluxe faház 2026. november 26-tól 28-ig 2 felnőtt részére?');
 const result=chat.reply('3 felnőtt részére szeretnénk foglalni.');
 assert.ok(result.decision);
 assert.equal(result.decision.facts.adults,3);
 assert.equal(result.decision.facts.guests,3);
 assert.equal(result.decision.facts.dates.arrival,'2026-11-26');
 assert.equal(result.decision.facts.cabin,'Deluxe');
 assert.equal(result.decision.facts.units_requested,1);
 assert.equal(result.decision.capacity.status,'UNKNOWN');
});
test('booking FAQ without new stay facts remains informational in an active inquiry',()=>{
 const chat=createChatInquirySession({clock:()=>now});chat.reply(iphoneInquiry);
 const before=chat.snapshot(),result=chat.reply('Hogyan válik érvényessé a foglalás?');
 assert.equal(result.response.intent,'booking');assert.equal(result.decision,null);
 assert.match(result.text,/külön visszaigazolás/u);assert.deepEqual(chat.snapshot(),before);
});
test('standalone booking FAQ and date message do not create an active inquiry',()=>{
 for(const message of ['Hogyan válik érvényessé a foglalás?','2026. november 26-tól 28-ig szeretnénk foglalni.']){
  const chat=createChatInquirySession({clock:()=>now}),result=chat.reply(message);
  assert.equal(result.response.intent,'booking');assert.equal(result.decision,null);
  assert.deepEqual(chat.snapshot(),{});
 }
});
