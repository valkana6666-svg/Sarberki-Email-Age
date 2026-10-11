// Projection of persisted operator-reviewed facts into the existing shared
// inquiry contract. This is not authorization or a second parser.
export function serverInquiryOptions(record,now=new Date()){
 const data=record.data,v=data.state.values;
 const count=value=>value===''||value===null||value===undefined?null:Number(value);
 return {tenantId:record.tenantId,now,fallback:false,language:String(v.language||'hu').toLowerCase().replace(/^sl$/,'si'),message:data.state.original||'',facts:{
  dates:v.arrival&&v.departure?{arrival:v.arrival,departure:v.departure,inferred_year:false}:null,
  guests:count(v.guests),adults:count(v.adults),children:count(v.children),
  child_ages:String(v.child_ages||'').split(',').map(s=>s.trim()).filter(Boolean).map(Number),
  cabin:v.unit||'',units_requested:count(v.units_requested),nights:v.nights||'',phone:v.phone||null,
  split_request_text:v.split_request_text||v.request||data.state.original||''
 }};
}
