import test from 'node:test';
import assert from 'node:assert/strict';
import {sameBookingConversation} from '../shared-core/case-thread-identity.mjs';
test('same Gmail thread matches',()=>assert.equal(sameBookingConversation({threadId:'abc'},{threadId:'abc'}).matched,true));
test('different threads do not match',()=>assert.equal(sameBookingConversation({threadId:'abc'},{threadId:'xyz'}).matched,false));
test('reply reference matches a known message',()=>assert.equal(sameBookingConversation({messageId:'<a@b>'},{inReplyTo:'<a@b>'}).matched,true));
test('sender and subject alone cannot match',()=>assert.equal(sameBookingConversation({from:'x@y',subject:'Foglalás'},{from:'x@y',subject:'Foglalás'}).matched,false));
