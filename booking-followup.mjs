import {activeMessageText,dateRangeFromText} from './sarberki-core.mjs';
const DATE='20\\d{2}[./-]\\d{1,2}[./-]\\d{1,2}';
function iso(raw){const [y,m,d]=raw.split(/[./-]/).map(Number),v=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;return Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v?v:null;}
// Deliberately narrow: unresolved date changes must not reuse the previous stay.
export function followupDateUpdate(text='',previous={}){
 const active=activeMessageText(text);
 const dates=[...active.matchAll(new RegExp(DATE,'g'))];
 const correction=/(?:helyett|statt|instead of|namesto|időpont[^.!?]{0,30}módos|módos[^.!?]{0,30}időpont|új időpont|new dates?|neue[rn]? termin|nov termin)/iu.test(active);
 if(!correction||!dates.length)return {status:'none'};
 const replacement=active.match(new RegExp('('+DATE+')\\s*helyett\\s*('+DATE+')','iu'));
 if(replacement){
  const old=iso(replacement[1]),arrival=iso(replacement[2]);
  const depart=active.match(new RegExp('(?:távoz\\p{L}*|depart(?:ure)?|Abreise|odhod)[^0-9.!?]{0,30}('+DATE+')','iu'));
  const departure=depart?iso(depart[1]):previous.departure;
  if(!old||!arrival||old!==previous.arrival||!departure||departure<=arrival||dates.length>(depart?3:2))return {status:'unverified',reason:'date_replacement_not_proven'};
  return {status:'updated',values:{arrival,departure},evidence:'explicit_arrival_replacement'};
 }
 const range=dateRangeFromText(active);
 if(range&&new Set(dates.map(m=>m[0])).size===2)return {status:'updated',values:{arrival:range.arrival,departure:range.departure},evidence:'explicit_new_range'};
 return {status:'unverified',reason:'ambiguous_date_change'};
}
