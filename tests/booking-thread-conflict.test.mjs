import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveBookingCase} from '../booking-cases.mjs';

const previous={
 id:'synthetic-case-1',
 sender:'alice@example.test',
 messages:[{thread_id:'gmail-thread-A',rfc_message_id:'<old@example.test>'}],
 state:{values:{arrival:'2026-11-14',departure:'2026-11-16'}}
};
const values={arrival:'2026-11-14',departure:'2026-11-16'};
const envelope=extra=>({
 sender:'alice@example.test',
 text:'Érdeklődöm a foglalásról.',
 ...extra
});

test('matching thread and sender remain linked',()=>{
 const result=resolveBookingCase([previous],envelope({thread_id:'gmail-thread-A'}),values);
 assert.equal(result.status,'linked');
 assert.equal(result.caseId,previous.id);
});
test('matching RFC reference without incoming thread remains linked',()=>{
 const result=resolveBookingCase([previous],envelope({in_reply_to:'<old@example.test>'}),values);
 assert.equal(result.status,'linked');
 assert.equal(result.caseId,previous.id);
});
test('conflicting Gmail thread IDs must not auto-merge, even with matching RFC reference',()=>{
 const result=resolveBookingCase([previous],envelope({thread_id:'gmail-thread-B',in_reply_to:'<old@example.test>'}),values);
 assert.equal(result.status,'ambiguous');
 assert.notEqual(result.status,'linked');
});
test('conflicting Gmail thread IDs must not auto-merge via references array',()=>{
 const result=resolveBookingCase([previous],envelope({thread_id:'gmail-thread-B',references:['<old@example.test>']}),values);
 assert.equal(result.status,'ambiguous');
});
test('different sender cannot auto-merge even with matching thread and reference',()=>{
 const result=resolveBookingCase([previous],{...envelope({thread_id:'gmail-thread-A',in_reply_to:'<old@example.test>'}),sender:'bob@example.test'},values);
 assert.notEqual(result.status,'linked');
});
test('unverified sender cannot auto-merge even with matching thread',()=>{
 const result=resolveBookingCase([previous],{...envelope({thread_id:'gmail-thread-A'}),sender:''},values);
 assert.notEqual(result.status,'linked');
});

test('untrusted case_id alone cannot link a Gmail message',()=>{
 const result=resolveBookingCase([previous],envelope({case_id:previous.id,thread_id:'other-thread'}),values);
 assert.notEqual(result.status,'linked');
 assert.equal(result.status,'ambiguous');
});
test('untrusted case_id alone without Gmail thread cannot link',()=>{
 const result=resolveBookingCase([previous],envelope({case_id:previous.id}),values);
 assert.notEqual(result.status,'linked');
});
