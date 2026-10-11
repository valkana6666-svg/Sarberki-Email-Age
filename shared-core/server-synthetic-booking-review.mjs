import {evaluateCentralInquiry} from './central-inquiry-decision.mjs';
import {buildAvailabilityOptions} from '../netlify/functions/availability-options.mjs';
import {normalizeAvailability,assertCurrentEvidence,EVIDENCE_TTL_MS} from './availability-model.mjs';
import {verifiedUnitBase} from './verified-pricing.mjs';
import {buildCentralReply} from '../central-reply.mjs';
import {SARBERKI_TENANT} from '../tenant-config.mjs';
import {serverInquiryOptions} from './server-inquiry-options.mjs';
import {renderCentralConversation} from './inquiry-channel-adapters.mjs';

// Fixture transport/presentation adapter only. Shared decisions own validation,
// inventory and totals. No persistence, live provider or approval is enabled.
export async function prepareSyntheticBookingReview({record,availability,pricing,now=Date.now(),currentNow=()=>typeof now==='function'?now():now}){
 const data=record?.data,values=data?.state?.values;
 if(record?.tenantId!=='sarberki-test'||data?.tenantId!==record.tenantId||!data.sender?.endsWith('.invalid')||!values)throw Error('Synthetic case required');
 const options=()=>{
  const projected=serverInquiryOptions(record,new Date(currentNow()));
  // The existing fixed-unit fixture contract defaults to one requested unit.
  if(projected.facts.units_requested===null)projected.facts.units_requested=1;
  return projected;
 };
 let decision=evaluateCentralInquiry(options());
 const draftInput={caseId:data.id,language:values.language||'hu',arrival:values.arrival,
  departure:values.departure,guests:decision.facts.guests,adults:decision.facts.adults,children:decision.facts.children,
  childAges:decision.facts.child_ages,phone:values.phone,name:values.name,
  cabin:values.unit,original:data.state.original};
 // Render a new reviewed draft from normalized stored facts. Existing stored text
 // is never overwritten; approval must match this exact current draft.
 const draft=buildCentralReply(draftInput,{tenant:{...SARBERKI_TENANT,id:record.tenantId},records:[]});
 const pending=(status,extra={})=>({status,approval:'pending',...extra,decision,
  operatorReviewText:buildCentralReply({...draftInput,language:'hu'},
   {tenant:{...SARBERKI_TENANT,id:record.tenantId},records:[]})+'\n\n'+renderCentralConversation(decision,{language:'hu'}),
  operatorReviewLanguage:'hu',draft});
 if(!decision.readyForCapacityCheck)return pending('missing_data',{
  missing:[...new Set([...decision.missing,...decision.contradictions.map(x=>x.code)])]});
 if(decision.capacity.incompatible)return pending('capacity_incompatible');
 if(typeof availability!=='function'||typeof pricing!=='function')throw Error('Fixture providers required');
 const query={arrival:values.arrival,departure:values.departure,cabin:values.unit};
 const guests=decision.facts.guests,units=decision.capacity.input.units||1;
 const nights=(Date.parse(query.departure)-Date.parse(query.arrival))/86400000;
 let evidence;
 const readFixture=async()=>{
  const raw=await availability({...query,guests,tenantId:record.tenantId});
  if(raw?.source!=='synthetic-fixture'||raw.tenantId!==record.tenantId)throw Error('Fixture scope required');
  const checked=normalizeAvailability(raw,query,{tenantId:record.tenantId,now:currentNow()});
  if(!checked.valid)throw Error('Current fixture evidence required');
  evidence=checked;return raw;
 };
 // A generic split-label fixture cannot prove independent A/B and C pools.
 if(decision.capacity.input.cabin?.startsWith('split')||values.split_request_text){
  try{await readFixture();}catch{return pending('capacity_unknown');}
  if(evidence.status!=='AVAILABLE'||units>evidence.availableUnits)return pending('capacity_unavailable');
  return pending('split_manual_review');
 }
 let capacity;
 try{
  const selectedCabin=decision.capacity.input.cabin;
  capacity=await buildAvailabilityOptions(decision.capacity.input,async input=>{
   if(input.cabin!==selectedCabin)throw Error('Unrequested fixture type');
   const raw=await readFixture();
   // Transport label translation follows original label/date/tenant validation.
   // Tenant identity is never rewritten.
   return {...raw,cabin:input.cabin};
  },{tenantId:record.tenantId,now:currentNow});
 }catch{return pending('capacity_unknown');}
 decision=evaluateCentralInquiry({...options(),capacity});
 if(decision.capacity.status==='UNAVAILABLE')return pending('capacity_unavailable');
 if(decision.capacity.status!=='AVAILABLE')return pending('capacity_unknown');
 let rate;try{rate=await pricing({...query,guests,units,nights});}catch{return pending('price_unknown');}
 decision=evaluateCentralInquiry({...options(),capacity});
 if(decision.capacity.status!=='AVAILABLE')return pending('capacity_unknown');
 try{assertCurrentEvidence(evidence,record.tenantId,query,currentNow());}catch{return pending('capacity_unknown');}
 const at=currentNow(),rateAge=at-Date.parse(rate?.checkedAt||'');
 if(rate?.source!=='synthetic-fixture'||rate.tenantId!==record.tenantId||rate.unitId!==query.cabin||
  rate.arrival!==query.arrival||rate.departure!==query.departure||!Number.isFinite(rateAge)||rateAge<0||rateAge>EVIDENCE_TTL_MS)return pending('price_unknown');
 try{
  const base=verifiedUnitBase({tenantId:record.tenantId,unitId:query.cabin,capacity:rate.capacity,guests,units,nights,rate});
  const scope={tenantId:record.tenantId,unitId:decision.capacity.input.cabin,
   arrival:query.arrival,departure:query.departure,guests,units,adults:decision.facts.adults,
   children:decision.facts.children,child_ages:decision.facts.child_ages,checkedAt:rate.checkedAt,approved:true};
  // Explicit zero fixture components retain the existing synthetic-rate contract.
  // They are not externally verified extras or approval of a guest offer.
  const component=amount=>({...scope,amount,verified:true,source:'synthetic-fixture'});
  const priceComponents={...scope,components:{base:component(base.amount),seasonal:component(0),
   discount:component(0),tourismTax:component(0),optional:component(0)}};
  decision=evaluateCentralInquiry({...options(),capacity,priceComponents});
  if(decision.capacity.status!=='AVAILABLE')return pending('capacity_unknown');
  if(!decision.pricing.verified)return pending('price_unknown');
  const quote={...decision.pricing.breakdown,unitId:query.cabin};
  return pending('internal_review_required',{evidence,quote,excludedExtras:['hot_tub']});
 }catch{return pending('price_unknown');}
}
