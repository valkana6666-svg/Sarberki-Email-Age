import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudCaseRequest} from '../shared-core/cloud-case-request.mjs';

const tenantId='sarberki-test',caseId='case-transport-parity';
const metadata={csrfToken:'f'.repeat(64)};
const saved={tenantId,caseId,revision:9,data:{state:{approval:'pending'},drafts:[{text:'Kitalált, tárolt válasz',operatorReviewText:'Kitalált ellenőrző összefoglaló',synthetic:true,reviewStatus:'internal_review_required'}]}};
const getInput={tenantId,caseId,action:'review-record'};

// The daily and detailed UIs import this exact shared client; do not invent a second transport.
test('daily and detailed review use identical authenticated GET and readback',async()=>{
 const calls=[];
 const transport=createCloudCaseRequest({request:async(url,options)=>{
  calls.push({url,options});return Response.json({result:saved});
 }});
 const [daily,detailed]=await Promise.all([transport(metadata,getInput,'GET'),transport(metadata,getInput,'GET')]);
 assert.deepEqual(daily,detailed);assert.equal(daily.revision,9);
 assert.equal(daily.data.drafts.at(-1).text,'Kitalált, tárolt válasz');
 assert.equal(daily.data.drafts.at(-1).operatorReviewText,'Kitalált ellenőrző összefoglaló');
 assert.equal(calls.length,2);
 for(const {url,options} of calls){
  const target=new URL(url,'https://synthetic.invalid');
  assert.equal(target.pathname,'/.netlify/functions/booking-cases');
  assert.equal(target.searchParams.get('tenantId'),tenantId);
  assert.equal(target.searchParams.get('caseId'),caseId);
  assert.equal(target.searchParams.get('action'),'review-record');
  assert.equal(options.method,'GET');assert.equal(options.credentials,'same-origin');
  assert.equal(options.headers['X-CSRF-Token'],metadata.csrfToken);
  assert.equal(options.headers['X-Sarberki-Operator'],'1');
  assert.equal(options.body,undefined);
 }
});

test('authority denial fails both views without fallback or automatic retry',async()=>{
 let calls=0;
 const transport=createCloudCaseRequest({request:async()=>{calls++;return Response.json({error:'FORBIDDEN'},{status:403});}});
 await assert.rejects(transport(metadata,getInput,'GET'),/FORBIDDEN/);
 await assert.rejects(transport(metadata,getInput,'GET'),/FORBIDDEN/);
 assert.equal(calls,2);
});

test('GET never transmits a user-controlled draft or approval payload',async()=>{
 let seen;
 const transport=createCloudCaseRequest({request:async(url,options)=>{seen={url,options};return Response.json({result:saved});}});
 await transport(metadata,getInput,'GET');
 assert.equal(seen.options.body,undefined);
 assert.ok(!seen.url.includes('Kitalált'));
});

test('expired login and stale revision fail closed without implicit retries',async()=>{
 for(const [status,error] of [[401,'AUTH_REQUIRED'],[409,'CASE_CONFLICT']]){
  let calls=0;
  const transport=createCloudCaseRequest({request:async()=>{calls++;return Response.json({error},{status});}});
  await assert.rejects(transport(metadata,getInput,'GET'),new RegExp(error));
  assert.equal(calls,1);
 }
});

test('malformed JSON and server failures cannot be mistaken for a persisted draft',async()=>{
 let calls=0;
 const malformed=createCloudCaseRequest({request:async()=>{calls++;return new Response('{invalid',{headers:{'Content-Type':'application/json'}});}});
 await assert.rejects(malformed(metadata,getInput,'GET'),SyntaxError);
 assert.equal(calls,1);
 const unavailable=createCloudCaseRequest({request:async()=>Response.json({error:'SERVICE_UNAVAILABLE'},{status:503})});
 await assert.rejects(unavailable(metadata,getInput,'GET'),/SERVICE_UNAVAILABLE/);
});
