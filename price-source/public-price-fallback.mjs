import {validateQuote} from '../price-quote.mjs';
import {SARBERKI_PROFILE} from '../business/sarberki/profile.mjs';

function nights(arrival,departure){
  return Math.round((Date.parse(departure+'T00:00:00Z')-Date.parse(arrival+'T00:00:00Z'))/86400000);
}
function highSeason(date){
  const md=date.slice(5);
  return md>=SARBERKI_PROFILE.pricingRules.highSeasonStart&&md<=SARBERKI_PROFILE.pricingRules.highSeasonEnd;
}
function dailyBasePrice(arrival,count,type){
  let accommodation=0;
  for(let i=0;i<count;i++){
    const date=new Date(Date.parse(arrival+'T00:00:00Z')+i*86400000).toISOString().slice(0,10);
    accommodation+=Math.round(type.publicListedNightlyHuf*(highSeason(date)?1+SARBERKI_PROFILE.pricingRules.highSeasonSurchargePct/100:1));
  }
  if(count===1) accommodation=Math.round(accommodation*(1+SARBERKI_PROFILE.pricingRules.oneNightSurchargePct/100));
  return accommodation;
}

// A reference based on public, fixed accommodation/unit prices. It does not query Previo.
// Only guests within the included base-price capacity may receive a full reference total.
// Above that threshold the current public extra-person rates are not verified.
export function fetchPublicPriceReference(raw){
  const input=validateQuote(raw);
  const type=SARBERKI_PROFILE.accommodationTypes[input.cabin];
  const count=nights(input.arrival,input.departure);
  if(count<1)throw Error('Érvénytelen éjszakaszám.');
  const units=input.units||1;
  const included=type.basePriceGuests;
  const guests=input.adults+input.children.length;
  if(!Number.isSafeInteger(type.publicListedNightlyHuf)||type.publicListedNightlyHuf<=0||!Number.isInteger(included)||included<1)throw Error('A választott ház publikus alapára nem igazolt.');
  if(guests>included*units||input.adults>included*units)
    throw Error('A publikus pótvendég-/gyermekár nem hitelesített aktuális díj; kézi vagy Previo-ellenőrzés szükséges.');

  // At least one adult per unit; the distribution changes tax, not the fixed house price.
  const parties=Array.from({length:units},()=>({adults:1,children:[]}));
  let remainingAdults=input.adults-units;
  for(let i=0;remainingAdults>0;i=(i+1)%units){
    if(parties[i].adults+parties[i].children.length<included){parties[i].adults++;remainingAdults--;}
  }
  for(const age of input.children){
    const unit=parties.find(p=>p.adults+p.children.length<included);
    if(!unit)throw Error('A vendégek az alapárban foglalt férőhelyekre nem oszthatók el.');
    unit.children.push(age);
  }
  const basePerUnit=dailyBasePrice(input.arrival,count,type);
  const taxPerAdult=count*SARBERKI_PROFILE.pricingRules.tourismTaxAdultNightlyHuf;
  const unitBreakdown=parties.map((p,index)=>{
    const tourismTax=p.adults*taxPerAdult;
    return {unit:index+1,adults:p.adults,children:p.children,accommodation:basePerUnit,tourismTax,total:basePerUnit+tourismTax};
  });
  const accommodation=basePerUnit*units;
  const tourismTax=input.adults*taxPerAdult;
  const total=accommodation+tourismTax;
  return {
    status:'public_reference',source:'Sárberki publikus árlista – tájékoztató kalkuláció',
    sourceUrl:type.publicPriceUrl||SARBERKI_PROFILE.bookingUrl,
    checkedAt:new Date().toISOString(),...input,units,
    availability:'not_checked',availableUnits:null,
    accommodation,tourismTax,total,currency:'HUF',
    unitBreakdown:units>1?unitBreakdown:[],
    bookingCompleted:false,referenceOnly:true
  };
}
