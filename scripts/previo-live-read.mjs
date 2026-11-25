// Owner 2026-11-23 (PERM-20261123-LIVE-READ-PROBE, PERM-20261123-LIVE-SHOW): Claude's own READ-ONLY access to the live
// Previo property 753011, run in GitHub Actions with the repository secret PREVIO_LIVE_API_KEY (never in chat, never
// printed). Every call is on a fixed allowlist: GET REST reads, the XML reservation SEARCH, and the price suggester
// (a calculation – books nothing; the same call ran many times on TEST 73521 without a booking). No write, change,
// cancel or status call exists here. Output is sanitized: business data (types, plans, categories, free counts,
// totals) is printed; anything about real guests is reduced to counts and field names – never a value.
//
// Usage: node scripts/previo-live-read.mjs '<json>'   (the workflow passes the last line of
// docs/PREVIO-LIVE-READ-REQUEST.md). Example request:
// {"probes":["plans","kinds","rooms","guestCategories","calendar","price","reservations","get:/rest/guest-categories"],
//  "arrival":"2027-06-15","departure":"2027-06-17","cabin":"deluxe","adults":2,"from":"2026-11-23","to":"2026-11-25"}
import {PREVIO_LIVE_753011} from '../shared-core/previo-booking-intent.mjs';
import {readPrevioFreeCapacity} from '../shared-core/server-previo-rest-read.mjs';

const ORIGIN='https://api.previo.app',HOTEL='753011';
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x);
const PII=/name|mail|phone|tel|address|street|city|zip|birth|document|passport|note|comment|company|vat|iban|card|contact|guest|person|first|last|surname/i;

// Shape only: keys and counts, never values (for anything that may hold guest data).
export function shape(x,depth=0){
 if(Array.isArray(x))return {array:x.length,item:x.length&&depth<3?shape(x[0],depth+1):null};
 if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).slice(0,60).map(k=>[k,depth<3&&x[k]&&typeof x[k]==='object'?shape(x[k],depth+1):typeof x[k]]));
 return typeof x;
}
// Business code lists ({id,name}): values are fine unless a key looks personal.
export function codeList(list){
 if(!Array.isArray(list))return shape(list);
 return list.slice(0,80).map(o=>Object.fromEntries(Object.entries(o||{}).filter(([k,v])=>!PII.test(k)||/^(name|hotelLangName)$/.test(k)).filter(([,v])=>v===null||['string','number','boolean'].includes(typeof v))));
}
export function xmlShape(text){
 const blocks=[...String(text).matchAll(/<reservation>([\s\S]*?)<\/reservation>/g)].map(m=>m[1]);
 const tags=[...new Set(blocks.flatMap(b=>[...b.matchAll(/<([A-Za-z][A-Za-z0-9]*)[ >]/g)].map(m=>m[1])))].sort();
 const status={};for(const b of blocks){const s=b.match(/<statusId>(\d+)<\/statusId>/)?.[1]??'?';status[s]=(status[s]||0)+1;}
 return {reservations:blocks.length,statusCounts:status,tags,error:/<error>/.test(text)?String(text.match(/<message>([^<]{0,160})/)?.[1]||'error'):null};
}

