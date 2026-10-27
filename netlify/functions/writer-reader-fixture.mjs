import {preparePendingEditableFixture,EDITABLE_FIXTURE_ID} from '../../shared-core/server-pending-editable-fixture.mjs';
import {cloudSyntheticApprovalEnabled,cloudSyntheticReviewProviders,assertCloudSyntheticReviewCase} from '../../shared-core/cloud-synthetic-approval.mjs';
import {createOperatorCookieSession,OperatorSessionError} from '../../shared-core/operator-cookie-session.mjs';
import {createServerCaseService} from '../../shared-core/server-case-service.mjs';
import {createSupabaseCaseRepository} from '../../shared-core/supabase-case-repository.mjs';
import {createServerBookingRuntime} from '../../shared-core/server-booking-runtime.mjs';
import {ensureSyntheticReaderFixture} from '../../shared-core/synthetic-reader-fixture.mjs';

// Fixed synthetic fixture only; the existing Reader cookie case API stays GET-only.
// Credentials, refresh/access tokens and draft content never leave this handler.
export function createWriterReaderFixtureHandler({env=process.env,fetchImpl=fetch,now=Date.now}={}){
 const session=createOperatorCookieSession({env,fetchImpl,now});
 return async event=>{
  let rotatedCookie=null;
  const reply=(statusCode,body,setCookie=rotatedCookie)=>({statusCode,headers:{
   'Content-Type':'application/json','Cache-Control':'private, no-store','Pragma':'no-cache',
   'Expires':'0','X-Content-Type-Options':'nosniff',...(setCookie?{'Set-Cookie':setCookie}:{})
  },body:JSON.stringify(body)});
  if(event.httpMethod!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
  if(event.isBase64Encoded||Buffer.byteLength(event.body||'')>256||Object.keys(event.queryStringParameters||{}).length||
   !/^application\/json(?:;\s*charset=utf-8)?$/i.test(event.headers?.['content-type']||event.headers?.['Content-Type']||''))return reply(400,{error:'INVALID_INPUT'});
  try{
   const input=JSON.parse(event.body||'');
   if(!input||Array.isArray(input)||Object.keys(input).join(',')!=='action'||!['create-reader-fixture','prepare-editable-fixture'].includes(input.action))return reply(400,{error:'INVALID_INPUT'});
   const verified=await session.protectedWrite(event);rotatedCookie=verified.setCookie;
   const service=createServerCaseService({repository:createSupabaseCaseRepository(verified.transport),resolveAuthority:async()=>verified.authority});
   if(input.action==='prepare-editable-fixture'){
    if(!cloudSyntheticApprovalEnabled(env))return reply(503,{error:'SYNTHETIC_FIXTURE_UNVERIFIED'});
    const runtime=createServerBookingRuntime({service,tenantId:'sarberki-test',clock:()=>new Date(now()).toISOString(),
      id:()=>EDITABLE_FIXTURE_ID,reviewProviders:cloudSyntheticReviewProviders(),cloudSyntheticEditing:true});
    const result=await preparePendingEditableFixture({service,runtime,isReviewCase:assertCloudSyntheticReviewCase,now});
    return reply(200,{result});
   }
   const runtime=createServerBookingRuntime({service,tenantId:'sarberki-test',clock:()=>new Date(now()).toISOString()});
   const result=await ensureSyntheticReaderFixture({ingestAndDraft:input=>runtime.ingest(input.envelope,undefined,{expectedRevision:input.expectedRevision,persistDraft:true})});
   return reply(200,{result});
  }catch(error){
   if(error instanceof OperatorSessionError)return reply(error.status,{error:error.code},error.setCookie||rotatedCookie);
   if(error instanceof SyntaxError)return reply(400,{error:'INVALID_INPUT'});
   return reply(error.code==='FORBIDDEN'?403:['CASE_CONFLICT','SYNTHETIC_FIXTURE_ALREADY_APPROVED'].includes(error.code)?409:503,{error:['FORBIDDEN','CASE_CONFLICT','SYNTHETIC_FIXTURE_ALREADY_APPROVED','SYNTHETIC_FIXTURE_EXPIRED'].includes(error.code)?error.code:'SYNTHETIC_FIXTURE_UNVERIFIED'});
  }
 };
}
export const handler=createWriterReaderFixtureHandler();
