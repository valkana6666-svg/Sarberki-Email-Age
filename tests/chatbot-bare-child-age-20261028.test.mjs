import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatInquirySession} from '../sarberki-chatbot-project/chat-session.mjs';
const now=new Date('2026-10-28T10:00:00Z');
const initial='Van szabad Deluxe faház 2026.11.20-22 között 2 felnőtt és 1 gyermek részére?';
for(const language of ['hu','de','en','si'])test('one outstanding child age accepts a bare answer: '+language,()=>{
 const chat=createChatInquirySession({language,clock:()=>now});
 const first=chat.reply(initial);assert.deepEqual(first.decision.missing,['child_ages']);
 const result=chat.reply('7');
 assert.deepEqual(result.decision.facts.child_ages,[7]);
 assert.equal(result.decision.facts.children,1);assert.equal(result.decision.facts.adults,2);
 assert.equal(result.decision.facts.dates.arrival,'2026-11-20');
 assert.equal(result.decision.missing.includes('child_ages'),false);
 assert.equal(result.decision.capacity.verified,false);assert.equal(result.decision.safety.bookingCreated,false);
});
test('one remaining age appends to prior sibling age',()=>{
 const chat=createChatInquirySession({clock:()=>now});
 chat.reply('Van szabad Deluxe faház 2026.11.20-22 között 2 felnőtt és 2 gyermek részére?');
 chat.reply('Az egyik 7 éves.');const result=chat.reply('10');
 assert.deepEqual(result.decision.facts.child_ages,[7,10]);assert.equal(result.decision.capacity.verified,false);
});
test('two outstanding child ages are not filled from one bare number',()=>{
 const chat=createChatInquirySession({clock:()=>now});
 chat.reply('Van szabad Deluxe faház 2026.11.20-22 között 2 felnőtt és 2 gyermek részére?');
 const result=chat.reply('7');assert.deepEqual(result.decision.facts.child_ages,[]);
 assert.ok(result.decision.missing.includes('child_ages'));assert.equal(result.decision.readyForCapacityCheck,false);
});
test('bare number is not assigned as age while another booking fact is missing',()=>{
 const chat=createChatInquirySession({clock:()=>now});
 chat.reply('Van szabad Deluxe faház 2 felnőtt és 1 gyermek részére?');
 const result=chat.reply('7');assert.deepEqual(result.decision.facts.child_ages,[]);
 assert.ok(result.decision.missing.includes('dates'));assert.ok(result.decision.missing.includes('child_ages'));
});
test('values outside 0–17 are not accepted and no verified capacity is created',()=>{
 for(const value of ['18','99','-1']){
  const chat=createChatInquirySession({clock:()=>now});chat.reply(initial);
  const result=chat.reply(value);assert.deepEqual(result.decision.facts.child_ages,[]);
  assert.ok(result.decision.missing.includes('child_ages'));assert.equal(result.decision.capacity.verified,false);
 }
});
test('reset does not keep a previous age question',()=>{
 const chat=createChatInquirySession({clock:()=>now});chat.reply(initial);chat.reset();
 assert.equal(chat.reply('7').decision,null);assert.deepEqual(chat.snapshot(),{});
});
test('an intervening FAQ invalidates the bare-age interpretation context',()=>{
 const chat=createChatInquirySession({clock:()=>now});chat.reply(initial);
 chat.reply('Van dézsa?');const answer=chat.reply('7');
 assert.deepEqual(answer.decision.facts.child_ages,[]);
 assert.ok(answer.decision.missing.includes('child_ages'));
 assert.equal(answer.decision.facts.adults,2);assert.equal(answer.decision.facts.children,1);
});
