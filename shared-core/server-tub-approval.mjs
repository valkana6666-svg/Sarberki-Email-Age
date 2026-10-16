import {createHash,createHmac} from 'node:crypto';
import {BUSINESS} from '../business-config.mjs';
import {CaseServiceError} from './server-case-service.mjs';
import {latestTubServiceRequest,tubServiceMessage} from './tub-request.mjs';
import {createTubAvailabilityChecker,parseOffsetInstant} from './server-tub-availability.mjs';
import {AVAILABILITY,EVIDENCE_TTL_MS} from './availability-model.mjs';
export const SERVICE_APPROVAL_DOMAIN='sarberki:tub-service-approval:v1';
export const SERVICE_APPROVAL_FIELDS=Object.freeze(['tenantId','caseId','caseRevision','actor','targetCaseId','targetRevision','decisionRevision','requestId','requestHash','houseNumber','resourceId','start','end','timezone','bindingProvenance','bindingReference','bindingVersion','bindingCheckedAt','bindingValidUntil','sourceId','provenance','evidenceReference','version','checkedAt','validUntil','requestDate','requestTime','durationHours','status','previewHash']);
const reject=code=>{throw new CaseServiceError(code,code);};
export const serviceApprovalMessage=payload=>{
 if(!payload||Object.keys(payload).length!==SERVICE_APPROVAL_FIELDS.length||SERVICE_APPROVAL_FIELDS.some(k=>payload[k]===null||payload[k]===undefined||String(payload[k])===''||/[\r\n]/u.test(String(payload[k]))))reject('INVALID_EVIDENCE');
 return [SERVICE_APPROVAL_DOMAIN,...SERVICE_APPROVAL_FIELDS.map(k=>String(payload[k]))].join('\n');
};
export function createServiceApprovalAttestor(key){
 if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))reject('SETUP_REQUIRED');
 return payload=>createHmac('sha256',Buffer.from(key,'hex')).update(serviceApprovalMessage(payload)).digest('hex');
}
const previewHash=payload=>hash([SERVICE_APPROVAL_DOMAIN,...SERVICE_APPROVAL_FIELDS.filter(k=>!['previewHash','actor','checkedAt','validUntil','bindingCheckedAt','bindingValidUntil'].includes(k)).map(k=>String(payload[k]))].join('\n'));
const hash=text=>createHash('sha256').update(text,'utf8').digest('hex');
const id=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,255}$/.test(value);
function localParts(value){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:BUSINESS.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
 const p=Object.fromEntries(parts.map(v=>[v.type,v.value]));return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`,second:p.second};
}
export function createTubServiceApproval({service,tenantId,requestContext,clock=()=>new Date().toISOString(),bindingProvider=null,availabilityProvider=null,attestor=null}={}){
 const checker=createTubAvailabilityChecker({provider:availabilityProvider,clock:()=>Date.parse(clock())});
 const bind=typeof bindingProvider==='function'?bindingProvider:null;
 async function prepare(caseId,expectedRevision,readOnly=false){
  const actor=await service[readOnly?'requireRead':'requireApproval']({requestContext,tenantId});
  const review=await service.getCase({requestContext,tenantId,caseId});
  if(!review)reject('CASE_NOT_FOUND');if(review.revision!==expectedRevision)reject('CASE_CONFLICT');
  const link=review.data.caseKind==='service_link_review'?await service.serviceLinkState({requestContext,tenantId,caseId}):{status:'resolved',targetCaseId:caseId,targetRevision:review.revision,reviewRevision:0};
  if(tenantId!=='sarberki-test'||link?.status!=='resolved'||review.data.caseKind==='service_link_review'&&link.reviewRevision!==expectedRevision)reject('REVIEW_NOT_READY');
  const target=await service.getCase({requestContext,tenantId,caseId:link.targetCaseId});
  if(!target||target.revision!==link.targetRevision)reject('CASE_CONFLICT');
  const stay=target.data.state?.values;
  if(target.data.caseKind==='service_link_review'||!['booking_request','availability_request','price_request','modification_request'].includes(target.data.state?.intent)||
   !/^\d{4}-\d{2}-\d{2}$/.test(stay?.arrival||'')||!/^\d{4}-\d{2}-\d{2}$/.test(stay?.departure||'')||!Number.isFinite(parseOffsetInstant(stay.arrival+'T00:00:00Z'))||!Number.isFinite(parseOffsetInstant(stay.departure+'T00:00:00Z'))||stay.departure<=stay.arrival)reject('REVIEW_NOT_READY');
  const stored=latestTubServiceRequest(review.data),sources=review.data.messages.filter(m=>m.message_id===stored?.sourceMessageId||m.mailbox_id+':'+m.message_id===stored?.sourceMessageId),message=sources.length===1?sources[0]:null;
  const requests=review.data.messages.map(m=>({...tubServiceMessage(m.text||''),sourceMessageId:m.mailbox_id+':'+m.message_id,at:m.received_at})).filter(r=>r.kind==='tub_request');
  if(requests.some(r=>!Number.isFinite(parseOffsetInstant(r.at))))reject('REVIEW_NOT_READY');
  const active=latestTubServiceRequest({serviceRequests:requests});
  const request=tubServiceMessage(message?.text||'');
  if(!active||!message||active.sourceMessageId!==message.mailbox_id+':'+message.message_id||active.cancelled||active.actionConflict||!stored||stored.cancelled||stored.actionConflict||request.kind!=='tub_request'||request.cancelled||request.actionConflict||!request.startDate||!request.startTime||!request.durationHours||
   ['startDate','startTime','durationHours'].some(k=>request[k]!==stored[k]))reject('REVIEW_NOT_READY');
  if(!bind||!attestor)reject('SERVICE_AVAILABILITY_UNKNOWN');
  // Trusted server binding owns house/resource/absolute interval. Caller JSON
  // (including bookingContext.verified) cannot establish this authority.
  let binding;try{binding=structuredClone(await bind({review:structuredClone(review),target:structuredClone(target),request:structuredClone(request)}));}catch{reject('SERVICE_AVAILABILITY_UNKNOWN');}
  if(!binding||!['provenance','reference','version','resourceId'].every(k=>id(binding[k]))||binding.tenantId!==tenantId||binding.caseId!==caseId||binding.caseRevision!==review.revision||binding.targetCaseId!==target.caseId||binding.targetRevision!==target.revision||binding.requestId!==stored.sourceMessageId)reject('SERVICE_AVAILABILITY_UNKNOWN');
  const checked=parseOffsetInstant(binding.checkedAt),until=parseOffsetInstant(binding.validUntil),now=Date.parse(clock());
  if(!Number.isFinite(now)||!Number.isFinite(checked)||!Number.isFinite(until)||now<checked||now>=until||now-checked>=EVIDENCE_TTL_MS||until<=checked||until-checked>EVIDENCE_TTL_MS)reject('SERVICE_AVAILABILITY_UNKNOWN');
  const query={tenantId,caseId,caseRevision:review.revision,houseNumber:binding.houseNumber,resourceId:binding.resourceId,start:binding.start,end:binding.end};
  const evidence=await checker.check(query);
  if(!evidence.valid||evidence.status!==AVAILABILITY.AVAILABLE)reject('SERVICE_AVAILABILITY_UNKNOWN');
  const finished=Date.parse(clock());
  if(!Number.isFinite(finished)||finished<checked||finished>=until||finished-checked>=EVIDENCE_TTL_MS)reject('SERVICE_AVAILABILITY_UNKNOWN');
  const local=localParts(binding.start);
  if(local.date!==request.startDate||local.time!==request.startTime||local.second!=='00'||Date.parse(binding.start)%1000!==0||Date.parse(binding.end)-Date.parse(binding.start)!==request.durationHours*3600000)reject('REVIEW_NOT_READY');
  const payload={tenantId,caseId,caseRevision:review.revision,actor,targetCaseId:target.caseId,targetRevision:target.revision,decisionRevision:link.reviewRevision,requestId:stored.sourceMessageId,requestHash:hash(message.text),houseNumber:binding.houseNumber,resourceId:binding.resourceId,start:binding.start,end:binding.end,timezone:BUSINESS.timezone,bindingProvenance:binding.provenance,bindingReference:binding.reference,bindingVersion:binding.version,bindingCheckedAt:binding.checkedAt,bindingValidUntil:binding.validUntil,sourceId:evidence.sourceId,provenance:evidence.provenance,evidenceReference:evidence.evidenceReference,version:evidence.version,checkedAt:evidence.checkedAt,validUntil:evidence.validUntil,requestDate:request.startDate,requestTime:request.startTime,durationHours:request.durationHours,status:evidence.status};
  payload.previewHash=previewHash(payload);
  return {payload,attestation:attestor(payload)};
 }
 async function state(caseId,revision){
  const review=await service.getCase({requestContext,tenantId,caseId});
  if(!review||review.revision!==revision)reject('CASE_CONFLICT');
  const approval=await service.getServiceApproval({requestContext,tenantId,caseId});
  let status='unapproved';
  if(approval){
   const link=review.data.caseKind==='service_link_review'?await service.serviceLinkState({requestContext,tenantId,caseId}):{status:'resolved',targetCaseId:caseId,targetRevision:review.revision},p=approval.payload,now=Date.parse(clock());
   status=link?.status!=='resolved'||p.caseRevision!==revision||p.targetCaseId!==link.targetCaseId||p.targetRevision!==link.targetRevision?'stale':!Number.isFinite(now)||now<Date.parse(p.checkedAt)||now>=Date.parse(p.validUntil)||now-Date.parse(p.checkedAt)>=EVIDENCE_TTL_MS||now<Date.parse(p.bindingCheckedAt)||now>=Date.parse(p.bindingValidUntil)||now-Date.parse(p.bindingCheckedAt)>=EVIDENCE_TTL_MS?'expired':'current';
  }
  let fresh=null;
  try{fresh=await prepare(caseId,revision,true);}catch(error){if(!['FORBIDDEN','SERVICE_AVAILABILITY_UNKNOWN','REVIEW_NOT_READY','CASE_CONFLICT'].includes(error.code))throw error;}
  if(status==='current'&&(!fresh||fresh.payload.previewHash!==approval.payload.previewHash))status=fresh?'stale':'unverified';
  let canApproveService=false,preview=null;
  if(status!=='current'&&fresh)try{await service.requireApproval({requestContext,tenantId});canApproveService=true;const p=fresh.payload;preview={hash:p.previewHash,houseNumber:p.houseNumber,resourceId:p.resourceId,start:p.start,end:p.end,timezone:p.timezone,sourceId:p.sourceId,evidenceReference:p.evidenceReference,version:p.version,bindingReference:p.bindingReference,bindingVersion:p.bindingVersion};}catch(error){if(!['FORBIDDEN','SERVICE_AVAILABILITY_UNKNOWN','REVIEW_NOT_READY','CASE_CONFLICT'].includes(error.code))throw error;}
  return {status,canApproveService,preview,actor:approval?.actor??null,at:approval?.at??null};
 }
 return Object.freeze({state,async approve(caseId,revision,reviewedHash){
  if(typeof reviewedHash!=='string'||!/^[a-f0-9]{64}$/.test(reviewedHash))reject('INVALID_EVIDENCE');
  const proof=await prepare(caseId,revision);
  if(proof.payload.previewHash!==reviewedHash)reject('REVIEW_CHANGED');
  // Authority is rechecked after trusted providers; DB checks current session,
  // both case revisions, A decision and deadline again while holding locks.
  return service.approveService({requestContext,tenantId,caseId,expectedRevision:revision,...proof});
 }});
}
