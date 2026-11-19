// Server-only. Returning-guest check against Previo's past stays (owner 2026-11-19, prepared; switch default OFF).
// Read-only XML Hotel.searchReservations, checked-out stays (statusId 9, System.getReservationStatuses) whose stay
// ended within the look-back window. Contact fields are compared IN MEMORY only and dropped: the result carries no
// guest data (status, how it matched, last stay date). Only the Previo TEST property 73521 is wired; the live property
// needs a read key with guest-data scope and a separate owner decision (nothing is requested from Previo now).
import {returningGuestDecision} from './returning-guest.mjs';
import {BUSINESS} from '../business-config.mjs';

const ORIGIN='https://api.previo.app',CHECKED_OUT=9,DAY=86400000;
export const RETURNING_SWITCH='test-only';

export function guestHistoryXml({hotelId,from,to}){
 return `<?xml version="1.0"?><request><hotId>${hotelId}</hotId><term><from>${from}</from><to>${to}</to></term><termType>overlap</termType><statuses><cosId>${CHECKED_OUT}</cosId></statuses></request>`;
}
// Pure: reservation blocks → [{email, phone, name, lastDay}] for checked-out stays (kept in memory only).
export function staysFromXml(text){
 return [...String(text||'').matchAll(/<reservation>([\s\S]*?)<\/reservation>/g)].map(([,b])=>{
  const contact=b.match(/<contactPerson>([\s\S]*?)<\/contactPerson>/)?.[1]||'';
  const pick=(src,tag)=>src.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1]?.trim()||null;
  return {statusId:Number(b.match(/<statusId>(\d+)<\/statusId>/)?.[1]),email:pick(contact,'email'),phone:pick(contact,'phone'),name:pick(contact,'name'),
   lastDay:b.match(/<term>[\s\S]*?<to>(\d{4}-\d{2}-\d{2})/)?.[1]??null};
 }).filter(s=>s.statusId===CHECKED_OUT).map(({statusId,...s})=>s);
}

export function previoGuestHistoryChecker(env,fetchImpl=globalThis.fetch,{timeoutMs=8000}={}){
 if(env?.RETURNING_GUEST_CHECK!==RETURNING_SWITCH||env?.PREVIO_READ_API_ENABLED!=='sandbox-73521-only'||String(env?.PREVIO_HOTEL_ID)!=='73521')return null;
 if(typeof env.PREVIO_API_KEY!=='string'||env.PREVIO_API_KEY.length<16)return null;
 return async({guest,referenceDay})=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(referenceDay||''))return {status:'unknown'};
  const days=Number(BUSINESS.operationalRules.returningGuestLookbackDays);
  const from=new Date(Date.parse(referenceDay+'T00:00:00Z')-days*DAY).toISOString().slice(0,10);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const r=await fetchImpl(ORIGIN+'/x1/hotel/searchReservations',{method:'POST',redirect:'error',cache:'no-store',signal:controller.signal,
    headers:{Authorization:'ApiKey '+env.PREVIO_API_KEY,'Content-Type':'application/xml',Accept:'application/xml'},body:guestHistoryXml({hotelId:'73521',from,to:referenceDay})});
   if(!r.ok)return {status:'unknown'};
   const text=await r.text();if(/<error>/.test(text)||!/<reservations/.test(text))return {status:'unknown'};
   return returningGuestDecision({guest,stays:staysFromXml(text),referenceDay});
  }catch{return {status:'unknown'};}
  finally{clearTimeout(timer);}
 };
}
