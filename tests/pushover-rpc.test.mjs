import test from 'node:test';import assert from 'node:assert/strict';
import {createPushoverRpc} from '../netlify/functions/_shared/pushover-rpc.mjs';
const url='https://mojnqizbcaczstguikpv.supabase.co',key='synthetic-server-credential';
test('RPC is pinned to test project and exact operation allowlist',async()=>{
 assert.throws(()=>createPushoverRpc({url:'https://other.invalid',key}));
 const rpc=createPushoverRpc({url,key,send:async(u,o)=>{assert.equal(u,url+'/rest/v1/rpc/sc_pushover_mark_unknown');assert.equal(o.redirect,'error');assert.equal(o.headers.authorization,'Bearer '+key);return Response.json(false);}});
 assert.deepEqual(await rpc('sc_pushover_mark_unknown',{p_claim:'synthetic'}),{data:false,error:null});
 await assert.rejects(rpc('arbitrary_sql',{}));
});
test('network and provider errors never leak credentials or retry',async()=>{
 for(const send of [async()=>{throw Error(key);},async()=>new Response(key,{status:401}),async()=>new Response('invalid-json')]){
 let calls=0;const rpc=createPushoverRpc({url,key,send:(...a)=>{calls++;return send(...a);}});
 await assert.rejects(rpc('sc_pushover_mark_unknown',{}),e=>e.message==='RPC_UNAVAILABLE');assert.equal(calls,1);
 }
});
test('timeout aborts once without retry',async()=>{
 let signal,calls=0;const rpc=createPushoverRpc({url,key,timeoutMs:5,send:async(_,o)=>{calls++;signal=o.signal;return new Promise(()=>{});}});
 await assert.rejects(rpc('sc_pushover_mark_unknown',{}));assert.equal(calls,1);assert.equal(signal.aborted,true);
});
