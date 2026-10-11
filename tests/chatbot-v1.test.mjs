import test from 'node:test';
import assert from 'node:assert/strict';
import {chatbotReply} from '../chatbot-v1.mjs';
for(const language of ['hu','de','en','si']){
 test('chatbot welcome and safety in '+language,()=>{
  const welcome=chatbotReply({language});
  assert.equal(welcome.intent,'welcome');
  assert.ok(welcome.reply.length>10);
  for(const message of ['availability','hot tub','booking']){
   const reply=chatbotReply({message,language});
   assert.equal(reply.bookingCreated,false);
   assert.equal(reply.emailSent,false);
   assert.equal(reply.availabilityVerified,false);
  }
 });
}
test('Hungarian hot tub is always separately rented',()=>{
 const r=chatbotReply({message:'Van dézsa?',language:'hu'});
 assert.equal(r.intent,'hotTub');
 assert.match(r.reply,/külön bérelhető, külön díj ellenében/u);
});
test('unknown questions are not invented',()=>{
 const r=chatbotReply({message:'Milyen lesz az időjárás jövőre?',language:'hu'});
 assert.equal(r.intent,'unknown');
 assert.match(r.reply,/nem tudom hitelesen/u);
});
test('Slovenian locale alias and unknown language fallback',()=>{
 assert.equal(chatbotReply({language:'sl'}).language,'si');
 assert.equal(chatbotReply({language:'xx'}).language,'hu');
});
