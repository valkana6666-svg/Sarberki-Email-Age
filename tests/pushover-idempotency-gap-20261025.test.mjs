import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../netlify/functions/pushover-gmail.mjs';

// Regression for the former duplicate-send hazard; synthetic atomic ledger only.
const origin = 'https://leafy-chimera-2403e5.netlify.app';
const context = {site:{name:'leafy-chimera-2403e5'}};
const env = {PUSHOVER_ENABLED:'true',PUSHOVER_USER_KEY:'u'.repeat(30),PUSHOVER_API_TOKEN:'a'.repeat(30)};
const messageId = '19abcdef12345';
const makeRequest = () => new Request(origin+'/api/pushover-gmail',{
  method:'POST',
  headers:{origin,'content-type':'application/json',authorization:'Bearer synthetic-test-token'},
  body:JSON.stringify({event:'gmail-new-message',messageId})
});
function harness(){
  let pushCalls=0;
  const send=async (url)=>{
    if(url.endsWith('/profile'))return Response.json({emailAddress:'sarberkiprojecttest@gmail.com'});
    if(url.includes('/messages/'))return Response.json({
      id:messageId,internalDate:String(Date.parse('2026-10-05T16:30:00Z')),
      labelIds:['INBOX'],payload:{headers:[{name:'Subject',value:'Synthetic inquiry'}]}
    });
    if(url==='https://api.pushover.net/1/messages.json'){
      pushCalls++;
      return Response.json({status:1,request:'synthetic-request-'+pushCalls});
    }
    throw Error('Unexpected external request in synthetic test');
  };
  let claimed=false;
  const ledger={async claimOnce(){if(claimed)return{status:'duplicate'};claimed=true;return{status:'claimed',claimId:'synthetic-claim'};},async markSent(){return true;},async markUnknown(){return true;}};
  return {handler:createHandler({env,send,ledger}),pushCalls:()=>pushCalls};
}
test('Repeated valid message IDs share one notification claim',async()=>{
  const {handler,pushCalls}=harness();
  const first=await handler(makeRequest(),context),second=await handler(makeRequest(),context);
  assert.equal(first.status,200);
  assert.equal(second.status,200);
  assert.equal(pushCalls(),1,'Repeated notification must be suppressed');
});
test('Concurrent valid requests share one notification claim',async()=>{
  const {handler,pushCalls}=harness();
  const responses=await Promise.all([handler(makeRequest(),context),handler(makeRequest(),context)]);
  assert.deepEqual(responses.map(r=>r.status),[200,200]);
  assert.equal(pushCalls(),1,'Concurrent notification must be suppressed');
});
