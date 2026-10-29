// Operator-only, disabled-by-default synthetic test route. No storage or providers.
import {createOperatorCookieSession,OperatorSessionError} from './operator-cookie-session.mjs';
import {replayServerChat} from './server-chat-conversation.mjs';
const origin='https://leafy-chimera-2403e5.netlify.app';
export function createServerChatPreview({env=process.env,fetchImpl=fetch,sessionFactory=createOperatorCookieSession,clock=()=>new Date()}={}){
 return async request=>{
  const reply=(status,body,cookie)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff',...(cookie?{'set-cookie':cookie}:{})}});
  if(env.SERVER_CHAT_SYNTHETIC_ONLY!=='true'||env.URL!==origin||new URL(request.url).origin!==origin)return reply(503,{error:'PREVIEW_DISABLED'});
  if(request.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
  if(request.headers.get('origin')!==origin||request.headers.has('authorization'))return reply(403,{error:'FORBIDDEN'});
  if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(request.headers.get('content-type')||'')||Number(request.headers.get('content-length')||0)>16000)return reply(400,{error:'INVALID_INPUT'});
  let session;try{session=await sessionFactory({env,fetchImpl}).protectedRead({httpMethod:'POST',headers:{...Object.fromEntries(request.headers),host:new URL(request.url).host}});}catch(error){return reply(error instanceof OperatorSessionError?error.status:503,{error:error instanceof OperatorSessionError?error.code:'SESSION_UNAVAILABLE'});}
  try{
   const raw=await request.text();if(Buffer.byteLength(raw)>16000)throw Error('INVALID_INPUT');
   const input=JSON.parse(raw);
   if(!input||Array.isArray(input)||Object.keys(input).sort().join(',')!=='language,messages')throw Error('INVALID_INPUT');
   const result=replayServerChat(input,{clock});
   return reply(200,{synthetic:true,text:result.text,language:result.language},session.setCookie);
  }catch(error){return reply(error instanceof SyntaxError||error.message==='INVALID_INPUT'||error.message==='INVALID_CHAT_INPUT'?400:503,{error:'PREVIEW_UNAVAILABLE'},session.setCookie);}
 };
}

