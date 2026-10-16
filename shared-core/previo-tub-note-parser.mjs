// Conservative synthetic Previo-note candidate extraction; never availability evidence.
const HOUSES=new Set([1,2,3,4,5,6,11,12,13,14,15]);
const unknown=reason=>Object.freeze({status:'UNKNOWN',reason});
export function parsePrevioTubNote(note,{accommodationHouse=null}={}){
 if(typeof note!=='string'||note.length>4000)return unknown('INVALID_NOTE');
 const text=note.normalize('NFC').trim();
 if(!/\bd[eé]zsa(?:f[üu]rd[őo])?\b/iu.test(text))return unknown('NO_TUB_NOTE');
 if(/\b(lemondva|t[öo]r[öo]lve|visszamondva|m[óo]dos[ií]tva)\b/iu.test(text))return unknown('CANCELLATION_OR_CHANGE_REQUIRES_REVIEW');
 const houses=[...text.matchAll(/\b(\d{1,2})\s*(?:-?es|-?os|-?as|-?ös)?\s*h[aá]z\s*d[eé]zsa\b|\bd[eé]zsa\s*(?:a\s*)?(\d{1,2})\s*(?:-?es|-?os|-?as|-?ös)?\s*h[aá]z/giu)];
 if(houses.length!==1)return unknown('TUB_HOUSE_UNVERIFIED');
 const tubHouse=Number(houses[0][1]||houses[0][2]);
 if(!HOUSES.has(tubHouse))return unknown('NO_FIXED_TUB_AT_HOUSE');
 const dates=[...text.matchAll(/\b(20\d{2})[.-](\d{1,2})[.-](\d{1,2})\b/gu)];
 if(dates.length!==1)return unknown('DATE_UNVERIFIED');
 const [,ys,ms,ds]=dates[0],year=Number(ys),month=Number(ms),day=Number(ds),dt=new Date(Date.UTC(year,month-1,day));
 if(dt.getUTCFullYear()!==year||dt.getUTCMonth()!==month-1||dt.getUTCDate()!==day)return unknown('INVALID_DATE');
 const times=[...text.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/gu)];
 if(times.length!==1)return unknown('TIME_UNVERIFIED');
 const durations=[...text.matchAll(/\b(\d{1,3})\s*(?:[óo]r[aá]ra|[óo]r[aá]s?|h)\b/giu)];
 if(durations.length!==1)return unknown('DURATION_UNVERIFIED');
 const durationHours=Number(durations[0][1]);
 if(durationHours<1||durationHours>72)return unknown('INVALID_DURATION');
 return Object.freeze({status:'CANDIDATE',tubHouse,accommodationHouse,startLocal:`${ys}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(times[0][1]).padStart(2,'0')}:${times[0][2]}`,durationHours,timezone:'Europe/Budapest',availabilityVerified:false});
}
