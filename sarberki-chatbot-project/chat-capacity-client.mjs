// Operator-only Previo TEST availability for the chat (owner demo 2026-11-11). Uses the signed-in operator's cookie
// session (CSRF); without a session it returns null and the chat stays exactly as before. Read only.
import {createOperatorSession} from './operator-session.mjs';
export function createChatCapacityProvider({request=fetch,tenantId='sarberki-test'}={}){
 const session=createOperatorSession({request});
 return async input=>{
  let meta;try{meta=await session.restore();}catch{return null;}
  if(!meta?.csrfToken||!input)return null;
  const q=new URLSearchParams({action:'chat-availability',tenantId,arrival:input.arrival,departure:input.departure,
   guests:String(input.guests),adults:String(input.adults??input.guests),cabin:input.cabin,units:String(input.units??1)});
  try{
   const r=await request('/.netlify/functions/booking-cases?'+q,{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',
    headers:{'X-Sarberki-Operator':'1','X-CSRF-Token':meta.csrfToken}});
   if(!r.ok)return null;const body=await r.json();return body?.result?.capacity??null;
  }catch{return null;}
 };
}
