import {createServerCaseService} from '../../shared-core/server-case-service.mjs';
import {createSupabaseTransport,createSupabaseAuthority,createSupabaseCaseRepository} from '../../shared-core/supabase-case-repository.mjs';
import {createServerBookingRuntime} from '../../shared-core/server-booking-runtime.mjs';
const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const response=(statusCode,body)=>({statusCode,headers,body:JSON.stringify(body)});
export function createCaseHandler({env=process.env,fetchImpl=fetch}={}){
 return async event=>{
  // Fail closed even when deployed automatically with the repository.
  if(env.CASE_STORE_ENABLED!=='synthetic-only'||env.URL!=='https://leafy-chimera-2403e5.netlify.app'||env.CASE_STORE_TEST_TENANTS!=='sarberki-test,demo-test')return response(503,{error:'CASE_STORE_DISABLED'});
  if(!['GET','POST'].includes(event.httpMethod))return response(405,{error:'METHOD_NOT_ALLOWED'});
  const authorization=event.headers?.authorization||event.headers?.Authorization;
  if(typeof authorization!=='string'||!/^Bearer [A-Za-z0-9._-]{20,8192}$/.test(authorization))return response(401,{error:'AUTH_REQUIRED'});
  if(event.isBase64Encoded||Buffer.byteLength(event.body||'')>32768)return response(400,{error:'INVALID_INPUT'});
  try{
   const input=event.httpMethod==='GET'?(event.queryStringParameters||{}):JSON.parse(event.body||'{}');
   if(Object.keys(input).some(k=>!['tenantId','caseId','envelope','values','expectedRevision','approvedCaseId','action'].includes(k)))return response(400,{error:'INVALID_INPUT'});
   if(!env.CASE_STORE_TEST_TENANTS.split(',').includes(input.tenantId))return response(403,{error:'FORBIDDEN'});
   const transport=createSupabaseTransport({url:env.SUPABASE_URL,publishableKey:env.SUPABASE_PUBLISHABLE_KEY,token:authorization.slice(7),fetchImpl});
   const service=createServerCaseService({repository:createSupabaseCaseRepository(transport),resolveAuthority:createSupabaseAuthority(transport)});
   let result;
   if(event.httpMethod==='GET')result=input.caseId?await service.getCase({tenantId:input.tenantId,caseId:input.caseId}):await service.listCases({tenantId:input.tenantId});
   else {
    const runtime=createServerBookingRuntime({service,tenantId:input.tenantId});
    if(input.action==='draft')result=await runtime.draft(input.caseId,input.expectedRevision);
    else if(input.action===undefined||input.action==='ingest')result=await runtime.ingest(input.envelope,input.values,{expectedRevision:input.expectedRevision,approvedCaseId:input.approvedCaseId});
    else return response(400,{error:'INVALID_INPUT'});
   }
   return response(200,{result});
  }catch(error){
   const code=error.code;
   const status=code==='FORBIDDEN'?403:code==='CASE_CONFLICT'?409:code?.startsWith('INVALID_')||error instanceof SyntaxError?400:503;
   return response(status,{error:status===503?'SERVICE_UNAVAILABLE':code||'INVALID_INPUT'});
  }
 };
}
export const handler=createCaseHandler();
