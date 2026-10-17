import {activeMessageText,requestFlagsFromText} from '../sarberki-core.mjs';
import {BUSINESS} from '../business-config.mjs';
// Parse the current request only. Dates/times are requests, never service evidence.
const tub=/(?:dézs\p{L}*|dezsa\p{L}*|hot[ -]?tub|badezuber|badefass|whirlpool|(?:vroč\p{L}*|masaž\p{L}*)\s*kad)/iu;
const currentText=text=>activeMessageText(String(text).replace(/\\n/g,'\n'));
const unique=items=>new Set(items).size===1?items[0]:null;
const withdrawalIntent=/(?:nem\s+kér|mégsem|megsem|nincs\s+szükség|cancel(?:led|ing)?(?!\p{L})|stornier(?:en|e|t)(?!\p{L})|preklic(?:ati|ujem|ujemo)?(?!\p{L})|lemond(?:om|juk|anám|anánk|ani)?(?!\p{L})|no\s+longer|do\s+not\s+want|don't\s+want|kein\p{L}*\s+(?:badefass|badezuber)|ne\s+žel|ne\s+potreb)/iu;
const explicitServiceRequest=/(?:\b(?:add|request|book|reserve|want|bitte|möcht\p{L}*|buchen|prosimo|želim|želimo|rezervirati)\b|would\s+like|kér\p{L}*|szeretn\p{L}*)/iu;
const serviceClauses=source=>source.split(/\.(?!\d)|[!?;\n]|(?<!\p{L})(?:but|de|aber|ampak)(?!\p{L})/iu).filter(clause=>tub.test(clause));
function tubReferences(source){
 const references=[...source.matchAll(/(?:foglalási\s*(?:szám|azonosító)|booking\s*(?:reference|ref|id|number)|reservierungsnummer|številka\s+rezervacije)\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{2,63})/giu)].map(m=>m[1].toUpperCase());
 return {requestedBookingReference:unique(references),bookingReferenceConflict:new Set(references).size>1};
}
export function tubBookingReference(text=''){
 return tubReferences(currentText(text)).requestedBookingReference;
}
export function trustedTubContext(record={}){
 const context=record.bookingContext;
 return context?.verified===true&&context.source==='operator_verified'?context:null;
}
const stayObject='(?:faház\\p{L}*|szállást|cabins?|houses?|accommodation|ferienhaus|unterkunft|hišk\\p{L}*|nastanitev)';
const stayWithdrawal=new RegExp('(?:'+stayObject+'\\s+(?:szeretn\\p{L}*\\s+)?(?:lemond\\p{L}*|stornier\\p{L}*)|(?:cancel|prekli[cč]\\p{L}*)\\s+(?:(?:my|our|the|a|one|deluxe|vip|family|našo|naša)\\s+){0,4}'+stayObject+')','iu');
// Use the same accommodation scope for additions and withdrawals.
function requestsAccommodation(source){
 // Asking for a free cabin is an accommodation inquiry too, even without
 // an explicit booking verb. Keep the availability word bound to the stay
 // noun: an available tub at an existing cabin remains a service-only query.
 const stayAvailability=new RegExp('(?:(?:szabad|elérhető|available|free|freie?[snmr]?|verfügbar\\p{L}*|prost\\p{L}*)\\s+(?:(?:deluxe|vip|családi|family)\\s+)?'+stayObject+'|'+stayObject+'\\s+(?:(?:is|are|ist|sind|je|so)\\s+)?(?:available|free|frei|verfügbar|prosta|proste))','iu');
 const stayRequest=new RegExp('(?:\\b(?:book|reserve|buchen|rezervirati|foglalni|lefoglal\\p{L}*)\\s+(?:(?:a|an|one|two|ein\\p{L}*|egy|két|deluxe|vip|family|családi)\\s+){0,4}'+stayObject+'|'+stayObject+'\\s+(?:szeretn\\p{L}*\\s+)?(?:foglalni|buchen|book)|(?:new|separate|új|másik|neue|nova)\\s+(?:stay|accommodation|szállás|übernachtung|nastanitev))','iu');
 return stayRequest.test(source)||stayAvailability.test(source)||stayWithdrawal.test(source);
}
export function tubServiceMessage(text=''){
 const source=currentText(text);
 const clauses=serviceClauses(source),scoped=clauses.join('\n');
 const hasWithdrawal=withdrawalIntent.test(scoped);
 // A request not to withdraw must never be turned into a withdrawal. Resolve
 // its effect on an existing service explicitly, rather than silently reviving it.
 const negatedWithdrawal=/(?:(?:do\s+not|don['’]t|not\s+to|never)\s+cancel(?!\p{L})|(?:ne|nem)\s+(?:szeretn\p{L}*\s+)?(?:lemond\p{L}*|mond\p{L}*\s+le|töröl\p{L}*)|nicht\s+stornier\p{L}*|stornier\p{L}*[^.!?\n]{0,60}\bnicht\b|ne\s+prekli[cč]\p{L}*)/iu.test(scoped);
 // Scope conditions/questions to the tub-withdrawal clause. An unrelated
 // checkout question must not weaken an explicit withdrawal in another sentence.
 const withdrawalMention=/(?:cancel\p{L}*|stornier\p{L}*|lemond\p{L}*|le\s+(?:lehet\s+)?mond\p{L}*|mond\p{L}*\s+le|prekli[cč]\p{L}*)/iu;
 const conditionalOrQuestion=/(?<!\p{L})(?:if|unless|falls|wenn|ha|amennyiben|če|ce|lehet|lemondhat\p{L}*|lahko)(?!\p{L})|\b(?:can|could|may)\s+(?:I|we)\b|\b(?:kann|könn\p{L}*|darf|dürf\p{L}*)\s+(?:ich|wir)\b|\b(?:what|which|wie|welche\p{L}*)\b/iu;
 const conditionalWithdrawal=clauses.some(clause=>withdrawalMention.test(clause)&&conditionalOrQuestion.test(clause));
 const ambiguousContinuation=!hasWithdrawal&&withdrawalIntent.test(source)&&!clauses.some(clause=>explicitServiceRequest.test(clause));
 if(tub.test(source)&&(negatedWithdrawal||conditionalWithdrawal||ambiguousContinuation))return {kind:'tub_request',serviceOnly:!requestsAccommodation(source),cancelled:false,actionConflict:true,startDate:null,startTime:null,durationHours:null,...tubReferences(source),confirmationAllowed:false,requiresHumanReview:true};
 // Withdrawal intent wins over a bare tub mention, including imperative EN/DE/SI.
 if(hasWithdrawal)
  return {kind:'tub_request',serviceOnly:!requestsAccommodation(source),cancelled:true,actionConflict:clauses.some(clause=>!withdrawalIntent.test(clause)&&explicitServiceRequest.test(clause))||/(?:but|and|de|és|aber|und|ampak|in)\s+.{0,30}(?:add|request|kérek|kérünk|möcht|želim)/iu.test(scoped),startDate:null,startTime:null,durationHours:null,...tubReferences(source),confirmationAllowed:false,requiresHumanReview:true};
 // Dates from another withdrawn service are not evidence of the tub schedule.
 const request=classifyTubRequest(withdrawalIntent.test(source)?scoped:source);
 return request.kind==='tub_request'?{...request,serviceOnly:!requestsAccommodation(source),...(stayWithdrawal.test(source)?{actionConflict:true}:{}),...tubReferences(source)}:request;
}
export function classifyTubRequest(text='') {
 const source=currentText(text);
 if(!tub.test(source)||!requestFlagsFromText(source).hotTubRequested)return {kind:'none'};
 const dates=[...source.matchAll(/\b(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})\b/gu)].map(d=>{
  const iso=`${d[1]}-${d[2].padStart(2,'0')}-${d[3].padStart(2,'0')}`;
  return !Number.isNaN(Date.parse(iso))&&new Date(iso).toISOString().slice(0,10)===iso?iso:null;
 });
 const times=[...source.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/gu)].map(t=>`${t[1].padStart(2,'0')}:${t[2]}`);
 const durations=[...source.matchAll(/\b(\d{1,3})\s*(órá(?:ra|s)?|óra|hours?|stunden|ur|nap(?:ra|ig)?|days?|tage?|dni)\b/giu)].map(m=>Number(m[1])*(/^(?:nap|day|tag|dni)/iu.test(m[2])?24:1));
 const startDate=dates.length?unique(dates):null,startTime=times.length?unique(times):null,durationHours=durations.length?unique(durations):null;
 // A mixed new accommodation request still follows the existing booking route.
 const serviceOnly=!requestsAccommodation(source);
 return {kind:'tub_request',serviceOnly,startDate,startTime,durationHours:durationHours>0&&!/\b\d{1,3}\s*(?:vagy|or|oder|ali)\s*\d{1,3}\s*(?:ór|hour|stund|ur|nap|day|tag|dni)/iu.test(source)?durationHours:null,
  ...tubReferences(source),availability:'unverified',confirmationAllowed:false,requiresHumanReview:true};
}
export function assessTubEligibility({unitNumber,unit,availability}={}) {
 const mapped=BUSINESS.splitPhysicalUnits.find(row=>row.id===String(unit||'').trim().toUpperCase());
 const n=mapped?.physicalHouse??(unitNumber===undefined?Number(String(unit||'').trim()):Number(unitNumber));
 if(!Number.isInteger(n)||n<1||n>15)return {status:'unverified',confirmationAllowed:false};
 if(!BUSINESS.hotTubRentalRules.houseNumbers.includes(n))return {status:'not_available',confirmationAllowed:false};
 return {status:availability==='available'?'requires_operator_confirmation':'unverified',confirmationAllowed:false};
}
export function latestTubServiceRequest(record){
 const priority=request=>request.actionConflict?2:request.cancelled?1:0;
 return record?.serviceRequests?.reduce((latest,item)=>!latest||Date.parse(item.at)>Date.parse(latest.at)||Date.parse(item.at)===Date.parse(latest.at)&&priority(item)>priority(latest)?item:latest,null)??null;
}
export function tubServiceProjection(record){
 const request=latestTubServiceRequest(record);
 if(!request)return null;
 // Accommodation-house equipment is not rental availability: guests may rent
 // another house's fixed tub. Only the separate trusted calendar can verify it.
 // null means unresolved intent, not an absent request or an accepted withdrawal.
 return {requested:request.actionConflict?null:request.cancelled!==true,startDate:request.startDate??null,startTime:request.startTime??null,durationHours:request.durationHours??null,
  linkedCaseId:request.linkedCaseId??null,verificationStatus:request.actionConflict?'intent_unverified':request.cancelled?'cancelled_unverified':'unverified',requiresHumanApproval:true};
}
