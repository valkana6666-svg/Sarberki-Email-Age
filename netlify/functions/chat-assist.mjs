// V3-SMALLTALK (owner 2026-11-15): the chatbot's free questions answered by a language model, ONLY from approved
// facts (shared-core/chat-assist.mjs). Public same-origin page, so: OFF by default (CHAT_ASSIST_ENABLED=test-only),
// same-origin JSON only, short input, a per-instance rate limit, nothing stored or logged (the guest text goes only to
// the model provider, store:false). Any failure -> {answer:null}: the page keeps the existing rule-based answer.
import {askChatAssist,chatAssistConfigured} from '../../shared-core/chat-assist.mjs';

const ORIGIN='https://leafy-chimera-2403e5.netlify.app';
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});

export function createChatAssistHandler({env=process.env,fetchImpl=fetch,now=()=>Date.now(),perMinute=20}={}){
 let windowStart=0,count=0;
 return async request=>{
  if(!chatAssistConfigured(env))return json(503,{error:'ASSIST_DISABLED'});
  if(request.method!=='POST')return json(405,{error:'METHOD_NOT_ALLOWED'});
  if(request.headers.get('origin')!==ORIGIN||request.headers.get('sec-fetch-site')!=='same-origin'||request.headers.get('content-type')?.split(';')[0]!=='application/json')return json(403,{error:'FORBIDDEN'});
  const raw=await request.text();if(raw.length>2000)return json(413,{error:'TOO_LARGE'});
  let input;try{input=JSON.parse(raw);}catch{return json(400,{error:'INVALID_INPUT'});}
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='language,message'||
   typeof input.message!=='string'||!input.message.trim()||input.message.length>1000||!['hu','de','en','si'].includes(input.language))return json(400,{error:'INVALID_INPUT'});
  const t=now();if(t-windowStart>60000){windowStart=t;count=0;}
  if(++count>perMinute)return json(429,{error:'TRY_LATER'});
  try{return json(200,{answer:await askChatAssist(input,{env,fetchImpl})});}
  catch{return json(200,{answer:null});}
 };
}
export default createChatAssistHandler();
