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
import {sendApprovedTestMailboxReply} from '../../shared-core/server-test-mailbox-send.mjs';
import {priceTestMailboxCase} from '../../shared-core/server-test-mailbox-price.mjs';
import {fetchMnbEurRate} from './price-quote.mjs';
import {translateTestMailboxMessage} from '../../shared-core/server-translation.mjs';
import {languageFromText} from '../../sarberki-core.mjs';
import {translationErrorCode} from '../../translation-errors.mjs';
// Process-local cache of verified translations per case revision (no repeated provider calls on re-open).
const testMailboxTranslations=new Map();
const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const response=(statusCode,body)=>({statusCode,headers,body:JSON.stringify(body)});
// Cookie-reader case picker gets metadata only, never raw inquiry content.
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
 GMAIL_SOURCE_UNVERIFIED:422,NOT_MARKED_TEST_MESSAGE:422,REPLY_NOT_ALLOWED:422,NOT_ADDRESSED_TO_TEST_MAILBOX:422,INVALID_SENDER:422,MESSAGE_ID_REQUIRED:422,
 TEXT_PART_REQUIRED:422,EMPTY_TEXT:422,TEXT_TOO_LONG:422,UNREADABLE_TEXT:422,INVALID_DRAFT:422,STORAGE_FAILURE:503,
 NOT_APPROVED:409,RECIPIENT_NOT_ALLOWED:403,SOURCE_UNVERIFIED:422,SEND_FAILED:502,CASE_CONFLICT:409,
 PRICE_FACTS_MISSING:422,PRICE_LINE_MISSING:422,PRICE_REFUSED:422,AVAILABILITY_NOT_CONFIRMED:400,TEST_MAILBOX_REJECTED:409});
