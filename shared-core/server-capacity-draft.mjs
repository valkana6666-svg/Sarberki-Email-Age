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

export async function emailDraftWithCapacity(options,availabilitySource=null){
 if(typeof availabilitySource!=='function')return buildEmailInquiryDraft(options);
 const decision=evaluateCentralInquiry(options);
 if(!decision.readyForCapacityCheck)return buildEmailInquiryDraft(options);
 let capacity=null;
 try{capacity=await buildAvailabilityOptions(decision.capacity.input,availabilitySource,{tenantId:options.tenantId,now:()=>+new Date(options.now)});}catch{}
 return buildEmailInquiryDraft(capacity?{...options,capacity}:options);
}