export function previoLiveReader({apiKey,fetchImpl=globalThis.fetch}){
 if(typeof apiKey!=='string'||!/^[A-Za-z0-9._~+/=-]{16,512}$/.test(apiKey))throw Object.assign(Error('PREVIO_LIVE_API_KEY missing'),{code:'KEY'});
 const H={Authorization:'ApiKey '+apiKey,'X-Previo-Hotel-Id':HOTEL,'X-Previo-Language-ID':'2',Accept:'application/json'};
 const call=async(path,opts={})=>{
  const r=await fetchImpl(ORIGIN+path,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),...opts,headers:{...H,...(opts.headers||{})}});
  const text=await r.text();let json=null;try{json=JSON.parse(text);}catch{}
  return {status:r.status,json,text,error:r.ok?null:String(json?.error||json?.message||text).slice(0,200)};
 };
 const get=path=>{
  // Only plain REST paths, GET only.
  if(!/^\/rest\/[a-z0-9/_-]{1,80}(\?[a-zA-Z0-9=&_-]{0,120})?$/.test(path))throw Object.assign(Error('PATH_NOT_ALLOWED'),{code:'PATH'});
  return call(path,{method:'GET'});
 };
 return {
  plans:async()=>{const r=await get('/rest/rate-plan');return {http:r.status,error:r.error,plans:codeList(r.json)};},
  kinds:async()=>{const r=await get('/rest/premise/kind?obtId=1');return {http:r.status,error:r.error,kinds:codeList(r.json)};},
  rooms:async()=>{const r=await get('/rest/rooms');return {http:r.status,error:r.error,rooms:r.status===200?codeList(r.json):null};},
  guestCategories:async()=>{const r=await get('/rest/guest-categories');return {http:r.status,error:r.error,categories:r.status===200?codeList(r.json):null};},
  calendar:async({arrival,departure})=>{
   const mapping=Object.fromEntries(Object.entries(PREVIO_LIVE_753011.roomKinds).map(([k,v])=>[k,String(v)]));
   try{const x=await readPrevioFreeCapacity({apiKey,hotelId:HOTEL,ratePlanId:String(PREVIO_LIVE_753011.ratePlanId),mapping,cabins:Object.keys(mapping),arrival,departure,allowLive:true,fetchImpl,timeoutMs:15000});
    return {freeByCabin:x.freeByCabin,complete:x.complete,bookingCreated:x.bookingCreated,writeAttempted:x.writeAttempted};}
   catch(e){return {error:e.code||'READ_FAILED'};}
  },
  // Price calculation only (books nothing). Needs the live adult guest-category id from guestCategories.
  price:async({arrival,departure,cabin,adults,adultCategoryId})=>{
   if(!Number.isSafeInteger(adultCategoryId))return {skipped:'ADULT_CATEGORY_UNKNOWN'};
   const roomKindId=PREVIO_LIVE_753011.roomKinds[cabin];if(!roomKindId)return {skipped:'CABIN_UNKNOWN'};
   const body={rooms:[{from:arrival,to:departure,roomKindId,ratePlanId:PREVIO_LIVE_753011.ratePlanId,guests:Array(adults).fill({guestCategoryId:adultCategoryId})}]};
   const r=await call('/rest/reservations/accounts/suggester',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const j=r.json||{};
   return {http:r.status,error:r.error,totalPrice:Number.isFinite(j.totalPrice)?j.totalPrice:null,currency:j?.currency?.currencyCode??null,shape:r.status===200?shape(j):null};
  },
  // Reservation SEARCH (XML, read): counts, statuses and field names only – no value of any reservation.
  reservations:async({from,to})=>{
   const xml=`<?xml version="1.0"?><request><hotId>${HOTEL}</hotId><term><from>${from}</from><to>${to}</to></term><termType>overlap</termType><statuses>${[1,2,3,6,7,8,9,10].map(i=>`<cosId>${i}</cosId>`).join('')}</statuses></request>`;
   const r=await call('/x1/hotel/searchReservations',{method:'POST',headers:{'Content-Type':'application/xml',Accept:'application/xml'},body:xml});
   return {http:r.status,...xmlShape(r.text)};
  },
  // Payments (XML Hotel.getPayments, a read): status, error text, count and field names only – never an amount or name.
  payments:async({from,to})=>{
   const xml=`<?xml version="1.0"?><request><hotId>${HOTEL}</hotId><term><from>${from}</from><to>${to}</to></term></request>`;
   const r=await call('/x1/hotel/getPayments',{method:'POST',headers:{'Content-Type':'application/xml',Accept:'application/xml'},body:xml});
   const blocks=[...String(r.text).matchAll(/<payment>([\s\S]*?)<\/payment>/g)].map(m=>m[1]);
   // Owner 2026-11-25: how far back – aggregate only (earliest/latest issue date, count per year); no amount or name.
   const days=blocks.map(b=>b.match(/<issued>(\d{4}-\d{2}-\d{2})/)?.[1]).filter(Boolean).sort();
   const perYear={};for(const d of days)perYear[d.slice(0,4)]=(perYear[d.slice(0,4)]||0)+1;
   return {http:r.status,payments:blocks.length,earliest:days[0]??null,latest:days.at(-1)??null,perYear,tags:[...new Set([...String(r.text).matchAll(/<([A-Za-z][A-Za-z0-9]*)[ >]/g)].map(m=>m[1]))].sort(),
    error:/<error>/.test(r.text)?String(r.text.match(/<message>([^<]{0,160})/)?.[1]||'error'):null};
  },
  // Owner 2026-11-25: does getPayments filter by reservation? One past checked-out reservation is picked INSIDE the
  // run (its id is never printed); only counts and field names come out.
  paymentsByReservation:async({from,to})=>{
   const sx=`<?xml version="1.0"?><request><hotId>${HOTEL}</hotId><term><from>${from}</from><to>${to}</to></term><termType>overlap</termType><statuses><cosId>9</cosId></statuses></request>`;
   const rs=await call('/x1/hotel/searchReservations',{method:'POST',headers:{'Content-Type':'application/xml',Accept:'application/xml'},body:sx});
   const resIds=[...String(rs.text).matchAll(/<resId>(\d+)<\/resId>/g)].map(m=>m[1]);
   if(!resIds.length)return {reservations:0};
   const out=[];
   for(const id of resIds.slice(0,3)){
    const px=`<?xml version="1.0"?><request><hotId>${HOTEL}</hotId><resId>${id}</resId></request>`;
    const r=await call('/x1/hotel/getPayments',{method:'POST',headers:{'Content-Type':'application/xml',Accept:'application/xml'},body:px});
    const n=[...String(r.text).matchAll(/<payment>/g)].length;
    out.push({http:r.status,payments:n,foundRows:Number(String(r.text).match(/<foundRows>(\d+)/)?.[1]??NaN),error:/<error>/.test(r.text)?String(r.text.match(/<message>([^<]{0,160})/)?.[1]||'error'):null});
   }
   return {reservationsInWindow:resIds.length,checked:out};
  },
  // Any other plain REST GET (e.g. a code list): status and SHAPE only.
  get:async path=>{const r=await get(path);return {path,http:r.status,error:r.error,shape:r.json?shape(r.json):null};}
 };
}

