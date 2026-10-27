// Browser-compatible review bridge. Never auto-initialized by the application.
// Only the persisted synthetic draft may be approved; a preview is insufficient.
import {isIsolatedReviewCaseId} from './isolated-review-case-id.mjs';
export function createIsolatedApprovalReview({client,enabled=false,cryptoProvider=globalThis.crypto}={}){
 let review=null,busy=false,generation=0;
 const requireEnabled=()=>{if(enabled!==true)throw Error('SETUP_REQUIRED');};
 const digest=async text=>Array.from(new Uint8Array(await cryptoProvider.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
 return {
  clear(){review=null;generation++;},
  async load(caseId){
   requireEnabled();if(busy)throw Error('REVIEW_BUSY');
   if(!isIsolatedReviewCaseId(caseId))throw Error('INVALID_INPUT');
   busy=true;review=null;const currentGeneration=++generation;
   try{
    const record=await client.get('sarberki-test',caseId),draft=record?.data?.drafts?.at(-1);
    if(record?.caseId!==caseId||record?.tenantId!=='sarberki-test'||!Number.isSafeInteger(record.revision)||record.revision<1||record.data?.state?.approval!=='pending'||(record.approvalBlockedReason!=='EXACT_REVIEW_EVIDENCE_REQUIRED'&&(draft?.synthetic!==true||draft.reviewStatus!=='internal_review_required'))||typeof draft.text!=='string'||!draft.text.trim())throw Error('INVALID_DRAFT');
    const value={caseId,approvalBlockedReason:record.approvalBlockedReason==='EXACT_REVIEW_EVIDENCE_REQUIRED'?record.approvalBlockedReason:null,canEditDraft:record.canEditDraft===true,revision:record.revision,text:draft.text,operatorReviewText:typeof draft.operatorReviewText==='string'?draft.operatorReviewText:null,hash:await digest(draft.text)};
    if(generation!==currentGeneration)throw Error('REVIEW_CANCELLED');
    review=value;return Object.freeze({...value});
   }finally{busy=false;}
  },
  async approve({caseId,revision,reviewedText,confirmed=false}={}){
   requireEnabled();if(busy)throw Error('REVIEW_BUSY');
   if(!review||confirmed!==true||caseId!==review.caseId||revision!==review.revision||reviewedText!==review.text)throw Error('REVIEW_REQUIRED');
   // Clear before the write: failures and uncertain responses require a fresh load.
   if(review.approvalBlockedReason)throw Error('REVIEW_NOT_READY');
   const selected=review;review=null;busy=true;
   try{
    const record=await client.approve('sarberki-test',caseId,revision,selected.hash);
    if(record?.caseId!==caseId||record?.tenantId!=='sarberki-test'||record?.revision!==revision+1||record.data?.state?.approval!=='internally_approved'||record.data?.serverApproval?.draftHash!==selected.hash||record.data?.serverApproval?.reviewedRevision!==revision)throw Error('INVALID_APPROVAL_RESPONSE');
    return record;
   }finally{busy=false;}
  }
 };
}
