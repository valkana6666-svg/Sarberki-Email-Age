import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudCaseRequest} from '../shared-core/cloud-case-request.mjs';

const metadata={csrfToken:'a'.repeat(64)};
const tenantId='sarberki-test';
const cases=[
 {tenantId,caseId:'case-list-one',revision:3,category:'incoming'},
 {tenantId,caseId:'case-list-two',revision:4,category:'approval'}
];

test('daily-list reads stored synthetic categories with same protected transport as review-record',async()=>{
 const calls=[];
 const transport=createCloudCaseRequest({request:async(url,options)=>{
  calls.push({url,options});
  const action=new URL(url,'https://synthetic.invalid').searchParams.get('action');
  return Response.json({result:action==='daily-list'?cases:{tenantId,caseId:'case-list-one',revision:3,data:{state:{approval:'pending'},drafts:[]}}});
 }});
 const rows=await transport(metadata,{tenantId,action:'daily-list'},'GET');
 const record=await transport(metadata,{tenantId,caseId:'case-list-one',action:'review-record'},'GET');
 assert.equal(rows[0].revision,record.revision);
 assert.equal(rows[0].caseId,record.caseId);
 assert.equal(rows[1].category,'approval');
 for(const {url,options} of calls){
  const u=new URL(url,'https://synthetic.invalid');
  assert.equal(u.pathname,'/.netlify/functions/booking-cases');
  assert.equal(u.searchParams.get('tenantId'),tenantId);
  assert.equal(options.method,'GET');
  assert.equal(options.credentials,'same-origin');
  assert.equal(options.headers['X-CSRF-Token'],metadata.csrfToken);
  assert.equal(options.body,undefined);
 }
});

test('daily-list permission failure never falls back to fabricated local case rows',async()=>{
 let calls=0;
 const transport=createCloudCaseRequest({request:async()=>{calls++;return Response.json({error:'FORBIDDEN'},{status:403});}});
 await assert.rejects(transport(metadata,{tenantId,action:'daily-list'},'GET'),/FORBIDDEN/);
 assert.equal(calls,1);
});

test('daily-list server unavailability is not interpreted as an empty successful list',async()=>{
 const transport=createCloudCaseRequest({request:async()=>Response.json({error:'SERVICE_UNAVAILABLE'},{status:503})});
 await assert.rejects(transport(metadata,{tenantId,action:'daily-list'},'GET'),/SERVICE_UNAVAILABLE/);
});
