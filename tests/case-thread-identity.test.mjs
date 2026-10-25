import test from 'node:test';
import assert from 'node:assert/strict';
import {sameBookingConversation} from '../shared-core/case-thread-identity.mjs';
const sender='alice@example.test';
const withSender=obj=>({from_email:sender,...obj});
test('same Gmail thread matches with verified sender',()=>assert.equal(sameBookingConversation(withSender({threadId:'abc'}),withSender({threadId:'abc'})).matched,true));
test('different threads do not match',()=>assert.equal(sameBookingConversation(withSender({threadId:'abc'}),withSender({threadId:'xyz'})).matched,false));
test('reply reference matches known message with verified sender',()=>assert.equal(sameBookingConversation(withSender({messageId:'<a@b>'}),withSender({inReplyTo:'<a@b>'})).matched,true));
test('sender and subject alone cannot match',()=>assert.equal(sameBookingConversation({from:'x@y',subject:'Foglalás'},{from:'x@y',subject:'Foglalás'}).matched,false));
test('real Gmail snake_case thread_id matches',()=>assert.equal(sameBookingConversation(withSender({thread_id:'gmail-t1'}),withSender({thread_id:'gmail-t1'})).matched,true));
test('real Gmail RFC headers match when thread ID is missing',()=>assert.equal(sameBookingConversation(withSender({rfc_message_id:'<old@example.test>'}),withSender({in_reply_to:'<old@example.test>'})).matched,true));
test('different Gmail thread_id cannot be overridden by matching references',()=>assert.equal(sameBookingConversation(withSender({thread_id:'first',rfc_message_id:'<old@example.test>'}),withSender({thread_id:'second',in_reply_to:'<old@example.test>'})).matched,false));
test('same Gmail thread but different sender must not merge',()=>assert.deepEqual(sameBookingConversation({thread_id:'t1',from_email:'alice@example.test'},{thread_id:'t1',from_email:'bob@example.test'}),{matched:false,reason:'SENDER_MISMATCH'}));
for(const [name,a,b] of [
  ['existing sender absent', {thread_id:'t1'},{thread_id:'t1',from_email:sender}],
  ['incoming sender absent',{thread_id:'t1',from_email:sender},{thread_id:'t1'}],
  ['both senders absent',{thread_id:'t1'},{thread_id:'t1'}],
  ['reference without incoming sender',{rfc_message_id:'<x@y>',from_email:sender},{in_reply_to:'<x@y>'}],
  ['reference without existing sender',{rfc_message_id:'<x@y>'},{in_reply_to:'<x@y>',from_email:sender}],
])test(name+' fails closed',()=>assert.deepEqual(sameBookingConversation(a,b),{matched:false,reason:'SENDER_UNVERIFIED'}));
test('sender normalization keeps safe positive match',()=>assert.equal(sameBookingConversation({threadId:'t1',from_email:' Alice@Example.test '},{threadId:'t1',from_email:'alice@example.test'}).matched,true));
