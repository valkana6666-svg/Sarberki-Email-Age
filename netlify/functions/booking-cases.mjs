import {createServerCaseService} from '../../shared-core/server-case-service.mjs';
import {createSupabaseTransport,createSupabaseAuthority,createSupabaseCaseRepository} from '../../shared-core/supabase-case-repository.mjs';
import {createServerBookingRuntime} from '../../shared-core/server-booking-runtime.mjs';
import {createOperatorCookieSession,OperatorSessionError} from '../../shared-core/operator-cookie-session.mjs';
import {createIsolatedApprovalAttestor} from '../../shared-core/isolated-approval-attestation.mjs';
import {isIsolatedReviewCaseId} from '../../shared-core/isolated-review-case-id.mjs';
import {cloudSyntheticApprovalEnabled,cloudSyntheticReviewProviders,assertCloudSyntheticReviewCase} from '../../shared-core/cloud-synthetic-approval.mjs';
import {createExactGmailReceipt,readExactReceiptAudit} from '../../shared-core/server-exact-gmail-receipt.mjs';
import {closedSyntheticMailLanguage,isClosedTubFollowup,isClosedTubPreviousRecord} from '../../shared-core/synthetic-mail-fixtures.mjs';
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
export function createCaseHandler({env=process.env,fetchImpl=fetch,isolatedApproval=false,reviewProviders=null}={}){
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
   if(Object.keys(input).some(k=>!['tenantId','caseId','envelope','values','expectedRevision','approvedCaseId','action','reviewedDraftHash','editedDraftText','sourceReceipt','targetCaseId','targetRevision','reason'].includes(k)))return response(400,{error:'INVALID_INPUT'});
   if(!env.CASE_STORE_TEST_TENANTS.split(',').includes(input.tenantId))return response(403,{error:'FORBIDDEN'});
   let cookieSession=null;
   const closedTub=event.httpMethod==='POST'&&input.action==='ingest-and-draft'&&isClosedTubFollowup(input.envelope);
   if(cookieMode){
    const cookiePost=event.httpMethod==='POST';
    const closedIngest=cookiePost&&input.action==='ingest-and-draft';
    if(input.tenantId!=='sarberki-test'||Object.keys(input).some(key=>!(closedIngest?(closedTub?['tenantId','caseId','action','envelope','expectedRevision']:['tenantId','action','envelope','expectedRevision','sourceReceipt']):cookiePost?['tenantId','caseId','action','expectedRevision','reviewedDraftHash','targetCaseId','targetRevision','reason']:['tenantId','caseId','action','expectedRevision']).includes(key))||
      (cookiePost?!['review-draft','approve','ingest-and-draft','resolve-service-link'].includes(input.action):!(cloudApproval?['preview-draft','approval-state','review-record',undefined]:['preview-draft',undefined]).includes(input.action))||
      (!cookiePost&&input.caseId!==undefined&&!['preview-draft','approval-state','review-record'].includes(input.action)))return cookieResponse(403,{error:'FORBIDDEN'});
    if(closedIngest&&(!cloudApproval||(closedTub?(!isIsolatedReviewCaseId(input.caseId)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<1):(input.expectedRevision!==0||!(input.sourceReceipt===undefined?closedSyntheticMailLanguage(input.envelope):exactReceipt?.matches(input.envelope,input.sourceReceipt))))))return cookieResponse(403,{error:'FORBIDDEN'});
    const session=createOperatorCookieSession({env,fetchImpl});
    cookieSession=await (cookiePost?(['approve','resolve-service-link'].includes(input.action)?session.protectedApproval(event):session.protectedWrite(event)):session.protectedRead(event));
    rotatedCookie=cookieSession.setCookie;
   }
   const transport=cookieSession?.transport||createSupabaseTransport({url:env.SUPABASE_URL,publishableKey:env.SUPABASE_PUBLISHABLE_KEY,token:authorization.slice(7),fetchImpl});
   const approvalEnabled=cloudApproval||isolatedApproval===true&&env.SUPABASE_URL==='https://isolated-approval.supabase.co';
   const approvalAttestor=approvalEnabled&&/^[a-f0-9]{64}$/.test(env.ISOLATED_APPROVAL_ATTESTATION_KEY||'')?createIsolatedApprovalAttestor(env.ISOLATED_APPROVAL_ATTESTATION_KEY):null;
   const service=createServerCaseService({repository:createSupabaseCaseRepository(transport,{approvalAttestor}),resolveAuthority:cookieSession?async()=>cookieSession.authority:createSupabaseAuthority(transport)});
   if(cloudApproval&&['review-draft','approve','approval-state','review-record'].includes(input.action)){
    if(input.tenantId!=='sarberki-test'||!isIsolatedReviewCaseId(input.caseId))return cookieResponse(403,{error:'FORBIDDEN'});
    assertCloudSyntheticReviewCase(await service.getCase({tenantId:input.tenantId,caseId:input.caseId}));
   }
   if(cookieMode&&closedTub){
    const previous=await service.getCase({tenantId:input.tenantId,caseId:input.caseId});
    if(!isClosedTubPreviousRecord(previous))return cookieResponse(403,{error:'FORBIDDEN'});
    if(previous.revision!==input.expectedRevision)return cookieResponse(409,{error:'CASE_CONFLICT'});
    const candidates=await service.listCases({tenantId:input.tenantId});
    const link=resolveBookingCase(candidates.map(row=>row.data),input.envelope,{});
    if(link.status!=='linked'||link.caseId!==input.caseId)return cookieResponse(403,{error:'FORBIDDEN'});
   }
   let result;
   if(event.httpMethod==='GET'){
    if(input.action==='review-record'&&cloudApproval){
     result=await service.getCase({tenantId:input.tenantId,caseId:input.caseId});
     assertCloudSyntheticReviewCase(result);
    }else if(input.action==='approval-state'&&cloudApproval){
     const record=await service.getCase({tenantId:input.tenantId,caseId:input.caseId});
     assertCloudSyntheticReviewCase(record);
     const audit=await transport('/rest/v1/sc_audit?'+new URLSearchParams({tenant_id:'eq.sarberki-test',case_id:'eq.'+input.caseId,kind:'eq.approve_isolated_synthetic',select:'revision,actor,kind,data_hash'}));
     const approval=record.data.serverApproval;
     result={caseId:record.caseId,revision:record.revision,approval:record.data.state.approval,
      serverApproval:approval?{actor:approval.actor,at:approval.at,reviewedRevision:approval.reviewedRevision,draftHash:approval.draftHash}:null,audit};
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
    const runtime=createServerBookingRuntime({service,tenantId:input.tenantId,isolatedApproval:approvalEnabled,exactReceipt,reviewProviders:cloudApproval?cloudSyntheticReviewProviders():approvalEnabled?reviewProviders:null});
    if(input.action==='resolve-service-link'){
     if(input.tenantId!=='sarberki-test'||!isIsolatedReviewCaseId(input.caseId)||!isIsolatedReviewCaseId(input.targetCaseId))return cookieResponse(403,{error:'FORBIDDEN'});
     result=await service.resolveServiceLink({tenantId:input.tenantId,caseId:input.caseId,expectedRevision:input.expectedRevision,targetCaseId:input.targetCaseId,targetRevision:input.targetRevision,reason:input.reason});
    }
    else if(input.action==='draft')result=await runtime.draft(input.caseId,input.expectedRevision);
    else if(input.action==='edit-draft')result=await runtime.editDraft(input.caseId,input.expectedRevision,input.editedDraftText);
    else if(input.action==='review-draft'&&approvalEnabled)result=await runtime.reviewAndDraft(input.caseId,input.expectedRevision);
    else if(input.action==='approve'&&approvalEnabled)result=await runtime.approve(input.caseId,input.expectedRevision,input.reviewedDraftHash);
    else if(input.action===undefined||input.action==='ingest'||input.action==='ingest-and-draft')result=await runtime.ingest(input.envelope,input.values,{expectedRevision:input.expectedRevision,approvedCaseId:input.approvedCaseId,persistDraft:input.action==='ingest-and-draft',sourceReceipt:input.sourceReceipt});
    else return response(400,{error:'INVALID_INPUT'});
   }
   return cookieResponse(200,{result});
  }catch(error){
   if(error instanceof OperatorSessionError)return cookieResponse(error.status,{error:error.code},error.setCookie);
   const code=error.code;
   const status=code==='FORBIDDEN'?403:code==='CASE_CONFLICT'||code==='REVIEW_CHANGED'?409:code==='REVIEW_NOT_READY'?422:code?.startsWith('INVALID_')||error instanceof SyntaxError?400:503;
   return cookieResponse(status,{error:status===503?'SERVICE_UNAVAILABLE':code||'INVALID_INPUT'});
  }
 };
}
export const handler=createCaseHandler();
