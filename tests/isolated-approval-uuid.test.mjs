import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createIsolatedApprovalReview} from '../shared-core/isolated-approval-review.mjs';
import {createCaseStoreClient} from '../shared-core/case-store-client.mjs';
const id='8b9597a1-c72d-4fde-9ef4-610d6865a3a3';
const stored={tenantId:'sarberki-test',caseId:id,revision:2,data:{state:{approval:'pending'},drafts:[{text:'Stored synthetic UUID draft',synthetic:true,reviewStatus:'internal_review_required'}]}};
test('server-generated UUID uses the existing authenticated persisted-draft approval chain',async()=>{
 const calls=[];const client=createCaseStoreClient({getAccessToken:async()=> 'synthetic-token',isolatedApproval:true,approvalTarget:'https://isolated-approval.supabase.co',request:async(url,options)=>{
  calls.push({url,options});if(options.method==='GET')return {ok:true,json:async()=>({result:stored})};
  const input=JSON.parse(options.body);return {ok:true,json:async()=>({result:{...stored,revision:3,data:{state:{approval:'internally_approved'},serverApproval:{reviewedRevision:2,draftHash:input.reviewedDraftHash}}}})};
 }});
 const bridge=createIsolatedApprovalReview({client,enabled:true,cryptoProvider:webcrypto});const reviewed=await bridge.load(id);await bridge.approve({...reviewed,reviewedText:reviewed.text,confirmed:true});assert.equal(calls.length,2);assert.equal(JSON.parse(calls[1].options.body).caseId,id);
});
test('UUID syntax cannot substitute for a stored synthetic draft or tenant authority',async()=>{
 for(const change of [r=>r.tenantId='demo-test',r=>r.data.drafts[0].synthetic=false]){
  const record=structuredClone(stored);change(record);
  const bridge=createIsolatedApprovalReview({client:{get:async()=>record,approve:()=>assert.fail('approval forbidden')},enabled:true,cryptoProvider:webcrypto});await assert.rejects(bridge.load(id),/INVALID_DRAFT/);
 }
});
test('email and malformed UUID never trigger a draft fetch',async()=>{
 const bridge=createIsolatedApprovalReview({client:{get:()=>assert.fail('fetch forbidden')},enabled:true,cryptoProvider:webcrypto});for(const invalid of ['guest@example.invalid',id+'x',id+'\n','../'+id])await assert.rejects(bridge.load(invalid),/INVALID_INPUT/);
});
