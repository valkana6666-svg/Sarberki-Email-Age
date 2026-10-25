import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../netlify/functions/pushover-gmail.mjs';
const origin='https://leafy-chimera-2403e5.netlify.app';
const request=()=>new Request(origin+'/api/pushover-gmail',{method:'POST',headers:{origin,'content-type':'application/json',authorization:'Bearer synthetic'},body:JSON.stringify({event:'gmail-new-message',messageId:'19abcdef12345'})});
for(const stage of ['profile','message'])for(const failure of ['headers-timeout','body-timeout','invalid-json','network'])test(`Gmail ${stage} ${failure} terminates before claim or push`,async()=>{
 let claims=0,pushes=0,attempts=0,signal;
 const handler=createHandler({gmailTimeoutMs:5,env:{PUSHOVER_ENABLED:'true'},ledger:{claimOnce:async()=>{claims++;}},send:async(url,options)=>{
  if(url.startsWith('https://api.pushover.net/')){pushes++;assert.fail('unexpected push');}
  const current=url.endsWith('/profile')?'profile':'message';
  if(current!==stage)return Response.json({emailAddress:'sarberkiprojecttest@gmail.com'});
  attempts++;signal=options.signal;assert.equal(options.redirect,'error');
  if(failure==='headers-timeout')return new Promise(()=>{});
  if(failure==='body-timeout')return {ok:true,json:()=>new Promise(()=>{})};
  if(failure==='invalid-json')return {ok:true,json:async()=>{throw Error('synthetic parsing detail');}};
  throw Error('synthetic network detail');
 }});
 const response=await handler(request(),{site:{name:'leafy-chimera-2403e5'}});
 assert.equal(response.status,503);assert.deepEqual(await response.json(),{ok:false,code:'GMAIL_UNAVAILABLE',deliveryUnknown:false});
 assert.equal(claims,0);assert.equal(pushes,0);assert.equal(attempts,1);
 if(failure.endsWith('timeout'))assert.equal(signal.aborted,true);
});
test('Gmail timeout configuration is bounded',()=>{
 for(const gmailTimeoutMs of [0,-1,15001,NaN,'5'])assert.throws(()=>createHandler({gmailTimeoutMs}),/INVALID_GMAIL_TIMEOUT/);
});
test('successful Gmail timers are cleared before slower ledger/provider work',async()=>{
 const signals=[];let pushes=0,claims=0;
 const handler=createHandler({gmailTimeoutMs:5,env:{PUSHOVER_ENABLED:'true',PUSHOVER_API_TOKEN:'a'.repeat(30),PUSHOVER_USER_KEY:'u'.repeat(30)},ledger:{claimOnce:async()=>{claims++;return {status:'claimed',claimId:'12345678-1234-4123-8123-123456789abc'};},markSent:async()=>true,markUnknown:async()=>true},send:async(url,options)=>{
  if(url.startsWith('https://gmail.googleapis.com/')){signals.push(options.signal);return Response.json(url.endsWith('/profile')?{emailAddress:'sarberkiprojecttest@gmail.com'}:{id:'19abcdef12345',internalDate:String(Date.parse('2026-10-05T16:30:00Z')),labelIds:['INBOX'],payload:{headers:[]}});}
  pushes++;await new Promise(resolve=>setTimeout(resolve,15));return Response.json({status:1,request:'synthetic-receipt'});
 }});
 const response=await handler(request(),{site:{name:'leafy-chimera-2403e5'}});assert.equal(response.status,200);assert.equal(claims,1);assert.equal(pushes,1);assert.equal(signals.length,2);assert.ok(signals.every(signal=>!signal.aborted));
});
