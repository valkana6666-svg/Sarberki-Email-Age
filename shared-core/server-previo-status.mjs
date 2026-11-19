// Server-only. Owner/ChatGPT 2026-11-19 (#9 7005064928): the staff approve, change or cancel the booking IN PREVIO;
// Previo is the source of the booking state. This read-only step finds the case's own reservation by its booking
// number (wide window, every status) and reports its state and any staff change against the case – nothing is written
// to Previo or to our database here. A failed read is UNKNOWN, never "cancelled". TEST 73521 only.
import {PREVIO_TEST_73521} from './previo-booking-intent.mjs';

const ORIGIN='https://api.previo.app';
// System.getReservationStatuses (Previo XML docs): 1 option, 2 confirmed, 3 checked in, 6 waiting list, 7 cancelled,
// 8 no-show, 9 checked out, 10 other.
export const PREVIO_STATUS=Object.freeze({1:'option',2:'confirmed',3:'checked_in',6:'waiting',7:'cancelled',8:'no_show',9:'checked_out',10:'other'});
export const PREVIO_STATUS_HU=Object.freeze({option:'opció (még nincs jóváhagyva)',confirmed:'megerősítve (a személyzet jóváhagyta)',checked_in:'bejelentkezett',
 waiting:'várólista',cancelled:'lemondva',no_show:'nem jelent meg',checked_out:'kijelentkezett',other:'egyéb',unknown:'ismeretlen (a Previo most nem olvasható)',missing:'nincs a Previóban'});
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x);
const shift=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);

export function statusSearchXml({hotelId,from,to}){
 return `<?xml version="1.0"?><request><hotId>${hotelId}</hotId><term><from>${from}</from><to>${to}</to></term><termType>overlap</termType><statuses>${Object.keys(PREVIO_STATUS).map(i=>`<cosId>${i}</cosId>`).join('')}</statuses></request>`;
}
// Pure: the blocks of one booking number → [{resId, state, unit, from, to, price, optionExpiration}] (no personal fields).
export function caseBookingsFromXml(text,voucher,property=PREVIO_TEST_73521){
 const unitOf=objId=>Object.entries(property.rooms||{}).find(([,id])=>id===objId)?.[0]??null;
 return [...String(text||'').matchAll(/<reservation>([\s\S]*?)<\/reservation>/g)].map(([,b])=>b).filter(b=>b.includes(`<voucher>${voucher}</voucher>`)).map(b=>{
  const num=re=>{const m=b.match(re);return m?Number(m[1]):null;};
  const statusId=num(/<statusId>(\d+)<\/statusId>/);
  return Object.freeze({resId:num(/<resId>(\d+)<\/resId>/),state:PREVIO_STATUS[statusId]||'other',unit:unitOf(num(/<object>\s*<objId>(\d+)<\/objId>/)),
   from:b.match(/<term>\s*<from>(\d{4}-\d{2}-\d{2})/)?.[1]??null,to:b.match(/<term>[\s\S]*?<to>(\d{4}-\d{2}-\d{2})/)?.[1]??null,
   price:(()=>{const m=b.match(/<price>([0-9.]+)<\/price>/);return m?Math.round(Number(m[1])):null;})(),
   optionExpiration:b.match(/<optionExpiration>([^<]+)<\/optionExpiration>/)?.[1]?.trim()||null});
 });
}
// Pure: Previo's booking vs the case → what the staff changed (dates, unit). Several rooms → handled by hand.
export function previoCaseView(bookings,{arrival,departure,unit=null}={}){
 if(!Array.isArray(bookings))return Object.freeze({state:'unknown',changes:[]});
 const live=bookings.filter(b=>b.state!=='cancelled'),list=live.length?live:bookings;
 if(!list.length)return Object.freeze({state:'missing',changes:[]});
 if(list.length>1)return Object.freeze({state:'multiple',changes:['MULTI_ROOM'],bookings:list});
 const b=list[0],changes=[];
 if(b.from&&b.to&&(b.from!==arrival||b.to!==departure))changes.push('DATES');
 if(unit&&b.unit&&b.unit!==unit)changes.push('UNIT');
 return Object.freeze({state:b.state,changes,booking:b});
}
export async function readPrevioCaseStatus({apiKey,voucher,arrival,departure,windowDays=120,property=PREVIO_TEST_73521,fetchImpl=globalThis.fetch,timeoutMs=8000}={}){
 if(String(property?.hotelId)!=='73521'||!/^SC-[0-9A-F]{16}$/.test(String(voucher||''))||!day(arrival)||!day(departure))return null;
 if(typeof apiKey!=='string'||!/^[A-Za-z0-9._~+/=-]{16,512}$/.test(apiKey))return null;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const r=await fetchImpl(ORIGIN+'/x1/hotel/searchReservations',{method:'POST',redirect:'error',cache:'no-store',signal:controller.signal,
   headers:{Authorization:'ApiKey '+apiKey,'Content-Type':'application/xml',Accept:'application/xml'},body:statusSearchXml({hotelId:property.hotelId,from:shift(arrival,-windowDays),to:shift(departure,windowDays)})});
  if(!r.ok)return null;const text=await r.text();if(/<error>/.test(text)||!/<reservations/.test(text))return null;
  return caseBookingsFromXml(text,voucher,property);
 }catch{return null;}
 finally{clearTimeout(timer);}
}
// Operator line (Hungarian, no personal data).
export function previoStatusLine(view){
 if(!view)return null;
 if(view.state==='unknown')return 'Previo (élő, csak olvasva): '+PREVIO_STATUS_HU.unknown+' – ez NEM lemondás.';
 if(view.state==='missing')return null;
 if(view.state==='multiple')return 'Previo (élő): több szoba / foglalás ezzel a számmal – kezeld a Previóban.';
 const b=view.booking,parts=[PREVIO_STATUS_HU[view.state]||view.state];
 if(b.unit)parts.push(b.unit+'. egység');if(b.from&&b.to)parts.push(b.from+' → '+b.to);if(Number.isSafeInteger(b.price))parts.push(String(b.price).replace(/\B(?=(\d{3})+(?!\d))/g,' ')+' Ft');
 if(view.state==='option'&&b.optionExpiration)parts.push('opció lejár: '+b.optionExpiration);
 const warn=view.changes.length?'\n⚠️ A Previóban módosították: '+view.changes.map(c=>({DATES:'dátum',UNIT:'egység'}[c]||c)).join(', ')+' – a Previo az irányadó.':'';
 return '📋 Previo (élő, csak olvasva): '+parts.join(' · ')+warn;
}
