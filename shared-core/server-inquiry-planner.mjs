// Server-side orchestration only. No provider is enabled by default. Live Previo
// access remains behind the existing authenticated safety gate elsewhere.
import {buildAvailabilityOptions} from '../netlify/functions/availability-options.mjs';
import {evaluateCentralInquiry} from './central-inquiry-decision.mjs';
export async function planCentralInquiry(options={}, {availabilitySource=null,priceSource=null,clock=()=>new Date()}={}){
 const current=()=>({...options,now:clock()});
 let decision=evaluateCentralInquiry(current());
 if(!decision.readyForCapacityCheck||typeof availabilitySource!=='function')return decision;
 let capacity;
 try{capacity=await buildAvailabilityOptions(decision.capacity.input,availabilitySource,{tenantId:options.tenantId||'sarberki',now:()=>+clock()});}
 catch{return decision;}
 decision=evaluateCentralInquiry({...current(),capacity});
 if(!decision.capacity.verified||decision.capacity.status!=='AVAILABLE'||typeof priceSource!=='function')return decision;
 let priceComponents;try{priceComponents=await priceSource({facts:decision.facts,capacity:decision.capacity});}catch{return decision;}
 // Re-evaluate capacity after pricing: expiry while awaiting a provider is closed.
 return evaluateCentralInquiry({...current(),capacity,priceComponents});
}
