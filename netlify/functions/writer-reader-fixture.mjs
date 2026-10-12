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
   if(!input||Array.isArray(input)||Object.keys(input).join(',')!=='action'||input.action!=='create-reader-fixture')return reply(400,{error:'INVALID_INPUT'});
   const verified=await session.protectedWrite(event);rotatedCookie=verified.setCookie;
   const service=createServerCaseService({repository:createSupabaseCaseRepository(verified.transport),resolveAuthority:async()=>verified.authority});
   const runtime=createServerBookingRuntime({service,tenantId:'sarberki-test',clock:()=>new Date(now()).toISOString()});
   const result=await ensureSyntheticReaderFixture({ingestAndDraft:input=>runtime.ingest(input.envelope,undefined,{expectedRevision:input.expectedRevision,persistDraft:true})});
   return reply(200,{result});
  }catch(error){
   if(error instanceof OperatorSessionError)return reply(error.status,{error:error.code},error.setCookie||rotatedCookie);
   if(error instanceof SyntaxError)return reply(400,{error:'INVALID_INPUT'});
   return reply(error.code==='FORBIDDEN'?403:503,{error:error.code==='FORBIDDEN'?'FORBIDDEN':'SYNTHETIC_FIXTURE_UNVERIFIED'});
  }
 };
}
export const handler=createWriterReaderFixtureHandler();
