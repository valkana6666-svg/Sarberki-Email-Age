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
 // Owner 2026-11-15: after the Previo booking the rest is done in Previo - no letter, no deposit button here.
 const h=nextStepFor({...booked,booking:{status:'finalized',unit:'12'},canMarkDeposit:true},{sendable:true});
 assert.equal(h.kind,'handoff');assert.equal(h.label,null);assert.match(h.info,/rögzítve a Previóban \(12\. egység\).*voucher, díjbekérő/);
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

test('owner test 2026-11-18 (Nagy Márton): an unpriced pending reply asks for the price before approval',()=>{
 assert.equal(nextStepFor({approval:'pending',canDecide:true,priceable:true},{sendable:true}).kind,'price');
 assert.equal(nextStepFor({approval:'pending',canDecide:true,priceable:false},{sendable:true}).kind,'approveSend');
 assert.equal(nextStepFor({approval:'approved_internal',priceable:true},{sendable:true}).kind,'send');
});

test('owner test 2026-11-18: a chat/phone intake is a booking request → the booking step comes first',async()=>{
 const {caseBookingIntent}=await import('../shared-core/booking-intent.mjs');
 const one=[{text:'Van szabad családi faház május 14-17?'}];
 assert.equal(caseBookingIntent(one,null,'chat'),'chates foglalási igény');
 assert.equal(caseBookingIntent(one,null,'phone'),'telefonos foglalási igény');
 assert.equal(caseBookingIntent(one,null,'gmail'),null); // a first e-mail inquiry is interest, not a booking
 assert.equal(caseBookingIntent(one,'finalized','chat'),null);
 assert.equal(caseBookingIntent(one,'cancelled','chat'),null);
 const rec={approval:'pending',canDecide:true,priceable:true,canOneClick:true,bookingIntent:caseBookingIntent(one,null,'chat')};
 assert.equal(nextStepFor(rec,{sendable:true}).kind,'book');
});

test('owner 2026-11-19: with a guest e-mail the booking step is one approval (Previo + letter)',()=>{
 const r={canOneClick:true,bookingIntent:'chates foglalási igény',approval:'pending'};
 assert.deepEqual(nextStepFor(r,{sendable:true}),{kind:'book',label:'Foglalás jóváhagyása',ask:null,send:true});
 assert.equal(nextStepFor(r,{sendable:false}).send,undefined);
});
