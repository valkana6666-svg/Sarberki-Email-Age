import {matchesExactGmailEditRecord} from './server-exact-gmail-receipt.mjs';
import {assertCloudSyntheticReviewCase} from './cloud-synthetic-approval.mjs';
import { createBookingCaseStore } from '../booking-cases.mjs';
import {tubServiceMessage,tubServiceProjection} from './tub-request.mjs';
import {tubServiceDraft} from '../central-reply.mjs';
import { CaseServiceError } from './server-case-service.mjs';
import { buildEmailInquiryDraft } from './inquiry-channel-adapters.mjs';
import {serverInquiryOptions} from './server-inquiry-options.mjs';
import { randomUUID,createHash } from 'node:crypto';
import { extractServerMessage } from './server-message-extraction.mjs';
import { prepareSyntheticBookingReview } from './server-synthetic-booking-review.mjs';
const reject=code=>{throw new CaseServiceError(code,code);};
function serviceScopedDraft(text,language,request,projection){
 if(request.kind!=='tub_request'||!request.serviceOnly&&!request.actionConflict)return text;
 const clarification=tubServiceDraft(language,Boolean(projection?.linkedCaseId),projection?.verificationStatus==='not_available',request.cancelled,request.actionConflict);
 return request.serviceOnly?clarification:[text,clarification].join('\n\n');
}
const allowed=['sender','text','message_id','mailbox_id','thread_id','rfc_message_id','in_reply_to','references','received_at','case_id'];
const fields=['arrival','departure','guests','adults','children','child_ages','unit','units_requested','request','split_request_text','language','name','phone','cars','nights','pier','dog'];
function validateMessage(envelope,values,exactSender=false) {
 if(!envelope||!values||Array.isArray(values)||Object.keys(envelope).some(k=>!allowed.includes(k))||Object.keys(values).some(k=>!fields.includes(k)))reject('INVALID_INPUT');
 if((!exactSender&&!/^[^@\s]+@[^@\s]+\.invalid$/i.test(envelope.sender||'')) || typeof envelope.text!=='string' || envelope.text.length>20000 || !/^[a-zA-Z0-9_-]{1,128}$/.test(envelope.mailbox_id||'') || !/^[a-zA-Z0-9_-]{1,256}$/.test(envelope.message_id||'') || !Number.isFinite(Date.parse(envelope.received_at)))reject('INVALID_INPUT');
 if(Object.values(values).some(x=>typeof x!=='string'||x.length>2000))reject('INVALID_INPUT');
 if(Object.entries(envelope).some(([k,v])=>k!=='references'&&(typeof v!=='string'||v.length>20000)))reject('INVALID_INPUT');
 if(envelope.references!==undefined&&(!Array.isArray(envelope.references)||envelope.references.length>100||envelope.references.some(x=>typeof x!=='string'||x.length>512)))reject('INVALID_INPUT');
}
export function validateSyntheticMessage(envelope,values){validateMessage(envelope,values);}
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
export function createServerBookingRuntime({service,tenantId,requestContext,clock=()=>new Date().toISOString(),id=randomUUID,reviewProviders=null,isolatedApproval=false,exactReceipt=null,exactEditReceipt=null,cloudSyntheticEditing=false}){
 return {
  async approve(caseId,expectedRevision,draftHash){
   if(!isolatedApproval||tenantId!=='sarberki-test'||!reviewProviders)reject('SETUP_REQUIRED');
   const approver=await service.requireApproval({requestContext,tenantId});
   const current=await service.getCase({requestContext,tenantId,caseId});
   if(!current)reject('CASE_NOT_FOUND');if(current.revision!==expectedRevision)reject('CASE_CONFLICT');
   const draft=current.data.drafts.at(-1);
   if(matchesExactGmailEditRecord(current,exactEditReceipt)){
    if(current.updatedBy===approver||draft?.editedBy===approver)reject('FORBIDDEN');
    if(typeof draft?.text!=='string'||createHash('sha256').update(draft.text,'utf8').digest('hex')!==draftHash)reject('INVALID_DRAFT');
    // No exact case-bound capacity/price/review evidence has been authorized.
    // Never call the unrelated two-person fixture providers for this record.
    reject('REVIEW_NOT_READY');
   }
   if(!draft?.synthetic||draft.reviewStatus!=='internal_review_required'||current.data.state.approval!=='pending'||draft.revision!==current.data.state.revision||
    draft.basedOnMessageCount!==current.data.messages.length)reject('INVALID_DRAFT');
   if(createHash('sha256').update(draft.text,'utf8').digest('hex')!==draftHash)reject('INVALID_DRAFT');
   const review=await prepareSyntheticBookingReview({...reviewProviders,record:current,now:()=>Date.parse(clock())});
   if(review.status!=='internal_review_required')reject('REVIEW_NOT_READY');
   if(draft.edited===true&&cloudSyntheticEditing){
    assertCloudSyntheticReviewCase(current);
    if(current.updatedBy===approver||draft.editedBy!==current.updatedBy)reject('FORBIDDEN');
    const base=current.data.drafts.find(d=>d.edited!==true&&d.synthetic===true&&d.reviewStatus==='internal_review_required'&&createHash('sha256').update(d.text,'utf8').digest('hex')===draft.baseDraftHash);
    if(!base||createHash('sha256').update(review.draft,'utf8').digest('hex')!==draft.baseDraftHash||draft.draftHash!==draftHash)reject('REVIEW_CHANGED');
   }else if(review.draft!==draft.text)reject('REVIEW_CHANGED');
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
   const latestDraft=current.data.drafts.at(-1);
   const savedDraftCurrent=Boolean(current.data.state?.approval==='pending' &&
     latestDraft && typeof latestDraft.text==='string' &&
     latestDraft.revision===current.data.state.revision &&
     latestDraft.basedOnMessageCount===current.data.messages.length);
   const storedDraft=savedDraftCurrent?{text:latestDraft.text,edited:latestDraft.edited===true,
     status:latestDraft.reviewStatus||'pending',caseRevision:current.revision}:null;
   const reviewState={caseRevision:current.revision,factsRevision:current.data.state.revision,
    latestDraftRevision:latestDraft?.revision??null,
    latestDraftMessageCount:latestDraft?.basedOnMessageCount??null,
    messageCount:current.data.messages.length,storedApproval:current.data.state.approval,
    auditStatus:'not_verified'};
   const readOnlyFreshness={verified:true,checkedAt:clock(),source:'stored-synthetic-case',
    tenantId,caseId,revision:current.revision,syntheticOnly:true};
   const latestMessage=current.data.messages.at(-1);
   const request=tubServiceMessage(current.data.state.original||latestMessage?.text||'');
   const serviceRequest=tubServiceProjection(current.data)||(request.kind==='tub_request'?tubServiceProjection({serviceRequests:[request]}):null);
   let serviceLink=null,canResolveServiceLink=false;
   if(current.data.caseKind==='service_link_review'){
    serviceLink=await service.serviceLinkState({requestContext,tenantId,caseId});
    try{await service.requireWrite({requestContext,tenantId});await service.requireApproval({requestContext,tenantId});canResolveServiceLink=serviceLink?.status!=='resolved';}catch(error){if(error.code!=='FORBIDDEN')throw error;}
    if(serviceRequest)serviceRequest.linkedCaseId=serviceLink?.status==='resolved'?serviceLink.targetCaseId:null;
   }
   const serviceOnly=request.kind==='tub_request'&&request.serviceOnly===true;
   return {caseId,revision:current.revision,text:serviceScopedDraft(planned.text,planned.decision.facts.language,request,serviceRequest),operatorReviewText:serviceScopedDraft(planned.operatorReviewText,'hu',request,serviceRequest),decision:planned.decision,reviewState,readOnlyFreshness,storedDraft,approval:'pending',persisted:false,serviceOnly,serviceRequest,serviceLink,serviceLinkReview:current.data.caseKind==='service_link_review'?{reason:current.data.linkReview?.evidence||'human_association_required'}:null,canResolveServiceLink};
  },
  async editDraft(caseId,expectedRevision,editedText,expectedDraftHash){
   // Synthetic-only, operator-authenticated edit; append a pending version, never authorize a guest send.
   if(tenantId!=='sarberki-test')reject('FORBIDDEN');
   if(typeof editedText!=='string'||!editedText.trim()||editedText.length>20000||/\u0000/u.test(editedText))reject('INVALID_DRAFT');
   const editor=await service.requireWrite({requestContext,tenantId});
   const current=await service.getCase({requestContext,tenantId,caseId});
   if(!current)reject('CASE_NOT_FOUND');
   if(current.revision!==expectedRevision)reject('CASE_CONFLICT');
   const exactEdit=cloudSyntheticEditing&&matchesExactGmailEditRecord(current,exactEditReceipt);
   if(cloudSyntheticEditing&&!exactEdit)assertCloudSyntheticReviewCase(current);
   const data=current.data,last=data?.drafts?.at(-1);
   if(cloudSyntheticEditing&&(!last||typeof last.text!=='string'||(!exactEdit&&(!last?.synthetic||last.reviewStatus!=='internal_review_required'))||
      typeof expectedDraftHash!=='string'||!/^[a-f0-9]{64}$/.test(expectedDraftHash)||
      createHash('sha256').update(last.text,'utf8').digest('hex')!==expectedDraftHash))reject('INVALID_DRAFT');
   if((!exactEdit&&!data?.sender?.endsWith('.invalid'))||data.state?.approval!=='pending'||data.serverApproval||
      !last||typeof last.text!=='string'||last.text===editedText||
      last.revision!==data.state.revision||last.basedOnMessageCount!==data.messages.length)reject('INVALID_DRAFT');
   const updated=structuredClone(data);
   updated.drafts.push({text:editedText,at:clock(),revision:updated.state.revision,
      basedOnMessageCount:updated.messages.length,edited:true,
      ...(exactEdit?{reviewStatus:'manual_edit_requires_review',editedBy:editor,
        previousDraftHash:expectedDraftHash,draftHash:createHash('sha256').update(editedText,'utf8').digest('hex'),
        operatorReviewText:'',operatorReviewStatus:'manual_edit_translation_unverified'}:cloudSyntheticEditing?{synthetic:true,reviewStatus:'internal_review_required',editedBy:editor,
        baseDraftHash:last.edited===true?last.baseDraftHash:expectedDraftHash,
        draftHash:createHash('sha256').update(editedText,'utf8').digest('hex'),
        operatorReviewText:'',operatorReviewStatus:'manual_edit_translation_unverified'}:{reviewStatus:'manual_edit_requires_review'})});
   updated.state.approval='pending';
   // CAS + server-side write authority are rechecked by the existing case service.
   return service.updateCase({requestContext,tenantId,caseId,expectedRevision,bookingCase:updated});
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
  async ingest(envelope,values,{expectedRevision,approvedCaseId=null,persistDraft=false,sourceReceipt}={}){
   const exact=tenantId==='sarberki-test'&&persistDraft&&exactReceipt?.matches(envelope,sourceReceipt)===true;
   if(sourceReceipt!==undefined&&!exact)reject('FORBIDDEN');
   // One optional synthetic-only path saves the parsed case and its pending reply draft in the SAME insert/CAS.
   // The normal Gmail read-only importer never sets this flag or uploads a real message.
   if(persistDraft){
    if(tenantId!=='sarberki-test'||approvedCaseId||envelope?.case_id)reject('FORBIDDEN');
    await service.requireWrite({requestContext,tenantId});
    // Never persist client-asserted booking facts in the atomic synthetic mail path.
    // Even if a browser supplies parsed values, the server extracts its own facts from the message.
    validateMessage(envelope,{},exact);
    values=extractServerMessage(envelope);
   }
   if(values===undefined){validateMessage(envelope,{},exact);values=extractServerMessage(envelope);}
   validateMessage(envelope,values,exact);
   const records=await service.listCases({requestContext,tenantId});
   const duplicate=records.find(r=>r.data.messages.some(m=>m.mailbox_id===envelope.mailbox_id&&m.message_id===envelope.message_id));
   if(duplicate){
    if(exact&&!exactReceipt.matchesRecord(duplicate))reject('CASE_CONFLICT');
    // A provider ID is only an idempotency key when the original message is identical.
    // Never expose an unrelated saved case just because a caller reused its ID.
    const original=duplicate.data.messages.find(m=>m.mailbox_id===envelope.mailbox_id&&m.message_id===envelope.message_id);
    const canonicalSender=value=>String(value||'').trim().toLowerCase();
    if(canonicalSender(duplicate.data.sender)!==canonicalSender(envelope.sender)||
       canonicalSender(original?.sender)!==canonicalSender(envelope.sender)||
       original?.text!==envelope.text)reject('CASE_CONFLICT');
    return {resolution:{status:'duplicate',caseId:duplicate.caseId},record:duplicate};
   }
   // Namespace provider IDs before passing to the existing engine's dedup logic.
   const scoped=records.map(r=>({...r.data,messages:r.data.messages.map(m=>scopeMessage(m))}));
   let saved;
   const storage={getItem:()=>JSON.stringify(scoped),setItem:(_,value)=>{saved=JSON.parse(value);}};
   const store=createBookingCaseStore({storage,tenantId,clock,id:exact?()=>exactReceipt.caseId:id});
   if(approvedCaseId||envelope.case_id)await service.requireApproval({requestContext,tenantId});
   const result=store.ingest(scopeMessage(envelope),values,{approvedCaseId});
   const data=saved.find(c=>c.id===result.bookingCase.id);
   data.messages=data.messages.map(m=>scopeMessage(m,true));
   if(exact){
    data.sourceReceipt=structuredClone(sourceReceipt);
    if(!exactReceipt.matchesRecord({tenantId,caseId:data.id,data}))reject('FORBIDDEN');
   }
   if(persistDraft){
    const at=clock();
    const plan=buildEmailInquiryDraft(serverInquiryOptions({tenantId,caseId:data.id,data},new Date(at)));
    const request=tubServiceMessage(data.state.original);
    if(request.kind==='tub_request'){
     const projection=tubServiceProjection(data);
     plan.text=serviceScopedDraft(plan.text,plan.decision.facts.language,request,projection);
     plan.operatorReviewText=serviceScopedDraft(plan.operatorReviewText,'hu',request,projection);
    }
    if(typeof plan.text!=='string'||!plan.text.trim())reject('INVALID_DRAFT');
    data.drafts.push({text:plan.text,operatorReviewText:plan.operatorReviewText,at,
     revision:data.state.revision,basedOnMessageCount:data.messages.length,
     synthetic:true,reviewStatus:'manual_review_required'});
    data.state.approval='pending';
   }
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
