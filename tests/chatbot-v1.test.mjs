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

for(const language of ['hu','de','en','si']){
 test('chatbot fishing and accommodation FAQ in '+language,()=>{
  const fishing=chatbotReply({message:'fishing',language});
  assert.equal(fishing.intent,'fishing');
  assert.ok(fishing.reply.length>40);
  assert.equal(fishing.bookingCreated,false);
  const cabins=chatbotReply({message:'Deluxe cabin',language});
  assert.equal(cabins.intent,'cabins');
  assert.equal(cabins.availabilityVerified,false);
  assert.ok(cabins.reply.length>30);
 });
}
test('Hungarian fishing rules and no fabricated availability',()=>{
 const fishing=chatbotReply({message:'Mik a horgászszabályok?',language:'hu'});
 assert.match(fishing.reply,/állami horgászjegy/u);
 assert.match(fishing.reply,/szakáll nélküli/u);
 const cabins=chatbotReply({message:'Milyen faházak vannak?',language:'hu'});
 assert.match(cabins.reply,/Családi, VIP, Deluxe/u);
 assert.match(cabins.reply,/külön ellenőrizzük/u);
});
