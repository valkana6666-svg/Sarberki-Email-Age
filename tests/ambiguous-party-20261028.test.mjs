import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatInquirySession} from '../sarberki-chatbot-project/chat-session.mjs';
import {buildChatInquiryReply,buildEmailInquiryDraft} from '../shared-core/inquiry-channel-adapters.mjs';
import {mergeBookingFacts} from '../booking-cases.mjs';
import {adultCountFromText,childCountFromText,guestCountFromText} from '../sarberki-core.mjs';
const now=new Date('2026-10-28T10:00:00Z');
const cases={
 hu:'Lehet, hogy 2 vagy 3 felnőtt jön.',
 de:'Es kommen zwei oder drei Erwachsene.',
 en:'There will be 2 or 3 adults.',
 si:'Prišli bodo 2 ali 3 odrasli.'
};
for(const [language,message] of Object.entries(cases)){
 test('ambiguous adults require clarification in chat and email: '+language,()=>{
  assert.equal(adultCountFromText(message),null);
  const input={language,message,now,facts:{dates:{arrival:'2026-11-20',departure:'2026-11-22'},cabin:'Deluxe',adults:2,children:0,guests:2}};
  const chat=buildChatInquiryReply(input),mail=buildEmailInquiryDraft(input);
  assert.deepEqual(chat.decision,mail.decision);
  assert.equal(chat.decision.facts.adults,null);
  assert.equal(chat.decision.facts.guests,null);
  assert.ok(chat.decision.missing.includes('adults'));
  assert.equal(chat.decision.readyForCapacityCheck,false);
  assert.equal(chat.decision.capacity.verified,false);
  const session=createChatInquirySession({language,clock:()=>now});
  session.reply('Van szabad Deluxe faház 2026.11.20-22 között 2 felnőtt részére?');
  const result=session.reply(message);
  assert.equal(result.decision.facts.adults,null);
  assert.equal(result.decision.facts.guests,null);
  assert.equal(result.decision.facts.dates.arrival,'2026-11-20');
  assert.equal(result.decision.readyForCapacityCheck,false);
  assert.equal(result.decision.capacity.status,'UNKNOWN');
  assert.equal(result.decision.safety.bookingCreated,false);
  const corrected=session.reply('3 adults, no children.');
  assert.equal(corrected.decision.facts.adults,3);
  assert.equal(corrected.decision.facts.guests,3);
  assert.equal(corrected.decision.capacity.verified,false);
 });
}
for(const [kind,message] of [
 ['adults','2–3 adults'],['adults','2 adults or 3 adults'],
 ['children','2 adults and 1 or 2 children'],['guests','2 fő vagy 3 fő'],
 ['guests','2 to 3 people'],['children','1 bis 2 Kinder']
])test('uncertain '+kind+' never carries over a previous case party: '+message,()=>{
 const prior={adults:'2',children:'1',child_ages:'7',guests:'3'};
 const result=mergeBookingFacts(prior,{},message);
 assert.equal(result.guests,'');
 if(kind==='adults'||kind==='guests')assert.equal(result.adults,'');
 if(kind==='children'){assert.equal(result.children,'');assert.equal(result.child_ages,'');}
});
test('unambiguous child and adult counts remain available',()=>{
 assert.equal(adultCountFromText('2 adults and 1 child'),2);
 assert.equal(childCountFromText('2 adults and 1 child'),1);
 assert.equal(guestCountFromText('2 adults and 1 child'),3);
});
test('ambiguous child counts do not reuse prior ages or ready capacity',()=>{
 const chat=createChatInquirySession({language:'en',clock:()=>now});
 chat.reply('Is a Deluxe cabin available from 2026-11-20 to 2026-11-22 for 2 adults and 1 child aged 7?');
 const result=chat.reply('There may be 1 or 2 children.');
 assert.equal(result.decision.facts.children,null);
 assert.deepEqual(result.decision.facts.child_ages,[]);
 assert.equal(result.decision.facts.guests,null);
 assert.ok(result.decision.missing.includes('children_status'));
 assert.equal(result.decision.readyForCapacityCheck,false);
});

test('linked email follow-up clears prior party and invalidates old quote',async()=>{
 const {createBookingCaseStore}=await import('../booking-cases.mjs');
 const store=createBookingCaseStore({id:()=> 'synthetic-party-case'});
 const e={sender:'guest@test.invalid',thread_id:'synthetic-party-thread'};
 const first=store.ingest({...e,message_id:'one',text:'Initial request'},{arrival:'2026-11-20',departure:'2026-11-22',adults:'2',children:'0',guests:'2',unit:'Deluxe'});
 store.save(first.bookingCase.id,{...first.bookingCase.state,quote:{total:1234},availability:{verified:true}});
 const next=store.ingest({...e,message_id:'two',text:'There will be 2 or 3 adults.'},{},{intent:'modification_request'});
 assert.equal(next.bookingCase.state.values.adults,'');
 assert.equal(next.bookingCase.state.values.guests,'');
 assert.equal(next.bookingCase.facts.adults.status,'missing');
 assert.equal(next.bookingCase.state.quote,null);
 assert.equal(next.bookingCase.state.availability,null);
 assert.equal(next.bookingCase.state.approval,'pending');
});

