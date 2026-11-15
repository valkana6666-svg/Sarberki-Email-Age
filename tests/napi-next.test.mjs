import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {nextStepFor} from '../napi-kezelo/napi-next.mjs';

// Owner 2026-11-15: one "next step" button per case; it never offers a step the server hints do not allow.
test('next step follows the case state and the server hints',()=>{
 assert.equal(nextStepFor(null),null);
 assert.equal(nextStepFor({approval:'pending',canDecide:true},{sendable:true}).kind,'approveSend');
 assert.equal(nextStepFor({approval:'pending',canDecide:true},{sendable:false}).kind,'approve');
 assert.equal(nextStepFor({approval:'pending',canDecide:false},{sendable:true}),null,'no decide right, no button');
 assert.equal(nextStepFor({approval:'pending',canDecide:true,canOneClick:true,bookingIntent:'igen, foglalnánk'},{sendable:true}).kind,'book','guest said yes: booking first');
 assert.equal(nextStepFor({approval:'pending',canDecide:true,canOneClick:true,bookingIntent:''},{sendable:true}).kind,'approveSend','no yes yet: no booking button');
 const booked={approval:'approved_internal',booking:{status:'finalized'},canMarkDeposit:false,canOneClick:false};
 assert.deepEqual([nextStepFor(booked,{sendable:true}).kind,nextStepFor(booked,{sendable:true}).label],['send','Visszaigazolás küldése']);
 assert.equal(nextStepFor({...booked,canMarkDeposit:true},{sendable:true}).kind,'deposit');
 assert.equal(nextStepFor({approval:'approved_internal'},{sendable:false}),null,'chat case without e-mail: nothing to send');
 assert.equal(nextStepFor({approval:'rejected',canDecide:true}),null);
});

test('simple view keeps only the next step, the facts, the letter and Elutasítás',async()=>{
 const html=await readFile(new URL('../napi-kezelo/index.html',import.meta.url),'utf8');
 assert.match(html,/<div id="next-step" class="next-step" hidden>/);
 for(const id of ['approve-draft','send-approved','draft-editor','save-draft','deposit-mark','booking-cancel','booking-unit'])
  assert.match(html,new RegExp('<[a-z]+ id="'+id+'"[^>]*data-detail'),id+' is in the full view only');
 assert.doesNotMatch(html,/<button id="reject-draft"[^>]*data-detail/);
 assert.doesNotMatch(html,/<div id="next-step"[^>]*data-detail/);
});
