import {BUSINESS} from './business-config.mjs';
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
export function createTenantConfig({id,brandName,languages,knowledge=[],businessRules={},inventory=[],pricing={},adapterId,communication={}}){
 if(!/^[a-z][a-z0-9-]{1,63}$/.test(id||'')||!brandName||!adapterId||!Array.isArray(languages)||!languages.length)throw Error('Hiányos vállalkozási konfiguráció.');
 if(knowledge.some(x=>x.tenantId!==id||x.approved!==true||!x.source||!x.id))throw Error('Idegen vagy nem jóváhagyott tudásforrás.');
 if(new Set(inventory.map(x=>x.id)).size!==inventory.length||inventory.some(x=>!x.id||!x.physicalHouse||!Number.isInteger(x.capacity)||x.capacity<1))throw Error('Hibás egységstruktúra.');
 return freeze(structuredClone({id,brandName,languages,knowledge,businessRules,inventory,pricing,adapterId,communication:{...communication,automaticSend:false,humanApprovalRequired:true}}));
}
const whole=[['vip',[1],5],['family',[2,3,4,5,6],8],['deluxe',[11,12,13,14],5],['small',[15],2]].flatMap(([type,houses,capacity])=>houses.map(n=>({id:String(n),physicalHouse:n,type,capacity,extraBedsVerified:false})));
export const SARBERKI_TENANT=createTenantConfig({id:'sarberki',brandName:BUSINESS.brandName,languages:['hu','de','en','si'],adapterId:BUSINESS.bookingProvider.kind,
 inventory:[...whole,...BUSINESS.splitPhysicalUnits.map(x=>({id:x.id,physicalHouse:x.physicalHouse,type:x.previoPool,capacity:x.nominalGuests,extraBedsVerified:false}))],
 businessRules:{booking:BUSINESS.bookingRules,operational:BUSINESS.operationalRules,pricing:BUSINESS.pricingRules},
 pricing:{basis:'per_unit',currency:'HUF',extraBedsRequireVerification:true},communication:{channel:'email',readOnly:true}});
