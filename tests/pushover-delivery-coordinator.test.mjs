import test from 'node:test';
import assert from 'node:assert/strict';
import {createPushoverDeliveryCoordinator} from '../shared-core/pushover-delivery-coordinator.mjs';

const identity={tenantId:'sarberki-test',mailbox:'sarberkiprojecttest@gmail.com',messageId:'19abcdef12345',notificationType:'gmail-new-message'};
function syntheticLedger(){
 const records=new Map();let n=0;
 const lookup=k=>JSON.stringify(k);
 return {
  records,
  async claimOnce(k) {
   const key=lookup(k);
   if(records.has(key))return {status:'duplicate'};
   const claimId='claim-'+(++n);
   records.set(key,{status:'sending',claimId});
   return {status:'claimed',claimId};
  },
  async markSent(k,receipt){
   const record=records.get(lookup(k));
   if(record?.status!=='sending'||record.claimId!==receipt)throw Error('stale claim');
   record.status='sent';
  },
  async markUnknown(k,receipt){
   const record=records.get(lookup(k));
   if(record?.status!=='sending'||record.claimId!==receipt)throw Error('stale claim');
   record.status='outcome_unknown';
  }
 };
}
test('disabled by default and never calls sender or ledger',async()=>{
 let calls=0;
 const gate=createPushoverDeliveryCoordinator({ledger:syntheticLedger(),sender:async()=>{calls++;return {accepted:true};}});
 assert.deepEqual(await gate.process(identity),{status:'disabled',code:'NOT_ENABLED',deliveryConfirmed:false});
 assert.equal(calls,0);
});
test('two sequential requests only call synthetic sender once',async()=>{
 const ledger=syntheticLedger();let calls=0;
 const gate=createPushoverDeliveryCoordinator({ledger,enabled:true,sender:async()=>{calls++;return {accepted:true};}});
 const first=await gate.process(identity),second=await gate.process(identity);
 assert.equal(first.status,'accepted');assert.equal(first.deliveryConfirmed,false);
 assert.equal(second.status,'suppressed');assert.equal(calls,1);
 assert.equal([...ledger.records.values()][0].status,'sent');
});
test('two parallel requests share a single simulated atomic claim',async()=>{
 const ledger=syntheticLedger();let calls=0;
 const gate=createPushoverDeliveryCoordinator({ledger,enabled:true,sender:async()=>{calls++;await Promise.resolve();return {accepted:true};}});
 const results=await Promise.all([gate.process(identity),gate.process(identity)]);
 assert.deepEqual(results.map(x=>x.status).sort(),['accepted','suppressed']);
 assert.equal(calls,1);
});
test('uncertain provider outcome blocks all retries',async()=>{
 const ledger=syntheticLedger();let calls=0;
 const gate=createPushoverDeliveryCoordinator({ledger,enabled:true,sender:async()=>{calls++;throw Error('lost provider response');}});
 assert.equal((await gate.process(identity)).code,'PROVIDER_OUTCOME_UNKNOWN');
 assert.equal((await gate.process(identity)).status,'suppressed');
 assert.equal([...ledger.records.values()][0].status,'outcome_unknown');
 assert.equal(calls,1);
});
test('provider acceptance followed by ledger error requires manual review, never retry',async()=>{
 const ledger=syntheticLedger();
 ledger.markSent=async()=>{throw Error('db timeout');};
 let calls=0;
 const gate=createPushoverDeliveryCoordinator({ledger,enabled:true,sender:async()=>{calls++;return {accepted:true};}});
 assert.equal((await gate.process(identity)).code,'SENT_BUT_RECORD_FAILED');
 assert.equal((await gate.process(identity)).status,'suppressed');
 assert.equal(calls,1);
});
test('invalid tenant, mailbox and notification type cannot send',async()=>{
 let calls=0;
 const gate=createPushoverDeliveryCoordinator({enabled:true,ledger:syntheticLedger(),sender:async()=>{calls++;return {accepted:true};}});
 for(const bad of [{...identity,tenantId:'../bad'},{...identity,mailbox:'other@gmail.com'},{...identity,notificationType:'booking-confirmation'},{...identity,guestEmail:'personal@example.com'},null]){
  assert.equal((await gate.process(bad)).status,'blocked');
 }
 assert.equal(calls,0);
});
test('missing ledger blocks dispatch even when enabled',async()=>{
 let calls=0;
 const gate=createPushoverDeliveryCoordinator({enabled:true,sender:async()=>{calls++;return {accepted:true};}});
 assert.equal((await gate.process(identity)).code,'LEDGER_OR_SENDER_MISSING');
 assert.equal(calls,0);
});
