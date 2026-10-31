import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createIsolatedApprovalReview} from '../shared-core/isolated-approval-review.mjs';

const caseId='case-parity-synthetic', tenantId='sarberki-test';
const original='Kitalált, ellenőrzésre váró választervezet';
const reviewText='Szintetikus magyar ellenőrző összefoglaló';
function storeFixture(){
 let revision=4, text=original, state='pending';
 const reads=[];
 const client={
  async get(tenant,id){
   assert.equal(tenant,tenantId);assert.equal(id,caseId);reads.push(revision);
   return {tenantId,caseId,revision,data:{state:{approval:state},drafts:[{text,operatorReviewText:reviewText,synthetic:true,reviewStatus:'internal_review_required'}]}};
  },
  async approve(_tenant,_id,expectedRevision,draftHash){
   if(expectedRevision!==revision)throw Error('CASE_CONFLICT');
   revision++;state='internally_approved';
   return {tenantId,caseId,revision,data:{state:{approval:state},serverApproval:{draftHash,reviewedRevision:expectedRevision}}};
  }
 };
 return {client,reads,edit(newText){text=newText;revision++;state='pending';}};
}
function view(client){return createIsolatedApprovalReview({client,enabled:true,cryptoProvider:webcrypto});}

test('two independent operator views read identical persisted draft, version and review hash',async()=>{
 const f=storeFixture(),daily=view(f.client),detailed=view(f.client);
 const [a,b]=await Promise.all([daily.load(caseId),detailed.load(caseId)]);
 assert.equal(a.text,original);assert.equal(b.text,a.text);
 assert.equal(a.revision,b.revision);assert.equal(a.hash,b.hash);
 assert.equal(a.operatorReviewText,b.operatorReviewText);
 assert.deepEqual(f.reads,[4,4]);
});

test('editing shared case makes stale independent approval fail closed',async()=>{
 const f=storeFixture(),daily=view(f.client),detailed=view(f.client);
 const stale=await daily.load(caseId);await detailed.load(caseId);
 f.edit('Javított, szintetikus tervezet');
 await assert.rejects(daily.approve({caseId,revision:stale.revision,reviewedText:stale.text,confirmed:true}),/CASE_CONFLICT/);
 await assert.rejects(daily.approve({caseId,revision:stale.revision,reviewedText:stale.text,confirmed:true}),/REVIEW_REQUIRED/);
 const current=await detailed.load(caseId);
 assert.equal(current.revision,5);assert.equal(current.text,'Javított, szintetikus tervezet');
 assert.notEqual(current.hash,stale.hash);
});

test('different tenant is rejected and does not grant review authority',async()=>{
 const f=storeFixture();const wrong={...f.client,get:async()=>({...await f.client.get(tenantId,caseId),tenantId:'other-tenant'})};
 await assert.rejects(view(wrong).load(caseId),/INVALID_DRAFT/);
});
