// Server-only. Level 1 (owner/ChatGPT 2026-11-06): the guest's draft rests on the Previo free-unit read when the
// owner switch enables it. Uses the EXISTING path: buildAvailabilityOptions -> evaluateCentralInquiry(capacity)
// -> buildEmailInquiryDraft. A failed/unknown read leaves the draft exactly as without Previo (never "sold out").
import {buildAvailabilityOptions} from '../netlify/functions/availability-options.mjs';
import {evaluateCentralInquiry} from './central-inquiry-decision.mjs';
import {buildEmailInquiryDraft} from './inquiry-channel-adapters.mjs';

// Adapter: readPrevioFreeCapacity(...) -> the availability-options source contract.
export function previoAvailabilitySource(reader){
 if(typeof reader!=='function')return null;
 return async({arrival,departure,cabin})=>{
  const r=await reader({cabin,arrival,departure});
  const n=r?.freeByCabin?.[cabin];
  if(!Number.isSafeInteger(n)||n<0)throw Error('PREVIO_CAPACITY_UNKNOWN');
  return {arrival,departure,cabin,availability:n>0?'available':'unavailable',availableUnits:n,checkedAt:r.checkedAt,source:'previo-rest-'+r.hotelId};
 };
}

// `clock` is read when the Previo answer is validated, not when the draft started: the read finishes after the
// start, and an answer "from the future" was rejected as invalid evidence (owner iPhone test 2026-11-09).
export async function emailDraftWithCapacity(options,availabilitySource=null,{clock=Date.now}={}){
 if(typeof availabilitySource!=='function')return buildEmailInquiryDraft(options);
 const decision=evaluateCentralInquiry(options);
 if(!decision.readyForCapacityCheck)return buildEmailInquiryDraft(options);
 // No cabin type chosen: the letter asks for the type first, so no Previo call (AGENTS.md: only the needed reads).
 if(!decision.capacity?.input?.cabin)return buildEmailInquiryDraft(options);
 let capacity=null;
 try{capacity=await buildAvailabilityOptions(decision.capacity.input,availabilitySource,{tenantId:options.tenantId,now:()=>Math.max(+new Date(options.now),Number(clock()))});}catch{}
 // The decision re-checks the evidence's freshness against `now`: use the moment after the read.
 return buildEmailInquiryDraft(capacity?{...options,now:new Date(Math.max(+new Date(options.now),Number(clock()))),capacity}:options);
}
