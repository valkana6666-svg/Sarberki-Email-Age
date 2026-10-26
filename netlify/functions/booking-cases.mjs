import {createTubServiceApproval,createServiceApprovalAttestor} from '../../shared-core/server-tub-approval.mjs';
import {createServerCaseService} from '../../shared-core/server-case-service.mjs';
import {createSupabaseTransport,createSupabaseAuthority,createSupabaseCaseRepository} from '../../shared-core/supabase-case-repository.mjs';
import {createServerBookingRuntime} from '../../shared-core/server-booking-runtime.mjs';
import {createOperatorCookieSession,OperatorSessionError,operatorSessionErrorBody,clearOperatorCookie} from '../../shared-core/operator-cookie-session.mjs';
import {createIsolatedApprovalAttestor} from '../../shared-core/isolated-approval-attestation.mjs';
import {isIsolatedReviewCaseId} from '../../shared-core/isolated-review-case-id.mjs';
import {cloudSyntheticApprovalEnabled,cloudSyntheticReviewProviders,assertCloudSyntheticReviewCase,assertCloudSyntheticReadCase} from '../../shared-core/cloud-synthetic-approval.mjs';
import {createExactGmailReceipt,readExactReceiptAudit,diagnoseExactGmailReceiptRequest} from '../../shared-core/server-exact-gmail-receipt.mjs';
import {closedSyntheticMailLanguage,isClosedTubFollowup,isClosedTubPreviousRecord,isClosedTubReview,isClosedTubReviewRecord} from '../../shared-core/synthetic-mail-fixtures.mjs';
import {resolveBookingCase} from '../../booking-cases.mjs';
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
export function createCaseHandler({env=process.env,fetchImpl=fetch,isolatedApproval=false,reviewProviders=null,serviceBindingProvider=null,serviceAvailabilityProvider=null}={}){
 return async event=>{
  // Fail closed even when deployed automatically with the repository.
  if(env.CASE_STORE_ENABLED!=='synthetic-only'||env.URL!=='https://leafy-chimera-2403e5.netlify.app'||env.CASE_STORE_TEST_TENANTS!=='sarberki-test,demo-test')return response(503,{error:'CASE_STORE_DISABLED'});
  if(!['GET','POST'].includes(event.httpMethod))return response(405,{error:'METHOD_NOT_ALLOWED'});
  const authorization=event.headers?.authorization||event.headers?.Authorization;
  const cloudApproval=cloudSyntheticApprovalEnabled(env);
  const exactReceipt=createExactGmailReceipt(env);
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
      (cookiePost?!['edit-draft','review-draft','approve','ingest-and-draft','resolve-service-link','approve-service'].includes(input.action):!(cloudApproval?['preview-draft','approval-state','review-record','service-approval-state',undefined]:['preview-draft','service-approval-state',undefined]).includes(input.action))||
      (!cookiePost&&input.caseId!==undefined&&!['preview-draft','approval-state','review-record','service-approval-state'].includes(input.action)))return cookieResponse(403,{error:'FORBIDDEN'});
    if(closedIngest&&(!cloudApproval||(closedTub||closedTubReview?(!isIsolatedReviewCaseId(input.caseId)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<1):(input.expectedRevision!==0||!(input.sourceReceipt===undefined?closedSyntheticMailLanguage(input.envelope):exactReceipt?.matches(input.envelope,input.sourceReceipt))))))return cookieResponse(403,{error:'FORBIDDEN'});
    const session=createOperatorCookieSession({env,fetchImpl});
    cookieSession=cookieSession||await (cookiePost?(['approve','resolve-service-link','approve-service'].includes(input.action)?session.protectedApproval(event):session.protectedWrite(event)):session.protectedRead(event));
    rotatedCookie=cookieSession.setCookie;
   }
   const transport=cookieSession?.transport||createSupabaseTransport({url:env.SUPABASE_URL,publishableKey:env.SUPABASE_PUBLISHABLE_KEY,token:authorization.slice(7),fetchImpl});
   const approvalEnabled=cloudApproval||isolatedApproval===true&&env.SUPABASE_URL==='https://isolated-approval.supabase.co';
   const approvalAttestor=approvalEnabled&&/^[a-f0-9]{64}$/.test(env.ISOLATED_APPROVAL_ATTESTATION_KEY||'')?createIsolatedApprovalAttestor(env.ISOLATED_APPROVAL_ATTESTATION_KEY):null;
   const service=createServerCaseService({repository:createSupabaseCaseRepository(transport,{approvalAttestor}),resolveAuthority:cookieSession?async()=>cookieSession.authority:createSupabaseAuthority(transport)});
   if(cloudApproval&&['edit-draft','review-draft','approve','approval-state','review-record'].includes(input.action)){
    if(input.tenantId!=='sarberki-test'||!isIsolatedReviewCaseId(input.caseId))return cookieResponse(403,{error:'FORBIDDEN'});
    const candidate=await service.getCase({tenantId:input.tenantId,caseId:input.caseId});
    if(event.httpMethod==='GET'&&input.action==='approval-state')assertCloudSyntheticReadCase(candidate);
    else assertCloudSyntheticReviewCase(candidate);
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
    if(input.action==='service-approval-state'){
     if(!isIsolatedReviewCaseId(input.caseId))return cookieResponse(403,{error:'FORBIDDEN'});
     result=await serviceFlow().state(input.caseId,Number(input.expectedRevision));
    }else if(input.action==='review-record'&&cloudApproval){
     result=await service.getCase({tenantId:input.tenantId,caseId:input.caseId});
     assertCloudSyntheticReviewCase(result);
     let canEditDraft=false;
     try{await service.requireWrite({tenantId:input.tenantId});canEditDraft=result.data.state?.approval==='pending'&&!result.data.serverApproval;}catch(error){if(error.code!=='FORBIDDEN')throw error;}
     result={...result,canEditDraft};
    }else if(input.action==='approval-state'&&cloudApproval){
     const record=await service.getCase({tenantId:input.tenantId,caseId:input.caseId});
     assertCloudSyntheticReadCase(record);
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
    const runtime=createServerBookingRuntime({service,tenantId:input.tenantId,isolatedApproval:approvalEnabled,cloudSyntheticEditing:cloudApproval,exactReceipt,reviewProviders:cloudApproval?cloudSyntheticReviewProviders():approvalEnabled?reviewProviders:null});
    if(input.action==='approve-service'){
     if(input.tenantId!=='sarberki-test'||!isIsolatedReviewCaseId(input.caseId))return cookieResponse(403,{error:'FORBIDDEN'});
     result=await serviceFlow().approve(input.caseId,input.expectedRevision,input.servicePreviewHash);
    }else if(input.action==='resolve-service-link'){
     if(input.tenantId!=='sarberki-test'||!isIsolatedReviewCaseId(input.caseId)||!isIsolatedReviewCaseId(input.targetCaseId))return cookieResponse(403,{error:'FORBIDDEN'});
     result=await service.resolveServiceLink({tenantId:input.tenantId,caseId:input.caseId,expectedRevision:input.expectedRevision,targetCaseId:input.targetCaseId,targetRevision:input.targetRevision,reason:input.reason});
    }
    else if(input.action==='draft')result=await runtime.draft(input.caseId,input.expectedRevision);
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
