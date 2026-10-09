// Does not fetch or invent rates. Only approved source components can be totalled.
export function verifiedPriceBreakdown({tenantId,unitId,capacity,guests,components}){
 if(!tenantId||!unitId||!Number.isInteger(capacity)||!Number.isInteger(guests)||guests<1||guests>capacity)throw Error('Nem igazolt elhelyezési kapacitás.');
 const names=['base','seasonal','discount','tourismTax','optional'];
 if(!components||names.some(k=>!components[k]||components[k].verified!==true||components[k].tenantId!==tenantId||!components[k].source||!Number.isFinite(components[k].amount)||components[k].amount<0))throw Error('Nem ellenőrzött árösszetevő.');
 const amounts=Object.fromEntries(names.map(k=>[k,components[k].amount]));
 const total=amounts.base+amounts.seasonal-amounts.discount+amounts.tourismTax+amounts.optional;
 if(total<0)throw Error('Ellentmondásos ár.');
 return Object.freeze({tenantId,unitId,basis:'per_unit',...amounts,total});
}
export function verifiedUnitBase({tenantId,unitId,capacity,guests,units=1,nights,rate}){
 if(!Number.isInteger(units)||units<1||!Number.isInteger(nights)||nights<1||!Number.isInteger(guests)||guests<1||guests>capacity*units||rate?.verified!==true||rate.tenantId!==tenantId||rate.unitId!==unitId||rate.basis!=='per_unit'||!rate.source||!Number.isFinite(rate.nightly)||rate.nightly<0)throw Error('Nem ellenőrzött fix egységár vagy kapacitás.');
 return {tenantId,unitId,basis:'per_unit',amount:rate.nightly*units*nights,source:rate.source,verified:true};
}
