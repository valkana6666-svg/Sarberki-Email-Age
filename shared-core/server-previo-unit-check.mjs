// Server-only. V2 step 4 (owner 2026-11-09): when the operator finalizes a booking with a unit and a Previo reference,
// a READ-ONLY Previo check (XML Hotel.searchReservations, term overlap, 73521 only) answers two questions:
//  1. is the chosen physical unit (objId) taken in Previo by ANOTHER reservation for these nights? -> refuse;
//  2. does the reference the operator typed exist on that unit for these dates? -> confirmed / not found (note only).
// Only ids, dates and status are read from the response; guest names, e-mails and phones are never kept or returned.
// Statuses (System.getReservationStatuses 2026-11-09): 7 storno and 8 no-show free the unit; any other status holds it.
import {PREVIO_TEST_73521} from './previo-booking-intent.mjs';

const ORIGIN='https://api.previo.app';
const FREEING=new Set([7,8]);
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x);

export function unitSearchXml({hotelId,arrival,departure}){
 return `<?xml version="1.0"?><request><hotId>${hotelId}</hotId><term><from>${arrival}</from><to>${departure}</to></term><termType>overlap</termType><roomsOnly>1</roomsOnly></request>`;
}

// Pure: reservation blocks -> {objId, from, to, statusId, voucher, resId}; no personal fields.
export function reservationsFromXml(text){
 return [...String(text||'').matchAll(/<reservation>([\s\S]*?)<\/reservation>/g)].map(([,b])=>{
  const num=re=>{const m=b.match(re);return m?Number(m[1]):null;};
  return {resId:num(/<resId>(\d+)<\/resId>/),objId:num(/<object>\s*<objId>(\d+)<\/objId>/),statusId:num(/<statusId>(\d+)<\/statusId>/),
   voucher:b.match(/<voucher>([^<]*)<\/voucher>/)?.[1]??null,
   from:b.match(/<term>\s*<from>(\d{4}-\d{2}-\d{2})/)?.[1]??null,to:b.match(/<term>[\s\S]*?<to>(\d{4}-\d{2}-\d{2})/)?.[1]??null};
 });
}

// Pure decision. Half-open nights: [arrival, departure) overlaps [from, to) when from < departure && to > arrival.
export function unitDecision(reservations,{objId,arrival,departure,previoReference}){
 const onUnit=reservations.filter(r=>r.objId===objId&&!FREEING.has(r.statusId)&&r.from&&r.to&&r.from<departure&&r.to>arrival);
 const own=onUnit.filter(r=>r.voucher&&r.voucher===String(previoReference||''));
 const others=onUnit.filter(r=>!own.includes(r));
 return Object.freeze({status:others.length?'taken':'free',referenceFound:own.length>0,
  conflicts:Object.freeze(others.map(r=>Object.freeze({from:r.from,to:r.to,statusId:r.statusId})))});
}

export async function checkPrevioUnit({apiKey,unit,arrival,departure,previoReference,property=PREVIO_TEST_73521,fetchImpl=globalThis.fetch,timeoutMs=8000}={}){
 if(String(property?.hotelId)!=='73521')return {status:'unknown'};
 const objId=property.rooms?.[unit];
 if(!Number.isSafeInteger(objId)||!day(arrival)||!day(departure)||departure<=arrival)return {status:'unknown'};
 if(typeof apiKey!=='string'||!/^[A-Za-z0-9._~+/=-]{16,512}$/.test(apiKey))return {status:'unknown'};
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const r=await fetchImpl(ORIGIN+'/x1/hotel/searchReservations',{method:'POST',redirect:'error',cache:'no-store',signal:controller.signal,
   headers:{Authorization:'ApiKey '+apiKey,'Content-Type':'application/xml',Accept:'application/xml'},body:unitSearchXml({hotelId:property.hotelId,arrival,departure})});
  if(!r.ok)return {status:'unknown'};
  const text=await r.text();
  if(/<error>/.test(text)||!/<reservations/.test(text))return {status:'unknown'};
  return unitDecision(reservationsFromXml(text),{objId,arrival,departure,previoReference});
 }catch{return {status:'unknown'};}
 finally{clearTimeout(timer);}
}

// Same owner switch as the other Level 1 reads (default off).
export function previoUnitChecker(env,fetchImpl){
 if(env?.PREVIO_READ_API_ENABLED!=='sandbox-73521-only'||String(env?.PREVIO_HOTEL_ID)!=='73521')return null;
 return args=>checkPrevioUnit({...args,apiKey:env.PREVIO_API_KEY,fetchImpl});
}

export function previoUnitLine(check,unit,previoReference){
 if(check?.status==='free')return check.referenceFound
  ?`Previo (csak olvasó): a(z) ${previoReference} foglalás megtalálható a(z) ${unit} egységen; más foglalás nincs rajta erre az időszakra.`
  :`Previo (csak olvasó): a(z) ${unit} egység szabad, de a(z) ${previoReference} hivatkozás NEM található rajta ezekre a napokra – ellenőrizd a Previóban.`;
 return 'Previo-egységellenőrzés most nem sikerült – a kézi Previo-ellenőrzés érvényes.';
}
