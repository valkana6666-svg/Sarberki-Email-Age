// Server-only (excluded from dist by the server- prefix). Owner decision 2026-11-06: a guest's reply continues the
// existing case in the operator system. One verified Gmail reply -> the case of the same thread and guest -> the
// existing shared engine merges the facts (createBookingCaseStore follow-up path) -> new machine draft ->
// sc_tm_followup (deployment/test-mailbox/followup.sql), which re-checks thread, guest, message key and the
// server attestation. The operator's Gmail token is used once and never stored. Nothing is sent or booked.
import {createHash,createHmac} from 'node:crypto';
import {createBookingCaseStore} from '../booking-cases.mjs';
import {extractServerMessage} from './server-message-extraction.mjs';
import {serverInquiryOptions} from './server-inquiry-options.mjs';
import {buildEmailInquiryDraft} from './inquiry-channel-adapters.mjs';
import {readVerifiedTestMailboxMessage} from './server-gmail-source.mjs';
import {scope} from './server-test-mailbox-case.mjs';
import {TEST_DEPLOYMENT} from './server-deployment.mjs';

export const FOLLOWUP_SCOPE='test-mailbox-followup-v1';
const VALUE_KEYS=['arrival','departure','nights','guests','adults','children','child_ages','phone','unit','units_requested','language','request','split_request_text','name'];
const fail=code=>{const error=Error(code);error.code=code;throw error;};
const sha=text=>createHash('sha256').update(String(text),'utf8').digest('hex');

export function attestFollowup({key,tenantId,caseId,expectedRevision,message,draftText,checkedAt}){
 if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))fail('SETUP_REQUIRED');
 const fields=[FOLLOWUP_SCOPE,tenantId,caseId,String(expectedRevision),message.mailbox_id,message.message_id,message.thread_id,message.rfc_message_id,
  String(message.sender).toLowerCase(),message.received_at,sha(message.text),sha(draftText),checkedAt];
 if(fields.some(v=>typeof v!=='string'||!v||/[\r\n]/.test(v)))fail('INVALID_EVIDENCE');
 return {scope:FOLLOWUP_SCOPE,checkedAt,attestation:createHmac('sha256',Buffer.from(key,'hex')).update(fields.join('\n')).digest('hex')};
}

export async function appendTestMailboxFollowup({token,messageId,transport,attestationKey,fetchImpl=globalThis.fetch,clock=()=>new Date().toISOString(),deployment=TEST_DEPLOYMENT}={}){
 if(typeof transport!=='function')fail('SETUP_REQUIRED');
 const TENANT=deployment.tenantId;
 const {source,envelope}=await readVerifiedTestMailboxMessage({token,messageId,fetchImpl,deployment,followup:true});
 // The case is found by the Gmail thread (RLS: only readable cases); the database re-checks thread and guest.
 let rows;
 try{rows=await transport('/rest/v1/sc_cases?select=*&tenant_id=eq.'+TENANT+'&data->sourceReceipt->>thread_id=eq.'+encodeURIComponent(source.thread_id));}
 catch(error){fail(error?.code==='FORBIDDEN'?'FORBIDDEN':'STORAGE_FAILURE');}
 const candidates=(Array.isArray(rows)?rows:[]).filter(r=>/^tm-[a-f0-9]{12,32}$/.test(r.case_id)&&String(r.data?.sender).toLowerCase()===envelope.sender);
 if(candidates.length!==1)fail('FOLLOWUP_CASE_NOT_FOUND');
 const row=candidates[0],caseId=row.case_id,revision=Number(row.revision);
 if(row.data.messages.some(m=>m.message_id===envelope.message_id))fail('ALREADY_IN_CASE');
 // Existing shared engine: the same follow-up merge the chatbot and the local store use.
 let saved;
 const current={...structuredClone(row.data),id:caseId,tenantId:TENANT,messages:row.data.messages.map(m=>scope(m))};
 const store=createBookingCaseStore({storage:{getItem:()=>JSON.stringify([current]),setItem:(_,value)=>{saved=JSON.parse(value);}},tenantId:TENANT,clock});
 const result=store.ingest(scope(envelope),extractServerMessage(envelope),{approvedCaseId:caseId});
 const merged=saved?.find(c=>c.id===caseId);
 if(!merged||result?.resolution?.caseId!==caseId||merged.messages.length!==row.data.messages.length+1)fail('INVALID_DRAFT');
 const values=Object.fromEntries(Object.entries(merged.state.values||{}).filter(([k,v])=>VALUE_KEYS.includes(k)&&v!==null&&v!==undefined&&v!=='').map(([k,v])=>[k,String(v)]));
 const data={...row.data,messages:[...row.data.messages,envelope],state:{...row.data.state,values}};
 const plan=buildEmailInquiryDraft(serverInquiryOptions({tenantId:TENANT,caseId,data},new Date(clock())));
 if(typeof plan.text!=='string'||!plan.text.trim())fail('INVALID_DRAFT');
 const draft={text:plan.text,operatorReviewText:String(plan.operatorReviewText||'')};
 const proof=attestFollowup({key:attestationKey,tenantId:TENANT,caseId,expectedRevision:revision,message:envelope,draftText:draft.text,checkedAt:clock()});
 let record;
 try{record=await transport('/rest/v1/rpc/sc_tm_followup',{method:'POST',body:{p_tenant:TENANT,p_case:caseId,p_expected:revision,p_message:envelope,p_values:values,p_draft:draft,p_proof:proof}});}
 catch(error){fail(error?.code==='FORBIDDEN'?'FORBIDDEN':'STORAGE_FAILURE');}
 if(!record)fail('CASE_CONFLICT');
 return {caseId,revision:Number(record.revision)};
}
