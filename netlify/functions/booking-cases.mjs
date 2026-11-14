import {createHash} from 'node:crypto';
import {clarificationEnabled} from '../../shared-core/server-clarification-review.mjs';
import {createTubServiceApproval,createServiceApprovalAttestor} from '../../shared-core/server-tub-approval.mjs';
import {createServerCaseService} from '../../shared-core/server-case-service.mjs';
import {createSupabaseTransport,createSupabaseAuthority,createSupabaseCaseRepository} from '../../shared-core/supabase-case-repository.mjs';
import {createServerBookingRuntime} from '../../shared-core/server-booking-runtime.mjs';
import {createOperatorCookieSession,OperatorSessionError,operatorSessionErrorBody,clearOperatorCookie} from '../../shared-core/operator-cookie-session.mjs';
import {createIsolatedApprovalAttestor} from '../../shared-core/isolated-approval-attestation.mjs';
import {isIsolatedReviewCaseId} from '../../shared-core/isolated-review-case-id.mjs';
import {cloudSyntheticApprovalEnabled,cloudSyntheticReviewProviders,assertCloudSyntheticReviewCase,assertCloudSyntheticReadCase} from '../../shared-core/cloud-synthetic-approval.mjs';
import {createExactGmailReceipt,exactGmailEditReceipt,matchesExactGmailEditRecord,readExactReceiptAudit,diagnoseExactGmailReceiptRequest} from '../../shared-core/server-exact-gmail-receipt.mjs';
import {closedSyntheticMailLanguage,isClosedTubFollowup,isClosedTubPreviousRecord,isClosedTubReview,isClosedTubReviewRecord} from '../../shared-core/synthetic-mail-fixtures.mjs';
import {resolveBookingCase} from '../../booking-cases.mjs';
import {dailyCaseSummary} from '../../shared-core/server-daily-case-view.mjs';
import {ingestTestMailboxMessage} from '../../shared-core/server-test-mailbox-case.mjs';
import {appendTestMailboxFollowup,triageTestMailboxMessages} from '../../shared-core/server-test-mailbox-followup.mjs';
import {sendApprovedTestMailboxReply} from '../../shared-core/server-test-mailbox-send.mjs';
import {priceTestMailboxCase} from '../../shared-core/server-test-mailbox-price.mjs';
import {previoPriceChecker} from '../../shared-core/server-previo-price-check.mjs';
import {previoUnitChecker} from '../../shared-core/server-previo-unit-check.mjs';
import {previoSplitPlacementReader} from '../../shared-core/server-previo-split-placement.mjs';
import {previoBookingWriter} from '../../shared-core/server-previo-booking-sync.mjs';
import {confirmTestMailboxBooking,previewTestMailboxBooking,pickFreeUnits,oneClickTestMailboxBooking,markTestMailboxDepositReceived,cancelTestMailboxBooking,modifyTestMailboxBooking} from '../../shared-core/server-test-mailbox-confirm.mjs';
import {bookingIntentHint} from '../../shared-core/booking-intent.mjs';
import {previoAvailabilitySource} from '../../shared-core/server-capacity-draft.mjs';
import {buildAvailabilityOptions} from './availability-options.mjs';
import {markTestMailboxUnavailable} from '../../shared-core/server-test-mailbox-unavailable.mjs';
import {fetchMnbEurRate} from './price-quote.mjs';
import {serverDeployment} from '../../shared-core/server-deployment.mjs';
import {readPrevioFreeCapacity} from '../../shared-core/server-previo-rest-read.mjs';
import {translateTestMailboxMessage} from '../../shared-core/server-translation.mjs';
import {languageFromText} from '../../sarberki-core.mjs';
import {translationErrorCode} from '../../translation-errors.mjs';
// Process-local cache of verified translations per case revision (no repeated provider calls on re-open).
const testMailboxTranslations=new Map();
const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const response=(statusCode,body)=>({statusCode,headers,body:JSON.stringify(body)});
// Cookie-reader case picker gets metadata only, never raw inquiry content.
// Owner 2026-11-13: the operator must recognise a case in the list without its id - guest name, house type, stay,
// guests, when the mail arrived and the booking state. Same protected read as opening the case; plain short strings.
const listText=(v,max)=>typeof v==='string'&&v.trim()?v.replace(/[\u0000-\u001f]+/g,' ').trim().slice(0,max):null;
const listDay=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:null;
function testMailboxListSummary(record){
 const v=record?.data?.state?.values||{},m=Array.isArray(record?.data?.messages)?record.data.messages:[];
 const adults=Number(v.adults),children=Number(v.children||0);
 const received=m.map(x=>x?.received_at).filter(x=>typeof x==='string'&&!Number.isNaN(Date.parse(x))).sort()[0]||null;
 const email=typeof record?.data?.sender==='string'&&/^[^\s@<>]{1,64}@[^\s@<>]{1,190}$/.test(record.data.sender)?record.data.sender.toLowerCase():null;
 const channel=['phone','chat'].includes(record?.data?.testMailbox?.channel)?record.data.testMailbox.channel:'email';
 return {name:listText(v.name,60),email,channel,unit:listText(v.unit,30),arrival:listDay(v.arrival),departure:listDay(v.departure),
  guests:Number.isInteger(adults)&&adults>0&&Number.isInteger(children)&&children>=0?adults+children:null,receivedAt:received,
  booking:['finalized','deposit_received','cancelled'].includes(record?.data?.booking?.status)?record.data.booking.status:null};
}

export function syntheticCaseSummaries(records,exactReceipt=null){
 if(!Array.isArray(records))throw Error('INVALID_CASE_LIST');
 return records.filter(row=>row?.tenantId==='sarberki-test'&&
  isIsolatedReviewCaseId(row.caseId)&&Number.isSafeInteger(row.revision)&&row.revision>=1&&
  typeof row.data?.sender==='string'&&
  (/^[^\s@]+@[^\s@]+\.invalid$/iu.test(row.data.sender)||exactReceipt?.matchesRecord(row)))
  .map(row=>({tenantId:'sarberki-test',caseId:row.caseId,revision:row.revision})).slice(0,100);
}
// Fixed public codes for the test-mailbox action; anything else becomes STORAGE_FAILURE.
const TEST_MAILBOX_ERRORS=Object.freeze({GMAIL_AUTH_REQUIRED:401,WRONG_GMAIL_ACCOUNT:403,FORBIDDEN:403,GMAIL_RATE_LIMITED:429,INVALID_INPUT:400,
 GMAIL_SOURCE_UNVERIFIED:422,NOT_MARKED_TEST_MESSAGE:422,NOT_TEST_PAIR_INQUIRY:422,REPLY_HANDLED_IN_GMAIL:422,NOT_A_FOLLOWUP:422,FOLLOWUP_CASE_NOT_FOUND:404,ALREADY_IN_CASE:409,LIVE_MAILBOX_READER_PENDING:503,AUTOMATED_MESSAGE:422,REPLY_NOT_ALLOWED:422,NOT_ADDRESSED_TO_TEST_MAILBOX:422,INVALID_SENDER:422,MESSAGE_ID_REQUIRED:422,
 TEXT_PART_REQUIRED:422,EMPTY_TEXT:422,TEXT_TOO_LONG:422,UNREADABLE_TEXT:422,INVALID_DRAFT:422,STORAGE_FAILURE:503,
 NOT_APPROVED:409,RECIPIENT_NOT_ALLOWED:403,SOURCE_UNVERIFIED:422,SEND_FAILED:502,SEND_OUTCOME_UNKNOWN:409,CASE_CONFLICT:409,
 PRICE_FACTS_MISSING:422,PRICE_LINE_MISSING:422,PRICE_REFUSED:422,AVAILABILITY_NOT_CONFIRMED:400,TEST_MAILBOX_REJECTED:409,
 UNAVAILABILITY_NOT_CONFIRMED:400,DRAFT_SHAPE_UNKNOWN:422,ALREADY_UNAVAILABLE:409,PREVIO_NO_FREE_UNIT:409,
 PREVIO_RECORDING_REQUIRED:400,ALREADY_FINALIZED:409,CONFIRMATION_FACTS_MISSING:422,CONFIRMATION_PRICE_MISSING:422,CONFIRMATION_CABIN_UNKNOWN:422,
 DEPOSIT_POLICY_UNVERIFIED:422,DEPOSIT_NOT_CONFIRMED:400,NOT_FINALIZED:409,INVALID_DATE:400,UNIT_TAKEN:409,UNIT_TAKEN_IN_PREVIO:409,UNIT_NOT_IN_TYPE:422,
 PREVIO_WRITE_DISABLED:409,PREVIO_WRITE_UNCERTAIN:502,PREVIO_BOOKING_NOT_ACTIVE:409,PREVIO_ORPHAN_OPTION:502,PREVIO_AUTH_REFUSED:502,PREVIO_REJECTED:502,PREVIO_SEARCH_FAILED:502,PREVIO_TIMEOUT:504,PREVIO_UNAVAILABLE:502,
 CANCEL_NOT_CONFIRMED:400,INVALID_REASON:400,NOT_ACTIVE_BOOKING:409,UNITS_INVALID:422,UNITS_COUNT_MISMATCH:422,UNITS_MIXED_SPLIT:422,PARTIES_REQUIRED:422,
 MODIFY_NOT_CONFIRMED:400,MULTI_UNIT_MODIFY_UNSUPPORTED:422,PREVIO_MANUAL_BOOKING:422,NOTHING_CHANGED:400,PREVIO_MODIFY_UNVERIFIED:502,PREVIO_MODIFY_NOT_REVERTED:502,
 PREVIEW_CHANGED:409,PREVIO_UNIT_UNVERIFIED:409,ONECLICK_NOT_CONFIRMED:400,ONECLICK_ROLE_REQUIRED:403,NO_FREE_UNIT:409,AUTO_UNIT_UNAVAILABLE:409});
