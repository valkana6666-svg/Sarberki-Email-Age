// Server-only. Level 1 add-on (owner 2026-11-09, "2. pont"): a read-only cross-check of our price-list total against
// the Previo suggester (POST /rest/reservations/accounts/suggester – computes a price, books nothing). The result is
// ONE operator-only line; the guest text and the price we quote never change. API TEST property 73521 only.
// Children: Previo's "Gyerek" category is 0–17 (cannot express 0–2 free / 3–8 +5000), so cases with children
// under 9 are reported as "not comparable", never as a match or a difference.
import {previoPriceRequest,PREVIO_TEST_73521} from './previo-booking-intent.mjs';

const ORIGIN='https://api.previo.app';
const fmt=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ');

export async function readPrevioPrice({apiKey,values,cabin,fetchImpl=globalThis.fetch,timeoutMs=8000}={}){
 if(typeof apiKey!=='string'||!/^[A-Za-z0-9._~+/=-]{16,512}$/.test(apiKey))return {status:'unavailable'};
 const ages=String(values?.child_ages||'').split(',').filter(Boolean).map(Number);
 if(ages.some(a=>a<9))return {status:'not_comparable'};
 let req;try{req=previoPriceRequest({values,cabin,property:PREVIO_TEST_73521});}catch{return {status:'unavailable'};}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const r=await fetchImpl(ORIGIN+'/rest/reservations/accounts/suggester',{method:'POST',redirect:'error',cache:'no-store',signal:controller.signal,
   headers:{Authorization:'ApiKey '+apiKey,'X-Previo-Hotel-Id':req.hotelId,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(req.body)});
  if(!r.ok)return {status:'unavailable'};
  const j=await r.json();
  return Number.isSafeInteger(j?.totalPrice)&&j?.currency?.currencyCode==='HUF'?{status:'read',total:j.totalPrice}:{status:'unavailable'};
 }catch{return {status:'unavailable'};}
 finally{clearTimeout(timer);}
}

// Same owner switch as the capacity read (default off). null = no check, no line.
export function previoPriceChecker(env,fetchImpl){
 if(env?.PREVIO_READ_API_ENABLED!=='sandbox-73521-only'||String(env?.PREVIO_HOTEL_ID)!=='73521')return null;
 return ({values,cabin})=>readPrevioPrice({apiKey:env.PREVIO_API_KEY,values,cabin,fetchImpl});
}

export function previoPriceLine(check,ourTotal){
 if(check?.status==='not_comparable')return 'Previo-ár: gyermekes eset, nem összevethető (a Previo „Gyerek” kategóriája 0–17 év).';
 if(check?.status!=='read')return 'Previo-ár: most nem ellenőrizhető – az árlista szerinti ár érvényes.';
 if(check.total===ourTotal)return `Previo-ár (csak olvasó): ${fmt(check.total)} Ft – egyezik az árlistával.`;
 return `Previo-ár (csak olvasó): ${fmt(check.total)} Ft – ELTÉR az árlistától (${fmt(ourTotal)} Ft). Küldés előtt ellenőrizd a Previóban.`;
}
