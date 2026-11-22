// Server-only. Owner 2026-11-22 (PERM-20261122-OPTION-EXPIRY-CANCEL, TEST 73521 only): Previo does not release an
// expired option by itself (read-only check 11-22: options expired 27 h earlier were still status 1), so the house
// stays blocked. When an option the SYSTEM created (booking number SC-…) has expired, the system cancels it in Previo
// (status 7) and reads it back. Own switch OPTION_EXPIRY_CANCEL=test-only (default off) on top of the existing V2
// writer locks. Never touches confirmed/other bookings, bookings made by hand in Previo, or the live property.
import {previoBookingWriter} from './server-previo-booking-sync.mjs';
import {statusSearchXml} from './server-previo-status.mjs';

export const EXPIRY_SWITCH='test-only';
export const EXPIRY_GRACE_MINUTES=15; // a guest paying right at the deadline still has a few minutes
export const EXPIRY_MAX_PER_RUN=5;
const OWN_VOUCHER=/^SC-[0-9A-F]{16}$/;
const ORIGIN='https://api.previo.app';

// Previo writes optionExpiration in hotel-local time ("YYYY-MM-DD HH:MM:SS", sometimes with a "T").
export function hotelLocalNow(ms){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms)).map(x=>[x.type,x.value]));
 return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}
const norm=s=>String(s||'').trim().replace('T',' ').slice(0,19);
const validLocal=s=>/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s);

// Pure: which reservations in a search answer are the system's own, still options, and expired (plus grace).
export function expiredOwnOptions(text,nowMs,graceMinutes=EXPIRY_GRACE_MINUTES){
 const cutoff=hotelLocalNow(nowMs-graceMinutes*60000);
 return [...String(text||'').matchAll(/<reservation>([\s\S]*?)<\/reservation>/g)].map(([,b])=>b).map(b=>({
  resId:Number(b.match(/<resId>(\d+)<\/resId>/)?.[1]),voucher:b.match(/<voucher>([^<]*)<\/voucher>/)?.[1]??'',
  statusId:Number(b.match(/<statusId>(\d+)<\/statusId>/)?.[1]),expires:norm(b.match(/<optionExpiration>([^<]*)<\/optionExpiration>/)?.[1])
 })).filter(r=>Number.isSafeInteger(r.resId)&&r.resId>0&&OWN_VOUCHER.test(r.voucher)&&r.statusId===1&&validLocal(r.expires)&&r.expires<cutoff);
}

const shift=(ms,days)=>new Date(ms+days*86400000).toISOString().slice(0,10);
export async function cancelExpiredOptions({env,fetchImpl=globalThis.fetch,now=()=>Date.now(),writer=undefined,log=()=>{}}={}){
 if(env?.OPTION_EXPIRY_CANCEL!==EXPIRY_SWITCH||String(env?.PREVIO_HOTEL_ID)!=='73521')return {status:'off'};
 const w=writer===undefined?previoBookingWriter(env,fetchImpl):writer;
 if(!w||typeof w.setStatus!=='function')return {status:'off'};
 const search=async()=>{
  const r=await fetchImpl(ORIGIN+'/x1/hotel/searchReservations',{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000),
   headers:{Authorization:'ApiKey '+env.PREVIO_API_KEY,'Content-Type':'application/xml',Accept:'application/xml'},
   body:statusSearchXml({hotelId:'73521',from:shift(now(),-2),to:shift(now(),550)})});
  const text=await r.text();
  if(!r.ok||/<error>/.test(text)||!/<reservations/.test(text))throw Object.assign(Error('read'),{code:'PREVIO_SEARCH_FAILED'});
  return text;
 };
 let text;try{text=await search();}catch{return {status:'unknown'};}
 const due=expiredOwnOptions(text,now()).slice(0,EXPIRY_MAX_PER_RUN),results=[];
 for(const r of due){
  // #9 7081585610: the staff may confirm or extend the option after the first read. Right before each write Previo is
  // read again and the booking must still be the same expired option (status 1, same booking number, expiry past the
  // cutoff). The XML API has no conditional update, so a window of about one request (~1 s) remains between this
  // re-read and the write; a booking confirmed exactly then is cancelled and shows in the log/read-back (status 7).
  let fresh;try{fresh=expiredOwnOptions(await search(),now()).find(x=>x.resId===r.resId&&x.voucher===r.voucher);}catch{fresh=undefined;}
  if(!fresh){results.push({resId:r.resId,voucher:r.voucher,write:'skipped',code:'CHANGED_OR_UNREADABLE'});continue;}
  try{await w.setStatus({resId:r.resId,status:'cancelled'});results.push({resId:r.resId,voucher:r.voucher,write:'sent'});}
  catch(e){results.push({resId:r.resId,voucher:r.voucher,write:'failed',code:typeof e?.code==='string'?e.code:'WRITE'});}
 }
 // Read back: a cancellation counts only when Previo shows status 7.
 if(results.some(x=>x.write==='sent')){
  let after='';try{after=await search();}catch{}
  for(const x of results)if(x.write==='sent'){
   const b=[...after.matchAll(/<reservation>([\s\S]*?)<\/reservation>/g)].map(([,b])=>b).find(b=>b.includes(`<resId>${x.resId}</resId>`));
   x.readBack=b?Number(b.match(/<statusId>(\d+)<\/statusId>/)?.[1]):null;x.cancelled=x.readBack===7;
  }
 }
 for(const x of results)log(`option-expiry resId=${x.resId} voucher=${x.voucher} write=${x.write} readBack=${x.readBack??'-'}`);
 return {status:'ran',checked:due.length,results};
}