export async function run(request,{apiKey,fetchImpl}={}){
 const q=request||{};const reader=previoLiveReader({apiKey,fetchImpl});const out={};
 const probes=Array.isArray(q.probes)?q.probes.slice(0,12):[];
 let adultCategoryId=Number.isSafeInteger(q.adultCategoryId)?q.adultCategoryId:null;
 for(const p of probes){
  try{
   if(p==='calendar'){if(!day(q.arrival)||!day(q.departure))out[p]={skipped:'DATES'};else out[p]=await reader.calendar(q);}
   else if(p==='price'){if(!day(q.arrival)||!day(q.departure))out[p]={skipped:'DATES'};else out[p]=await reader.price({...q,adults:Number(q.adults)||2,adultCategoryId});}
   else if(p==='reservations'){if(!day(q.from)||!day(q.to)||q.to<q.from)out[p]={skipped:'DATES'};else out[p]=await reader.reservations(q);}
   else if(p==='paymentsByReservation'){if(!day(q.from)||!day(q.to)||q.to<q.from)out[p]={skipped:'DATES'};else out[p]=await reader.paymentsByReservation(q);}
   else if(p==='payments'){if(!day(q.from)||!day(q.to)||q.to<q.from)out[p]={skipped:'DATES'};else out[p]=await reader.payments(q);}
   else if(p.startsWith('get:'))out[p]=await reader.get(p.slice(4));
   else if(['plans','kinds','rooms','guestCategories'].includes(p)){
    out[p]=await reader[p]();
    // The adult category for the price probe, if the list names one.
    if(p==='guestCategories'&&Array.isArray(out[p].categories)&&adultCategoryId===null){
     const a=out[p].categories.find(c=>/feln|adult|erwachs/i.test(String(c.name||'')));if(Number.isSafeInteger(a?.id??a?.guaId))adultCategoryId=a.id??a.guaId;}
   }else out[p]={skipped:'UNKNOWN_PROBE'};
  }catch(e){out[p]={error:e.code||'FAILED'};}
 }
 return out;
}

if(import.meta.url===`file://${process.argv[1]}`){
 let request={};try{request=JSON.parse(process.argv[2]||'{}');}catch{console.log('BAD_REQUEST');process.exit(1);}
 run(request,{apiKey:process.env.PREVIO_LIVE_API_KEY}).then(r=>console.log(JSON.stringify(r,null,1))).catch(e=>{console.log('BLOCKED',e.code||e.message);process.exit(1);});
}
