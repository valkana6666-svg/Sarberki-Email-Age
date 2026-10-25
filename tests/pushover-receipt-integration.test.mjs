import test from 'node:test';import assert from 'node:assert/strict';
import {createPushoverDeliveryCoordinator} from '../shared-core/pushover-delivery-coordinator.mjs';
import {createPushoverLedger} from '../netlify/functions/_shared/pushover-ledger.mjs';
const key={tenantId:'sarberki-test',mailbox:'sarberkiprojecttest@gmail.com',messageId:'19abcdef12345',notificationType:'gmail-new-message'},claim='12345678-1234-4123-8123-123456789abc';
for(const receipt of ['synthetic-provider-receipt',null])test('coordinator RPC receipt roundtrip '+receipt,async()=>{
 let claimed=false,sends=0,stored=null,unknown=0;
 const ledger=createPushoverLedger({rpc:async(name,args)=>{
 if(name==='sc_pushover_claim_once'){if(claimed)return{data:{status:'duplicate'}};claimed=true;return{data:{status:'claimed',claimId:claim}};}
 if(name==='sc_pushover_mark_sent'){stored=args.p_provider_request_id;return{data:true};}
 if(name==='sc_pushover_mark_unknown'){unknown++;return{data:true};}assert.fail('unexpected RPC');}});
 const c=createPushoverDeliveryCoordinator({enabled:true,ledger,sender:async()=>{sends++;return{accepted:true,requestId:receipt};}});
 const result=await c.process(key);assert.equal(result.status,receipt?'accepted':'review');assert.equal(result.deliveryConfirmed,false);assert.equal(stored,receipt);assert.equal(unknown,receipt?0:1);
 await c.process(key);assert.equal(sends,1);
});
