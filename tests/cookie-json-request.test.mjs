import test from 'node:test';
import assert from 'node:assert/strict';
import {createCookieJsonRequest} from '../shared-core/cookie-json-request.mjs';
function fixture(request){
 let fire,cleared=0;const calls=[];
 const send=createCookieJsonRequest({request:(...args)=>{calls.push(args);return request(...args);},setTimer:(fn,ms)=>{assert.equal(ms,15000);fire=fn;return 1;},clearTimer:id=>{assert.equal(id,1);cleared++;}});
 return {send,calls,timeout:()=>fire(),get cleared(){return cleared;}};
}
test('unresolved headers abort and release the request without exposing details or retrying',async()=>{
 const f=fixture(()=>new Promise(()=>{})),pending=f.send('/synthetic',{method:'POST',body:'fictional'});
 f.timeout();await assert.rejects(pending,e=>e.message==='SERVICE_UNAVAILABLE');
 assert.equal(f.calls.length,1);assert.equal(f.calls[0][1].signal.aborted,true);assert.equal(f.cleared,1);
});
test('unresolved JSON body is covered by the same deadline',async()=>{
 let reading=false;const f=fixture(async()=>({ok:true,status:200,json:()=>{reading=true;return new Promise(()=>{});}}));
 const pending=f.send('/synthetic');await Promise.resolve();assert.equal(reading,true);
 f.timeout();await assert.rejects(pending,/SERVICE_UNAVAILABLE/);assert.equal(f.calls[0][1].signal.aborted,true);
});
test('complete response preserves HTTP denial and cancels its deadline',async()=>{
 const f=fixture(async()=>({ok:false,status:403,json:async()=>({error:'FORBIDDEN'})}));
 const r=await f.send('/synthetic',{method:'GET',credentials:'same-origin'});
 assert.equal(r.ok,false);assert.equal(r.status,403);assert.deepEqual(await r.json(),{error:'FORBIDDEN'});
 assert.equal(f.cleared,1);assert.equal(f.calls[0][1].signal.aborted,false);
});
test('late write success cannot replace timeout, and the next explicit request may complete',async()=>{
 let release,count=0;const f=fixture(async()=>++count===1?new Promise(r=>release=r):{ok:true,status:200,json:async()=>({result:'fresh-read'})});
 const pending=f.send('/synthetic',{method:'POST'});f.timeout();await assert.rejects(pending,/SERVICE_UNAVAILABLE/);
 release({ok:true,status:200,json:async()=>({result:'late-write'})});await Promise.resolve();
 assert.equal(count,1,'timeout must not replay the write');
 assert.deepEqual(await (await f.send('/synthetic',{method:'GET'})).json(),{result:'fresh-read'});
 assert.equal(count,2);
});

function sharedLocks(){
 let tail=Promise.resolve();
 return {request(name,{mode,signal},callback){
  assert.equal(name,'sarberki-operator-cookie-request-v1');assert.equal(mode,'exclusive');
  const next=tail.then(()=>{if(signal.aborted)throw Error('ABORTED');return callback();});tail=next.catch(()=>{});return next;
 }};
}
test('independent UI transports share the cookie lock through complete JSON/rotation',async()=>{
 const lockManager=sharedLocks();let bodyReady,started=0;
 const first=createCookieJsonRequest({lockManager,request:async()=>{started++;return {ok:true,status:200,json:()=>new Promise(resolve=>bodyReady=resolve)};}});
 const second=createCookieJsonRequest({lockManager,request:async()=>{started++;return {ok:true,status:200,json:async()=>({second:true})};}});
 const a=first('/session'),b=second('/cases');await new Promise(r=>setImmediate(r));
 assert.equal(started,1);bodyReady({first:true});await Promise.all([a,b]);assert.equal(started,2);
});
test('timeout while waiting for another tab cancels queued request without network/retry',async()=>{
 const lockManager=sharedLocks();let release,fire,calls=0;
 const first=createCookieJsonRequest({lockManager,request:async()=>({ok:true,status:200,json:()=>new Promise(r=>release=r)})});
 const waiting=createCookieJsonRequest({lockManager,setTimer:fn=>{fire=fn;return 1;},clearTimer:()=>{},request:async()=>{calls++;throw Error('MUST_NOT_SEND');}});
 const a=first('/session');await new Promise(r=>setImmediate(r));
 const b=waiting('/cases');fire();await assert.rejects(b,/SERVICE_UNAVAILABLE/);
 release({});await a;await new Promise(r=>setImmediate(r));assert.equal(calls,0);
});
