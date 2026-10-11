import { createBookingCaseStore } from '../booking-cases.mjs';
import { CaseServiceError } from './server-case-service.mjs';
import { buildEmailInquiryDraft } from './inquiry-channel-adapters.mjs';
import {serverInquiryOptions} from './server-inquiry-options.mjs';
import { randomUUID,createHash } from 'node:crypto';
import { extractServerMessage } from './server-message-extraction.mjs';
import { prepareSyntheticBookingReview } from './server-synthetic-booking-review.mjs';
const reject=code=>{throw new CaseServiceError(code,code);};
const allowed=['sender','text','message_id','mailbox_id','thread_id','rfc_message_id','in_reply_to','references','received_at','case_id'];
const fields=['arrival','departure','guests','adults','children','child_ages','unit','units_requested','request','split_request_text','language','name','phone','cars','nights','pier','dog'];
export function validateSyntheticMessage(envelope,values) {
 if(!envelope||!values||Array.isArray(values)||Object.keys(envelope).some(k=>!allowed.includes(k))||Object.keys(values).some(k=>!fields.includes(k)))reject('INVALID_INPUT');
 if(!/^[^@\s]+@[^@\s]+\.invalid$/i.test(envelope.sender||'') || typeof envelope.text!=='string' || envelope.text.length>20000 || !/^[a-zA-Z0-9_-]{1,128}$/.test(envelope.mailbox_id||'') || !/^[a-zA-Z0-9_-]{1,256}$/.test(envelope.message_id||'') || !Number.isFinite(Date.parse(envelope.received_at)))reject('INVALID_INPUT');
 if(Object.values(values).some(x=>typeof x!=='string'||x.length>2000))reject('INVALID_INPUT');
 if(Object.entries(envelope).some(([k,v])=>k!=='references'&&(typeof v!=='string'||v.length>20000)))reject('INVALID_INPUT');
 if(envelope.references!==undefined&&(!Array.isArray(envelope.references)||envelope.references.length>100||envelope.references.some(x=>typeof x!=='string'||x.length>512)))reject('INVALID_INPUT');
}
// Scope RFC references as well as provider IDs, preserving angle-bracket syntax.
function scopeMessage(message, reverse=false){
 const box=message.mailbox_id, prefix=box+':';
 const change=value=>reverse?value.slice(prefix.length):prefix+value;
 const refs=value=>String(value).replace(/<([^>]+)>/g,(_,id)=>'<'+change(id)+'>');
 return {...message,message_id:change(message.message_id),
  ...(message.thread_id?{thread_id:change(message.thread_id)}:{}),
  ...(message.rfc_message_id?{rfc_message_id:refs(message.rfc_message_id)}:{}),
  ...(message.in_reply_to?{in_reply_to:refs(message.in_reply_to)}:{}),
  ...(message.references?{references:message.references.map(refs)}:{})};
}
// Reuses the existing engine. Only persistence is asynchronous; no new booking rules.
export function createServerBookingRuntime({service,tenantId,requestContext,clock=()=>new Date().toISOString(),id=randomUUID,reviewProviders=null,isolatedApproval=false}){
 return {
  async approve(caseId,expectedRevision,draftHash){
   if(!isolatedApproval||tenantId!=='sarberki-test'||!reviewProviders)reject('SETUP_REQUIRED');
   await service.requireApproval({requestContext,tenantId});
   const current=await service.getCase({requestContext,tenantId,caseId});
   if(!current)reject('CASE_NOT_FOUND');if(current.revision!==expectedRevision)reject('CASE_CONFLICT');
   const draft=current.data.drafts.at(-1);
   if(!draft?.synthetic||draft.reviewStatus!=='internal_review_required'||current.data.state.approval!=='pending'||draft.revision!==current.data.state.revision||
    draft.basedOnMessageCount!==current.data.messages.length)reject('INVALID_DRAFT');
   if(createHash('sha256').update(draft.text,'utf8').digest('hex')!==draftHash)reject('INVALID_DRAFT');
   const review=await prepareSyntheticBookingReview({...reviewProviders,record:current,now:()=>Date.parse(clock())});
   if(review.status!=='internal_review_required')reject('REVIEW_NOT_READY');
   if(review.draft!==draft.text)reject('REVIEW_CHANGED');
   // No caller-supplied actor/evidence is accepted. Authority and DB session are rechecked after providers.
   return service.approveCase({requestContext,tenantId,caseId,expectedRevision,draftHash,evidence:review.evidence});
  },
  async previewReview(caseId,expectedRevision){
   if(!reviewProviders)reject('SETUP_REQUIRED');
   const record=await service.getCase({requestContext,tenantId,caseId});
   if(!record)reject('CASE_NOT_FOUND');if(record.revision!==expectedRevision)reject('CASE_CONFLICT');
   return prepareSyntheticBookingReview({...reviewProviders,record,now:()=>Date.parse(clock())});
  },
  async reviewAndDraft(caseId,expectedRevision){
   if(tenantId!=='sarberki-test')reject('FORBIDDEN');
   if(!reviewProviders)reject('SETUP_REQUIRED');
   await service.requireWrite({requestContext,tenantId});
   const current=await service.getCase({requestContext,tenantId,caseId});
   if(!current)reject('CASE_NOT_FOUND');if(current.revision!==expectedRevision)reject('CASE_CONFLICT');
   const review=await prepareSyntheticBookingReview({...reviewProviders,record:current,now:()=>Date.parse(clock())});
   const data=structuredClone(current.data);
   data.drafts.push({text:review.draft,operatorReviewText:review.operatorReviewText,at:clock(),revision:data.state.revision,basedOnMessageCount:data.messages.length,synthetic:true,reviewStatus:review.status});
   // Recheck authority and CAS after provider calls. Evidence/quotes stay internal.
   const record=await service.updateCase({requestContext,tenantId,caseId,expectedRevision,bookingCase:data});
   return {review,record};
  },
  async previewDraft(caseId,expectedRevision){
   if(tenantId!=='sarberki-test')reject('FORBIDDEN');
   const current=await service.getCase({requestContext,tenantId,caseId});
   if(!current)reject('CASE_NOT_FOUND');if(current.revision!==expectedRevision)reject('CASE_CONFLICT');
   // Read-only common planner preview; client facts are never evidence.
   const planned=buildEmailInquiryDraft(serverInquiryOptions(current,new Date(clock())));
   return {caseId,revision:current.revision,text:planned.text,operatorReviewText:planned.operatorReviewText,decision:planned.decision,approval:'pending',persisted:false};
  },
  async draft(caseId,expectedRevision){
   // Save only after separate server-side write authorization and optimistic concurrency check.
   await service.requireWrite({requestContext,tenantId});
   const preview=await this.previewDraft(caseId,expectedRevision);
   const current=await service.getCase({requestContext,tenantId,caseId});
   if(!current)reject('CASE_NOT_FOUND');if(current.revision!==expectedRevision)reject('CASE_CONFLICT');
   const data=structuredClone(current.data);
   data.drafts.push({text:preview.text,operatorReviewText:preview.operatorReviewText,at:clock(),revision:data.state.revision,basedOnMessageCount:data.messages.length});
   return service.updateCase({requestContext,tenantId,caseId,expectedRevision,bookingCase:data});
  },
  async ingest(envelope,values,{expectedRevision,approvedCaseId=null}={}){
   if(values===undefined){validateSyntheticMessage(envelope,{});values=extractServerMessage(envelope);}
   validateSyntheticMessage(envelope,values);
   const records=await service.listCases({requestContext,tenantId});
   const duplicate=records.find(r=>r.data.messages.some(m=>m.mailbox_id===envelope.mailbox_id&&m.message_id===envelope.message_id));
   if(duplicate)return {resolution:{status:'duplicate',caseId:duplicate.caseId},record:duplicate};
   // Namespace provider IDs before passing to the existing engine's dedup logic.
   const scoped=records.map(r=>({...r.data,messages:r.data.messages.map(m=>scopeMessage(m))}));
   let saved;
   const storage={getItem:()=>JSON.stringify(scoped),setItem:(_,value)=>{saved=JSON.parse(value);}};
   const store=createBookingCaseStore({storage,tenantId,clock,id});
   if(approvedCaseId||envelope.case_id)await service.requireApproval({requestContext,tenantId});
   const result=store.ingest(scopeMessage(envelope),values,{approvedCaseId});
   const data=saved.find(c=>c.id===result.bookingCase.id);
   data.messages=data.messages.map(m=>scopeMessage(m,true));
   const previous=records.find(r=>r.caseId===data.id);
   let record;
   if(previous){
    if(expectedRevision!==previous.revision)reject('CASE_CONFLICT');
    record=await service.updateCase({requestContext,tenantId,caseId:data.id,expectedRevision,bookingCase:data});
   }else{
    if(expectedRevision!==0)reject('INVALID_REVISION');
    record=await service.createCase({requestContext,tenantId,bookingCase:data});
   }
   return {resolution:result.resolution,record};
  }
 };
}
