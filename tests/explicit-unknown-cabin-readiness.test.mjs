import test from 'node:test';
import assert from 'node:assert/strict';
import {buildChatInquiryReply,buildEmailInquiryDraft} from '../shared-core/inquiry-channel-adapters.mjs';
import {planCentralInquiry} from '../shared-core/server-inquiry-planner.mjs';
const now=new Date('2026-10-12T10:00:00Z');
const facts={dates:{arrival:'2026-11-20',departure:'2026-11-22',inferred_year:false},guests:2,adults:2,children:0,child_ages:[],units_requested:1};
for(const cabin of ['Unknown','Unverified cottage','? Ismeretlen']){
 test('explicit unknown stored cabin stays blocked across both channels and server providers: '+cabin,async()=>{
  const input={message:'Synthetic dated accommodation inquiry',now,facts:{...facts,cabin}};
  const chat=buildChatInquiryReply(input),email=buildEmailInquiryDraft(input);assert.deepEqual(chat.decision,email.decision);
  assert.equal(chat.decision.readyForCapacityCheck,false);assert.ok(chat.decision.missing.includes('accommodation'));assert.equal(chat.decision.capacity.status,'UNKNOWN');
  let capacityCalls=0,priceCalls=0;const decision=await planCentralInquiry(input,{clock:()=>now,availabilitySource:async()=>{capacityCalls++;throw Error('must not query');},priceSource:async()=>{priceCalls++;throw Error('must not price');}});
  assert.equal(decision.readyForCapacityCheck,false);assert.equal(capacityCalls,0);assert.equal(priceCalls,0);
 });
}
test('truly absent cabin still permits the approved general availability search',()=>{
 for(const cabin of [null,'']){const input={now,facts:{...facts,cabin}};const chat=buildChatInquiryReply(input),email=buildEmailInquiryDraft(input);assert.deepEqual(chat.decision,email.decision);assert.equal(chat.decision.readyForCapacityCheck,true);assert.equal(chat.decision.missing.includes('accommodation'),false);}
});
