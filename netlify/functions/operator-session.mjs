import {createOperatorCookieSession,OperatorSessionError,operatorSessionErrorBody} from '../../shared-core/operator-cookie-session.mjs';
const headers={'Content-Type':'application/json','Cache-Control':'private, no-store','Pragma':'no-cache','Expires':'0','X-Content-Type-Options':'nosniff'};
export function createOperatorSessionHandler({env=process.env,fetchImpl=fetch,now=Date.now}={}){
 const session=createOperatorCookieSession({env,fetchImpl,now});
 return async event=>{
  const reply=(statusCode,body,setCookie)=>({statusCode,headers:{...headers,...(setCookie?{'Set-Cookie':setCookie}:{})},body:JSON.stringify(body)});
  try{
   if(event.httpMethod==='GET'){
    if(event.body||Object.keys(event.queryStringParameters||{}).length) return reply(400,{error:'INVALID_INPUT'});
    const result=await session.restore(event);return reply(200,result.metadata,result.setCookie);
   }
   if(event.httpMethod!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
   if(event.isBase64Encoded||Buffer.byteLength(event.body||'')>4096||! /^application\/json(?:;\s*charset=utf-8)?$/i.test(event.headers?.['content-type']||event.headers?.['Content-Type']||''))return reply(400,{error:'INVALID_INPUT'});
   let input;try{input=JSON.parse(event.body||'');}catch{return reply(400,{error:'INVALID_INPUT'});}
   let result;
   if(input?.action==='login')result=await session.login(event,input);
   else if(input?.action==='logout'&&Object.keys(input).length===1)result=await session.logout(event);
   else return reply(400,{error:'INVALID_INPUT'});
   return reply(200,result.metadata,result.setCookie);
  }catch(error){return error instanceof OperatorSessionError?reply(error.status,operatorSessionErrorBody(error),error.setCookie):reply(503,{error:'SESSION_SERVICE_UNAVAILABLE'});}
 };
}
export const handler=createOperatorSessionHandler();
