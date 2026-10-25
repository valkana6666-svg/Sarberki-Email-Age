import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../netlify/functions/pushover-gmail.mjs';

// Characterization only: this documents the EXISTING duplicate-send hazard.
// It does not assert that server-side deduplication is implemented or safe.
const origin = 'https://leafy-chimera-2403e5.netlify.app';
const context = {site:{name:'leafy-chimera-2403e5'}};
const env = {PUSHOVER_USER_KEY:'u'.repeat(30),PUSHOVER_API_TOKEN:'a'.repeat(30)};
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
  return {handler:createHandler({env,send}),pushCalls:()=>pushCalls};
}
test('SAFETY GAP: repeated valid message IDs currently cause repeated push requests',async()=>{
  const {handler,pushCalls}=harness();
  const first=await handler(makeRequest(),context),second=await handler(makeRequest(),context);
  assert.equal(first.status,200);
  assert.equal(second.status,200);
  assert.equal(pushCalls(),2,'Current implementation does not offer server-side idempotency');
});
test('SAFETY GAP: concurrent valid requests both reach provider',async()=>{
  const {handler,pushCalls}=harness();
  const responses=await Promise.all([handler(makeRequest(),context),handler(makeRequest(),context)]);
  assert.deepEqual(responses.map(r=>r.status),[200,200]);
  assert.equal(pushCalls(),2,'No atomic server-side delivery claim exists yet');
});
