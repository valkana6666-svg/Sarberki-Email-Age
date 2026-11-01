import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudCaseRequest} from '../shared-core/cloud-case-request.mjs';
import {createCaseStoreClient} from '../shared-core/case-store-client.mjs';
test('cloud list GET matches established cookie client URL and JSON transport headers',async()=>{
 const calls=[];const request=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({result:[]})};};
 const csrfToken='synthetic-csrf';
 await createCloudCaseRequest({request})({csrfToken},{tenantId:'sarberki-test'},'GET');
 await createCaseStoreClient({request,cookieReadOnly:true,getCsrfToken:()=>csrfToken}).list('sarberki-test');
 const {signal,...httpOptions}=calls[0].options;
 assert.ok(signal instanceof AbortSignal);assert.equal(signal.aborted,false);
 assert.deepEqual({...calls[0],options:httpOptions},calls[1]);assert.equal(calls[0].options.body,undefined);
 assert.deepEqual(Object.fromEntries(new URL(calls[0].url,'https://test.invalid').searchParams),{tenantId:'sarberki-test'});
});
test('review POST keeps exact case version and CSRF without credential metadata leakage',async()=>{
 let captured;const input={tenantId:'sarberki-test',caseId:'case-synthetic',action:'review-draft',expectedRevision:1};
 const request=async(url,options)=>{captured={url,options};return {ok:true,json:async()=>({result:{revision:2}})};};
 assert.deepEqual(await createCloudCaseRequest({request})({csrfToken:'synthetic-csrf',access_token:'must-not-leak'},input),{revision:2});
 assert.equal(captured.options.method,'POST');assert.deepEqual(JSON.parse(captured.options.body),input);
 assert.equal(captured.options.headers['Content-Type'],'application/json');assert.ok(!JSON.stringify(captured).includes('must-not-leak'));
});
test('only the transient Gmail token header may be added; it never enters the body or URL',async()=>{
 const calls=[];const request=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({result:{caseId:'tm-abababababababab',revision:1}})};};
 const send=createCloudCaseRequest({request}),input={tenantId:'sarberki-test',action:'test-mailbox-ingest',messageId:'abababababababab'};
 await send({csrfToken:'synthetic-csrf'},input,'POST',{'X-Sarberki-Gmail-Token':'SYNTHETIC_TOKEN'});
 assert.equal(calls[0].options.headers['X-Sarberki-Gmail-Token'],'SYNTHETIC_TOKEN');assert.equal(calls[0].options.headers['X-CSRF-Token'],'synthetic-csrf');
 assert.deepEqual(JSON.parse(calls[0].options.body),input);assert.ok(!calls[0].url.includes('SYNTHETIC_TOKEN'));
 for(const extra of [{'X-CSRF-Token':'forged'},{Authorization:'Bearer x'},{'X-Sarberki-Gmail-Token':1}])
  await assert.rejects(send({csrfToken:'synthetic-csrf'},input,'POST',extra),/INVALID_INPUT/);
 assert.equal(calls.length,1);
});
