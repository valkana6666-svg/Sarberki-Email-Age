// Server-only (excluded from dist by the server- prefix). Links, for ONE marked test-mailbox message:
// verified Gmail read (WP2) -> existing shared AI (extraction + inquiry draft) -> sc_tm_create (WP3).
// The operator's transient Gmail token is used once and never stored or returned. Storage uses the
// operator's own Supabase session transport (no service role). The database recomputes the attestation.
// Nothing here sends mail, books, calls Previo or approves: the case is stored pending for an
// independent approver. Not wired to a Netlify route or switch (separate, owner-gated step).
import {createBookingCaseStore} from '../booking-cases.mjs';
import {extractServerMessage} from './server-message-extraction.mjs';
import {serverInquiryOptions} from './server-inquiry-options.mjs';
import {buildEmailInquiryDraft} from './inquiry-channel-adapters.mjs';
import {readVerifiedTestMailboxMessage,attestTestMailboxSource} from './server-gmail-source.mjs';
import {TEST_DEPLOYMENT} from './server-deployment.mjs';

const fail=code=>{const error=Error(code);error.code=code;throw error;};
const scope=(message,reverse=false)=>{
 const prefix=message.mailbox_id+':',change=value=>reverse?value.slice(prefix.length):prefix+value;
 const refs=value=>String(value).replace(/<([^>]+)>/g,(_,id)=>'<'+change(id)+'>');
 return {...message,message_id:change(message.message_id),thread_id:change(message.thread_id),rfc_message_id:refs(message.rfc_message_id)};
};
// Fixed codes only: database/transport text never leaves this module.
function storageFailure(error){
 if(error?.code==='FORBIDDEN')return 'FORBIDDEN';
 return 'STORAGE_FAILURE';
}

export async function ingestTestMailboxMessage({token,messageId,transport,attestationKey,fetchImpl=globalThis.fetch,clock=()=>new Date().toISOString(),deployment=TEST_DEPLOYMENT}={}){
 const TENANT=deployment.tenantId;
 if(typeof transport!=='function')fail('SETUP_REQUIRED');
 // 1. Server-side Gmail read and gates (marked subject, single recipient, no reply, plain text...).
 const {source,envelope}=await readVerifiedTestMailboxMessage({token,messageId,fetchImpl,deployment});
 // 2. Existing shared engine: the server extracts its own facts; no client-asserted values.
 const caseId='tm-'+source.message_id;
 let saved;
 const store=createBookingCaseStore({storage:{getItem:()=>'[]',setItem:(_,value)=>{saved=JSON.parse(value);}},tenantId:TENANT,clock,id:()=>caseId});
 const values=extractServerMessage(envelope);
 store.ingest(scope(envelope),values,{approvedCaseId:null});
 const data=saved?.find(c=>c.id===caseId);
 if(!data||data.messages.length!==1)fail('INVALID_DRAFT');
 data.messages=data.messages.map(m=>scope(m,true));
 // The engine writes linkReview:null on a fresh case; sc_tm_create rejects the key itself. A real review marker or service-only kind is never a test-mailbox case.
 if(data.linkReview||data.caseKind)fail('INVALID_DRAFT');
 delete data.linkReview;
 data.sender=envelope.sender;
 data.sourceReceipt=structuredClone(source);
 const at=clock();
 const plan=buildEmailInquiryDraft(serverInquiryOptions({tenantId:TENANT,caseId,data},new Date(at)));
 if(typeof plan.text!=='string'||!plan.text.trim())fail('INVALID_DRAFT');
 data.drafts=[{text:plan.text,operatorReviewText:plan.operatorReviewText,at,revision:data.state.revision,basedOnMessageCount:1,reviewStatus:'manual_review_required'}];
 data.state.approval='pending';
 // 3. Server attestation (own key, own scope); the database recomputes it, nothing secret is stored.
 const proof=attestTestMailboxSource({key:attestationKey,tenantId:TENANT,source,envelope,checkedAt:clock(),deployment});
 try{
  const record=await transport('/rest/v1/rpc/sc_tm_create',{method:'POST',body:{p_tenant:TENANT,p_case:caseId,p_data:data,p_proof:proof}});
  return {caseId,revision:record?.revision??null};
 }catch(error){fail(storageFailure(error));}
}