const TEST_MAILBOX_FIELDS=Object.freeze({
 'test-mailbox-ingest':['action,messageId,tenantId'],
 'test-mailbox-redraft':['action,caseId,draftText,expectedRevision,tenantId'],
 'test-mailbox-decide':['action,caseId,decision,expectedRevision,reviewedDraftHash,tenantId','action,caseId,decision,expectedRevision,reason,reviewedDraftHash,tenantId'],
 'test-mailbox-send':['action,caseId,expectedRevision,tenantId'],
 'test-mailbox-price':['action,availabilityConfirmed,cabin,caseId,expectedRevision,tenantId']
});
function validTestMailboxInput(input){
 if(input.action==='test-mailbox-ingest')return typeof input.messageId==='string'&&/^[a-f0-9]{12,32}$/.test(input.messageId);
 if(typeof input.caseId!=='string'||!/^tm-[a-f0-9]{12,32}$/.test(input.caseId)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<1)return false;
 if(input.action==='test-mailbox-send')return true;
 if(input.action==='test-mailbox-price')return input.availabilityConfirmed===true&&['deluxe','family','vip','small','splitA','splitB','splitC'].includes(input.cabin);
 if(input.action==='test-mailbox-redraft')return typeof input.draftText==='string'&&input.draftText.trim().length>0&&input.draftText.length<=20000;
 return typeof input.reviewedDraftHash==='string'&&/^[a-f0-9]{64}$/.test(input.reviewedDraftHash)&&['approve','return','reject'].includes(input.decision)&&
  (input.reason===undefined||typeof input.reason==='string'&&input.reason.length<=500&&!/[\r\n]/.test(input.reason));
}
// Only sc_tm_create produces this shape: synthetic writers are limited to .invalid senders.
function isTestMailboxCase(record){
 return record?.tenantId==='sarberki-test'&&typeof record.caseId==='string'&&/^tm-[a-f0-9]{12,32}$/.test(record.caseId)&&
  typeof record.data?.sender==='string'&&!/\.invalid$/i.test(record.data.sender)&&record.data.testMailbox?.scope==='test-mailbox-source-v1'&&
  Array.isArray(record.data.drafts)&&record.data.drafts.length>0&&Array.isArray(record.data.messages);
}
function testMailboxView(record,authority){
 const data=record.data,state=data.state?.approval,latest=data.drafts.at(-1),permissions=authority?.tenants?.['sarberki-test']||[];
 return {caseId:record.caseId,revision:record.revision,approval:state,
  messages:data.messages.map(m=>({text:m.text,received_at:m.received_at})),values:data.state?.values||{},
  draft:{text:latest.text,operatorReviewText:latest.operatorReviewText??null,createdAt:latest.createdAt??null,hash:createHash('sha256').update(String(latest.text),'utf8').digest('hex')},
  decisions:(data.decisions||[]).map(d=>({decision:d.decision,at:d.at,reason:d.reason??null,reviewedRevision:d.reviewedRevision})),
  internalApproval:data.internalApproval?{scope:data.internalApproval.scope,at:data.internalApproval.at,capacityVerified:false,priceVerified:false,sendAllowed:false,bookingAllowed:false}:null,
  // Display hints only: the database re-checks permission, state, revision, hash and approver independence.
  canEditDraft:permissions.includes('write')&&['pending','returned_for_edit','rejected'].includes(state),
  canDecide:permissions.includes('approve')&&state==='pending'&&(latest.createdBy!==authority?.subject||latest.machineDraft===true)};
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
  // Fail closed even when deployed automatically with the repository.
  if(env.CASE_STORE_ENABLED!=='synthetic-only'||env.URL!=='https://leafy-chimera-2403e5.netlify.app'||env.CASE_STORE_TEST_TENANTS!=='sarberki-test,demo-test')return response(503,{error:'CASE_STORE_DISABLED'});
  if(!['GET','POST'].includes(event.httpMethod))return response(405,{error:'METHOD_NOT_ALLOWED'});
  const authorization=event.headers?.authorization||event.headers?.Authorization;
  const cloudApproval=cloudSyntheticApprovalEnabled(env);
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
   if(input.action==='test-mailbox-translate'){
    if(event.httpMethod!=='GET'||!cookieMode||!testMailboxIngestEnabled(env,cloudApproval)||input.tenantId!=='sarberki-test'||Object.keys(input).sort().join(',')!=='action,caseId,tenantId')
     return cookieResponse(403,{error:'FORBIDDEN'});
    if(typeof input.caseId!=='string'||!/^tm-[a-f0-9]{12,32}$/.test(input.caseId))return cookieResponse(400,{error:'INVALID_INPUT'});
    cookieSession=await createOperatorCookieSession({env,fetchImpl}).protectedRead(event);
    rotatedCookie=cookieSession.setCookie;
    const rows=await cookieSession.transport('/rest/v1/sc_cases?select=*&tenant_id=eq.sarberki-test&case_id=eq.'+encodeURIComponent(input.caseId));
    const row=Array.isArray(rows)&&rows.length===1?rows[0]:null;
    const record=row&&{tenantId:row.tenant_id,caseId:row.case_id,revision:Number(row.revision),data:row.data};
    if(!record||!isTestMailboxCase(record))return cookieResponse(404,{error:'NOT_FOUND'});
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
   if(input.action==='test-mailbox-record'){
    if(event.httpMethod!=='GET'||!cookieMode||!testMailboxIngestEnabled(env,cloudApproval)||input.tenantId!=='sarberki-test'||Object.keys(input).sort().join(',')!=='action,caseId,tenantId')
     return cookieResponse(403,{error:'FORBIDDEN'});
    if(typeof input.caseId!=='string'||!/^tm-[a-f0-9]{12,32}$/.test(input.caseId))return cookieResponse(400,{error:'INVALID_INPUT'});
    cookieSession=await createOperatorCookieSession({env,fetchImpl}).protectedRead(event);
    rotatedCookie=cookieSession.setCookie;
    const rows=await cookieSession.transport('/rest/v1/sc_cases?select=*&tenant_id=eq.sarberki-test&case_id=eq.'+encodeURIComponent(input.caseId));
    const row=Array.isArray(rows)&&rows.length===1?rows[0]:null;
    const record=row&&{tenantId:row.tenant_id,caseId:row.case_id,revision:Number(row.revision),data:row.data};
    if(!record||!isTestMailboxCase(record))return cookieResponse(404,{error:'NOT_FOUND'});
    return cookieResponse(200,{result:testMailboxView(record,cookieSession.authority)});
   }
   if(TEST_MAILBOX_FIELDS[input.action]){
    const keys=Object.keys(input).sort().join(',');
    if(event.httpMethod!=='POST'||!cookieMode||!testMailboxIngestEnabled(env,cloudApproval)||input.tenantId!=='sarberki-test'||!TEST_MAILBOX_FIELDS[input.action].includes(keys)
     ||input.action==='test-mailbox-send'&&!testMailboxSendEnabled(env,cloudApproval))
     return cookieResponse(403,{error:'FORBIDDEN'});
    if(!validTestMailboxInput(input))return cookieResponse(400,{error:'INVALID_INPUT'});
    const session=createOperatorCookieSession({env,fetchImpl});
    cookieSession=await (['test-mailbox-decide','test-mailbox-send'].includes(input.action)?session.protectedApproval(event):session.protectedWrite(event));
    rotatedCookie=cookieSession.setCookie;
    if(input.action==='test-mailbox-send'){
     const tokens=Object.entries(event.headers||{}).filter(([key])=>key.toLowerCase()==='x-sarberki-gmail-token').map(([,value])=>value);
     if(tokens.length!==1||typeof tokens[0]!=='string'||tokens[0].length>4096)return cookieResponse(401,{error:'GMAIL_AUTH_REQUIRED'});
     try{
      // Read with the approver's own session (RLS); the exact reviewed revision is required.
      const rows=await cookieSession.transport('/rest/v1/sc_cases?select=*&tenant_id=eq.sarberki-test&case_id=eq.'+encodeURIComponent(input.caseId));
      const row=Array.isArray(rows)&&rows.length===1?rows[0]:null;
      const record=row&&{tenantId:row.tenant_id,caseId:row.case_id,revision:Number(row.revision),data:row.data};
      if(!record||!isTestMailboxCase(record))return cookieResponse(404,{error:'NOT_FOUND'});
      if(record.revision!==input.expectedRevision)return cookieResponse(409,{error:'CASE_CONFLICT'});
      const result=await sendApprovedTestMailboxReply({record,token:tokens[0],fetchImpl});
      return cookieResponse(200,{result:{caseId:record.caseId,status:result.status}});
     }catch(error){
      const code=TEST_MAILBOX_ERRORS[error?.code]?error.code:'SEND_FAILED';
      return cookieResponse(TEST_MAILBOX_ERRORS[code],{error:code});
     }
    }
    if(input.action==='test-mailbox-price'){
     try{
      const rows=await cookieSession.transport('/rest/v1/sc_cases?select=*&tenant_id=eq.sarberki-test&case_id=eq.'+encodeURIComponent(input.caseId));
      const row=Array.isArray(rows)&&rows.length===1?rows[0]:null;
      const record=row&&{tenantId:row.tenant_id,caseId:row.case_id,revision:Number(row.revision),data:row.data};
      if(!record||!isTestMailboxCase(record))return cookieResponse(404,{error:'NOT_FOUND'});
      if(record.revision!==input.expectedRevision)return cookieResponse(409,{error:'CASE_CONFLICT'});
      const {saved,quote}=await priceTestMailboxCase({record,cabin:input.cabin,availabilityConfirmed:input.availabilityConfirmed,
       attestationKey:env.ISOLATED_APPROVAL_ATTESTATION_KEY,transport:cookieSession.transport,fxFn:()=>fetchMnbEurRate(fetchImpl)});
      if(!saved)return cookieResponse(409,{error:'CASE_CONFLICT'});
      return cookieResponse(200,{result:{caseId:saved.case_id,revision:Number(saved.revision),approval:saved.data?.state?.approval,total:quote.total}});
     }catch(error){
      if(error?.code==='FORBIDDEN')return cookieResponse(403,{error:'FORBIDDEN'});
      const code=TEST_MAILBOX_ERRORS[error?.code]?error.code:'TEST_MAILBOX_REJECTED';
      return cookieResponse(TEST_MAILBOX_ERRORS[code],{error:code,...(code==='PRICE_REFUSED'&&error.detail?{detail:error.detail}:{})});
     }
    }
    if(input.action==='test-mailbox-ingest'){
     const tokens=Object.entries(event.headers||{}).filter(([key])=>key.toLowerCase()==='x-sarberki-gmail-token').map(([,value])=>value);
     if(tokens.length!==1||typeof tokens[0]!=='string'||tokens[0].length>4096)return cookieResponse(401,{error:'GMAIL_AUTH_REQUIRED'});
     try{
      const result=await ingestTestMailboxMessage({token:tokens[0],messageId:input.messageId,transport:cookieSession.transport,attestationKey:env.ISOLATED_APPROVAL_ATTESTATION_KEY,fetchImpl});
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
     if(testMailboxIngestEnabled(env,cloudApproval))result=result.concat(records.filter(isTestMailboxCase).map(record=>({tenantId:record.tenantId,caseId:record.caseId,revision:record.revision,
      category:record.data.state?.approval==='pending'?'approval':'progress',kind:'test-mailbox'}))).slice(0,100);
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
