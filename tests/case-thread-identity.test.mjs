import test from 'node:test';
import assert from 'node:assert/strict';
import {sameBookingConversation} from '../shared-core/case-thread-identity.mjs';
test('same Gmail thread matches',()=>assert.equal(sameBookingConversation({threadId:'abc'},{threadId:'abc'}).matched,true));
test('different threads do not match',()=>assert.equal(sameBookingConversation({threadId:'abc'},{threadId:'xyz'}).matched,false));
test('reply reference matches a known message',()=>assert.equal(sameBookingConversation({messageId:'<a@b>'},{inReplyTo:'<a@b>'}).matched,true));
test('sender and subject alone cannot match',()=>assert.equal(sameBookingConversation({from:'x@y',subject:'Foglalás'},{from:'x@y',subject:'Foglalás'}).matched,false));

test('real Gmail snake_case thread_id matches',()=>assert.equal(sameBookingConversation({thread_id:'gmail-t1'},{thread_id:'gmail-t1'}).matched,true));
test('real Gmail RFC headers match when thread ID is missing',()=>assert.equal(sameBookingConversation({rfc_message_id:'<old@example.test>'},{in_reply_to:'<old@example.test>'}).matched,true));
test('different Gmail thread_id cannot be overridden by matching references',()=>assert.equal(sameBookingConversation({thread_id:'first',rfc_message_id:'<old@example.test>'},{thread_id:'second',in_reply_to:'<old@example.test>'}).matched,false));

test('same Gmail thread but different sender must not merge',()=>assert.deepEqual(sameBookingConversation({thread_id:'t1',from_email:'alice@example.test'},{thread_id:'t1',from_email:'bob@example.test'}),{matched:false,reason:'SENDER_MISMATCH'}));
