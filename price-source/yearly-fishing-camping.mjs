// 2027 owner-approved tariffs from the signed two-page PDF dated 2026-09-30.
// This is an isolated, read-only tariff lookup; no guest quote or PMS writes.
import { fishing as fishing2026 } from '../fishing-rules.mjs';

const freeze = value => Object.freeze(value);
const adults = freeze({hours12:5000,hours24:7500,week:32500,year:86000,half1:43000,half2:53000});
const children = freeze({hours12:2500,hours24:3750,week:16250,year:43000,half1:21500,half2:26500});
const recordAdult = freeze({hours12:7500,hours24:11250,week:48750,year:129000,half1:64500,half2:80000});
const recordChild = freeze({hours12:3750,hours24:5650,week:24500,year:64500,half1:32250,half2:39750});

export const TARIFF_2027 = freeze({
  validFrom:'2027-01-01', validThrough:'2027-12-31',
  source:'2027. évi végleges árak, Rezidencia 96 Kft., 2026-09-30, page 2',
  fishing:freeze({
    tickets:freeze({
      normal:freeze({adult:adults,child:children}),
      record:freeze({adult:recordAdult,child:recordChild})
    }),
    rentalPerItemDay:freeze({cart:600,cradle:1000}),
    fishPerKg:freeze({zander:4500,pike:4500,catfishAngler:1500,catfishNonAngler:3500,
      carpUnder5Kg:2000,grassCarpUnder5Kg:2000,bream:1350,crucian:1350}),
    guestHours12Allowed:false, recordTicketValidAtNormalLake:true,
    fishWeightRoundingKg:0.1,fishWeightRoundingMode:'down',
    otherFishTakeawayAllowed:false
  }),
  camping:freeze({
    perItemDay:freeze({tent:2200,caravan:2200,motorhome:3600,car:2200,motorcycle:2200,
      electricity:2600}),
    perPersonDay:1850,
    electricCarChargingPer24Hours:26000,
    tourismTaxNotIncluded:true
  })
});

function checkedYear(date){
  if(typeof date!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
     !Number.isFinite(Date.parse(date)) ||
     new Date(date).toISOString().slice(0,10)!==date) throw new TypeError('Valid ISO date required');
  return Number(date.slice(0,4));
}
function priceResult(amountHuf,status,source){
  return freeze({amountHuf,status,source,currency:'HUF',accommodationTotalAffected:false});
}
export function fishingTicketPrice({date,lake,person,ticket,stayingGuest=false}){
  const year=checkedYear(date);
  if(!['normal','record'].includes(lake) ||
     !['adult','child'].includes(person) ||
     !['hours12','hours24','week','year','half1','half2'].includes(ticket) ||
     typeof stayingGuest!=='boolean') throw new TypeError('Invalid fishing ticket choice');
  if(stayingGuest && ticket==='hours12') return priceResult(null,'not_allowed_for_staying_guests','2027-PDF');
  if(year===2027) return priceResult(TARIFF_2027.fishing.tickets[lake][person][ticket],'owner_approved_2027',TARIFF_2027.source);
  if(year===2026) return priceResult(fishing2026.tickets[lake][person][ticket],'existing_2026_reference',fishing2026.source);
  return priceResult(null,'year_not_configured',null);
}
export function fishingOtherPrice({date,group,item}){
  const year=checkedYear(date);
  if(!['rentalPerItemDay','fishPerKg'].includes(group) || !Object.hasOwn(TARIFF_2027.fishing[group],item))
    throw new TypeError('Unknown fishing fee');
  if(year===2027) return priceResult(TARIFF_2027.fishing[group][item],'owner_approved_2027',TARIFF_2027.source);
  // Keep the existing 2026 configuration untouched and do not infer incompatible aliases.
  if(year===2026){
    const old=group==='rentalPerItemDay' ? fishing2026.extrasPerDay[item] :
      (item==='catfishAngler' ? fishing2026.fishPerKg.catfish :
       item==='catfishNonAngler' ? fishing2026.fishPerKg.catfishNonAngler : fishing2026.fishPerKg[item]);
    return priceResult(Number.isFinite(old)?old:null,Number.isFinite(old)?'existing_2026_reference':'needs_2026_source_check',fishing2026.source);
  }
  return priceResult(null,'year_not_configured',null);
}
export function campingPrice({date,item}){
  const year=checkedYear(date);
  const amount = item==='person' ? TARIFF_2027.camping.perPersonDay :
    item==='electricCarCharging' ? TARIFF_2027.camping.electricCarChargingPer24Hours :
    TARIFF_2027.camping.perItemDay[item];
  if(!Number.isFinite(amount)) throw new TypeError('Unknown camping fee');
  // No reliable 2026 camping price source in the currently verified runtime.
  if(year!==2027) return priceResult(null,year===2026?'needs_2026_source_check':'year_not_configured',null);
  return priceResult(amount,'owner_approved_2027',TARIFF_2027.source);
}
