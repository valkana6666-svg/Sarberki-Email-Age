import test from 'node:test';
import assert from 'node:assert/strict';
import {createEpochRequestQueue} from '../shared-core/epoch-request-queue.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('queued old approval never executes under the next operator session',async()=>{
 let epoch=1,authenticated=true;const gate=deferred(),started=deferred(),calls=[];
 const request=createEpochRequestQueue({getEpoch:()=>epoch,isAuthenticated:()=>authenticated,
  prepare:async()=>{started.resolve();await gate.promise;return {csrf:'old-session'};},
  execute:async(context,action)=>{calls.push(action);return context;}});
 const first=request('readback');const firstRejected=assert.rejects(first,/SESSION_CHANGED/);
 await started.promise;
 const queued=request('approve');const queuedRejected=assert.rejects(queued,/SESSION_CHANGED/);
 authenticated=false;epoch++;authenticated=true;epoch++;gate.resolve();
 await Promise.all([firstRejected,queuedRejected]);assert.deepEqual(calls,[]);
});
test('response completing after logout cannot become a verified approval',async()=>{
 let epoch=1,authenticated=true;const gate=deferred(),started=deferred();let calls=0;
 const request=createEpochRequestQueue({getEpoch:()=>epoch,isAuthenticated:()=>authenticated,
  prepare:async()=>({csrf:'current'}),execute:async()=>{calls++;started.resolve();await gate.promise;return {approved:true};}});
 const pending=request('approve'),rejected=assert.rejects(pending,/SESSION_CHANGED/);
 await started.promise;authenticated=false;epoch++;gate.resolve();await rejected;assert.equal(calls,1);
});
test('current session operations execute serially and return their verified result',async()=>{
 let active=0;const calls=[];
 const request=createEpochRequestQueue({getEpoch:()=>1,isAuthenticated:()=>true,prepare:async()=>({csrf:'current'}),
  execute:async(context,value)=>{assert.equal(active++,0);await Promise.resolve();calls.push(value);active--;return value;}});
 assert.deepEqual(await Promise.all([request('prepare'),request('read'),request('approve')]),['prepare','read','approve']);
 assert.deepEqual(calls,['prepare','read','approve']);
});
