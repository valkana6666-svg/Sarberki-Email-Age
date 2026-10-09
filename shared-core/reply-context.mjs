// The renderer gets a projected DTO, not configuration, storage or adapter handles.
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const fields=['language','name','original','arrival','departure','guests','adults','children','childAges','phone','cabin','pier','hotTub','dog','intent'];
const ruleKeys={bookingRules:['depositPctUnder15Guests','depositPctFrom15Guests','depositDueDays','cancellationDaysUnder15Guests','cancellationDaysFrom15Guests'],operationalRules:['reception24h','checkinFrom','checkoutBy','electricitySettlement','parking','firewood','returningGuestDiscountPct','returningGuestLookbackDays','returningGuestRequiresHistoryCheck','petAllowedForFee','petFeeVerified','petFeeHufPerPetPerDay','hotTubAvailabilityRequiresCheck','hotTubFeeVerified','hotTubSeparateRental'],pricingRules:['tourismTaxAdultNightlyHuf']};
export function createReplyContext(tenant,input,records=[]){
 if(records.length&&(!input.caseId||typeof input.caseId!=='string'))throw Error('Ügyazonosító szükséges a válaszforrásokhoz.');
 if(!tenant?.id)throw Error('Vállalkozási azonosító szükséges.');
 const facts=Object.fromEntries(fields.filter(k=>input[k]!=null).map(k=>[k,structuredClone(input[k])]));
 facts.brandName=tenant.brandName;
 const provenance=[];
 for(const [key,allowed]of Object.entries(ruleKeys)){
  const rules=tenant.businessRules?.[{bookingRules:'booking',operationalRules:'operational',pricingRules:'pricing'}[key]]||{};
  facts[key]=Object.fromEntries(allowed.filter(k=>rules[k]!=null).map(k=>[k,rules[k]]));
  provenance.push({field:key,source:'approved_tenant_configuration',tenantId:tenant.id});
 }
 facts.caseContext={priceLines:[],bookingLines:[],extraLines:[],availabilityLines:[],priceApproved:false};facts.knowledgeLines=[];
 for(const record of records){
  if(record.tenantId!==tenant.id||record.caseId!==input.caseId||record.approved!==true||!record.source)throw Error('Idegen vagy nem ellenőrzött válaszinformáció.');
  if(!['price','booking','extra','availability','knowledge'].includes(record.kind))throw Error('Nem engedélyezett válaszforrás.');
  if(record.kind==='availability'&&!record.valid)continue;
  const lines=record.lines.filter(x=>typeof x==='string');
  if(record.kind==='knowledge')facts.knowledgeLines.push(...lines);
  else facts.caseContext[record.kind+'Lines'].push(...lines);
  if(record.kind==='price'&&lines.length)facts.caseContext.priceApproved=true;
  provenance.push({field:record.kind,source:record.source,tenantId:tenant.id,caseId:record.caseId});
 }
 return freeze({tenantId:tenant.id,facts,provenance,untrustedFields:['original']});
}
export function renderReplyContext(context,renderer){return renderer(structuredClone(context.facts));}