const TEST_MAILBOX_FIELDS=Object.freeze({
 'test-mailbox-ingest':['action,messageId,tenantId'],
 'test-mailbox-followup':['action,messageId,tenantId'],
 'test-mailbox-triage':['action,messageIds,tenantId'],
 'test-mailbox-redraft':['action,caseId,draftText,expectedRevision,tenantId'],
 'test-mailbox-decide':['action,caseId,decision,expectedRevision,reviewedDraftHash,tenantId','action,caseId,decision,expectedRevision,reason,reviewedDraftHash,tenantId'],
 'test-mailbox-send':['action,caseId,expectedRevision,tenantId'],
 'test-mailbox-price':['action,availabilityConfirmed,cabin,caseId,expectedRevision,tenantId'],
 'test-mailbox-unavailable':['action,caseId,expectedRevision,tenantId,unavailableConfirmed'],
 'test-mailbox-confirm':['action,caseId,expectedRevision,previoRecorded,previoReference,tenantId,unit','action,caseId,expectedRevision,previoAuto,tenantId,unit',
  'action,caseId,expectedRevision,previoRecorded,previoReference,tenantId,unit,units','action,caseId,expectedRevision,previoAuto,tenantId,unit,units'],
 'test-mailbox-deposit':['action,caseId,depositConfirmed,expectedRevision,receivedOn,tenantId'],
 'test-mailbox-cancel':['action,cancelConfirmed,caseId,expectedRevision,reason,tenantId'],
 'test-mailbox-modify':['action,arrival,caseId,departure,expectedRevision,modifyConfirmed,tenantId,unit'],
 'test-mailbox-oneclick':['action,caseId,expectedRevision,oneClickConfirmed,previewHash,tenantId,unit','action,caseId,expectedRevision,oneClickConfirmed,previewHash,tenantId,unit,units']
});
function validTestMailboxInput(input){
 if(input.action==='test-mailbox-triage')return Array.isArray(input.messageIds)&&input.messageIds.length>0&&input.messageIds.length<=25&&input.messageIds.every(id=>typeof id==='string'&&/^[a-f0-9]{12,32}$/.test(id));
 if(input.action==='test-mailbox-ingest'||input.action==='test-mailbox-followup')return typeof input.messageId==='string'&&/^[a-f0-9]{12,32}$/.test(input.messageId);
 if(typeof input.caseId!=='string'||!/^tm-[a-f0-9]{12,32}$/.test(input.caseId)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<1)return false;
 if(input.action==='test-mailbox-send')return true;
 if(input.action==='test-mailbox-unavailable')return input.unavailableConfirmed===true;
 if(input.action==='test-mailbox-oneclick'&&!(input.oneClickConfirmed===true&&typeof input.previewHash==='string'&&/^[a-f0-9]{64}$/.test(input.previewHash)&&typeof input.unit==='string'&&/^(?:[1-9]|1[0-5]|(?:7|8|9|10)\/[ABC])$/.test(input.unit)))return false;
 if(input.action==='test-mailbox-oneclick'&&input.units!==undefined&&!(Array.isArray(input.units)&&input.units.length>=2&&input.units.length<=6&&input.units.every(u=>typeof u==='string'&&/^(?:[1-9]|1[0-5]|(?:7|8|9|10)\/[ABC])$/.test(u))&&input.units[0]===input.unit))return false;
 if(input.action==='test-mailbox-oneclick')return true;
 if(input.action==='test-mailbox-confirm'&&input.units!==undefined&&!(Array.isArray(input.units)&&input.units.length>=2&&input.units.length<=6&&input.units.every(u=>typeof u==='string'&&/^(?:[1-9]|1[0-5]|(?:7|8|9|10)\/[ABC])$/.test(u))&&input.units[0]===input.unit))return false;
 if(input.action==='test-mailbox-confirm'&&input.previoAuto!==undefined)return input.previoAuto===true&&typeof input.unit==='string'&&/^(?:[1-9]|1[0-5]|(?:7|8|9|10)\/[ABC])$/.test(input.unit);
 if(input.action==='test-mailbox-confirm')return input.previoRecorded===true&&typeof input.previoReference==='string'&&/^[A-Za-z0-9\/_.-]{1,40}$/.test(input.previoReference)&&typeof input.unit==='string'&&/^(?:[1-9]|1[0-5]|(?:7|8|9|10)\/[ABC])$/.test(input.unit);
 if(input.action==='test-mailbox-modify')return input.modifyConfirmed===true&&/^\d{4}-\d{2}-\d{2}$/.test(input.arrival)&&/^\d{4}-\d{2}-\d{2}$/.test(input.departure)&&input.departure>input.arrival&&typeof input.unit==='string'&&/^(?:[1-9]|1[0-5]|(?:7|8|9|10)\/[ABC])$/.test(input.unit);
 if(input.action==='test-mailbox-cancel')return input.cancelConfirmed===true&&typeof input.reason==='string'&&input.reason.trim().length>0&&input.reason.length<=300&&!/[\r\n]/.test(input.reason);
 if(input.action==='test-mailbox-deposit')return input.depositConfirmed===true&&typeof input.receivedOn==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(input.receivedOn);
 if(input.action==='test-mailbox-price')return input.availabilityConfirmed===true&&['deluxe','family','vip','small','splitA','splitB','splitC'].includes(input.cabin);
 if(input.action==='test-mailbox-redraft')return typeof input.draftText==='string'&&input.draftText.trim().length>0&&input.draftText.length<=20000;
 return typeof input.reviewedDraftHash==='string'&&/^[a-f0-9]{64}$/.test(input.reviewedDraftHash)&&['approve','return','reject'].includes(input.decision)&&
  (input.reason===undefined||typeof input.reason==='string'&&input.reason.length<=500&&!/[\r\n]/.test(input.reason));
}
// Only sc_tm_create (Gmail) and sc_intake_create (phone/chat, V3-1) produce this shape; the scope is set by the database
// functions alone (clients cannot send testMailbox). Synthetic writers are limited to .invalid senders.
function isTestMailboxCase(record,tenant='sarberki-test'){
 return record?.tenantId===tenant&&typeof record.caseId==='string'&&/^tm-[a-f0-9]{12,32}$/.test(record.caseId)&&
  typeof record.data?.sender==='string'&&!/\.invalid$/i.test(record.data.sender)&&['test-mailbox-source-v1','intake-source-v1'].includes(record.data.testMailbox?.scope)&&
  Array.isArray(record.data.drafts)&&record.data.drafts.length>0&&Array.isArray(record.data.messages);
}
function testMailboxView(record,authority,tenant='sarberki-test',previoRead=false,previoWrite=false){
 const data=record.data,state=data.state?.approval,latest=data.drafts.at(-1),permissions=authority?.tenants?.[tenant]||[];
 return {caseId:record.caseId,revision:record.revision,approval:state,
  messages:data.messages.map(m=>({text:m.text,received_at:m.received_at})),values:data.state?.values||{},
  // V3-1: where the request came from; phone/chat cases have no Gmail thread to reply to.
  channel:['phone','chat'].includes(data.sourceReceipt?.provider)?data.sourceReceipt.provider:'gmail',
  draft:{text:latest.text,operatorReviewText:latest.operatorReviewText??null,createdAt:latest.createdAt??null,hash:createHash('sha256').update(String(latest.text),'utf8').digest('hex')},
  // Display hint: the owner switch for the read-only Previo checks (free units, price, unit) is on.
  previoRead:previoRead===true,
  // V2 hint: the server can create/confirm the Previo TEST booking itself (switch + recorded permission).
  previoWrite:previoWrite===true,
  decisions:(data.decisions||[]).map(d=>({decision:d.decision,at:d.at,reason:d.reason??null,reviewedRevision:d.reviewedRevision})),
  internalApproval:data.internalApproval?{scope:data.internalApproval.scope,at:data.internalApproval.at,capacityVerified:false,priceVerified:false,sendAllowed:false,bookingAllowed:false}:null,
  // Display hints only: the database re-checks permission, state, revision, hash and approver independence.
  canEditDraft:permissions.includes('write')&&['pending','returned_for_edit','rejected'].includes(state),
  canDecide:permissions.includes('approve')&&state==='pending'&&(latest.createdBy!==authority?.subject||latest.machineDraft===true),
  // V1 booking completion: finalized only after the operator's Previo attestation; deposit received is separate.
  unitsRequested:Number(data.state?.values?.units_requested||1),
  booking:data.booking?{status:data.booking.status,unit:data.booking.unit??null,units:Array.isArray(data.booking.units)?data.booking.units:null,previoReference:data.booking.previo?.reference??null,deposit:data.booking.deposit??null,depositReceivedOn:data.booking.depositReceived?.on??null}:null,
  // Hint only (V1): the guest's reply reads as an explicit booking acceptance; nothing is booked here.
  bookingIntent:bookingIntentHint(data.messages,data.booking?.status),
  canFinalize:permissions.includes('write')&&!['finalized','deposit_received'].includes(data.booking?.status),
  // One-click V2 (PERM-20261112-ONECLICK): one account with write AND approve, the V2 writer on, not yet finalized.
  canOneClick:permissions.includes('write')&&permissions.includes('approve')&&previoWrite===true&&!['finalized','deposit_received'].includes(data.booking?.status),
  canMarkDeposit:permissions.includes('write')&&data.booking?.status==='finalized',
  canCancelBooking:permissions.includes('write')&&['finalized','deposit_received'].includes(data.booking?.status),
  canModifyBooking:permissions.includes('write')&&['finalized','deposit_received'].includes(data.booking?.status)&&/^V2-\d+$/.test(data.booking?.previo?.reference||'')&&!Array.isArray(data.booking?.units)&&previoWrite===true};
}
// Read-only Previo capacity before the price step. Owner switch, default off; only the API TEST property
// (73521, enforced again in the reader). AGENTS.md: switch on only after Previo documented that the read
// creates no hold/booking. The key and mapping are server env only.
export function previoCapacityReader(env,fetchImpl){
 // Live read (753011): separate switch, default off, its own mapping/rate plan; prepared 2026-11-07, NOT enabled.
 // Enable only after the owner accepts the documented no-hold evidence and the key's live scope is verified.
 if(env.PREVIO_LIVE_READ==='availability-only'){
  let liveMap;try{liveMap=JSON.parse(env.PREVIO_LIVE_ROOM_KIND_MAP||'');}catch{return null;}
  return ({cabin,arrival,departure})=>readPrevioFreeCapacity({apiKey:env.PREVIO_API_KEY,hotelId:'753011',ratePlanId:env.PREVIO_LIVE_RATE_PLAN_ID,
   mapping:liveMap,cabins:[cabin],arrival,departure,allowLive:true,fetchImpl});
 }
 if(env.PREVIO_READ_API_ENABLED!=='sandbox-73521-only')return null;
 let mapping;try{mapping=JSON.parse(env.PREVIO_ROOM_KIND_MAP||'');}catch{return null;}
 return ({cabin,arrival,departure})=>readPrevioFreeCapacity({apiKey:env.PREVIO_API_KEY,hotelId:env.PREVIO_HOTEL_ID,ratePlanId:env.PREVIO_RATE_PLAN_ID,
  mapping,cabins:[cabin],arrival,departure,fetchImpl});
}
// Daily category (owner request 2026-11-06): a booking whose newest draft answers a guest's reply waits in
// "Folytatásra vár" until that exact draft has been sent (send ledger: status sent for its hash).
async function sentDraftKeys(transport,tenant){
 try{const rows=await transport('/rest/v1/sc_tm_send_ledger?select=case_id,draft_hash,status&tenant_id=eq.'+tenant);
  return new Set((Array.isArray(rows)?rows:[]).filter(r=>r.status==='sent').map(r=>r.case_id+':'+r.draft_hash));}catch{return new Set();}
}
function testMailboxCategory(record,sent){
 const latest=record.data.drafts?.at?.(-1),hash=createHash('sha256').update(String(latest?.text??''),'utf8').digest('hex');
 if(latest?.followup===true&&!sent.has(record.caseId+':'+hash))return 'followup';
 return record.data.state?.approval==='pending'?'approval':'progress';
}
function testMailboxIngestEnabled(env,cloudApproval){
 return cloudApproval&&env.CASE_TEST_MAILBOX_INGEST_ENABLED==='sarberki-test-fictional-only';
}
// Separate owner switch, default off (AGENTS.md TESZT-LEVÉLKÜLDÉSI ENGEDÉLY): removing the variable stops sending.
function testMailboxSendEnabled(env,cloudApproval){
 return testMailboxIngestEnabled(env,cloudApproval)&&env.CASE_TEST_MAILBOX_SEND_ENABLED==='sarberki-test-pair-only';
}
export function createCaseHandler({env=process.env,fetchImpl=fetch,isolatedApproval=false,reviewProviders=null,serviceBindingProvider=null,serviceAvailabilityProvider=null}={}){
 return async event=>{
  // Fail closed even when deployed automatically with the repository. One deployment decision (live store
  // slice 2): TEST keeps every existing gate; LIVE needs its own site, store switch and mailbox switch, and
  // exposes ONLY the mailbox routes below, never the synthetic/legacy routes and never sending (AGENTS.md).
  let deployment;try{deployment=serverDeployment(env);}catch{return response(503,{error:'CASE_STORE_DISABLED'});}
  const live=deployment.environment==='live',TENANT=deployment.tenantId;
  if(live?(env.CASE_STORE_ENABLED!=='sarberki-live'||env.URL!==deployment.origin||env.CASE_LIVE_MAILBOX_ENABLED!=='sarberki-live-mailbox')
   :(env.CASE_STORE_ENABLED!=='synthetic-only'||env.URL!=='https://leafy-chimera-2403e5.netlify.app'||env.CASE_STORE_TEST_TENANTS!=='sarberki-test,demo-test'))
   return response(503,{error:'CASE_STORE_DISABLED'});
  if(!['GET','POST'].includes(event.httpMethod))return response(405,{error:'METHOD_NOT_ALLOWED'});
  const authorization=event.headers?.authorization||event.headers?.Authorization;
  const cloudApproval=!live&&cloudSyntheticApprovalEnabled(env);
  const mailboxOn=live||testMailboxIngestEnabled(env,cloudApproval);
  const exactReceipt=createExactGmailReceipt(env);
  const exactEditReceipt=cloudApproval?exactGmailEditReceipt(env,exactReceipt):null;
  const exactEditable=record=>matchesExactGmailEditRecord(record,exactEditReceipt);
  const assertReviewAccess=record=>{if(!exactEditable(record))assertCloudSyntheticReviewCase(record);};
  const assertReadAccess=record=>{if(!exactEditable(record))assertCloudSyntheticReadCase(record);};
  const cookieMode=authorization===undefined&&(event.httpMethod==='GET'||cloudApproval&&event.httpMethod==='POST')&&
   Object.keys(event.headers||{}).some(key=>['cookie','x-sarberki-operator'].includes(key.toLowerCase()));
  if(!cookieMode&&(typeof authorization!=='string'||!/^Bearer [A-Za-z0-9._-]{20,8192}$/.test(authorization)))return response(401,{error:'AUTH_REQUIRED'});
  let rotatedCookie=null;
  const cookieResponse=(statusCode,body,setCookie=rotatedCookie)=>{
   const result=response(statusCode,body);
   if(cookieMode)result.headers={...result.headers,'Cache-Control':'private, no-store','Pragma':'no-cache','Expires':'0',...(setCookie?{'Set-Cookie':setCookie}:{})};
   return result;
  };
  if(event.isBase64Encoded||Buffer.byteLength(event.body||'')>32768)return response(400,{error:'INVALID_INPUT'});
  try{
   const input=event.httpMethod==='GET'?(event.queryStringParameters||{}):JSON.parse(event.body||'{}');
   if(!input||typeof input!=='object'||Array.isArray(input))return response(400,{error:'INVALID_INPUT'});
   let cookieSession=null;
   // Server-attested fictional test-mailbox cases (WP3/WP4a). Off unless the owner sets the switch; cookie
   // session with CSRF only; Writer for ingest/redraft, Approver for decisions (the database also enforces an
   // approver independent of the draft author). The Gmail token travels in its own header, is used once and
   // is never stored or echoed. Fixed public error codes only.
   // Hungarian translation of a stored foreign-language test-mailbox message, shown under the message.
   // Chatbot availability (owner demo 2026-11-11, "1. pont"): an AUTHENTICATED operator's chat asks the Previo TEST
   // free-unit read for a complete, already decided capacity input. Read only; same owner switch as Level 1; never on
   // the live profile; the public chatbot stays without Previo (availability-options.mjs rule).
   if(input.action==='chat-availability'){
    const keyset=Object.keys(input).sort().join(',');
    if(event.httpMethod!=='GET'||!cookieMode||live||input.tenantId!==TENANT||!['action,adults,arrival,cabin,departure,guests,tenantId,units','action,adults,arrival,cabin,departure,guests,tenantId'].includes(keyset))return cookieResponse(403,{error:'FORBIDDEN'});
    const hasUnits=input.units!==undefined;
    const reader=previoCapacityReader(env,fetchImpl);
    if(!reader)return cookieResponse(503,{error:'PREVIO_READ_DISABLED'});
    const n=k=>Number(input[k]);
    const day=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'');
    if(!day(input.arrival)||!day(input.departure)||input.departure<=input.arrival||!['vip','family','deluxe','small','splitA','splitB','splitC'].includes(input.cabin)
     ||![n('guests'),n('adults')].every(Number.isInteger)||n('guests')<1||n('guests')>40||n('adults')<1||n('adults')>n('guests')||(hasUnits&&(!Number.isInteger(n('units'))||n('units')<1||n('units')>6)))
     return cookieResponse(400,{error:'INVALID_INPUT'});
    cookieSession=await createOperatorCookieSession({env,fetchImpl}).protectedRead(event);
    rotatedCookie=cookieSession.setCookie;
    try{
     const capacity=await buildAvailabilityOptions({arrival:input.arrival,departure:input.departure,guests:n('guests'),adults:n('adults'),cabin:input.cabin,...(hasUnits?{units:n('units')}:{}),fallback:false},
      previoAvailabilitySource(reader),{tenantId:'sarberki',now:()=>Date.now()});
     return cookieResponse(200,{result:{capacity}});
    }catch{return cookieResponse(502,{error:'PREVIO_UNAVAILABLE'});}
   }
   if(input.action==='test-mailbox-translate'){
    if(event.httpMethod!=='GET'||!cookieMode||!mailboxOn||input.tenantId!==TENANT||Object.keys(input).sort().join(',')!=='action,caseId,tenantId')
     return cookieResponse(403,{error:'FORBIDDEN'});
    if(typeof input.caseId!=='string'||!/^tm-[a-f0-9]{12,32}$/.test(input.caseId))return cookieResponse(400,{error:'INVALID_INPUT'});
    cookieSession=await createOperatorCookieSession({env,fetchImpl}).protectedRead(event);
    rotatedCookie=cookieSession.setCookie;
    const rows=await cookieSession.transport('/rest/v1/sc_cases?select=*&tenant_id=eq.'+TENANT+'&case_id=eq.'+encodeURIComponent(input.caseId));
    const row=Array.isArray(rows)&&rows.length===1?rows[0]:null;
    const record=row&&{tenantId:row.tenant_id,caseId:row.case_id,revision:Number(row.revision),data:row.data};
    if(!record||!isTestMailboxCase(record,TENANT))return cookieResponse(404,{error:'NOT_FOUND'});
    const text=String(record.data.messages[0]?.text||''),language=languageFromText(text);
    if(!['de','en','si'].includes(language))return cookieResponse(200,{result:{caseId:record.caseId,needed:false,language}});
    const key=record.caseId+':'+createHash('sha256').update(text,'utf8').digest('hex');
    try{
     if(!testMailboxTranslations.has(key)){
      const translated=await translateTestMailboxMessage({text,sourceLanguage:language},{env,fetchImpl});
      if(testMailboxTranslations.size>=200)testMailboxTranslations.clear();
      testMailboxTranslations.set(key,translated.text);
     }
     return cookieResponse(200,{result:{caseId:record.caseId,needed:true,language,text:testMailboxTranslations.get(key)}});
    }catch(error){return cookieResponse(503,{error:translationErrorCode(error?.message)});}
   }
   // Automatic free-unit suggestion (owner 2026-11-13: "mindig automatikusan ajánljon fel egy szabad egységet",
   // manual choice stays possible). Read only: our bookings + the Previo TEST unit read.
   if(input.action==='test-mailbox-suggest-units'){
    if(event.httpMethod!=='GET'||!cookieMode||!mailboxOn||live||input.tenantId!==TENANT||Object.keys(input).sort().join(',')!=='action,caseId,tenantId')
     return cookieResponse(403,{error:'FORBIDDEN'});
    if(typeof input.caseId!=='string'||!/^tm-[a-f0-9]{12,32}$/.test(input.caseId))return cookieResponse(400,{error:'INVALID_INPUT'});
    cookieSession=await createOperatorCookieSession({env,fetchImpl}).protectedRead(event);
    rotatedCookie=cookieSession.setCookie;
    try{
     const rows=await cookieSession.transport('/rest/v1/sc_cases?select=*&tenant_id=eq.'+TENANT+'&case_id=eq.'+encodeURIComponent(input.caseId));
     const row=Array.isArray(rows)&&rows.length===1?rows[0]:null;
     const record=row&&{tenantId:row.tenant_id,caseId:row.case_id,revision:Number(row.revision),data:row.data};
     if(!record||!isTestMailboxCase(record,TENANT))return cookieResponse(404,{error:'NOT_FOUND'});
     const units=await pickFreeUnits({record,transport:cookieSession.transport,unitCheckFn:previoUnitChecker(env,fetchImpl)});
     return cookieResponse(200,{result:{caseId:record.caseId,revision:record.revision,units}});
    }catch(error){
     const code=TEST_MAILBOX_ERRORS[error?.code]?error.code:'TEST_MAILBOX_REJECTED';
     return cookieResponse(TEST_MAILBOX_ERRORS[code],{error:code});
    }
   }
   // One-click V2 preview (PERM-20261112-ONECLICK): read only - our checks + the Previo TEST unit/price reads.
   if(input.action==='test-mailbox-oneclick-preview'){
    const keyset=Object.keys(input).sort().join(',');
    if(event.httpMethod!=='GET'||!cookieMode||!mailboxOn||live||input.tenantId!==TENANT||!['action,caseId,tenantId,unit','action,caseId,tenantId,unit,units'].includes(keyset))
     return cookieResponse(403,{error:'FORBIDDEN'});
    const unitRe=/^(?:[1-9]|1[0-5]|(?:7|8|9|10)\/[ABC])$/;
    const units=input.units===undefined?null:String(input.units).split(',');
    // unit=auto (owner 2026-11-13): the server picks free unit(s) read-only; the operator may still change them.
    const auto=input.unit==='auto'&&input.units===undefined;
    if(typeof input.caseId!=='string'||!/^tm-[a-f0-9]{12,32}$/.test(input.caseId)||typeof input.unit!=='string'||!auto&&!unitRe.test(input.unit)
     ||units&&!(units.length>=2&&units.length<=6&&units.every(u=>unitRe.test(u))&&units[0]===input.unit))return cookieResponse(400,{error:'INVALID_INPUT'});
    cookieSession=await createOperatorCookieSession({env,fetchImpl}).protectedRead(event);
    rotatedCookie=cookieSession.setCookie;
    try{
     const rows=await cookieSession.transport('/rest/v1/sc_cases?select=*&tenant_id=eq.'+TENANT+'&case_id=eq.'+encodeURIComponent(input.caseId));
     const row=Array.isArray(rows)&&rows.length===1?rows[0]:null;
     const record=row&&{tenantId:row.tenant_id,caseId:row.case_id,revision:Number(row.revision),data:row.data};
     if(!record||!isTestMailboxCase(record,TENANT))return cookieResponse(404,{error:'NOT_FOUND'});
     const perms=cookieSession.authority?.tenants?.[TENANT]||[];
     let unit=input.unit,list=units;
     if(auto){const picked=await pickFreeUnits({record,transport:cookieSession.transport,unitCheckFn:previoUnitChecker(env,fetchImpl)});unit=picked[0];list=picked.length>1?picked:null;}
     const preview=await previewTestMailboxBooking({record,unit,units:list,transport:cookieSession.transport,unitCheckFn:previoUnitChecker(env,fetchImpl),
      priceCheckFn:previoPriceChecker(env,fetchImpl),previoWriterOn:previoBookingWriter(env,fetchImpl)!==null});
     if(!(perms.includes('write')&&perms.includes('approve'))){preview.blockers.push('ONECLICK_ROLE_REQUIRED');preview.ready=false;}
     return cookieResponse(200,{result:{caseId:record.caseId,revision:record.revision,autoPicked:auto,...preview}});
    }catch(error){
     const code=TEST_MAILBOX_ERRORS[error?.code]?error.code:'TEST_MAILBOX_REJECTED';
     return cookieResponse(TEST_MAILBOX_ERRORS[code],{error:code});
    }
   }
   if(input.action==='test-mailbox-record'){
    if(event.httpMethod!=='GET'||!cookieMode||!mailboxOn||input.tenantId!==TENANT||Object.keys(input).sort().join(',')!=='action,caseId,tenantId')
     return cookieResponse(403,{error:'FORBIDDEN'});
    if(typeof input.caseId!=='string'||!/^tm-[a-f0-9]{12,32}$/.test(input.caseId))return cookieResponse(400,{error:'INVALID_INPUT'});
    cookieSession=await createOperatorCookieSession({env,fetchImpl}).protectedRead(event);
    rotatedCookie=cookieSession.setCookie;
    const rows=await cookieSession.transport('/rest/v1/sc_cases?select=*&tenant_id=eq.'+TENANT+'&case_id=eq.'+encodeURIComponent(input.caseId));
    const row=Array.isArray(rows)&&rows.length===1?rows[0]:null;
    const record=row&&{tenantId:row.tenant_id,caseId:row.case_id,revision:Number(row.revision),data:row.data};
    if(!record||!isTestMailboxCase(record,TENANT))return cookieResponse(404,{error:'NOT_FOUND'});
    return cookieResponse(200,{result:testMailboxView(record,cookieSession.authority,TENANT,!live&&env.PREVIO_READ_API_ENABLED==='sandbox-73521-only',!live&&previoBookingWriter(env,fetchImpl)!==null)});
   }
   if(TEST_MAILBOX_FIELDS[input.action]){
    const keys=Object.keys(input).sort().join(',');
    if(event.httpMethod!=='POST'||!cookieMode||!mailboxOn||input.tenantId!==TENANT||!TEST_MAILBOX_FIELDS[input.action].includes(keys)
     ||input.action==='test-mailbox-send'&&(live||!testMailboxSendEnabled(env,cloudApproval)))
     return cookieResponse(403,{error:'FORBIDDEN'});
    if(!validTestMailboxInput(input))return cookieResponse(400,{error:'INVALID_INPUT'});
    const session=createOperatorCookieSession({env,fetchImpl});
    cookieSession=await (['test-mailbox-decide','test-mailbox-send','test-mailbox-oneclick'].includes(input.action)?session.protectedApproval(event):session.protectedWrite(event));
    rotatedCookie=cookieSession.setCookie;
    if(input.action==='test-mailbox-oneclick'&&!cookieSession.authority?.tenants?.[TENANT]?.includes('write'))return cookieResponse(403,{error:'ONECLICK_ROLE_REQUIRED'});
    if(input.action==='test-mailbox-send'){
     const tokens=Object.entries(event.headers||{}).filter(([key])=>key.toLowerCase()==='x-sarberki-gmail-token').map(([,value])=>value);
     if(tokens.length!==1||typeof tokens[0]!=='string'||tokens[0].length>4096)return cookieResponse(401,{error:'GMAIL_AUTH_REQUIRED'});
     try{
      // Read with the approver's own session (RLS); the exact reviewed revision is required.
      const rows=await cookieSession.transport('/rest/v1/sc_cases?select=*&tenant_id=eq.'+TENANT+'&case_id=eq.'+encodeURIComponent(input.caseId));
      const row=Array.isArray(rows)&&rows.length===1?rows[0]:null;
      const record=row&&{tenantId:row.tenant_id,caseId:row.case_id,revision:Number(row.revision),data:row.data};
      if(!record||!isTestMailboxCase(record,TENANT))return cookieResponse(404,{error:'NOT_FOUND'});
      // Phone/chat requests (V3-1) have no Gmail thread: the operator answers by phone or a new e-mail.
      if(record.data.sourceReceipt?.provider!=='gmail')return cookieResponse(409,{error:'NOT_EMAIL_CASE'});
      if(record.revision!==input.expectedRevision)return cookieResponse(409,{error:'CASE_CONFLICT'});
      // Owner switch: with the DB send ledger installed (deployment/test-mailbox/send-ledger.sql) every send is
      // claimed atomically under the approver's own session; if the ledger is required but missing, nothing is sent.
      const rpc=(name,body)=>cookieSession.transport('/rest/v1/rpc/'+name,{method:'POST',body});
      const ledger=env.CASE_TEST_MAILBOX_SEND_LEDGER==='required'?{
       claim:({draftHash})=>rpc('sc_tm_send_claim',{p_tenant:record.tenantId,p_case:record.caseId,p_expected:record.revision,p_draft_hash:draftHash}),
       finish:({claimId,status,gmailMessageId=null})=>rpc('sc_tm_send_finish',{p_tenant:record.tenantId,p_claim:claimId,p_status:status,p_gmail_message_id:gmailMessageId})}:null;
      const result=await sendApprovedTestMailboxReply({record,token:tokens[0],fetchImpl,ledger});
      return cookieResponse(200,{result:{caseId:record.caseId,status:result.status}});
     }catch(error){
      const code=TEST_MAILBOX_ERRORS[error?.code]?error.code:'SEND_FAILED';
      return cookieResponse(TEST_MAILBOX_ERRORS[code],{error:code});
     }
    }
    if(input.action==='test-mailbox-price'){
     try{
      const rows=await cookieSession.transport('/rest/v1/sc_cases?select=*&tenant_id=eq.'+TENANT+'&case_id=eq.'+encodeURIComponent(input.caseId));
      const row=Array.isArray(rows)&&rows.length===1?rows[0]:null;
      const record=row&&{tenantId:row.tenant_id,caseId:row.case_id,revision:Number(row.revision),data:row.data};
      if(!record||!isTestMailboxCase(record,TENANT))return cookieResponse(404,{error:'NOT_FOUND'});
      if(record.revision!==input.expectedRevision)return cookieResponse(409,{error:'CASE_CONFLICT'});
      const {saved,quote,previo}=await priceTestMailboxCase({record,cabin:input.cabin,availabilityConfirmed:input.availabilityConfirmed,
       attestationKey:env.ISOLATED_APPROVAL_ATTESTATION_KEY,transport:cookieSession.transport,fxFn:()=>fetchMnbEurRate(fetchImpl),capacityFn:live?null:previoCapacityReader(env,fetchImpl),
       priceCheckFn:live?null:previoPriceChecker(env,fetchImpl)});
      if(!saved)return cookieResponse(409,{error:'CASE_CONFLICT'});
      return cookieResponse(200,{result:{caseId:saved.case_id,revision:Number(saved.revision),approval:saved.data?.state?.approval,total:quote.total,...(previo?{previo:{decision:previo.decision,free:previo.free}}:{})}});
     }catch(error){
      if(error?.code==='FORBIDDEN')return cookieResponse(403,{error:'FORBIDDEN'});
      const code=TEST_MAILBOX_ERRORS[error?.code]?error.code:'TEST_MAILBOX_REJECTED';
      return cookieResponse(TEST_MAILBOX_ERRORS[code],{error:code,...(code==='PRICE_REFUSED'&&error.detail?{detail:error.detail}:{})});
     }
    }
    if(input.action==='test-mailbox-unavailable'){
     try{
      const rows=await cookieSession.transport('/rest/v1/sc_cases?select=*&tenant_id=eq.'+TENANT+'&case_id=eq.'+encodeURIComponent(input.caseId));
      const row=Array.isArray(rows)&&rows.length===1?rows[0]:null;
      const record=row&&{tenantId:row.tenant_id,caseId:row.case_id,revision:Number(row.revision),data:row.data};
      if(!record||!isTestMailboxCase(record,TENANT))return cookieResponse(404,{error:'NOT_FOUND'});
      if(record.revision!==input.expectedRevision)return cookieResponse(409,{error:'CASE_CONFLICT'});
      const saved=await markTestMailboxUnavailable({record,unavailableConfirmed:input.unavailableConfirmed,
       attestationKey:env.ISOLATED_APPROVAL_ATTESTATION_KEY,transport:cookieSession.transport});
      if(!saved)return cookieResponse(409,{error:'CASE_CONFLICT'});
      return cookieResponse(200,{result:{caseId:saved.case_id,revision:Number(saved.revision),approval:saved.data?.state?.approval}});
     }catch(error){
      if(error?.code==='FORBIDDEN')return cookieResponse(403,{error:'FORBIDDEN'});
      const code=TEST_MAILBOX_ERRORS[error?.code]?error.code:'TEST_MAILBOX_REJECTED';
      return cookieResponse(TEST_MAILBOX_ERRORS[code],{error:code});
     }
    }
    if(input.action==='test-mailbox-oneclick'){
     try{
      if(live)return cookieResponse(403,{error:'FORBIDDEN'});
      const rows=await cookieSession.transport('/rest/v1/sc_cases?select=*&tenant_id=eq.'+TENANT+'&case_id=eq.'+encodeURIComponent(input.caseId));
      const row=Array.isArray(rows)&&rows.length===1?rows[0]:null;
      const record=row&&{tenantId:row.tenant_id,caseId:row.case_id,revision:Number(row.revision),data:row.data};
      if(!record||!isTestMailboxCase(record,TENANT))return cookieResponse(404,{error:'NOT_FOUND'});
      if(record.revision!==input.expectedRevision)return cookieResponse(409,{error:'CASE_CONFLICT'});
      const previoWriter=previoBookingWriter(env,fetchImpl);
      if(!previoWriter)return cookieResponse(409,{error:'PREVIO_WRITE_DISABLED'});
      const {saved,approved,deposit}=await oneClickTestMailboxBooking({record,unit:input.unit,units:input.units??null,previewHash:input.previewHash,
       oneClickConfirmed:input.oneClickConfirmed,previoWriter,attestationKey:env.ISOLATED_APPROVAL_ATTESTATION_KEY,transport:cookieSession.transport,
       unitCheckFn:previoUnitChecker(env,fetchImpl)});
      if(!saved)return cookieResponse(409,{error:'CASE_CONFLICT'});
      return cookieResponse(200,{result:{caseId:saved.case_id,revision:Number(saved.revision),approval:saved.data?.state?.approval,bookingStatus:saved.data?.booking?.status,approved,
       ...(deposit?{deposit:{pct:deposit.pct,amount:deposit.amount,receiptDeadlineUtc:deposit.receiptDeadlineUtc}}:{})}});
     }catch(error){
      if(error?.code==='FORBIDDEN')return cookieResponse(403,{error:'FORBIDDEN'});
      const code=TEST_MAILBOX_ERRORS[error?.code]?error.code:'TEST_MAILBOX_REJECTED';
      return cookieResponse(TEST_MAILBOX_ERRORS[code],{error:code});
     }
    }
    if(input.action==='test-mailbox-confirm'||input.action==='test-mailbox-deposit'||input.action==='test-mailbox-cancel'||input.action==='test-mailbox-modify'){
     try{
      const rows=await cookieSession.transport('/rest/v1/sc_cases?select=*&tenant_id=eq.'+TENANT+'&case_id=eq.'+encodeURIComponent(input.caseId));
      const row=Array.isArray(rows)&&rows.length===1?rows[0]:null;
      const record=row&&{tenantId:row.tenant_id,caseId:row.case_id,revision:Number(row.revision),data:row.data};
      if(!record||!isTestMailboxCase(record,TENANT))return cookieResponse(404,{error:'NOT_FOUND'});
      if(record.revision!==input.expectedRevision)return cookieResponse(409,{error:'CASE_CONFLICT'});
      let saved,deposit=null;
      const previoWriter=live?null:previoBookingWriter(env,fetchImpl);
      if(input.action==='test-mailbox-confirm')({saved,deposit}=await confirmTestMailboxBooking({record,previoReference:input.previoReference,previoRecorded:input.previoRecorded,
       previoAuto:input.previoAuto===true,previoWriter,unit:input.unit,units:input.units??null,
       attestationKey:env.ISOLATED_APPROVAL_ATTESTATION_KEY,transport:cookieSession.transport,unitCheckFn:live?null:previoUnitChecker(env,fetchImpl)}));
      else if(input.action==='test-mailbox-modify')({saved,deposit}=await modifyTestMailboxBooking({record,arrival:input.arrival,departure:input.departure,unit:input.unit,
       modifyConfirmed:input.modifyConfirmed,attestationKey:env.ISOLATED_APPROVAL_ATTESTATION_KEY,transport:cookieSession.transport,previoWriter,
       unitCheckFn:live?null:previoUnitChecker(env,fetchImpl)}));
      else if(input.action==='test-mailbox-cancel')saved=await cancelTestMailboxBooking({record,reason:input.reason,cancelConfirmed:input.cancelConfirmed,transport:cookieSession.transport,previoWriter});
      else saved=await markTestMailboxDepositReceived({record,receivedOn:input.receivedOn,depositConfirmed:input.depositConfirmed,transport:cookieSession.transport,previoWriter});
      if(!saved)return cookieResponse(409,{error:'CASE_CONFLICT'});
      return cookieResponse(200,{result:{caseId:saved.case_id,revision:Number(saved.revision),approval:saved.data?.state?.approval,bookingStatus:saved.data?.booking?.status,
       ...(deposit?{deposit:{pct:deposit.pct,amount:deposit.amount,receiptDeadlineUtc:deposit.receiptDeadlineUtc}}:{}),...(saved.previoSync?{previoSync:saved.previoSync}:{})}});
     }catch(error){
      if(error?.code==='FORBIDDEN')return cookieResponse(403,{error:'FORBIDDEN'});
      const code=TEST_MAILBOX_ERRORS[error?.code]?error.code:'TEST_MAILBOX_REJECTED';
      return cookieResponse(TEST_MAILBOX_ERRORS[code],{error:code});
     }
    }
    // Owner request 2026-11-06: server-side triage of the read mails (new / continuation / uncertain / stored).
    if(input.action==='test-mailbox-triage'){
     const tokens=Object.entries(event.headers||{}).filter(([key])=>key.toLowerCase()==='x-sarberki-gmail-token').map(([,value])=>value);
     if(tokens.length!==1||typeof tokens[0]!=='string'||tokens[0].length>4096)return cookieResponse(401,{error:'GMAIL_AUTH_REQUIRED'});
     try{return cookieResponse(200,{result:await triageTestMailboxMessages({token:tokens[0],messageIds:input.messageIds,transport:cookieSession.transport,fetchImpl,deployment})});}
     catch(error){const code=TEST_MAILBOX_ERRORS[error?.code]?error.code:'STORAGE_FAILURE';return cookieResponse(TEST_MAILBOX_ERRORS[code],{error:code});}
    }
    // Owner decision 2026-11-06: a guest's reply continues its case (same thread, same guest; DB re-checks).
    if(input.action==='test-mailbox-followup'){
     const tokens=Object.entries(event.headers||{}).filter(([key])=>key.toLowerCase()==='x-sarberki-gmail-token').map(([,value])=>value);
     if(tokens.length!==1||typeof tokens[0]!=='string'||tokens[0].length>4096)return cookieResponse(401,{error:'GMAIL_AUTH_REQUIRED'});
     try{
      const result=await appendTestMailboxFollowup({token:tokens[0],messageId:input.messageId,transport:cookieSession.transport,attestationKey:env.ISOLATED_APPROVAL_ATTESTATION_KEY,fetchImpl,deployment,availabilitySource:live?null:previoAvailabilitySource(previoCapacityReader(env,fetchImpl),previoSplitPlacementReader(env,fetchImpl))});
      return cookieResponse(200,{result:{caseId:result.caseId,revision:result.revision}});
     }catch(error){
      const code=TEST_MAILBOX_ERRORS[error?.code]?error.code:'STORAGE_FAILURE';
      return cookieResponse(TEST_MAILBOX_ERRORS[code],{error:code});
     }
    }
    if(input.action==='test-mailbox-ingest'){
     const tokens=Object.entries(event.headers||{}).filter(([key])=>key.toLowerCase()==='x-sarberki-gmail-token').map(([,value])=>value);
     if(tokens.length!==1||typeof tokens[0]!=='string'||tokens[0].length>4096)return cookieResponse(401,{error:'GMAIL_AUTH_REQUIRED'});
     try{
      const result=await ingestTestMailboxMessage({token:tokens[0],messageId:input.messageId,transport:cookieSession.transport,attestationKey:env.ISOLATED_APPROVAL_ATTESTATION_KEY,fetchImpl,deployment,availabilitySource:live?null:previoAvailabilitySource(previoCapacityReader(env,fetchImpl),previoSplitPlacementReader(env,fetchImpl))});
      return cookieResponse(200,{result:{caseId:result.caseId,revision:Number(result.revision)}});
     }catch(error){
      const code=TEST_MAILBOX_ERRORS[error?.code]?error.code:'STORAGE_FAILURE';
      return cookieResponse(TEST_MAILBOX_ERRORS[code],{error:code});
     }
    }
    const rpc=input.action==='test-mailbox-redraft'?
     ['/rest/v1/rpc/sc_tm_redraft',{p_tenant:input.tenantId,p_case:input.caseId,p_expected:input.expectedRevision,p_draft:{text:input.draftText}}]:
     ['/rest/v1/rpc/sc_tm_decide',{p_tenant:input.tenantId,p_case:input.caseId,p_expected:input.expectedRevision,p_draft_hash:input.reviewedDraftHash,p_decision:input.decision,p_reason:input.reason??null}];
    let record;
    // The database answers a state, hash or unchanged-draft refusal like an outage (400); both mean "reload".
    try{record=await cookieSession.transport(rpc[0],{method:'POST',body:rpc[1]});}
    catch(error){return error?.code==='FORBIDDEN'?cookieResponse(403,{error:'FORBIDDEN'}):cookieResponse(409,{error:'TEST_MAILBOX_REJECTED'});}
    if(!record)return cookieResponse(409,{error:'CASE_CONFLICT'});
    return cookieResponse(200,{result:{caseId:record.case_id,revision:Number(record.revision),approval:record.data?.state?.approval}});
   }
   // LIVE: only the mailbox routes above and this mailbox-only daily list; everything else is refused.
   if(live){
    if(event.httpMethod!=='GET'||input.action!=='daily-list'||!cookieMode||input.tenantId!==TENANT||Object.keys(input).sort().join(',')!=='action,tenantId')
     return response(403,{error:'FORBIDDEN'});
    cookieSession=await createOperatorCookieSession({env,fetchImpl}).protectedRead(event);
    rotatedCookie=cookieSession.setCookie;
    const rows=await cookieSession.transport('/rest/v1/sc_cases?select=*&tenant_id=eq.'+TENANT);
    const records=(Array.isArray(rows)?rows:[]).map(row=>({tenantId:row.tenant_id,caseId:row.case_id,revision:Number(row.revision),data:row.data}));
    const sent=await sentDraftKeys(cookieSession.transport,TENANT);
    return cookieResponse(200,{result:records.filter(record=>isTestMailboxCase(record,TENANT)).slice(0,100).map(record=>({tenantId:record.tenantId,caseId:record.caseId,revision:record.revision,
     category:testMailboxCategory(record,sent),kind:'test-mailbox',
     approval:['pending','approved_internal','returned_for_edit','rejected'].includes(record.data.state?.approval)?record.data.state.approval:null,summary:testMailboxListSummary(record)}))});
   }
   const exactAttempt=event.httpMethod==='POST'&&(input.action==='diagnose-exact-receipt'||input.action==='ingest-and-draft'&&Object.hasOwn(input,'sourceReceipt'));
   if(exactAttempt){
    // Never expose an allowlist-comparison oracle to Bearer, anonymous or foreign-tenant requests.
    if(!cookieMode||input.tenantId!=='sarberki-test')return cookieResponse(403,{error:'FORBIDDEN'});
    try{
     cookieSession=await createOperatorCookieSession({env,fetchImpl}).protectedWrite(event);
     rotatedCookie=cookieSession.setCookie;
    }catch(error){
     // Only this rotated cookie proves Auth + membership succeeded and Writer alone failed.
     if(error instanceof OperatorSessionError&&error.code==='FORBIDDEN'&&error.setCookie&&error.setCookie!==clearOperatorCookie)
      return cookieResponse(403,{error:'FORBIDDEN',diagnostic:{category:'WRITER_DENIED',fields:[]}},error.setCookie);
     throw error;
    }
    const diagnostic=diagnoseExactGmailReceiptRequest(env,input);
    if(diagnostic.category!=='MATCH')return cookieResponse(403,{error:'FORBIDDEN',diagnostic});
    if(input.action==='diagnose-exact-receipt')return cookieResponse(200,{diagnostic});
   }
   if(Object.keys(input).some(k=>!['tenantId','caseId','envelope','values','expectedRevision','approvedCaseId','action','reviewedDraftHash','editedDraftText','expectedDraftHash','sourceReceipt','targetCaseId','targetRevision','reason','servicePreviewHash'].includes(k)))return response(400,{error:'INVALID_INPUT'});
   if(cloudApproval&&input.action==='edit-draft'&&Object.keys(input).some(key=>!['tenantId','caseId','action','expectedRevision','expectedDraftHash','editedDraftText'].includes(key)))return cookieResponse(400,{error:'INVALID_INPUT'});
   if(!env.CASE_STORE_TEST_TENANTS.split(',').includes(input.tenantId))return response(403,{error:'FORBIDDEN'});
   const closedTubReview=event.httpMethod==='POST'&&input.action==='ingest-and-draft'&&isClosedTubReview(input.envelope);
   const closedTub=event.httpMethod==='POST'&&input.action==='ingest-and-draft'&&isClosedTubFollowup(input.envelope);
   if(cookieMode){
    const cookiePost=event.httpMethod==='POST';
    const closedIngest=cookiePost&&input.action==='ingest-and-draft';
    if(input.tenantId!=='sarberki-test'||Object.keys(input).some(key=>!(closedIngest?(closedTub||closedTubReview?['tenantId','caseId','action','envelope','expectedRevision']:['tenantId','action','envelope','expectedRevision','sourceReceipt']):cookiePost?(input.action==='edit-draft'?['tenantId','caseId','action','expectedRevision','expectedDraftHash','editedDraftText']:['tenantId','caseId','action','expectedRevision','reviewedDraftHash','targetCaseId','targetRevision','reason','servicePreviewHash']):['tenantId','caseId','action','expectedRevision']).includes(key))||
      (cookiePost?!['prepare-clarification','approve-clarification','edit-draft','review-draft','approve','ingest-and-draft','resolve-service-link','approve-service'].includes(input.action):!(cloudApproval?['daily-list','preview-draft','approval-state','review-record','service-approval-state',undefined]:['preview-draft','service-approval-state',undefined]).includes(input.action))||
      (!cookiePost&&input.caseId!==undefined&&!['preview-draft','approval-state','review-record','service-approval-state'].includes(input.action)))return cookieResponse(403,{error:'FORBIDDEN'});
    if(closedIngest&&(!cloudApproval||(closedTub||closedTubReview?(!isIsolatedReviewCaseId(input.caseId)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<1):(input.expectedRevision!==0||!(input.sourceReceipt===undefined?closedSyntheticMailLanguage(input.envelope):exactReceipt?.matches(input.envelope,input.sourceReceipt))))))return cookieResponse(403,{error:'FORBIDDEN'});
    const session=createOperatorCookieSession({env,fetchImpl});
    cookieSession=cookieSession||await (cookiePost?(['approve-clarification','approve','resolve-service-link','approve-service'].includes(input.action)?session.protectedApproval(event):session.protectedWrite(event)):session.protectedRead(event));
    rotatedCookie=cookieSession.setCookie;
   }
   if(['prepare-clarification','approve-clarification'].includes(input.action)&&(!cookieMode||!clarificationEnabled(env)||!exactEditReceipt||Object.keys(input).some(k=>!['tenantId','caseId','action','expectedRevision','reviewedDraftHash'].includes(k))))return cookieResponse(403,{error:'FORBIDDEN'});
   const transport=cookieSession?.transport||createSupabaseTransport({url:env.SUPABASE_URL,publishableKey:env.SUPABASE_PUBLISHABLE_KEY,token:authorization.slice(7),fetchImpl});
   const approvalEnabled=cloudApproval||isolatedApproval===true&&env.SUPABASE_URL==='https://isolated-approval.supabase.co';
   const approvalAttestor=approvalEnabled&&/^[a-f0-9]{64}$/.test(env.ISOLATED_APPROVAL_ATTESTATION_KEY||'')?createIsolatedApprovalAttestor(env.ISOLATED_APPROVAL_ATTESTATION_KEY):null;
   const service=createServerCaseService({repository:createSupabaseCaseRepository(transport,{approvalAttestor}),resolveAuthority:cookieSession?async()=>cookieSession.authority:createSupabaseAuthority(transport)});
   if(cloudApproval&&['prepare-clarification','approve-clarification','edit-draft','review-draft','approve','approval-state','review-record'].includes(input.action)){
    if(input.tenantId!=='sarberki-test'||!isIsolatedReviewCaseId(input.caseId))return cookieResponse(403,{error:'FORBIDDEN'});
    const candidate=await service.getCase({tenantId:input.tenantId,caseId:input.caseId});
    if(event.httpMethod==='GET'&&input.action==='approval-state')assertReadAccess(candidate);
    else {
     assertReviewAccess(candidate);
     // Editing authorization cannot authorize a review provider or approval.
     if(exactEditable(candidate)&&input.action==='review-draft')return cookieResponse(422,{error:'REVIEW_NOT_READY'});
    }
   }
   if(cookieMode&&closedTub){
    const previous=await service.getCase({tenantId:input.tenantId,caseId:input.caseId});
    if(!isClosedTubPreviousRecord(previous))return cookieResponse(403,{error:'FORBIDDEN'});
    if(previous.revision!==input.expectedRevision)return cookieResponse(409,{error:'CASE_CONFLICT'});
    const candidates=await service.listCases({tenantId:input.tenantId});
    const link=resolveBookingCase(candidates.map(row=>row.data),input.envelope,{});
    if(link.status!=='linked'||link.caseId!==input.caseId)return cookieResponse(403,{error:'FORBIDDEN'});
   }
   let fixtureTarget=null;
   if(cookieMode&&closedTubReview){
    const target=await service.getCase({tenantId:input.tenantId,caseId:input.caseId});
    if(!isClosedTubPreviousRecord(target))return cookieResponse(403,{error:'FORBIDDEN'});
    if(target.revision!==input.expectedRevision)return cookieResponse(409,{error:'CASE_CONFLICT'});
    const records=await service.listCases({tenantId:input.tenantId});
    const prior=records.find(row=>row.data.messages.some(m=>m.mailbox_id===input.envelope.mailbox_id&&m.message_id===input.envelope.message_id));
    if(prior&&!isClosedTubReviewRecord(prior))return cookieResponse(409,{error:'CASE_CONFLICT'});
    const link=resolveBookingCase(records.map(row=>row.data),input.envelope,{});
    if(link.status!=='ambiguous'||link.serviceOnly!==true)return cookieResponse(403,{error:'FORBIDDEN'});
    fixtureTarget={caseId:target.caseId,revision:target.revision};
   }
   const serviceFlow=()=>createTubServiceApproval({service,tenantId:input.tenantId,bindingProvider:serviceBindingProvider,availabilityProvider:serviceAvailabilityProvider,
    attestor:/^[a-f0-9]{64}$/.test(env.ISOLATED_APPROVAL_ATTESTATION_KEY||'')?createServiceApprovalAttestor(env.ISOLATED_APPROVAL_ATTESTATION_KEY):null});
   let result;
   if(event.httpMethod==='GET'){
    if(input.action==='daily-list'&&cloudApproval){
     if(!cookieMode||Object.keys(input).sort().join(',')!=='action,tenantId')return cookieResponse(403,{error:'FORBIDDEN'});
     const records=await service.listCases({tenantId:input.tenantId});
     result=records.filter(record=>{try{assertReviewAccess(record);return true;}catch(error){if(error.code==='FORBIDDEN')return false;throw error;}}).slice(0,100).map(dailyCaseSummary);
     // Test-mailbox cases appear only while the owner switch is on; pending awaits an independent decision.
     const sent=testMailboxIngestEnabled(env,cloudApproval)?await sentDraftKeys(transport,'sarberki-test'):new Set();
     if(testMailboxIngestEnabled(env,cloudApproval))result=result.concat(records.filter(record=>isTestMailboxCase(record)).map(record=>({tenantId:record.tenantId,caseId:record.caseId,revision:record.revision,
      category:testMailboxCategory(record,sent),kind:'test-mailbox',
      // State label only (metadata, no guest content): lets the operator find an approved reply to send.
      approval:['pending','approved_internal','returned_for_edit','rejected'].includes(record.data.state?.approval)?record.data.state.approval:null,summary:testMailboxListSummary(record)}))).slice(0,100);
    }else if(input.action==='service-approval-state'){
     if(!isIsolatedReviewCaseId(input.caseId))return cookieResponse(403,{error:'FORBIDDEN'});
     result=await serviceFlow().state(input.caseId,Number(input.expectedRevision));
    }else if(input.action==='review-record'&&cloudApproval){
     result=await service.getCase({tenantId:input.tenantId,caseId:input.caseId});
     assertReviewAccess(result);
     let canEditDraft=false,canApproveDraft=false;
     try{await service.requireWrite({tenantId:input.tenantId});canEditDraft=result.data.state?.approval==='pending'&&!result.data.serverApproval;}catch(error){if(error.code!=='FORBIDDEN')throw error;}
     try{const actor=await service.requireApproval({tenantId:input.tenantId});canApproveDraft=result.data.state?.approval==='pending'&&!result.data.serverApproval&&actor!==result.updatedBy&&actor!==result.data.drafts?.at(-1)?.editedBy&&!exactEditable(result);}catch(error){if(error.code!=='FORBIDDEN')throw error;}
     result={...result,canEditDraft,canApproveDraft,...(exactEditable(result)?{approvalBlockedReason:'EXACT_REVIEW_EVIDENCE_REQUIRED'}:{})};
    }else if(input.action==='approval-state'&&cloudApproval){
     const record=await service.getCase({tenantId:input.tenantId,caseId:input.caseId});
     assertReadAccess(record);
     const audit=await transport('/rest/v1/sc_audit?'+new URLSearchParams({tenant_id:'eq.sarberki-test',case_id:'eq.'+input.caseId,kind:'eq.approve_isolated_synthetic',select:'revision,actor,at,kind,data_hash',order:'revision.asc'}));
     const approval=record.data.serverApproval,latest=record.data.drafts?.at(-1);
     const storedDraft=latest&&typeof latest.text==='string'?{
      text:latest.text,operatorReviewText:typeof latest.operatorReviewText==='string'?latest.operatorReviewText:'',
      factsRevision:latest.revision??null,basedOnMessageCount:latest.basedOnMessageCount??null,
      current:latest.revision===record.data.state.revision&&latest.basedOnMessageCount===record.data.messages.length
     }:null;
     result={caseId:record.caseId,revision:record.revision,approval:record.data.state.approval,
      serverApproval:approval?{actor:approval.actor,at:approval.at,reviewedRevision:approval.reviewedRevision,draftHash:approval.draftHash}:null,
      readOnly:true,auditScope:'approval-history',storedDraft,audit};
     if(exactEditable(record)&&clarificationEnabled(env)){
      result.clarificationApproval=record.data.clarificationApproval||null;
      result.clarificationAudit=await transport('/rest/v1/sc_audit?'+new URLSearchParams({tenant_id:'eq.sarberki-test',case_id:'eq.'+input.caseId,kind:'eq.approve_clarification_only',select:'revision,actor,at,kind,data_hash',order:'revision.asc'}));
     }
    }else if(input.action==='preview-draft'){
     let candidate=null;
     if(cookieMode){
      if(!isIsolatedReviewCaseId(input.caseId))return cookieResponse(403,{error:'FORBIDDEN'});
      candidate=await service.getCase({tenantId:input.tenantId,caseId:input.caseId});
      if(candidate?.tenantId!=='sarberki-test'||typeof candidate.data?.sender!=='string'||
         (!/^[^\s@]+@[^\s@]+\.invalid$/iu.test(candidate.data.sender)&&!exactReceipt?.matchesRecord(candidate)))
       return cookieResponse(403,{error:'FORBIDDEN'});
     }
     const runtime=createServerBookingRuntime({service,tenantId:input.tenantId});
     result=await runtime.previewDraft(input.caseId,Number(input.expectedRevision));
     if(exactReceipt&&input.caseId===exactReceipt.caseId){
      const record=candidate||await service.getCase({tenantId:input.tenantId,caseId:input.caseId});
      if(record?.revision===result.revision){
       const proof=await readExactReceiptAudit({record,exactReceipt,transport});
       if(proof){result.auditProof=proof;result.reviewState.auditStatus='verified';}
      }
     }
    }else if(input.action===undefined){
     const records=input.caseId?await service.getCase({tenantId:input.tenantId,caseId:input.caseId}):
      await service.listCases({tenantId:input.tenantId});
     result=cookieMode?syntheticCaseSummaries(records,exactReceipt):records;
    }else return response(400,{error:'INVALID_INPUT'});
   }
   else {
    const runtime=createServerBookingRuntime({service,tenantId:input.tenantId,isolatedApproval:approvalEnabled,cloudSyntheticEditing:cloudApproval,exactReceipt,exactEditReceipt,clarificationAllowed:cloudApproval&&clarificationEnabled(env),reviewProviders:cloudApproval?cloudSyntheticReviewProviders():approvalEnabled?reviewProviders:null});
    if(input.action==='approve-service'){
     if(input.tenantId!=='sarberki-test'||!isIsolatedReviewCaseId(input.caseId))return cookieResponse(403,{error:'FORBIDDEN'});
     result=await serviceFlow().approve(input.caseId,input.expectedRevision,input.servicePreviewHash);
    }else if(input.action==='resolve-service-link'){
     if(input.tenantId!=='sarberki-test'||!isIsolatedReviewCaseId(input.caseId)||!isIsolatedReviewCaseId(input.targetCaseId))return cookieResponse(403,{error:'FORBIDDEN'});
     result=await service.resolveServiceLink({tenantId:input.tenantId,caseId:input.caseId,expectedRevision:input.expectedRevision,targetCaseId:input.targetCaseId,targetRevision:input.targetRevision,reason:input.reason});
    }
    else if(input.action==='draft')result=await runtime.draft(input.caseId,input.expectedRevision);
    else if(input.action==='prepare-clarification')result=await runtime.prepareClarification(input.caseId,input.expectedRevision);
    else if(input.action==='approve-clarification')result=await runtime.approveClarification(input.caseId,input.expectedRevision,input.reviewedDraftHash);
    else if(input.action==='edit-draft')result=await runtime.editDraft(input.caseId,input.expectedRevision,input.editedDraftText,input.expectedDraftHash);
    else if(input.action==='review-draft'&&approvalEnabled)result=await runtime.reviewAndDraft(input.caseId,input.expectedRevision);
    else if(input.action==='approve'&&approvalEnabled)result=await runtime.approve(input.caseId,input.expectedRevision,input.reviewedDraftHash);
    else if(input.action===undefined||input.action==='ingest'||input.action==='ingest-and-draft')result=await runtime.ingest(input.envelope,input.values,{expectedRevision:fixtureTarget?0:input.expectedRevision,approvedCaseId:input.approvedCaseId,persistDraft:input.action==='ingest-and-draft',sourceReceipt:input.sourceReceipt});
    else return response(400,{error:'INVALID_INPUT'});
    if(fixtureTarget){
     if(!isClosedTubReviewRecord(result?.record)||result.record.caseId===fixtureTarget.caseId)throw Error('INVALID_REVIEW_FIXTURE');
     result={...result,fixtureTarget};
    }
   }
   return cookieResponse(200,{result});
  }catch(error){
   if(error instanceof OperatorSessionError){
    // Preserve exact-receipt/write gates: no unauthenticated diagnostic oracle.
    const query=event.queryStringParameters;
    const listOnly=event.httpMethod==='GET'&&query?.tenantId==='sarberki-test'&&Object.keys(query).sort().join(',')==='tenantId';
    return cookieResponse(error.status,listOnly?operatorSessionErrorBody(error):{error:error.code},error.setCookie);
   }
   const code=error.code;
   const status=code==='FORBIDDEN'?403:code==='CASE_CONFLICT'||code==='REVIEW_CHANGED'?409:['REVIEW_NOT_READY','SERVICE_AVAILABILITY_UNKNOWN'].includes(code)?422:code?.startsWith('INVALID_')||error instanceof SyntaxError?400:503;
   return cookieResponse(status,{error:status===503?'SERVICE_UNAVAILABLE':code||'INVALID_INPUT'});
  }
 };
}
export const handler=createCaseHandler();
