// Server-only. Owner 2026-11-23 („Javaslat elfogadva”): the LIVE Previo (753011) availability is only SHOWN in the
// daily view, as information next to the case; bookings still go to the TEST property 73521 only. Own switch
// PREVIO_LIVE_SHOW=availability-only (default off), own read-only key PREVIO_LIVE_API_KEY (never the TEST key), the
// verified live type ids (PREVIO_LIVE_753011), one calendar GET per type and period, cached for 5 minutes. Nothing is
// written; a failed read is "unknown", never "free" or "full".
import {readPrevioFreeCapacity} from './server-previo-rest-read.mjs';
import {PREVIO_LIVE_753011} from './previo-booking-intent.mjs';
import {BUSINESS} from '../business-config.mjs';

export const LIVE_SHOW_SWITCH='availability-only';
const CACHE_MS=5*60000,cache=new Map();
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x);

export function liveAvailabilityReader(env,fetchImpl=globalThis.fetch,{now=()=>Date.now()}={}){
 if(env?.PREVIO_LIVE_SHOW!==LIVE_SHOW_SWITCH)return null;
 const key=env.PREVIO_LIVE_API_KEY;
 if(typeof key!=='string'||key.length<16||key===env.PREVIO_API_KEY)return null;
 const mapping=Object.fromEntries(Object.entries(PREVIO_LIVE_753011.roomKinds).map(([k,v])=>[k,String(v)]));
 return async({cabin,arrival,departure})=>{
  if(!mapping[cabin]||!day(arrival)||!day(departure)||arrival>=departure)return {status:'unknown'};
  const id=cabin+'|'+arrival+'|'+departure,hit=cache.get(id);
  if(hit&&now()-hit.at<CACHE_MS)return hit.value;
  let value;
  try{const r=await readPrevioFreeCapacity({apiKey:key,hotelId:'753011',ratePlanId:String(PREVIO_LIVE_753011.ratePlanId),mapping,cabins:[cabin],
   arrival,departure,allowLive:true,fetchImpl});
   const n=r.freeByCabin[cabin];value=Number.isSafeInteger(n)?{status:'read',free:n}:{status:'unknown'};}
  catch{value={status:'unknown'};}
  if(cache.size>200)cache.clear();
  cache.set(id,{at:now(),value});
  return value;
 };
}

// Operator line (Hungarian). Information only – the guest is never told a live figure from here.
export function liveAvailabilityLine({cabin,arrival,departure},read){
 const label=BUSINESS.accommodationTypes?.[cabin]?.label||cabin;
 const head=`🔎 Éles Previo (csak olvasva, tájékoztató): ${label} ${arrival} → ${departure}: `;
 if(read?.status!=='read')return head+'most nem olvasható.';
 const pool=cabin==='splitA'||cabin==='splitB'?' (az A/B közös készletben)':'';
 return head+(read.free>0?`${read.free} szabad${pool}.`:'nincs szabad.')+' A foglalás most a teszt Previóba kerül.';
}