test('a tub-only question with an uncertain service party preserves accommodation facts',async()=>{
 const {createBookingCaseStore}=await import('../booking-cases.mjs');
 const store=createBookingCaseStore({id:()=> 'service-synthetic'});
 const e={sender:'guest@test.invalid',thread_id:'service-thread'};
 const first=store.ingest({...e,message_id:'one',text:'Initial stay'},{arrival:'2026-11-20',departure:'2026-11-22',adults:'2',children:'0',guests:'2',unit:'Deluxe'});
 const next=store.ingest({...e,message_id:'two',text:'Can we rent a hot tub for 2 or 3 adults?'},{},{intent:'service_request'});
 assert.equal(next.bookingCase.state.values.adults,'2');
 assert.equal(next.bookingCase.state.values.guests,'2');
 assert.equal(next.bookingCase.id,first.bookingCase.id);
});

for(const [language,message] of Object.entries({hu:'2 vagy 3',de:'zwei oder drei',en:'2 or 3',si:'dva ali tri'})){
 test('bare ambiguous reply clears prior party until clarified: '+language,()=>{
  const chat=createChatInquirySession({language,clock:()=>now});
  chat.reply('Van szabad Deluxe faház 2026.11.20-22 között 2 felnőtt részére?');
  const result=chat.reply(message);
  assert.equal(result.decision.facts.adults,null);
  assert.equal(result.decision.facts.children,null);
  assert.equal(result.decision.facts.guests,null);
  assert.ok(result.decision.missing.includes('adults'));
  assert.ok(result.decision.missing.includes('children_status'));
  assert.equal(result.decision.readyForCapacityCheck,false);
  assert.equal(result.decision.capacity.verified,false);
  assert.equal(result.decision.facts.dates.arrival,'2026-11-20');
 });
}

for(const [language,message] of Object.entries({
 hu:'Bocsánat, 2 felnőtt helyett 3 jön.',
 de:'Nicht 2 Erwachsene, sondern 3 Erwachsene.',
 en:'2 adults instead of 3 adults.',
 si:'Ne 2 odrasli, ampak 3 odrasli.'
}))test('a party correction with conflicting old and new numbers is clarified: '+language,()=>{
 const facts={dates:{arrival:'2026-11-20',departure:'2026-11-22'},cabin:'Deluxe',adults:2,children:0,guests:2};
 const input={language,message,now,facts};
 const mail=buildEmailInquiryDraft(input),chat=buildChatInquiryReply(input);
 assert.deepEqual(chat.decision,mail.decision);
 assert.equal(chat.decision.facts.adults,null);
 assert.equal(chat.decision.facts.guests,null);
 assert.ok(chat.decision.missing.includes('adults'));
 assert.equal(chat.decision.readyForCapacityCheck,false);
 const session=createChatInquirySession({language,clock:()=>now});
 session.reply('Van szabad Deluxe faház 2026.11.20-22 között 2 felnőtt részére?');
 const answer=session.reply(message);
 assert.equal(answer.decision.facts.adults,null);
 assert.equal(answer.decision.facts.guests,null);
 assert.equal(answer.decision.facts.dates.arrival,'2026-11-20');
 assert.equal(answer.decision.capacity.verified,false);
 assert.equal(mergeBookingFacts({adults:'2',children:'0',guests:'2'},{},message).adults,'');
});
for(const message of ['2–3 vendég','2-3 vendég','2 felnőtt jön, vagy talán 3.'])test('additional ambiguous party phrasing does not retain old count: '+message,()=>{
 const chat=createChatInquirySession({clock:()=>now});
 chat.reply('Van szabad Deluxe faház 2026.11.20-22 között 2 felnőtt részére?');
 const result=chat.reply(message);
 assert.equal(result.decision.facts.guests,null);
 assert.equal(result.decision.facts.adults,null);
 assert.ok(result.decision.missing.includes('adults'));
 assert.equal(result.decision.readyForCapacityCheck,false);
});
test('a bare numeric response to a completed party does not silently retain the old count',()=>{
 const chat=createChatInquirySession({clock:()=>now});
 chat.reply('Van szabad Deluxe faház 2026.11.20-22 között 2 felnőtt részére?');
 const result=chat.reply('3');
 assert.equal(result.decision.facts.adults,null);
 assert.equal(result.decision.facts.guests,null);
 assert.ok(result.decision.missing.includes('adults'));
 assert.equal(result.decision.readyForCapacityCheck,false);
 const clarified=chat.reply('3 felnőtt, gyermek nélkül.');
 assert.equal(clarified.decision.facts.adults,3);
 assert.equal(clarified.decision.facts.guests,3);
 assert.equal(clarified.decision.facts.dates.arrival,'2026-11-20');
});
test('a sole outstanding child age accepts a bare answer while preserving the party',()=>{
 const chat=createChatInquirySession({clock:()=>now});
 chat.reply('Van szabad Deluxe faház 2026.11.20-22 között 2 felnőtt és 1 gyermek részére?');
 const result=chat.reply('7');
 assert.equal(result.decision.facts.adults,2);
 assert.equal(result.decision.facts.children,1);
 assert.deepEqual(result.decision.facts.child_ages,[7]);
 assert.equal(result.decision.missing.includes('child_ages'),false);
 assert.equal(result.decision.capacity.verified,false);
});
