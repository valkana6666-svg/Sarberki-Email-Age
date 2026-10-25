// Synthetic candidate extraction only. Never establishes Previo completeness or availability.
const HOUSES = new Set([1,2,3,4,5,6,11,12,13,14,15]);
const unknown = reason => Object.freeze({status:'UNKNOWN',reason,availabilityVerified:false});
const pad = value => String(value).padStart(2,'0');
export function parsePrevioTubNote(note,{accommodationHouse=null}={}) {
  if(typeof note!=='string'||note.length>4000)return unknown('INVALID_NOTE');
  const text=note.normalize('NFC').trim();
  if(!/dézsa|dezsa|dézsafürdő/iu.test(text))return unknown('NO_TUB_NOTE');
  // Cancellation/negative intent always requires human review, never a tub candidate.
  if(/lemondva|lemondás|lemondani|törölve|törlés|törölni|visszamondva|visszamondás|módosítva|nem\s+(?:kérjük|kérem|kéri|kérik|kell)|mégsem\s+(?:kérjük|kérem)/iu.test(text))return unknown('CANCELLATION_OR_CHANGE_REQUIRES_REVIEW');
  const dates=[...text.matchAll(/\b(20\d{2})[.-](\d{1,2})[.-](\d{1,2})\b/gu)];
  const times=[...text.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/gu)];
  // Keep independently parsed date/time tokens outside the house expression.
  // Their strict count and calendar validation below remains mandatory.
  const houseText=[...dates,...times].reduce((source,match)=>{
    // A date/time-shaped value attached to 'ház' is an invalid house mention,
    // not a schedule token that may be hidden beside a valid house.
    const after=text.slice(match.index+match[0].length);
    return /^\s*(?:-?(?:es|os|as|ös))?\s*ház/iu.test(after)?source:source.replace(match[0],' ');
  },text);
  // House number must explicitly identify the physical tub, not merely the guest's accommodation.
  // Capture the whole numeric-bearing house token, including malformed prefixes,
  // decimals and ranges, so an invalid mention cannot disappear beside a valid one.
  const token='[^\\s;!?()\\[\\]]*\\d[^\\s;!?()\\[\\]]*';
  const numberExpression=token+'(?:\\s+(?:[+\\-−–—.,/:]\\s*)?\\d[^\\s;!?()\\[\\]]*)*';
  const patterns=[new RegExp('(?<!\\S)('+numberExpression+')\\s*(?:-?(?:es|os|as|ös))?\\s*ház\\s*(?:dézsa|dezsa)','giu'),new RegExp('(?:dézsa|dezsa)\\s*(?:a\\s*)?('+numberExpression+')\\s*(?:-?(?:es|os|as|ös))?\\s*ház','giu')];
  const houses=patterns.flatMap(re=>[...houseText.matchAll(re)].map(m=>m[1].replace(/\s*-?(?:es|os|as|ös)$/iu,'').trim()));
  if(houses.length!==1||!(/^[1-9]\d?$/.test(houses[0])))return unknown('TUB_HOUSE_UNVERIFIED');
  const tubHouse=Number(houses[0]);
  if(!HOUSES.has(tubHouse))return unknown('NO_FIXED_TUB_AT_HOUSE');
  if(dates.length!==1)return unknown('DATE_UNVERIFIED');
  const [,ys,ms,ds]=dates[0],year=Number(ys),month=Number(ms),day=Number(ds);
  const date=new Date(Date.UTC(year,month-1,day));
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return unknown('INVALID_DATE');
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

