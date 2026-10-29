// Isolated operator test client. No local decision engine or browser storage.
import {createCookieJsonRequest} from '../shared-core/cookie-json-request.mjs';
export function createServerChatClient({request=fetch,getCsrfToken,language='auto'}={}){
 if(typeof getCsrfToken!=='function')throw Error('AUTH_REQUIRED');
 const send=createCookieJsonRequest({request});let turns=[],epoch=0,busy=false;
 return Object.freeze({
  reset(){epoch++;turns=[];},
  async reply(message){
   if(busy)throw Error('REQUEST_IN_PROGRESS');
   if(typeof message!=='string'||!message.trim()||message.length>1000||turns.length>=30)throw Error('INVALID_CHAT_INPUT');
   const id=epoch, pending=[...turns,message];busy=true;
   try{
    const csrf=await getCsrfToken();if(id!==epoch)throw Error('SESSION_CHANGED');
    const response=await send('/.netlify/functions/server-chat-preview',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{'content-type':'application/json','X-Sarberki-Operator':'1','X-CSRF-Token':csrf},body:JSON.stringify({language,messages:pending})});
    if(id!==epoch)throw Error('SESSION_CHANGED');if(!response.ok)throw Error('PREVIEW_UNAVAILABLE');
    const result=await response.json();if(id!==epoch)throw Error('SESSION_CHANGED');
    if(result?.synthetic!==true||typeof result.text!=='string'||!result.text||result.text.length>12000||!['hu','de','en','si'].includes(result.language)||Object.keys(result).sort().join(',')!=='language,synthetic,text')throw Error('INVALID_RESPONSE');
    turns=pending;return {text:result.text,language:result.language};
   }finally{busy=false;}
  }
 });
}
