import {createHash} from 'node:crypto';
import {createOperatorCookieSession,OperatorSessionError} from '../../shared-core/operator-cookie-session.mjs';
import {assertClosedTranslation,translationConfigured,translateClosedIncoming} from '../../shared-core/server-translation.mjs';

export function createTranslationHandler({env=process.env,fetchImpl=fetch,now=Date.now}={}){
 const session=createOperatorCookieSession({env,fetchImpl,now}),requests=new Map();
 return async event=>{
  let cookie=null;
  const reply=(statusCode,body,setCookie=cookie)=>({statusCode,headers:{'Content-Type':'application/json',
   'Cache-Control':'private, no-store','Pragma':'no-cache','Expires':'0','X-Content-Type-Options':'nosniff',
   ...(setCookie?{'Set-Cookie':setCookie}:{})},body:JSON.stringify(body)});
  if(event.httpMethod!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
  if(event.isBase64Encoded||Buffer.byteLength(event.body||'')>12000||Object.keys(event.queryStringParameters||{}).length||
   !/^application\/json(?:;\s*charset=utf-8)?$/i.test(event.headers?.['content-type']||event.headers?.['Content-Type']||''))return reply(400,{error:'INVALID_INPUT'});
  try{
   const input=assertClosedTranslation(JSON.parse(event.body||''));
   if(!translationConfigured(env))return reply(503,{error:'TRANSLATION_DISABLED'});
   const verified=await session.protectedWrite(event);cookie=verified.setCookie;
   // Authenticate every request before reuse. Cache is process-local, session-
   // bound and expires; failures also prevent duplicate provider retries.
   const key=createHash('sha256').update(JSON.stringify([verified.authority.subject,verified.metadata.csrfToken,input.sourceLanguage])).digest('hex');
   for(const [k,value] of requests)if(value.expires<=now())requests.delete(k);
   if(!requests.has(key)){
    if(requests.size>=128)return reply(503,{error:'TRANSLATION_UNAVAILABLE'});
    const promise=translateClosedIncoming(input,{env,fetchImpl});
    requests.set(key,{expires:Math.min(now()+300000,Date.parse(verified.metadata.expiresAt)),promise});
   }
   return reply(200,await requests.get(key).promise);
  }catch(error){
   if(error instanceof OperatorSessionError)return reply(error.status,{error:error.code},error.setCookie||cookie);
   if(error instanceof SyntaxError||error.message==='INVALID_INPUT')return reply(400,{error:'INVALID_INPUT'});
   return reply(503,{error:error.message==='TRANSLATION_UNVERIFIED'?'TRANSLATION_UNVERIFIED':'TRANSLATION_UNAVAILABLE'});
  }
 };
}
export const handler=createTranslationHandler();
