// Server-only. Owner 2026-11-25 (#9 7161329077 / 7161371109): the finance view lists EVERY Previo booking – chatbot,
// e-mail, website, phone, manual Previo, OTA – not only our own cases. Verified on the live Previo (read-only probes
// 2026-11-25, runs 45607501929 / 45607659641 / 45607811543): a reservation carries resId, voucher, status (+ option
// expiry), term, created, total price, currency, room type and, on some, a sales partner (e.g. "Booking.com XML",
// "Szallas GROUP"). It carries NO paid / deposit / balance field; Hotel.getAccountItems exists but the key is not
// authorised; payments cannot be tied to a reservation (paymentLink probe: 0 of 1586). So the payment state of a
// Previo-only booking is UNKNOWN here – never guessed. No guest name, e-mail, phone or note is kept.
// TEST 73521 only, switch PREVIO_PAYMENT_HINT=test-only (same read-only Previo switch as the payment hint), cached.
import {PREVIO_TEST_73521} from './previo-booking-intent.mjs';
import {PREVIO_STATUS} from './server-previo-status.mjs';

const ORIGIN='https://api.previo.app',CACHE_MS=10*60000,DAY=86400000;
let cache=null;
// A partner name is shown only when it reads like a sales channel – never a person or a private company.
const CHANNEL=/booking|airbnb|expedia|sz[aá]ll[aá]s|travel|tour|online|channel|portal|\.com|\.hu|engine|google|trip|agoda|hrs/i;
const dayOf=ms=>new Date(ms).toISOString().slice(0,10);

export function financeSearchXml({hotelId='73521',from,to}){
 return `<?xml version="1.0"?><request><hotId>${hotelId}</hotId><term><from>${from}</from><to>${to}</to></term><termType>overlap</termType><statuses>${Object.keys(PREVIO_STATUS).map(i=>`<cosId>${i}</cosId>`).join('')}</statuses></request>`;
}

// Pure: reservation blocks → business facts only.
export function parseFinanceReservations(xml,property=PREVIO_TEST_73521){
 const unitOf=objId=>Object.entries(property.rooms||{}).find(([,id])=>id===objId)?.[0]??null;
 return [...String(xml||'').matchAll(/<reservation>([\s\S]*?)<\/reservation>/g)].map(([,b])=>{
  const num=re=>{const m=b.match(re);return m?Number(m[1]):null;};
  const partner=b.match(/<partner>([\s\S]*?)<\/partner>/)?.[1];
  const pid=partner?num(/<partner>[\s\S]*?<prpId>(\d+)<\/prpId>/):null;
  const pname=partner?String(partner.match(/<name>([^<]{0,60})<\/name>/)?.[1]||'').trim():'';
  const statusId=num(/<statusId>(\d+)<\/statusId>/);
  return {resId:num(/<resId>(\d+)<\/resId>/),voucher:(b.match(/<voucher>([A-Za-z0-9-]{1,40})<\/voucher>/)?.[1])||null,
   state:PREVIO_STATUS[statusId]||'other',from:b.match(/<term>\s*<from>(\d{4}-\d{2}-\d{2})/)?.[1]??null,to:b.match(/<term>[\s\S]*?<to>(\d{4}-\d{2}-\d{2})/)?.[1]??null,
   price:(()=>{const m=b.match(/<price>([0-9.]+)<\/price>/);return m?Math.round(Number(m[1])):null;})(),
   currency:b.match(/<currency>[\s\S]*?<code>([A-Z]{3})<\/code>/)?.[1]??null,
   house:String(b.match(/<objectKind>[\s\S]*?<name>([^<]{1,40})<\/name>/)?.[1]||'').trim()||null,unit:unitOf(num(/<object>\s*<objId>(\d+)<\/objId>/)),
   optionExpiration:b.match(/<optionExpiration>([^<]{1,30})<\/optionExpiration>/)?.[1]?.trim()||null,created:b.match(/<created>(\d{4}-\d{2}-\d{2})/)?.[1]??null,
   partner:partner===undefined||!partner.trim()?null:{id:Number.isSafeInteger(pid)?pid:null,channel:CHANNEL.test(pname)?pname.slice(0,40):null}};
 }).filter(r=>Number.isSafeInteger(r.resId));
}

// Pure: one booking = one item. Rooms of one booking share the voucher (multi-room); else the resId alone.
export function financeItems(reservations){
 const groups=new Map();
 for(const r of Array.isArray(reservations)?reservations:[]){const k=r.voucher?'v:'+r.voucher:'r:'+r.resId;(groups.get(k)||groups.set(k,[]).get(k)).push(r);}
 return [...groups.values()].map(list=>{
  list.sort((a,b)=>a.resId-b.resId);
  const live=list.filter(r=>r.state!=='cancelled'),base=(live[0]||list[0]);
  const prices=live.map(r=>r.price);
  return Object.freeze({key:'p-'+base.resId,resIds:list.map(r=>r.resId),voucher:base.voucher,state:live.length?base.state:'cancelled',rooms:live.length||list.length,
   from:list.map(r=>r.from).filter(Boolean).sort()[0]||null,to:list.map(r=>r.to).filter(Boolean).sort().at(-1)||null,
   price:live.length&&prices.every(Number.isSafeInteger)?prices.reduce((a,b)=>a+b,0):null,currency:base.currency,house:base.house,unit:list.length===1?base.unit:null,
   optionExpiration:base.state==='option'?base.optionExpiration:null,created:base.created,
   source:base.partner?{group:'external',channel:base.partner.channel||(base.partner.id?'Previo-partner #'+base.partner.id:'Previo-partner')}:{group:'unknown',channel:null}});
 });
}

export function previoFinanceReader(env,fetchImpl=globalThis.fetch,{now=()=>Date.now()}={}){
 if(env?.PREVIO_PAYMENT_HINT!=='test-only'||String(env?.PREVIO_HOTEL_ID)!=='73521')return null;
 const key=env.PREVIO_API_KEY;if(typeof key!=='string'||key.length<16)return null;
 return async()=>{
  if(cache&&now()-cache.at<CACHE_MS)return cache.value;
  const t=now(),from=dayOf(t-30*DAY),to=dayOf(t+365*DAY);
  const r=await fetchImpl(ORIGIN+'/x1/hotel/searchReservations',{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),
   headers:{Authorization:'ApiKey '+key,'Content-Type':'application/xml',Accept:'application/xml'},body:financeSearchXml({from,to})});
  const text=await r.text();
  if(!r.ok||/<error>/.test(text)||!/<reservations/.test(text))throw Object.assign(Error('read'),{code:'PREVIO_UNAVAILABLE'});
  const value={readAt:new Date(t).toISOString(),window:{from,to},items:financeItems(parseFinanceReservations(text))};
  cache={at:t,value};return value;
 };
}
export function resetPrevioFinanceCache(){cache=null;}
