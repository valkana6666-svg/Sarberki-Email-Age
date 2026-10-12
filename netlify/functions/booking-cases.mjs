import {createServerCaseService} from '../../shared-core/server-case-service.mjs';
import {createSupabaseTransport,createSupabaseAuthority,createSupabaseCaseRepository} from '../../shared-core/supabase-case-repository.mjs';
import {createServerBookingRuntime} from '../../shared-core/server-booking-runtime.mjs';
import {createOperatorCookieSession,OperatorSessionError} from '../../shared-core/operator-cookie-session.mjs';
import {createIsolatedApprovalAttestor} from '../../shared-core/isolated-approval-attestation.mjs';
const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const response=(statusCode,body)=>({statusCode,headers,body:JSON.stringify(body)});
export function createCaseHandler({env=process.env,fetchImpl=fetch,isolatedApproval=false,reviewProviders=null}={}){
 return async event=>{
  // Fail closed even when deployed automatically with the repository.
  if(env.CASE_STORE_ENABLED!=='synthetic-only'||env.URL!=='https://leafy-chimera-2403e5.netlify.app'||env.CASE_STORE_TEST_TENANTS!=='sarberki-test,demo-test')return response(503,{error:'CASE_STORE_DISABLED'});
  if(!['GET','POST'].includes(event.httpMethod))return response(405,{error:'METHOD_NOT_ALLOWED'});
  const authorization=event.headers?.authorization||event.headers?.Authorization;
  const cookieMode=authorization===undefined&&event.httpMethod==='GET'&&
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
   if(Object.keys(input).some(k=>!['tenantId','caseId','envelope','values','expectedRevision','approvedCaseId','action','reviewedDraftHash','editedDraftText'].includes(k)))return response(400,{error:'INVALID_INPUT'});
   if(!env.CASE_STORE_TEST_TENANTS.split(',').includes(input.tenantId))return response(403,{error:'FORBIDDEN'});
   let cookieSession=null;
   if(cookieMode){
    if(input.tenantId!=='sarberki-test'||Object.keys(input).some(key=>!['tenantId','caseId','action','expectedRevision'].includes(key))||!['preview-draft',undefined].includes(input.action))return cookieResponse(403,{error:'FORBIDDEN'});
    cookieSession=await createOperatorCookieSession({env,fetchImpl}).protectedRead(event);
    rotatedCookie=cookieSession.setCookie;
   }
   const transport=cookieSession?.transport||createSupabaseTransport({url:env.SUPABASE_URL,publishableKey:env.SUPABASE_PUBLISHABLE_KEY,token:authorization.slice(7),fetchImpl});
   const approvalEnabled=isolatedApproval===true&&env.SUPABASE_URL==='https://isolated-approval.supabase.co';
   const approvalAttestor=approvalEnabled&&/^[a-f0-9]{64}$/.test(env.ISOLATED_APPROVAL_ATTESTATION_KEY||'')?createIsolatedApprovalAttestor(env.ISOLATED_APPROVAL_ATTESTATION_KEY):null;
   const service=createServerCaseService({repository:createSupabaseCaseRepository(transport,{approvalAttestor}),resolveAuthority:cookieSession?async()=>cookieSession.authority:createSupabaseAuthority(transport)});
   let result;
   if(event.httpMethod==='GET'){if(input.action==='preview-draft'){const runtime=createServerBookingRuntime({service,tenantId:input.tenantId});result=await runtime.previewDraft(input.caseId,Number(input.expectedRevision));}else if(input.action===undefined)result=input.caseId?await service.getCase({tenantId:input.tenantId,caseId:input.caseId}):await service.listCases({tenantId:input.tenantId});else return response(400,{error:'INVALID_INPUT'});}
   else {
    const runtime=createServerBookingRuntime({service,tenantId:input.tenantId,isolatedApproval:approvalEnabled,reviewProviders:approvalEnabled?reviewProviders:null});
    if(input.action==='draft')result=await runtime.draft(input.caseId,input.expectedRevision);
    else if(input.action==='edit-draft')result=await runtime.editDraft(input.caseId,input.expectedRevision,input.editedDraftText);
    else if(input.action==='review-draft'&&approvalEnabled)result=await runtime.reviewAndDraft(input.caseId,input.expectedRevision);
    else if(input.action==='approve'&&approvalEnabled)result=await runtime.approve(input.caseId,input.expectedRevision,input.reviewedDraftHash);
    else if(input.action===undefined||input.action==='ingest')result=await runtime.ingest(input.envelope,input.values,{expectedRevision:input.expectedRevision,approvedCaseId:input.approvedCaseId});
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
