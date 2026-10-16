// Pure, synthetic-safe service-request classifier. No reservation or email side effects.
const tub=/\b(?:dézsa(?:fürdő)?|dézsát|dézsafürdőt|hot\s*tub|badezuber|badefass|vroča\s*kad)\b/iu;
const date=/\b(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})\b/u;
const time=/\b([01]?\d|2[0-3]):([0-5]\d)\b/u;
export function classifyTubRequest(text='') {
 const source=String(text);
 if(!tub.test(source))return {kind:'none'};
 const d=source.match(date),t=source.match(time);
 let startDate=null;
 if(d){const iso=`${d[1]}-${d[2].padStart(2,'0')}-${d[3].padStart(2,'0')}`;if(!Number.isNaN(Date.parse(iso))&&new Date(iso).toISOString().slice(0,10)===iso)startDate=iso;}
 const hours=/\b24\s*(?:órá(?:ra|s)?|hours?|stunden|ur)\b/iu.test(source)?24:null;
 return {kind:'tub_request',startDate,startTime:t?`${t[1].padStart(2,'0')}:${t[2]}`:null,durationHours:hours,availability:'unverified',confirmationAllowed:false,requiresHumanReview:true};
}
export function assessTubEligibility({unitNumber,availability}={}) {
 const n=Number(unitNumber);
 if(!Number.isInteger(n)||n<1||n>15)return {status:'unverified',confirmationAllowed:false};
 if(n>=7&&n<=10)return {status:'not_available',confirmationAllowed:false};
 // Availability evidence alone is insufficient: this module never confirms a service.
 return {status:availability==='available'?'requires_operator_confirmation':'unverified',confirmationAllowed:false};
}
