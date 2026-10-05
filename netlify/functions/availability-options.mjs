import {BUSINESS} from '../../business-config.mjs';
import {fetchPublicBookingAvailability} from '../../price-source/sarberki-public-booking.mjs';

const LIVE_TEST_HOSTS=new Set(['leafy-chimera-2403e5.netlify.app']);

export function isLiveAvailabilityEnabled(request){
  try{return LIVE_TEST_HOSTS.has(new URL(request.url).hostname);}catch{return false;}
}

function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(+new Date(value+'T00:00:00Z'));}

export function splitCapacityOptions(guests){
  const units=[
    {key:'splitA',label:'Osztott A',capacity:BUSINESS.accommodationTypes.splitA.maxGuests},
    {key:'splitB',label:'Osztott B',capacity:BUSINESS.accommodationTypes.splitB.maxGuests},
    {key:'splitC',label:'Osztott C',capacity:BUSINESS.accommodationTypes.splitC.maxGuests}
  ];
  const combos=[];
  for(let mask=1;mask<(1<<units.length);mask++){
    const selected=units.filter((_,i)=>mask&(1<<i));
    const capacity=selected.reduce((n,x)=>n+x.capacity,0);
    if(capacity>=guests) combos.push({units:selected.map(x=>x.key),labels:selected.map(x=>x.label),capacity,excess:capacity-guests,count:selected.length});
  }
  combos.sort((a,b)=>a.excess-b.excess||a.count-b.count||a.labels.join().localeCompare(b.labels.join()));
  const best=combos[0];
  if(!best)return [];
  return combos.filter(x=>x.excess===best.excess&&x.count===best.count).map(x=>({
    kind:'split_manual_review',
    label:x.labels.join(' + '),
    units:x.units,
    capacity:x.capacity,
    availability_verified:false,
    reason:'A Previo-típusmapping hitelesített (A/B = 2 fős apartman pool, C = 4 fős apartman pool), de az egyedi 7A–10C egység-ID és az azonos fizikai házhoz tartozó A/B + C párosítás ezen a read-only útvonalon nem látszik.'
  }));
}

export async function buildAvailabilityOptions(input,source=fetchPublicBookingAvailability){
  const {arrival,departure,guests}=input||{};
  if(!validDate(arrival)||!validDate(departure)||new Date(departure+'T00:00:00Z')<=new Date(arrival+'T00:00:00Z')) throw Error('Pontos, érvényes érkezési és távozási dátum szükséges.');
  if(!Number.isInteger(guests)||guests<1||guests>40) throw Error('Érvényes összlétszám szükséges.');

  const mapped=Object.entries(BUSINESS.accommodationTypes)
    .filter(([,x])=>x.bookingName)
    .map(([key,x])=>({key,label:x.label,capacity:x.maxGuests,units:Math.max(Math.ceil(guests/x.maxGuests),Math.ceil(guests/x.maxAdults))}))
    .filter(x=>x.units>=1&&x.units<=10);

  const checked=await Promise.all(mapped.map(async option=>{
    try{
      const result=await source({arrival,departure,cabin:option.key});
      const enough=result.availability==='available'&&Number(result.availableUnits)>=option.units;
      return {...option,availability:enough?'available':'unavailable',availableUnits:Number(result.availableUnits)||0,checkedAt:result.checkedAt||null,source:result.source||null,availability_verified:true};
    }catch(error){
      return {...option,availability:'unverified',availableUnits:null,availability_verified:false,error:error.message};
    }
  }));

  return {
    status:'review_required',
    arrival,departure,guests,
    available_options:checked.filter(x=>x.availability==='available'),
    unavailable_options:checked.filter(x=>x.availability==='unavailable'),
    unverified_options:checked.filter(x=>x.availability==='unverified'),
    manual_review_options:splitCapacityOptions(guests),
    bookingCompleted:false
  };
}

export async function handleAvailabilityOptions(request,source=fetchPublicBookingAvailability,enabled=false){
  if(request.method!=='POST')return Response.json({error:'POST szükséges.'},{status:405});
  if(!enabled)return Response.json({status:'unverified',error:'Élő kapacitás-ellenőrzés csak a külön Sárberki tesztoldalon engedélyezett.'},{status:503,headers:{'cache-control':'no-store'}});
  try{
    if(Number(request.headers.get('content-length')||0)>4096)throw Error('Túl nagy kérés.');
    const raw=await request.text(); if(raw.length>4096)throw Error('Túl nagy kérés.');
    const parsed=JSON.parse(raw);
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||Object.keys(parsed).some(k=>!['arrival','departure','guests'].includes(k))) throw Error('Csak dátum és összlétszám küldhető.');
    const result=await buildAvailabilityOptions({arrival:parsed.arrival,departure:parsed.departure,guests:Number(parsed.guests)},source);
    return Response.json(result,{headers:{'cache-control':'no-store'}});
  }catch(error){
    return Response.json({status:'unverified',error:'HITELES KAPACITÁSELLENŐRZÉS SZÜKSÉGES · '+error.message},{status:503,headers:{'cache-control':'no-store'}});
  }
}

export default request=>handleAvailabilityOptions(request,fetchPublicBookingAvailability,isLiveAvailabilityEnabled(request));
