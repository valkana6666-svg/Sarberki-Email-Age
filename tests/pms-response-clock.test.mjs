import test from 'node:test';
import assert from 'node:assert/strict';
import {createReadOnlyPmsAdapter} from '../shared-core/pms-adapter.mjs';
const query={arrival:'2026-10-23',departure:'2026-10-25',cabin:'deluxe'};
const raw=(count,checkedAt)=>({...query,tenantId:'sarberki',source:'synthetic-clock',checkedAt,availability:count>0?'available':'unavailable',availableUnits:count});
const adapter=fetchAvailability=>createReadOnlyPmsAdapter({id:'clock-fixture',tenantId:'sarberki',fetchAvailability,fetchQuote:()=>{throw Error('unused');}});
test('response timestamp is evaluated after the asynchronous provider completes',async()=>{
 const realNow=Date.now;let clock=Date.parse('2026-10-11T12:00:00Z');
 Date.now=()=>clock;
 try{
  const a=adapter(async()=>{await Promise.resolve();clock+=50;return raw(2,new Date(clock).toISOString());});
  const result=await a.getVerifiedAvailability(query,{tenantId:'sarberki'});
  assert.equal(result.status,'AVAILABLE');assert.equal(result.availableUnits,2);
 }finally{Date.now=realNow;}
});
test('explicit clock remains exact; future, stale, zero and failures remain distinct',async()=>{
 const now=Date.parse('2026-10-11T12:00:00Z');
 for(const [count,offset,status,units] of [[2,1,'UNKNOWN',null],[2,-120001,'UNKNOWN',null],[0,0,'UNAVAILABLE',0],[2,0,'AVAILABLE',2]]){
  const a=adapter(async()=>raw(count,new Date(now+offset).toISOString()));
  const r=await a.getVerifiedAvailability(query,{tenantId:'sarberki',now});
  assert.equal(r.status,status);assert.equal(r.availableUnits,units);
 }
 const failed=await adapter(async()=>{throw Error('synthetic failure');}).getVerifiedAvailability(query,{tenantId:'sarberki',now});
 assert.equal(failed.status,'UNKNOWN');assert.equal(failed.availableUnits,null);
});
