import test from 'node:test';
import assert from 'node:assert/strict';
import {createPushoverDeliveryCoordinator} from '../shared-core/pushover-delivery-coordinator.mjs';
const identity={tenantId:'sarberki-test',mailbox:'sarberkiprojecttest@gmail.com',messageId:'19abcdef12345',notificationType:'gmail-new-message'};
for(const unknownResult of [true,false])test('false markSent never reports accepted; unknown transition '+unknownResult,async()=>{
 let sends=0,claimed=false;
 const ledger={async claimOnce(){if(claimed)return {status:'duplicate'};claimed=true;return{status:'claimed',claimId:'synthetic-claim'};},async markSent(){return false;},async markUnknown(){return unknownResult;}};
 const c=createPushoverDeliveryCoordinator({enabled:true,ledger,sender:async()=>{sends++;return{accepted:true};}});
 const first=await c.process(identity);
 assert.equal(first.status,'review');assert.equal(first.deliveryConfirmed,false);
 assert.equal(first.code,unknownResult?'SENT_BUT_RECORD_FAILED':'LEDGER_TRANSITION_FAILED');
 assert.equal((await c.process(identity)).status,'suppressed');assert.equal(sends,1);
});
