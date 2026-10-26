import test from 'node:test';import assert from 'node:assert/strict';
import {sameBookingConversation as same} from '../shared-core/case-thread-identity.mjs';
import {reconcileIncomingReply as reconcile} from '../shared-core/case-reply-reconcile.mjs';
const sender={from_email:'synthetic@example.invalid'};
for(const value of ['abc',{},42,true,['a',null],['a',1],new Array(1)])test('invalid messageIds cannot match or throw: '+JSON.stringify(value),()=>{
 for(const thread of [false,true])assert.deepEqual(same({...sender,messageIds:value,...(thread?{threadId:'t1'}:{})},{...sender,inReplyTo:'a',...(thread?{threadId:'t1'}:{})}),{matched:false,reason:'INVALID_IDENTITY_DATA'});
});
for(const value of [{},42,true,['a',null],['a',1],new Array(1)])test('invalid references cannot match or throw: '+JSON.stringify(value),()=>{
 assert.deepEqual(same({...sender,messageId:'a',threadId:'t1'},{...sender,references:value,threadId:'t1'}),{matched:false,reason:'INVALID_IDENTITY_DATA'});
});
for(const value of [null,[],42,'abc'])test('invalid records remain unresolved: '+JSON.stringify(value),()=>{
 assert.equal(same(value,sender).matched,false);assert.equal(same(sender,value).matched,false);
});
for(const references of ['<old@synthetic.invalid>',['<old@synthetic.invalid>']])test('valid reference representation preserved: '+JSON.stringify(references),()=>{
 assert.equal(same({...sender,messageIds:['<old@synthetic.invalid>']},{...sender,references}).matched,true);
});
test('absent and null optional collections preserve valid thread matching',()=>{
 for(const messageIds of [undefined,null,[]])for(const references of [undefined,null,[]])assert.equal(same({...sender,threadId:'t1',messageIds},{...sender,threadId:'t1',references}).matched,true);
});
test('malformed identity preserves previous facts and requires review',()=>{
 const previousFacts={arrival:'2026-11-13',guests:4};
 const r=reconcile({conversation:{...sender,messageIds:'abc'},incoming:{...sender,inReplyTo:'a'},previousFacts,incomingFacts:{unit:'Deluxe'}});
 assert.equal(r.requiresHumanReview,true);assert.equal(r.identity.matched,false);assert.deepEqual(r.updates,{});assert.deepEqual(r.values,previousFacts);assert.deepEqual(previousFacts,{arrival:'2026-11-13',guests:4});
});
