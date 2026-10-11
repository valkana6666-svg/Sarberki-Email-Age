import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileIncomingReply} from '../shared-core/case-reply-reconcile.mjs';
test('confirmed reply fills missing cabin without changing dates',()=>{
 const x=reconcileIncomingReply({conversation:{threadId:'t1'},incoming:{threadId:'t1'},previousFacts:{arrival:'2026-11-13',guests:4},incomingFacts:{unit:'Deluxe'}});
 assert.equal(x.requiresHumanReview,false);assert.equal(x.values.unit,'Deluxe');assert.equal(x.values.arrival,'2026-11-13');
});
test('unrelated message cannot change case',()=>{
 const x=reconcileIncomingReply({conversation:{threadId:'t1'},incoming:{threadId:'t2'},previousFacts:{arrival:'2026-11-13'},incomingFacts:{unit:'Deluxe'}});
 assert.equal(x.requiresHumanReview,true);assert.equal(x.values.unit,undefined);
});
test('contradictory reply requires review',()=>{
 const x=reconcileIncomingReply({conversation:{threadId:'t1'},incoming:{threadId:'t1'},previousFacts:{guests:4},incomingFacts:{guests:6}});
 assert.equal(x.requiresHumanReview,true);assert.equal(x.values.guests,4);
});
