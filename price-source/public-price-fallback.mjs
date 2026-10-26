import {validateQuote} from '../price-quote.mjs';
import {SARBERKI_PROFILE} from '../business/sarberki/profile.mjs';
import {SARBERKI_TARIFF_2027,sarberkiTariffForNight} from '../business/sarberki/tariffs.mjs';

function nights(arrival,departure){
  return Math.round((Date.parse(departure+'T00:00:00Z')-Date.parse(arrival+'T00:00:00Z'))/86400000);
}
function dateOfNight(arrival,index){
  return new Date(Date.parse(arrival+'T00:00:00Z')+index*86400000).toISOString().slice(0,10);
}
const is2027=date=>date>=SARBERKI_TARIFF_2027.validFrom&&date<=SARBERKI_TARIFF_2027.validThrough;
function highSeason(date){
  // Signed PDF: prose says Aug 22, tariff table says Aug 20.
  // No guess for Aug 21/22 in 2027. Leave 2026 as it was.
  if(date==='2027-08-21'||date==='2027-08-22')
    throw Error('A 2027. augusztus 21–22-i főszezonhatár tisztázandó; kézi ármegállapítás szükséges.');
  const md=date.slice(5);
  return md>=SARBERKI_PROFILE.pricingRules.highSeasonStart&&md<=SARBERKI_PROFILE.pricingRules.highSeasonEnd;
}
function dailyBasePrice(arrival,count,tariffs,extraAdultNightlyHuf=0){
  let accommodation=0;
  for(let i=0;i<count;i++){
    const date=dateOfNight(arrival,i);
    accommodation+=Math.round((tariffs[i].nightlyHuf+extraAdultNightlyHuf)*
      (highSeason(date)?1+SARBERKI_PROFILE.pricingRules.highSeasonSurchargePct/100:1));
  }
  if(count===1) accommodation=Math.round(accommodation*(1+SARBERKI_PROFILE.pricingRules.oneNightSurchargePct/100));
  return accommodation;
}

// Public informational reference only; no Previo availability, guest sends or booking.
export function fetchPublicPriceReference(raw){
  const input=validateQuote(raw);
  const type=SARBERKI_PROFILE.accommodationTypes[input.cabin];
  const count=nights(input.arrival,input.departure);
  if(count<1)throw Error('Érvénytelen éjszakaszám.');
  const units=input.units||1;
  const dates=Array.from({length:count},(_,i)=>dateOfNight(input.arrival,i));
  // Select each occupied night independently, including stays across New Year.
  const tariffs=dates.map(date=>sarberkiTariffForNight(date,input.cabin));
  const included=Math.min(...tariffs.map(t=>t.includedGuests));
  const guests=input.adults+input.children.length;
  const uses2027=dates.some(is2027);
  const all2027=dates.every(is2027);
  if(tariffs.some(t=>!Number.isSafeInteger(t.nightlyHuf)||t.nightlyHuf<=0)||!Number.isInteger(included)||included<1)
    throw Error('A választott ház publikus alapára nem igazolt.');

  // Do not silently skip the PDF's seventh-free-night benefit.
  if(uses2027&&count>=7)
    throw Error('A 2027-es hetedik ingyenes éjszaka beszámítása ellenőrizendő; kézi árazás szükséges.');
  // Ages 0-2 are explicitly free. Ages >=3 need a decision on the 3y
  // boundary and interaction of the 5000 HUF fee with house occupancy.
  if(uses2027&&input.children.some(age=>age>=3))
    throw Error('A 2027-es gyermekár és az alaplétszám együttes alkalmazása ellenőrizendő.');

  let extraAdultNightlyHuf=0;
  if(guests>included*units||input.adults>included*units){
    // The signed 2027 adult occupancy rows establish +10000 HUF per adult
    // per normal night for a SINGLE unit; no assumptions for mixed-age,
    // multi-unit or cross-year extra-person allocation.
    if(all2027&&units===1&&input.children.length===0&&input.adults>included&&
       type.extraAdultPricing==='standard'&&Number.isSafeInteger(SARBERKI_TARIFF_2027.extraAdultNightlyHuf)){
      extraAdultNightlyHuf=(input.adults-included)*SARBERKI_TARIFF_2027.extraAdultNightlyHuf;
    }else{
      throw Error('A publikus pótvendég-/gyermekár nem hitelesített aktuális díj; kézi vagy Previo-ellenőrzés szükséges.');
    }
  }

  // At least one adult per unit; distribution changes tax, not fixed house price.
  const parties=Array.from({length:units},()=>({adults:1,children:[]}));
  let remainingAdults=input.adults-units;
  for(let i=0;remainingAdults>0;i=(i+1)%units){
    if(parties[i].adults+parties[i].children.length<included+
      (extraAdultNightlyHuf>0 ? input.adults-included : 0)){
      parties[i].adults++;remainingAdults--;
    }
  }
  for(const age of input.children){
    const unit=parties.find(p=>p.adults+p.children.length<included);
    if(!unit)throw Error('A vendégek az alapárban foglalt férőhelyekre nem oszthatók el.');
    unit.children.push(age);
  }
  const basePerUnit=dailyBasePrice(input.arrival,count,tariffs,extraAdultNightlyHuf);
  const taxPerAdult=count*SARBERKI_PROFILE.pricingRules.tourismTaxAdultNightlyHuf;
  const unitBreakdown=parties.map((p,index)=>{
    const tourismTax=p.adults*taxPerAdult;
    return {unit:index+1,adults:p.adults,children:p.children,accommodation:basePerUnit,tourismTax,total:basePerUnit+tourismTax};
  });
  const accommodation=basePerUnit*units;
  const tourismTax=input.adults*taxPerAdult;
  const total=accommodation+tourismTax;
  return {
    status:'public_reference',source:uses2027?'Sárberki 2027. évi végleges árlista – tájékoztató kalkuláció':'Sárberki publikus árlista – tájékoztató kalkuláció',
    sourceUrl:type.publicPriceUrl||SARBERKI_PROFILE.bookingUrl,
    checkedAt:new Date().toISOString(),...input,units,
    availability:'not_checked',availableUnits:null,
    accommodation,tourismTax,total,currency:'HUF',
    unitBreakdown:units>1?unitBreakdown:[],
    bookingCompleted:false,referenceOnly:true
  };
}
