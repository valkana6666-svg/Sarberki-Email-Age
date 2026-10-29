// Isolated operator test client. No local decision engine or browser storage.
import {createCookieJsonRequest} from '../shared-core/cookie-json-request.mjs';
export function createServerChatClient({request=fetch,getCsrfToken,language='auto'}={}){
 if(typeof getCsrfToken!=='function')throw Error('AUTH_REQUIRED');
 // Edge-generated 429/5xx bodies can be plain text. Only successful responses
 // require JSON; failure handling trusts the HTTP status, never the body.
 const send=createCookieJsonRequest({request:async(url,options)=>{
  const response=await request(url,options);
  return response.ok?response:{ok:false,status:response.status,headers:response.headers,json:async()=>({})};
 }});let turns=[],epoch=0,busy=false;
 return Object.freeze({
  reset(){epoch++;turns=[];},
  async reply(message){
   if(busy)throw Error('REQUEST_IN_PROGRESS');
   if(typeof message!=='string'||!message.trim()||message.length>1000||turns.length>=30)throw Error('INVALID_CHAT_INPUT');
   const id=epoch, pending=[...turns,message];busy=true;
   try{
    const body=JSON.stringify({language,messages:pending});
    if(pending.reduce((sum,text)=>sum+text.length,0)>12000||new TextEncoder().encode(body).byteLength>16000)throw Error('INVALID_CHAT_INPUT');
    const csrf=await getCsrfToken();if(id!==epoch)throw Error('SESSION_CHANGED');
    const response=await send('/api/server-chat-preview',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{'content-type':'application/json','X-Sarberki-Operator':'1','X-CSRF-Token':csrf},body});
    if(id!==epoch)throw Error('SESSION_CHANGED');
    if(!response.ok)throw Error(response.status===429?'RATE_LIMITED':response.status===401?'AUTH_REQUIRED':response.status===403?'FORBIDDEN':'PREVIEW_UNAVAILABLE');
    const result=await response.json();if(id!==epoch)throw Error('SESSION_CHANGED');
    if(result?.synthetic!==true||typeof result.text!=='string'||!result.text||result.text.length>12000||!['hu','de','en','si'].includes(result.language)||Object.keys(result).sort().join(',')!=='language,synthetic,text')throw Error('INVALID_RESPONSE');
    turns=pending;return {text:result.text,language:result.language};
   }finally{busy=false;}
  }
 });
}
