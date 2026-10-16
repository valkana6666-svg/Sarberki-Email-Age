// Synthetic-only Previo booking note adapter. No HTTP calls, secrets or live writes.
import {createPrevioTubNoteReader} from './previo-tub-note-reader.mjs';
const own=Object.prototype.hasOwnProperty;
const clean=x=>typeof x==='string'&&x.length>0&&x.length<=256;
export function createSyntheticPrevioTubAdapter({bookings=[]}={}){
 if(!Array.isArray(bookings))throw new TypeError('bookings must be an array');
 const records=bookings.map(b=>{
  if(!b||!clean(b.id)||!clean(b.tenantId)||!clean(b.note)||!clean(b.start)||!clean(b.end)||!clean(b.resourceId)||!own.call(b,'accommodationHouse'))throw new TypeError('invalid synthetic booking');
  return Object.freeze({...b});
 });
 const fetchNotes=async ({tenantId,resourceId,start,end})=>({
  notes:records.filter(b=>b.tenantId===tenantId&&b.resourceId===resourceId&&Date.parse(b.start)<Date.parse(end)&&Date.parse(start)<Date.parse(b.end)).map(b=>({id:b.id,text:b.note}))
 });
 const reader=createPrevioTubNoteReader({fetchNotes,sourceId:'synthetic-previo-fixture'});
 return Object.freeze({sourceId:'synthetic-previo-fixture',read:query=>reader.read(query)});
}
