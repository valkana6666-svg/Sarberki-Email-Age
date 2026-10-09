import {normalizeAvailability} from './availability-model.mjs';
import {verifiedUnitBase,verifiedPriceBreakdown} from './verified-pricing.mjs';
import {buildCentralReply} from '../central-reply.mjs';
import {SARBERKI_TENANT} from '../tenant-config.mjs';

// Internal, injected fixture rehearsal only. Not exposed by booking-cases;
// it neither persists evidence nor calls Previo, sends mail or approves an offer.
export async function prepareSyntheticBookingReview({record,availability,pricing,now=Date.now()}){
 const data=record?.data,values=data?.state?.values;
 if(record?.tenantId!=='sarberki-test'||data?.tenantId!==record.tenantId||!data.sender?.endsWith('.invalid')||!values)throw Error('Synthetic case required');
 const missing=['arrival','departure','guests','adults','children','unit'].filter(k=>values[k]===undefined||values[k]==='');
 const query={arrival:values.arrival,departure:values.departure,cabin:values.unit};
 const guests=Number(values.guests),adults=Number(values.adults),children=Number(values.children),units=Number(values.units_requested||1);
 const nights=(Date.parse(query.departure)-Date.parse(query.arrival))/86400000;
 if(!Number.isInteger(units)||units<1)missing.push('units_requested');
 if(!Number.isInteger(guests)||guests<1||!Number.isInteger(adults)||!Number.isInteger(children)||adults<0||children<0||adults+children!==guests||!Number.isInteger(nights)||nights<1||String(values.unit).startsWith('?'))missing.push('confirmed_stay_and_party');
 if(children>0&&String(values.child_ages||'').split(',').filter(Boolean).length!==children)missing.push('child_ages');
 const input={caseId:data.id,language:values.language||'hu',arrival:values.arrival,departure:values.departure,guests:values.guests,adults:values.adults,children:values.children,cabin:values.unit,original:data.state.original};
 const tenant={...SARBERKI_TENANT,id:record.tenantId};
 const pending=(status,extra={})=>({status,approval:'pending',...extra,draft:buildCentralReply(input,{tenant,records:[]})});
 if(missing.length)return pending('missing_data',{missing:[...new Set(missing)]});
 if(typeof availability!=='function'||typeof pricing!=='function')throw Error('Fixture providers required');
 let raw;try{raw=await availability({...query,guests});}catch{return pending('capacity_unknown');}
 // A type pool cannot prove placement in a particular physical house.
 if(raw?.source!=='synthetic-fixture')return pending('capacity_unknown');
 const evidence=normalizeAvailability(raw,query,{tenantId:record.tenantId,now});
 if(!evidence.valid)return pending('capacity_unknown');
 if(evidence.status!=='AVAILABLE')return pending('capacity_unavailable');
 if(units>evidence.availableUnits)return pending('capacity_unavailable');
 if(values.unit==='Osztott'||values.split_request_text)return pending('split_manual_review');
 const rate=await pricing({...query,guests});
 if(rate?.source!=='synthetic-fixture')throw Error('Fixture pricing required');
 const base=verifiedUnitBase({tenantId:record.tenantId,unitId:query.cabin,capacity:rate.capacity,guests,units,nights,rate});
 const component=amount=>({amount,verified:true,tenantId:record.tenantId,source:'synthetic-fixture'});
 const quote=verifiedPriceBreakdown({tenantId:record.tenantId,unitId:query.cabin,capacity:rate.capacity*units,guests,components:{base,seasonal:component(0),discount:component(0),tourismTax:component(0),optional:component(0)}});
 // The synthetic calculation is internal, not an approved guest price source.
 return pending('internal_review_required',{evidence,quote,excludedExtras:['hot_tub']});
}
