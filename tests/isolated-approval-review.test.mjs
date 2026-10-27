import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {createCaseStoreClient} from '../shared-core/case-store-client.mjs';
import {createIsolatedApprovalReview} from '../shared-core/isolated-approval-review.mjs';
const text='Szintetikus tervezet – 120 000 Ft',hash=createHash('sha256').update(text).digest('hex');
const record=()=>({tenantId:'sarberki-test',caseId:'case-review',revision:2,data:{state:{approval:'pending'},drafts:[{text,synthetic:true,reviewStatus:'internal_review_required'}]}});
const approved=()=>({...record(),revision:3,data:{...record().data,state:{approval:'internally_approved'},serverApproval:{draftHash:hash,reviewedRevision:2}}});
function fixture({get=async()=>record(),approve=async()=>approved()}={}){
 const calls=[];const client={get:async(...args)=>{calls.push(['get',...args]);return get(...args);},approve:async(...args)=>{calls.push(['approve',...args]);return approve(...args);}};
 return {calls,review:createIsolatedApprovalReview({client,enabled:true,cryptoProvider:webcrypto})};
}
test('default gates reject approval without token lookup or network',async()=>{
 const client=createCaseStoreClient({getAccessToken:()=>assert.fail('token'),request:()=>assert.fail('network')});
 await assert.rejects(client.approve('sarberki-test','case-review',2,hash),/SETUP_REQUIRED/);
 const review=createIsolatedApprovalReview({client});await assert.rejects(review.load('case-review'),/SETUP_REQUIRED/);
 const source=createCaseStoreClient({isolatedApproval:true,approvalTarget:'https://mojnqizbcaczstguikpv.supabase.co',getAccessToken:()=>assert.fail('token')});
 await assert.rejects(source.approve('sarberki-test','case-review',2,hash),/SETUP_REQUIRED/);
});
test('approved request contains only persisted version and exact reviewed hash',async()=>{
 const calls=[];const client=createCaseStoreClient({isolatedApproval:true,approvalTarget:'https://isolated-approval.supabase.co',getAccessToken:async()=> 'synthetic-token',request:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({result:options.method==='GET'?record():approved()})};}});
 const review=createIsolatedApprovalReview({client,enabled:true,cryptoProvider:webcrypto}),loaded=await review.load('case-review');
 assert.equal(loaded.hash,hash);assert.equal(loaded.text,text);
 const result=await review.approve({caseId:loaded.caseId,revision:loaded.revision,reviewedText:loaded.text,confirmed:true});assert.equal(result.revision,3);
 assert.deepEqual(JSON.parse(calls[1].options.body),{action:'approve',tenantId:'sarberki-test',caseId:'case-review',expectedRevision:2,reviewedDraftHash:hash});
 assert.equal(calls[1].options.headers.Authorization,'Bearer synthetic-token');
 await assert.rejects(review.approve({caseId:'case-review',revision:2,reviewedText:text,confirmed:true}),/REVIEW_REQUIRED/);
});
test('preview, non-synthetic draft, wrong tenant and approved state cannot be reviewed',async()=>{
 for(const change of [r=>delete r.data.drafts,r=>r.data.drafts[0].synthetic=false,r=>r.tenantId='demo-test',r=>r.data.state.approval='internally_approved']){
  const f=fixture({get:async()=>{const r=record();change(r);return r;}});await assert.rejects(f.review.load('case-review'),/INVALID_DRAFT/);assert.equal(f.calls.length,1);
 }
});
test('edited text, different case/version and missing confirmation cannot write',async()=>{
 const f=fixture();await f.review.load('case-review');
 const good={caseId:'case-review',revision:2,reviewedText:text,confirmed:true};
 for(const change of [{reviewedText:text+' '},{caseId:'case-other'},{revision:3},{confirmed:false}])await assert.rejects(f.review.approve({...good,...change}),/REVIEW_REQUIRED/);
 assert.equal(f.calls.length,1);
});
test('CAS failure or invalid response invalidates review and prevents retry writes',async()=>{
 for(const approve of [async()=>{throw Error('CASE_CONFLICT');},async()=>({...approved(),revision:4})]){
  const f=fixture({approve});await f.review.load('case-review');const input={caseId:'case-review',revision:2,reviewedText:text,confirmed:true};
  await assert.rejects(f.review.approve(input),/CASE_CONFLICT|INVALID_APPROVAL_RESPONSE/);
  await assert.rejects(f.review.approve(input),/REVIEW_REQUIRED/);assert.equal(f.calls.filter(x=>x[0]==='approve').length,1);
 }
});
test('concurrent approval submits one write and blocks competing load',async()=>{
 let release;const f=fixture({approve:()=>new Promise(resolve=>{release=resolve;})});await f.review.load('case-review');
 const input={caseId:'case-review',revision:2,reviewedText:text,confirmed:true},first=f.review.approve(input);
 await assert.rejects(f.review.approve(input),/REVIEW_BUSY/);await assert.rejects(f.review.load('case-other'),/REVIEW_BUSY/);
 release(approved());await first;assert.equal(f.calls.filter(x=>x[0]==='approve').length,1);
});
test('clearing a pending load cannot resurrect review permission',async()=>{
 let release;const f=fixture({get:()=>new Promise(resolve=>{release=resolve;})});
 const pending=f.review.load('case-review');f.review.clear();release(record());
 await assert.rejects(pending,/REVIEW_CANCELLED/);
 await assert.rejects(f.review.approve({caseId:'case-review',revision:2,reviewedText:text,confirmed:true}),/REVIEW_REQUIRED/);
});
test('HTTP authority denial is preserved without retry or local approval',async()=>{
 const calls=[];const client=createCaseStoreClient({isolatedApproval:true,approvalTarget:'https://isolated-approval.supabase.co',getAccessToken:async()=> 'synthetic-token',request:async(url,options)=>{calls.push(options.method);return {ok:options.method==='GET',json:async()=> options.method==='GET'?{result:record()}:{error:'FORBIDDEN'}};}});
 const review=createIsolatedApprovalReview({client,enabled:true,cryptoProvider:webcrypto});await review.load('case-review');
 const input={caseId:'case-review',revision:2,reviewedText:text,confirmed:true};await assert.rejects(review.approve(input),/FORBIDDEN/);
 await assert.rejects(review.approve(input),/REVIEW_REQUIRED/);assert.deepEqual(calls,['GET','POST']);
});

test('explicit edit-only server capability permits read but never invokes approval transport',async()=>{
 const f=fixture({get:async()=>{const r=record();r.approvalBlockedReason='EXACT_REVIEW_EVIDENCE_REQUIRED';r.canEditDraft=true;delete r.data.drafts[0].synthetic;r.data.drafts[0].reviewStatus='manual_edit_requires_review';return r;}});
 const loaded=await f.review.load('case-review');assert.equal(loaded.canEditDraft,true);assert.equal(loaded.hash,hash);
 await assert.rejects(f.review.approve({caseId:loaded.caseId,revision:loaded.revision,reviewedText:loaded.text,confirmed:true}),/REVIEW_NOT_READY/);
 assert.equal(f.calls.filter(x=>x[0]==='approve').length,0);
});
