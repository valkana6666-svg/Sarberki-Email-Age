import {validateQuote} from '../price-quote.mjs';
import {SARBERKI_PROFILE} from '../business/sarberki/profile.mjs';

function nights(arrival,departure){
  return Math.round((Date.parse(departure+'T00:00:00Z')-Date.parse(arrival+'T00:00:00Z'))/86400000);
}
function highSeason(date){
  const md=date.slice(5);
  return md>=SARBERKI_PROFILE.pricingRules.highSeasonStart&&md<=SARBERKI_PROFILE.pricingRules.highSeasonEnd;
}
function childExtraRate(age){
  if(age<3) return SARBERKI_PROFILE.pricingRules.child0to3NightlyHuf;
  if(age<=8) return SARBERKI_PROFILE.pricingRules.child3to8NightlyHuf;
  return SARBERKI_PROFILE.pricingRules.extraAdultNightlyHuf;
}
export function fetchPublicPriceReference(raw){
  const input=validateQuote(raw);
  if(!['splitA','splitB','splitC'].includes(input.cabin)) throw Error('Publikus referenciaár csak az Osztott A/B/C egységekhez használható.');
  const type=SARBERKI_PROFILE.accommodationTypes[input.cabin];
  const count=nights(input.arrival,input.departure);
  if(count<1) throw Error('Érvénytelen éjszakaszám.');
  const units=input.units||1;
  if(units!==1) throw Error('Osztott referenciaárnál egyszerre egy egység árazható.');
  const base=type.basePriceGuests;
  const baseChildSlots=Math.max(0,base-input.adults);
  const extraAdults=Math.max(0,input.adults-base);
  const extraChildren=input.children.slice(baseChildSlots);
  if((extraAdults>0||extraChildren.length>0)&&!SARBERKI_PROFILE.pricingRules.publicExtraGuestRatesVerified){
    throw Error('A publikus pótvendég-/gyermekár nem hitelesített aktuális díj; kézi vagy Previo-ellenőrzés szükséges.');
  }
  const nightlyExtra=extraAdults*SARBERKI_PROFILE.pricingRules.extraAdultNightlyHuf+extraChildren.reduce((s,age)=>s+childExtraRate(age),0);
  let accommodation=0;
  for(let i=0;i<count;i++){
    const d=new Date(Date.parse(input.arrival+'T00:00:00Z')+i*86400000).toISOString().slice(0,10);
    const rawNight=type.publicListedNightlyHuf+nightlyExtra;
    accommodation+=Math.round(rawNight*(highSeason(d)?1+SARBERKI_PROFILE.pricingRules.highSeasonSurchargePct/100:1));
  }
  if(count===1) accommodation=Math.round(accommodation*(1+SARBERKI_PROFILE.pricingRules.oneNightSurchargePct/100));
  const tourismTax=input.adults*count*SARBERKI_PROFILE.pricingRules.tourismTaxAdultNightlyHuf;
  return {
    status:'public_reference',
    source:'Sárberki hivatalos publikus árlista',
    sourceUrl:type.publicPriceUrl||SARBERKI_PROFILE.bookingUrl,
    checkedAt:new Date().toISOString(),
    ...input,
    units:1,
    availability:'not_checked',
    accommodation,
    tourismTax,
    total:accommodation+tourismTax,
    currency:'HUF',
    bookingCompleted:false,
    referenceOnly:true
  };
}
