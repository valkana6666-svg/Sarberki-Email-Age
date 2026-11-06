import {normalizeInquiryInput} from '../intake-normalize.mjs';

// Projection of persisted operator-reviewed facts into the existing shared
// inquiry contract. This is not authorization or a second parser.
// A date range without a year is never stored as a case fact (no price or capacity on a guessed year); for
// the reply only, the same shared normalizer re-derives it from the guest's own text so the letter repeats
// the dates and asks to confirm the year instead of asking for the dates again (as the local preview does).
function inferredYearDates(data){
 const text=data.state?.original||data.messages?.[0]?.text||'';
 const received=Date.parse(data.messages?.[0]?.received_at||'');
 if(!text||!Number.isFinite(received))return null;
 const d=normalizeInquiryInput({sourceChannel:'gmail',rawText:text,now:new Date(received)}).normalized.dates;
 return d?.inferred_year&&d.arrival&&d.departure?{arrival:d.arrival,departure:d.departure,inferred_year:true}:null;
}
export function serverInquiryOptions(record,now=new Date()){
 const data=record.data,v=data.state.values;
 const count=value=>value===''||value===null||value===undefined?null:Number(value);
 return {tenantId:record.tenantId,now,fallback:false,language:String(v.language||'hu').toLowerCase().replace(/^sl$/,'si'),message:data.state.original||'',facts:{
  dates:v.arrival&&v.departure?{arrival:v.arrival,departure:v.departure,inferred_year:false}:inferredYearDates(data),
  guests:count(v.guests),adults:count(v.adults),children:count(v.children),
  child_ages:String(v.child_ages||'').split(',').map(s=>s.trim()).filter(Boolean).map(Number),
  cabin:v.unit||'',units_requested:count(v.units_requested),nights:v.nights||'',phone:v.phone||null,
  split_request_text:v.split_request_text||v.request||data.state.original||''
 }};
}
