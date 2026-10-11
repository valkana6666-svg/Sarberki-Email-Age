// Pure channel-independent decision. Evidence is injected; no network, booking,
// sending, operator authorization or guest-price approval happens here.
import {normalizeInquiryInput} from '../intake-normalize.mjs';
import {assessAccommodationInquiry} from './inquiry-assessment.mjs';
import {stageFacts,capacityInput,capacityFresh,selectedCapacityOptions,wholeCabinCandidates} from '../booking-filter.mjs';
import {normalizeAvailability,EVIDENCE_TTL_MS} from './availability-model.mjs';
import {verifiedPriceBreakdown} from './verified-pricing.mjs';
import {splitCapacityOptions} from '../split-units.mjs';
const tenant='sarberki';
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const number=value=>Number.isSafeInteger(value)?value:null;
const currentEvidence=(evidence,cabin,input,now)=>{
 if(evidence?.valid!==true||evidence.tenantId!==tenant)return null;
 const normalized=normalizeAvailability({tenantId:evidence.tenantId,cabin:evidence.unit,
  arrival:evidence.arrival,departure:evidence.departure,source:evidence.source,
  checkedAt:evidence.checkedAt,availableUnits:evidence.availableUnits,
  availability:typeof evidence.status==='string'?evidence.status.toLowerCase():null,verification_scope:evidence.scope},
 {arrival:input.arrival,departure:input.departure,cabin},{tenantId:tenant,now});
 return normalized.valid?normalized:null;
};
function decideCapacity(result,input,ready,now){
 const unknown={status:'UNKNOWN',verified:false,selectedOptions:[],input};
 if(!ready||result?.tenantId!==tenant||result.arrival!==input.arrival||
  result.departure!==input.departure||result.guests!==input.guests||
  !capacityFresh(result,input,now)||!['available_options','unverified_options','unavailable_options'].every(k=>Array.isArray(result[k])&&result[k].every(r=>r&&typeof r==='object')))return unknown;
 const split=input.cabin?.startsWith('split');
 let permitted=[];
 if(split){
  const pools={};
  for(const [key,cabin] of [['splitAB','splitA'],['splitC','splitC']]){
   const evidence=currentEvidence(result.split_pool_checks?.[key]?.evidence,cabin,input,now);
   pools[key]={verified:Boolean(evidence),availability:evidence?.status.toLowerCase()||'unverified',availableUnits:evidence?.availableUnits??null};
  }
  const p=input.placement;
  const request=p?{kind:p.exactIds?.length?'exact':'mixed',requestedAB:p.ab,requestedC:p.c,
   exactUnitIds:p.exactIds||[],requiresAdjacent:p.adjacent}:null;
  permitted=splitCapacityOptions(input.guests,pools,request).filter(x=>x.availability_verified&&x.availability==='available'&&x.capacity>=input.guests)
   .map(x=>({...x,key:x.requiredC&&!x.requiredAB?'splitC':x.requiredAB&&!x.requiredC?'splitAB':'splitCombination',units:x.units.length}));
 }
 const candidates=wholeCabinCandidates(input).candidates;
 const selected=selectedCapacityOptions(result,input).flatMap(row=>{
  if(split){
   const plan=permitted.find(p=>p.key===row.key&&p.units===row.units&&
    (row.requiredAB===undefined||row.requiredAB===p.requiredAB)&&(row.requiredC===undefined||row.requiredC===p.requiredC));
   return plan?[plan]:[];
  }
  const expected=candidates.find(c=>c.key===row.key&&c.units===row.units&&c.capacity===row.capacity);
  const evidence=currentEvidence(row.evidence,row.key,input,now);
  return expected&&evidence?.status==='AVAILABLE'&&evidence.availableUnits>=expected.units?
   [{...expected,evidence,availability:'available',availability_verified:true}]:[];
 });
 if(selected.length)return {status:'AVAILABLE',verified:true,selectedOptions:selected,input};
 // Explicit zero is distinct from missing/failed evidence, never inferred from
 // an empty list. Other unverified placements retain UNKNOWN.
 if(!split&&result.unverified_options.length===0){
  const zero=result.unavailable_options.some(row=>{
   if(row.key!==input.cabin)return false;
   const expected=candidates.find(c=>c.key===row.key&&c.units===row.units&&c.capacity===row.capacity);
   const evidence=currentEvidence(row.evidence,row.key,input,now);
   return expected&&evidence&&(evidence.status==='UNAVAILABLE'||evidence.availableUnits<expected.units);
  });
  if(zero)return {status:'UNAVAILABLE',verified:true,selectedOptions:[],input};
 }
 return unknown;
}
function decidePrice(proof,capacity,now,facts){
 const unknown={status:'UNKNOWN',verified:false,breakdown:null,guestPriceApproved:false};
 if(!capacity.verified||capacity.status!=='AVAILABLE'||proof?.approved!==true||proof.tenantId!==tenant)return unknown;
 const i=capacity.input,selected=capacity.selectedOptions.find(x=>x.key===proof.unitId&&x.units===proof.units);
 const age=now-Date.parse(proof.checkedAt||'');
 if(!selected||proof.arrival!==i.arrival||proof.departure!==i.departure||proof.guests!==i.guests||
  !Number.isFinite(age)||age<0||age>EVIDENCE_TTL_MS||proof.adults!==facts.adults||
  proof.children!==facts.children||JSON.stringify(proof.child_ages)!==JSON.stringify(facts.child_ages))return unknown;
 const names=['base','seasonal','discount','tourismTax','optional'];
 if(names.some(name=>{
  const c=proof.components?.[name];
  return c?.approved!==true||c.tenantId!==tenant||c.unitId!==proof.unitId||
   c.arrival!==i.arrival||c.departure!==i.departure||c.guests!==i.guests||c.units!==proof.units||
   c.checkedAt!==proof.checkedAt||c.adults!==facts.adults||c.children!==facts.children||
   JSON.stringify(c.child_ages)!==JSON.stringify(facts.child_ages);
 }))return unknown;
 try{
  const totalCapacity=selected.requiredAB!==undefined?selected.capacity:selected.capacity*selected.units;
  const breakdown=verifiedPriceBreakdown({tenantId:tenant,unitId:proof.unitId,capacity:totalCapacity,guests:i.guests,components:proof.components});
  return {status:'VERIFIED',verified:true,breakdown,guestPriceApproved:false};
 }catch{return unknown;}
}
export function evaluateCentralInquiry({message='',language='hu',now=new Date(),facts=null,
 datesConfirmed=false,capacity=null,priceComponents=null}={}){
 const time=now instanceof Date?now:new Date(now),timestamp=time.getTime();
 const parsed=String(message).trim()&&Number.isFinite(timestamp)?normalizeInquiryInput({sourceChannel:'manual',rawText:message,now:time}).normalized:{};
 const n={...parsed,...structuredClone(facts||{}),language,originalText:String(message)};
 n.adults=number(n.adults);n.children=number(n.children);n.guests=number(n.guests);
 if(n.guests===null&&n.adults!==null&&n.children!==null)n.guests=n.adults+n.children;
 n.child_ages=Array.isArray(n.child_ages)?n.child_ages:[];
 const dates=n.dates||{};
 const assessment=assessAccommodationInquiry({arrival:dates.arrival,departure:dates.departure,
  accommodation:n.cabin,guests:n.guests,adults:n.adults,children:n.children,childAges:n.child_ages});
 const missing=[...assessment.missing],contradictions=[...assessment.contradictions];
 const values={arrival:dates.arrival||'',departure:dates.departure||'',guests:n.guests,
  adults:n.adults,children:n.children,child_ages:n.child_ages.join(','),unit:n.cabin||'',
  units_requested:n.units_requested,split_request_text:n.split_request_text||n.originalText};
 const staged=stageFacts(values);
 for(const [field,value] of Object.entries(staged)){
  if(value.status==='contradictory')contradictions.push({code:'invalid_'+field,message:'Ellentmondásos adat: '+field});
  if(value.status==='clarify')missing.push(field==='unit'?'accommodation':field);
 }
 if(dates.inferred_year===true&&datesConfirmed!==true)missing.push('dates_confirmation');
 if(n.units_open_request===true)missing.push('units_requested');
 if(n.guests>40||n.units_requested>10)contradictions.push({code:'party_or_units_out_of_range',message:'A létszám vagy egységszám kezelői pontosítást igényel.'});
 if(n.child_ages.some(age=>!Number.isInteger(age)||age<0||age>17))contradictions.push({code:'invalid_child_ages',message:'Érvényes 0–17 éves gyermekéletkor szükséges.'});
 let today=null;
 if(Number.isFinite(timestamp))today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit'}).format(time);
 else missing.push('current_date');
 if(staged.arrival.status==='known'&&today&&dates.arrival<today)contradictions.push({code:'past_arrival',message:'Az érkezés múltbeli; kezelői pontosítás szükséges.'});
 const input=capacityInput(values,n.originalText);
 // A follow-up may only contain a phone number or child age. Preserve the
 // already normalized split request instead of re-parsing that latest turn.
 // Reviewed specific A/B/C cabin choices retain capacityInput's precedence.
 if(input.cabin==='split'&&n.split_request?.isSplit===true){
  const p=n.split_request;
  if(!Number.isInteger(p.requestedAB)||p.requestedAB<0||p.requestedAB>8||
   !Number.isInteger(p.requestedC)||p.requestedC<0||p.requestedC>4||
   !Array.isArray(p.exactUnitIds)||p.exactUnitIds.some(id=>! /^(?:7|8|9|10)[ABC]$/.test(id))||
   new Set(p.exactUnitIds).size!==p.exactUnitIds.length||
   (p.requiresAdjacent!==undefined&&typeof p.requiresAdjacent!=='boolean')){
   contradictions.push({code:'invalid_split_request',message:'Az osztott elhelyezési igény pontosítandó.'});
  }else{
   input.placement={ab:p.requestedAB,c:p.requestedC,adjacent:p.requiresAdjacent===true,exactIds:[...p.exactUnitIds]};
   if(input.units&&p.requestedAB+p.requestedC>0&&input.units!==p.requestedAB+p.requestedC)
    contradictions.push({code:'split_units_mismatch',message:'Az apartmanszám és az elhelyezési igény nem egyezik.'});
  }
 }
 if(!input.cabin)missing.push('accommodation');
 const uniqueMissing=[...new Set(missing)],uniqueContradictions=[...new Map(contradictions.map(c=>[c.code,c])).values()];
 const ready=uniqueMissing.length===0&&uniqueContradictions.length===0;
 const decidedCapacity=decideCapacity(capacity,input,ready,timestamp);
 return freeze({facts:n,missing:uniqueMissing,contradictions:uniqueContradictions,
  requiresHumanReview:uniqueContradictions.length>0||uniqueMissing.includes('dates_confirmation'),
  readyForCapacityCheck:ready,capacity:decidedCapacity,pricing:decidePrice(priceComponents,decidedCapacity,timestamp,n),
  safety:{emailSent:false,bookingCreated:false,approval:'pending',guestPriceApproved:false}});
}
