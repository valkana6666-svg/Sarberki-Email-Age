// Synthetic candidate extraction only. Never establishes Previo completeness or availability.
const HOUSES = new Set([1,2,3,4,5,6,11,12,13,14,15]);
const unknown = reason => Object.freeze({status:'UNKNOWN',reason,availabilityVerified:false});
const pad = value => String(value).padStart(2,'0');
export function parsePrevioTubNote(note,{accommodationHouse=null}={}) {
  if(typeof note!=='string'||note.length>4000)return unknown('INVALID_NOTE');
  const text=note.normalize('NFC').trim();
  if(!/dézsa|dezsa|dézsafürdő/iu.test(text))return unknown('NO_TUB_NOTE');
  if(/lemondva|törölve|visszamondva|módosítva/iu.test(text))return unknown('CANCELLATION_OR_CHANGE_REQUIRES_REVIEW');
  // House number must explicitly identify the physical tub, not merely the guest's accommodation.
  const patterns=[/(\d{1,2})\s*(?:-?es|-?os|-?as|-?ös)?\s*ház\s*(?:dézsa|dezsa)/giu,/(?:dézsa|dezsa)\s*(?:a\s*)?(\d{1,2})\s*(?:-?es|-?os|-?as|-?ös)?\s*ház/giu];
  const houses=patterns.flatMap(re=>[...text.matchAll(re)].map(m=>Number(m[1])));
  if(houses.length!==1)return unknown('TUB_HOUSE_UNVERIFIED');
  const tubHouse=houses[0];
  if(!HOUSES.has(tubHouse))return unknown('NO_FIXED_TUB_AT_HOUSE');
  const dates=[...text.matchAll(/\b(20\d{2})[.-](\d{1,2})[.-](\d{1,2})\b/gu)];
  if(dates.length!==1)return unknown('DATE_UNVERIFIED');
  const [,ys,ms,ds]=dates[0],year=Number(ys),month=Number(ms),day=Number(ds);
  const date=new Date(Date.UTC(year,month-1,day));
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return unknown('INVALID_DATE');
  const times=[...text.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/gu)];
  if(times.length!==1)return unknown('TIME_UNVERIFIED');
  // Consume an entire numeric duration before accepting a positive integer.
  // Never reinterpret fractional/signed/range notation or a grouped thousands
  // suffix as a smaller duration. The preceding note's date/time stays separate.
  const durationText=text.replace(dates[0][0],' ').replace(times[0][0],' ');
  const durations=[...durationText.matchAll(/(?<![\p{L}\p{N}.,:/+\-−–—±])([+\-−–—±]?\s*\d+(?:(?:\s*[.,:/+\-−–—]\s*\d+)|(?:\s+\d+))*)\s*(?:órára|órás|óra|h)\b/giu)];
  if(durations.length!==1)return unknown('DURATION_UNVERIFIED');
  const numericDuration=durations[0][1].trim();
  if(!/^\d{1,3}$/.test(numericDuration))return unknown('INVALID_DURATION');
  const durationHours=Number(numericDuration);
  if(durationHours<1||durationHours>72)return unknown('INVALID_DURATION');
  return Object.freeze({status:'CANDIDATE',tubHouse,tubResourceId:`tub-house-${tubHouse}`,accommodationHouse,startLocal:`${ys}-${pad(month)}-${pad(day)}T${pad(times[0][1])}:${times[0][2]}`,durationHours,timezone:'Europe/Budapest',availabilityVerified:false});
}

