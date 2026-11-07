// V2 preparation (owner 2026-11-07: V1 testing and V2 development in parallel). Unit-level inventory and
// collision protection for the 23 bookable Sárberki units, derived from business-config (no second list).
// Pure functions, no network, no Previo, no persistence. Stays are half-open [arrival, departure): the
// departure day is free for a new arrival. Evidence source is kept on every booking so a SYNTHETIC calendar
// can never be reported as a verified free unit to a guest (only previo-* evidence can).
import {BUSINESS} from '../business-config.mjs';
import {AVAILABILITY} from './availability-model.mjs';

const fail=code=>{const error=Error(code);error.code=code;throw error;};
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
export const EVIDENCE_SOURCES=Object.freeze(['synthetic','previo-73521','previo-753011']);

// Unit id = Previo room name ("1", "7/A", …), as in the live and the TEST Previo.
export const UNITS=Object.freeze(Object.entries(BUSINESS.accommodationTypes).flatMap(([cabin,t])=>
 (t.physicalHouseNumbers||[]).map(house=>Object.freeze({id:t.splitUnit?`${house}/${t.splitUnit}`:String(house),cabin,house,part:t.splitUnit||null})))
 .sort((a,b)=>a.house-b.house||String(a.part).localeCompare(String(b.part))));
const BY_ID=new Map(UNITS.map(u=>[u.id,u]));
export const unitsOfType=cabin=>UNITS.filter(u=>u.cabin===cabin);

function validStay(arrival,departure){if(!day(arrival)||!day(departure)||departure<=arrival)fail('INVALID_DATES');}
// Half-open overlap: [a1,d1) ∩ [a2,d2) ≠ ∅.
export const overlaps=(a,b)=>a.arrival<b.departure&&b.arrival<a.departure;

function validBooking(b){
 if(!b||!BY_ID.has(b.unit))fail('UNKNOWN_UNIT');
 validStay(b.arrival,b.departure);
 if(!EVIDENCE_SOURCES.includes(b.source))fail('UNKNOWN_SOURCE');
 return b;
}

// Bookings that block this unit for the stay (cancelled ones never block).
export function conflictsFor(bookings,{unit,arrival,departure}){
 validStay(arrival,departure);if(!BY_ID.has(unit))fail('UNKNOWN_UNIT');
 return (bookings||[]).map(validBooking).filter(b=>b.status!=='cancelled'&&b.unit===unit&&overlaps(b,{arrival,departure}));
}

// Free units of one type for the whole stay, and which evidence the answer rests on.
export function freeUnits(bookings,{cabin,arrival,departure,source}){
 if(!unitsOfType(cabin).length)fail('UNKNOWN_CABIN');
 if(!EVIDENCE_SOURCES.includes(source))fail('UNKNOWN_SOURCE');
 const relevant=(bookings||[]).map(validBooking).filter(b=>b.source===source);
 const free=unitsOfType(cabin).filter(u=>!conflictsFor(relevant,{unit:u.id,arrival,departure}).length).map(u=>u.id);
 return Object.freeze({cabin,arrival,departure,source,free:Object.freeze(free),
  // Only real Previo evidence may tell a guest "free"; synthetic stays internal.
  guestVerifiable:source.startsWith('previo-'),
  status:free.length?AVAILABILITY.AVAILABLE:AVAILABILITY.UNAVAILABLE});
}

// A+B of the SAME physical house (split houses 7–10), e.g. for a family wanting to be together.
export function freeSameHousePairs(bookings,{arrival,departure,source}){
 return [7,8,9,10].filter(h=>['A','B'].every(p=>!conflictsFor((bookings||[]).filter(b=>b.source===source),{unit:`${h}/${p}`,arrival,departure}).length))
  .map(h=>Object.freeze([`${h}/A`,`${h}/B`]));
}

// Synthetic reservation with idempotency: the same key returns the same booking; a different request on a
// taken unit is refused (DOUBLE_BOOKING). Returns a NEW list; the input is never mutated.
export function reserveSynthetic(bookings,{key,unit,arrival,departure,guests,status='option'}){
 if(typeof key!=='string'||!/^[A-Za-z0-9_.:-]{6,80}$/.test(key))fail('IDEMPOTENCY_KEY_REQUIRED');
 const list=(bookings||[]).map(validBooking);
 const same=list.find(b=>b.key===key);
 if(same){
  if(same.unit!==unit||same.arrival!==arrival||same.departure!==departure)fail('IDEMPOTENCY_KEY_REUSED');
  return Object.freeze({bookings:list,booking:same,created:false});
 }
 const u=BY_ID.get(unit);if(!u)fail('UNKNOWN_UNIT');
 const max=BUSINESS.accommodationTypes[u.cabin].maxGuests;
 if(!Number.isInteger(guests)||guests<1||guests>max)fail('CAPACITY_EXCEEDED');
 if(conflictsFor(list,{unit,arrival,departure}).length)fail('DOUBLE_BOOKING');
 if(!['option','confirmed'].includes(status))fail('INVALID_STATUS');
 const booking=Object.freeze({key,unit,arrival,departure,guests,status,source:'synthetic'});
 return Object.freeze({bookings:Object.freeze([...list,booking]),booking,created:true});
}

// Cancel releases the unit; the record is kept (audit).
export function cancelSynthetic(bookings,key){
 let found=false;
 const list=(bookings||[]).map(validBooking).map(b=>b.key===key?(found=true,Object.freeze({...b,status:'cancelled'})):b);
 if(!found)fail('NOT_FOUND');
 return Object.freeze(list);
}
