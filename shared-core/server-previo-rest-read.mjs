// Server-only (excluded from dist by the server- prefix). READ-ONLY Previo REST client for free capacity.
// Source: public Previo REST docs (https://rest.apidocs.previo.app/, read 2026-11-06):
//   GET https://api.previo.app/rest/calendar/availability?filterFrom&filterTo&roomKindIds[]&ratePlanId
//   headers: Authorization: ApiKey <key>, X-Previo-Hotel-Id: <hotel>; privilege 'Booking.getFreeCapacity'
//   response: [{ratePlanId, availability:[{date, roomKinds:[{id, availability}]}]}]
// Not yet live-verified. AGENTS.md: no live call until the side-effect-free nature of this exact operation
// is documented by Previo, and only against the API TEST hotel 73521 (753011 is the LIVE property: refused).
// The key is passed in by the caller from server env, used once, never logged or returned.
// Fail closed: any missing night, unknown room kind, malformed value or transport error -> UNKNOWN.
import {BUSINESS} from '../business-config.mjs';

export const PREVIO_API_ORIGIN='https://api.previo.app';
export const PREVIO_SANDBOX_HOTEL_ID='73521';
const LIVE_HOTEL_IDS=Object.freeze(['753011']);
const fail=code=>{const error=Error(code);error.code=code;throw error;};
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const addDays=(x,n)=>new Date(Date.parse(x+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const intId=x=>(typeof x==='number'&&Number.isSafeInteger(x)&&x>0)||(typeof x==='string'&&/^[1-9]\d{0,11}$/.test(x));

// Nights of a stay: arrival .. departure-1 (the departure day is not occupied).
export function stayNights(arrival,departure){
 if(!day(arrival)||!day(departure)||departure<=arrival)fail('INVALID_DATES');
 const nights=[];for(let d=arrival;d<departure;d=addDays(d,1))nights.push(d);
 if(nights.length>60)fail('INVALID_DATES');
 return nights;
}

// Owner-approved mapping: local cabin key (business-config accommodationTypes) -> Previo roomKindId.
export function validateRoomKindMapping(mapping){
 if(!mapping||typeof mapping!=='object'||Array.isArray(mapping))fail('MAPPING_UNVERIFIED');
 const keys=Object.keys(mapping),known=Object.keys(BUSINESS.accommodationTypes);
 if(!keys.length||keys.some(k=>!known.includes(k)||!intId(mapping[k])))fail('MAPPING_UNVERIFIED');
 // Distinct room kinds, except the shared A/B pool (business-config: splitA and splitB = one Previo kind).
 const pooled=k=>k==='splitA'||k==='splitB';
 const seen=new Map();
 for(const k of keys){const id=String(mapping[k]),other=seen.get(id);if(other&&!(pooled(other)&&pooled(k)))fail('MAPPING_UNVERIFIED');seen.set(id,k);}
 return Object.freeze(Object.fromEntries(keys.map(k=>[k,String(mapping[k])])));
}

// Live property (753011) only with the separate, default-off live switch (owner/ChatGPT 2026-11-07, prepared,
// NOT enabled): availability read only, same GET-only client. Any other hotel id is refused.
export function previoAvailabilityRequest({hotelId,ratePlanId,roomKindIds,arrival,departure,allowLive=false}){
 const live=LIVE_HOTEL_IDS.includes(String(hotelId));
 if(live&&allowLive!==true)fail('LIVE_PROPERTY_REFUSED');
 if(!live&&String(hotelId)!==PREVIO_SANDBOX_HOTEL_ID)fail('SANDBOX_ONLY');
 if(!intId(ratePlanId))fail('RATE_PLAN_UNVERIFIED');
 if(!Array.isArray(roomKindIds)||!roomKindIds.length||roomKindIds.length>23||!roomKindIds.every(intId)||new Set(roomKindIds.map(String)).size!==roomKindIds.length)fail('MAPPING_UNVERIFIED');
 const nights=stayNights(arrival,departure);
 // Previo refuses filterFrom===filterTo (HTTP 400 "Invalid date range", 73521, 2026-11-09): a one-night stay asks
 // up to the departure day; only the stay nights are evaluated.
 const query=new URLSearchParams([['filterFrom',nights[0]],['filterTo',nights.length===1?departure:nights.at(-1)],...roomKindIds.map(id=>['roomKindIds[]',String(id)]),['ratePlanId',String(ratePlanId)]]);
 return Object.freeze({url:PREVIO_API_ORIGIN+'/rest/calendar/availability?'+query,nights:Object.freeze(nights),roomKindIds:Object.freeze(roomKindIds.map(String)),ratePlanId:String(ratePlanId)});
}

// Minimum free count per room kind over all nights; any gap -> null for that room kind.
export function normalizePrevioAvailability(body,request){
 if(!Array.isArray(body))return null;
 const plan=body.filter(p=>p&&String(p.ratePlanId)===request.ratePlanId);
 if(plan.length!==1||!Array.isArray(plan[0].availability))return null;
 const byDate=new Map();
 for(const entry of plan[0].availability){
  if(!entry||!day(entry.date)||!Array.isArray(entry.roomKinds)||byDate.has(entry.date))return null;
  const kinds=new Map();
  for(const rk of entry.roomKinds){
   if(!rk||!intId(rk.id)||!Number.isSafeInteger(rk.availability)||rk.availability<0||kinds.has(String(rk.id)))return null;
   kinds.set(String(rk.id),rk.availability);
  }
  byDate.set(entry.date,kinds);
 }
 return Object.freeze(Object.fromEntries(request.roomKindIds.map(id=>{
  let min=Infinity;
  for(const night of request.nights){const v=byDate.get(night)?.get(id);if(v===undefined){min=null;break;}min=Math.min(min,v);}
  return [id,min===Infinity?null:min];
 })));
}

// One attempt, pinned host, GET only, no redirects, timeout <= 15 s. Returns per-cabin free counts.
export async function readPrevioFreeCapacity({apiKey,hotelId,ratePlanId,mapping,cabins,arrival,departure,allowLive=false,fetchImpl=globalThis.fetch,timeoutMs=8000,clock=()=>new Date().toISOString()}={}){
 if(typeof apiKey!=='string'||!/^[A-Za-z0-9._~+/=-]{16,512}$/.test(apiKey))fail('PREVIO_KEY_MISSING');
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>15000)fail('INVALID_TIMEOUT');
 const map=validateRoomKindMapping(mapping);
 if(!Array.isArray(cabins)||!cabins.length||cabins.some(c=>!map[c]))fail('MAPPING_UNVERIFIED');
 const request=previoAvailabilityRequest({hotelId,ratePlanId,roomKindIds:[...new Set(cabins.map(c=>map[c]))],arrival,departure,allowLive});
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 let body;
 try{
  const response=await fetchImpl(request.url,{method:'GET',headers:{Authorization:'ApiKey '+apiKey,'X-Previo-Hotel-Id':String(hotelId),Accept:'application/json'},redirect:'error',cache:'no-store',signal:controller.signal});
  if(response.status===401||response.status===403)fail('PREVIO_AUTH_REFUSED');
  if(response.status===429)fail('PREVIO_RATE_LIMITED');
  if(!response.ok)fail('PREVIO_UNAVAILABLE');
  body=await response.json();
 }catch(error){if(error?.code)throw error;fail(controller.signal.aborted?'PREVIO_TIMEOUT':'PREVIO_UNAVAILABLE');}
 finally{clearTimeout(timer);}
 const free=normalizePrevioAvailability(body,request);
 const checkedAt=clock();
 const result=Object.fromEntries(cabins.map(c=>{const n=free?.[map[c]];return [c,Number.isSafeInteger(n)?n:null];}));
 return Object.freeze({source:'previo-rest-calendar-availability',hotelId:String(hotelId),arrival,departure,nights:request.nights.length,checkedAt,
  freeByCabin:Object.freeze(result),complete:Object.values(result).every(n=>n!==null),bookingCreated:false,writeAttempted:false});
}

// Decision for the operator (owner 2026-11-04): a fully checked "no free unit" must stop the price step;
// anything incomplete stays a manual Previo check. A free count is a snapshot, never a reservation.
export function capacityDecision(read,cabin,unitsNeeded=1){
 if(!Number.isSafeInteger(unitsNeeded)||unitsNeeded<1)return 'UNKNOWN';
 const n=read?.freeByCabin?.[cabin];
 if(!Number.isSafeInteger(n))return 'UNKNOWN';
 return n>=unitsNeeded?'AVAILABLE':'UNAVAILABLE';
}
