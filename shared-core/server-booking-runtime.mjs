import { createBookingCaseStore } from '../booking-cases.mjs';
import { CaseServiceError } from './server-case-service.mjs';
import { buildCentralReply } from '../central-reply.mjs';
import { SARBERKI_TENANT } from '../tenant-config.mjs';
import { randomUUID } from 'node:crypto';
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
// Reuses the existing engine. Only persistence is asynchronous; no new booking rules.
export function createServerBookingRuntime({service,tenantId,requestContext,clock=()=>new Date().toISOString(),id=randomUUID}){
 return {
  async draft(caseId,expectedRevision){
   if(tenantId!=='sarberki-test')reject('FORBIDDEN'); // No borrowed Sárberki rules for another tenant.
   const current=await service.getCase({requestContext,tenantId,caseId});
   if(!current)reject('CASE_NOT_FOUND');if(current.revision!==expectedRevision)reject('CASE_CONFLICT');
   const data=structuredClone(current.data),v=data.state.values;
   // No supplied price or availability proofs: only a data-collection draft.
   const tenant={...SARBERKI_TENANT,id:tenantId};
   const text=buildCentralReply({caseId,language:v.language||'hu',name:v.name,original:data.state.original,
    arrival:v.arrival,departure:v.departure,guests:v.guests,adults:v.adults,children:v.children,
    childAges:String(v.child_ages||'').split(',').filter(Boolean).map(Number),phone:v.phone,cabin:v.unit,
    intent:data.state.intent},{tenant,records:[]});
   data.drafts.push({text,at:clock(),revision:data.state.revision});
   return service.updateCase({requestContext,tenantId,caseId,expectedRevision,bookingCase:data});
  },
  async ingest(envelope,values,{expectedRevision,approvedCaseId=null}={}){
   validateSyntheticMessage(envelope,values);
   const records=await service.listCases({requestContext,tenantId});
   const duplicate=records.find(r=>r.data.messages.some(m=>m.mailbox_id===envelope.mailbox_id&&m.message_id===envelope.message_id));
   if(duplicate)return {resolution:{status:'duplicate',caseId:duplicate.caseId},record:duplicate};
   // Namespace provider IDs before passing to the existing engine's dedup logic.
   const scoped=records.map(r=>({...r.data,messages:r.data.messages.map(m=>({...m,message_id:m.mailbox_id+':'+m.message_id,...(m.thread_id?{thread_id:m.mailbox_id+':'+m.thread_id}:{})}))}));
   let saved;
   const storage={getItem:()=>JSON.stringify(scoped),setItem:(_,value)=>{saved=JSON.parse(value);}};
   const store=createBookingCaseStore({storage,tenantId,clock,id});
   if(approvedCaseId)await service.requireApproval({requestContext,tenantId});
   const result=store.ingest({...envelope,message_id:envelope.mailbox_id+':'+envelope.message_id,...(envelope.thread_id?{thread_id:envelope.mailbox_id+':'+envelope.thread_id}:{})},values,{approvedCaseId});
   const data=saved.find(c=>c.id===result.bookingCase.id);
   data.messages=data.messages.map(m=>({...m,message_id:m.message_id.slice(m.mailbox_id.length+1),...(m.thread_id?{thread_id:m.thread_id.slice(m.mailbox_id.length+1)}:{})}));
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
