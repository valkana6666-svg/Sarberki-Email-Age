import test from 'node:test';
import assert from 'node:assert/strict';
import {chatbotReply,renderChatbotIntent} from '../chatbot-v1.mjs';
import {createChatInquirySession} from '../sarberki-chatbot-project/chat-session.mjs';

const checkin={hu:'Mikor van az érkezés és távozás?',de:'Wann sind Anreise und Abreise?',en:'What time is check-in and check-out?',si:'Kdaj sta prijava in odjava?'};
const tub={hu:'Van szabad dézsa?',de:'Ist ein Badezuber verfügbar?',en:'Is a hot tub available?',si:'Ali je masažna kad na voljo?'};
for(const language of Object.keys(checkin)){
 test('check-in FAQ remains informative without losing inquiry facts: '+language,()=>{
  const chat=createChatInquirySession({language,clock:()=>new Date('2026-10-28T10:00:00Z')});
  chat.reply('Van szabad Deluxe faház 2026.11.20-22 között 2 felnőtt részére?');
  const before=chat.snapshot(),result=chat.reply(checkin[language]);
  assert.equal(result.response.intent,'checkin');
  assert.equal(result.text,renderChatbotIntent('checkin',language));
  assert.equal(result.operatorReviewText,renderChatbotIntent('checkin','hu'));
  assert.deepEqual(chat.snapshot(),before);
  assert.equal(result.decision,null);
 });
 test('hot tub availability gives separate-fee FAQ without claiming availability: '+language,()=>{
  const response=chatbotReply({message:tub[language],language});
  assert.equal(response.intent,'hotTub');assert.equal(response.reply,renderChatbotIntent('hotTub',language));
  assert.equal(response.availabilityVerified,false);assert.equal(response.bookingCreated,false);
  const chat=createChatInquirySession({language});
  chat.reply('Van szabad Deluxe faház 2026.11.20-22 között 2 felnőtt részére?');
  const before=chat.snapshot(),result=chat.reply(tub[language]);
  assert.equal(result.text,response.reply);assert.deepEqual(chat.snapshot(),before);assert.equal(result.decision,null);
 });
}
test('a stay inquiry that also mentions a hot tub is still routed to booking',()=>{
 const chat=createChatInquirySession({language:'en'});
 const result=chat.reply('Is a Deluxe cabin with a hot tub available from 2026-11-20 to 2026-11-22 for 2 adults?');
 assert.equal(result.response.intent,'availability');assert.equal(result.decision.facts.cabin,'Deluxe');
 assert.equal(result.decision.capacity.verified,false);assert.equal(result.decision.safety.bookingCreated,false);
});
test('a date correction mentioning arrival is processed as a booking update',()=>{
 const chat=createChatInquirySession({language:'en'});
 chat.reply('Is a Deluxe cabin available from 2026-11-20 to 2026-11-22 for 2 adults?');
 const result=chat.reply('Our arrival is 2026-11-21 and departure is 2026-11-23.');
 assert.ok(result.decision);assert.equal(result.decision.facts.dates.arrival,'2026-11-21');
 assert.equal(result.decision.facts.dates.departure,'2026-11-23');assert.equal(result.decision.facts.adults,2);
 assert.equal(result.decision.capacity.verified,false);
});

test('an incomplete or invalid changed date removes the old stay and asks again',()=>{
 for(const message of ['Our arrival is 2026-11-21.','Check-in 2026-02-30 to 2026-03-02.']){
  const chat=createChatInquirySession({language:'en'});
  chat.reply('Is a Deluxe cabin available from 2026-11-20 to 2026-11-22 for 2 adults?');
  const result=chat.reply(message);
  assert.ok(result.decision);assert.equal(result.decision.facts.dates,null);
  assert.ok(result.decision.missing.includes('dates'));
  assert.equal(result.decision.readyForCapacityCheck,false);
  assert.equal(result.decision.capacity.verified,false);
  assert.doesNotMatch(result.text,/20 November 2026 to 22 November 2026/);
 }
});

test('unparsed month-name and day-first date changes do not silently retain the previous stay',()=>{
 const cases={
  hu:'Módosítás: november 21-én érkeznénk és november 23-án távoznánk.',
  de:'Die Anreise ist am 21. November 2026 und die Abreise am 23. November 2026.',
  en:'We changed our dates to November 21 and November 23, 2026.',
  si:'Prihod 21. novembra in odhod 23. novembra 2026.'
 };
 for(const [language,message] of Object.entries(cases)){
  const chat=createChatInquirySession({language});
  chat.reply('Van szabad Deluxe faház 2026.11.20-22 között 2 felnőtt részére?');
  const result=chat.reply(message);
  assert.ok(result.decision,language);
  if(result.decision.facts.dates){
   assert.equal(result.decision.facts.dates.arrival,'2026-11-21',language);
   assert.equal(result.decision.facts.dates.departure,'2026-11-23',language);
  }else{
   assert.ok(result.decision.missing.includes('dates'),language);
   assert.equal(result.decision.readyForCapacityCheck,false,language);
  }
  assert.equal(result.decision.capacity.verified,false,language);
 }
});
test('an ordinary check-in time question does not erase the stay',()=>{
 const chat=createChatInquirySession({language:'en'});
 chat.reply('Is a Deluxe cabin available from 2026-11-20 to 2026-11-22 for 2 adults?');
 const before=chat.snapshot();const result=chat.reply('Can we check in at 14.00?');
 assert.equal(result.response.intent,'checkin');assert.deepEqual(chat.snapshot(),before);
});
