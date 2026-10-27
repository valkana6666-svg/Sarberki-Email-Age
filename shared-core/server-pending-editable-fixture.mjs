// One exact, owner-requested synthetic acceptance fixture. No arbitrary input,
// credentials, live inventory, guest send or approved-case reopening.
import {CaseServiceError} from './server-case-service.mjs';
export const EDITABLE_FIXTURE_ID='case-editable-review-20261026';
export const EDITABLE_FIXTURE_DATES=Object.freeze({arrival:'2026-11-26',departure:'2026-11-28'});
const envelope=Object.freeze({sender:'guest@editable-review-20261026.invalid',
 text:'Hello! One Deluxe cabin from 2026-11-26 to 2026-11-28 for 2 adults and 0 children. Phone: +36 00 000 0000.',
 mailbox_id:'sarberki_editable_review_20261026',message_id:'editable-review-20261026-v1',
 thread_id:'editable-review-thread-20261026-v1',received_at:'2026-10-26T12:00:00.000Z'});
export const editableFixtureRequest=()=>({tenantId:'sarberki-test',action:'ingest-and-draft',expectedRevision:0,envelope:{...envelope}});
export function matchesEditableFixture(record){
 const data=record?.data,values=data?.state?.values,message=data?.messages?.[0];
 return record?.tenantId==='sarberki-test'&&record.caseId===EDITABLE_FIXTURE_ID&&
  data?.id===record.caseId&&data.tenantId===record.tenantId&&data.sender===envelope.sender&&
  !data.caseKind&&!data.linkReview&&data.messages?.length===1&&message&&
  Object.keys(message).length===Object.keys(envelope).length&&Object.keys(envelope).every(k=>message[k]===envelope[k])&&
  values?.arrival===EDITABLE_FIXTURE_DATES.arrival&&values.departure===EDITABLE_FIXTURE_DATES.departure&&
  values.adults==='2'&&values.children==='0'&&values.guests==='2'&&values.unit==='Deluxe';
}
const fail=code=>{throw new CaseServiceError(code,code);};
const pending=record=>record?.data?.state?.approval==='pending'&&!record.data.serverApproval&&record.data.messages?.length===1&&!record.data.caseKind;
const ready=record=>{
 const d=record.data,last=d.drafts?.at(-1);
 return pending(record)&&last?.synthetic===true&&last.reviewStatus==='internal_review_required'&&
  last.revision===d.state.revision&&last.basedOnMessageCount===1&&typeof last.text==='string'&&last.text.trim().length>0;
};
const metadata=(record,duplicate)=>({tenantId:'sarberki-test',caseId:record.caseId,revision:record.revision,duplicate,readyForReaderPreview:true});
export async function preparePendingEditableFixture({service,runtime,isReviewCase,now=Date.now}){
 await service.requireWrite({tenantId:'sarberki-test'});
 const records=await service.listCases({tenantId:'sarberki-test'}),today=new Date(now()).toISOString().slice(0,10);
 // Prefer an existing eligible reviewed case; never mutate it merely for a probe.
 for(const record of [...records].sort((a,b)=>a.caseId.localeCompare(b.caseId))){
  if(!ready(record)||typeof record.data.state.values?.arrival!=='string'||record.data.state.values.arrival<=today)continue;
  try{
   isReviewCase(record);
   if((await runtime.previewReview(record.caseId,record.revision)).status==='internal_review_required')return metadata(record,true);
  }catch{continue;}
 }
 let record=records.find(r=>r.caseId===EDITABLE_FIXTURE_ID||r.data?.messages?.some(m=>m.mailbox_id===envelope.mailbox_id&&m.message_id===envelope.message_id));
 const duplicate=Boolean(record);
 if(record){
  if(!matchesEditableFixture(record))fail('CASE_CONFLICT');
  if(!pending(record))fail('SYNTHETIC_FIXTURE_ALREADY_APPROVED');
  if(EDITABLE_FIXTURE_DATES.arrival<=today)fail('SYNTHETIC_FIXTURE_EXPIRED');
 }else{
  if(EDITABLE_FIXTURE_DATES.arrival<=today)fail('SYNTHETIC_FIXTURE_EXPIRED');
  const created=await runtime.ingest(editableFixtureRequest().envelope,undefined,{expectedRevision:0,persistDraft:true});
  record=created.record;
  if(!matchesEditableFixture(record)||!pending(record))fail('SYNTHETIC_FIXTURE_UNVERIFIED');
 }
 if(!ready(record)){
  const reviewed=await runtime.reviewAndDraft(record.caseId,record.revision);record=reviewed.record;
  if(reviewed.review.status!=='internal_review_required'||!ready(record))fail('SYNTHETIC_FIXTURE_UNVERIFIED');
 }
 isReviewCase(record);return metadata(record,duplicate);
}
