// Server-only. Split houses 7-8-9-10 (owner 2026-11-12): when a guest asks for split units in the SAME house
// ("A és B egymás mellett", "egy osztott faház A és B apartmanja") or in NEIGHBOURING houses ("egymás mellett"),
// the type-level pool cannot prove it (AGENTS). One READ-ONLY Previo call (XML Hotel.searchReservations, 73521 only)
// gives every reservation overlapping the stay; each split unit (7/A … 10/C) is free when no active reservation
// (status other than 7 storno / 8 no-show) holds its objId. Physical order 7-8-9-10 in a row (owner 2026-11-12):
// neighbours are consecutive house numbers. No write, no personal data kept.
import {PREVIO_TEST_73521} from './previo-booking-intent.mjs';
import {reservationsFromXml,unitSearchXml} from './server-previo-unit-check.mjs';
import {CAPACITY_AVAILABLE_LINE} from './inquiry-channel-adapters.mjs';

export const SPLIT_HOUSE_ORDER=Object.freeze(['7','8','9','10']);
const FREEING=new Set([7,8]);
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x);
const unitsOf=house=>({ab:[house+'/A',house+'/B'],c:[house+'/C']});

// Pure: free unit ids + need -> placement. mode 'same-house' | 'adjacent' | 'any'.
// 'adjacent': the chosen units' houses form a gap-free run of consecutive houses (one house first, then the shortest
// run); 7 and 9 with 8 between them are NOT neighbours. 'same-house': one house only.
export function planSplitPlacement(free,{ab=0,c=0,mode='any'}={},order=SPLIT_HOUSE_ORDER){
 if(!(ab+c>0)||ab+c>order.length*3)return {status:'unknown'};
 const units=order.flatMap((h,i)=>[...unitsOf(h).ab.map(id=>({id,i,kind:'ab'})),...unitsOf(h).c.map(id=>({id,i,kind:'c'}))]).filter(u=>free.has(u.id));
 const firstAny=()=>{const a=units.filter(u=>u.kind==='ab').slice(0,ab),b=units.filter(u=>u.kind==='c').slice(0,c);return a.length===ab&&b.length===c?[...a,...b].map(u=>u.id):null;};
 if(mode==='any'){const any=firstAny();return any?{status:'available',units:any,sameHouse:false}:{status:'unavailable'};}
 let best=null;
 const choose=(start,picked,nab,nc)=>{
  if(nab===ab&&nc===c){
   const houses=[...new Set(picked.map(u=>u.i))].sort((x,y)=>x-y),span=houses.at(-1)-houses[0]+1;
   const ok=mode==='same-house'?houses.length===1:span===houses.length;
   if(ok&&(!best||span<best.span))best={span,units:picked.map(u=>u.id)};return;
  }
  for(let k=start;k<units.length;k++){const u=units[k];
   if(u.kind==='ab'&&nab<ab)choose(k+1,[...picked,u],nab+1,nc);else if(u.kind==='c'&&nc<c)choose(k+1,[...picked,u],nab,nc+1);}
 };
 choose(0,[],0,0);
 if(best)return {status:'available',units:best.units,sameHouse:best.span===1};
 const any=firstAny();
 return {status:'unavailable',alternative:any?{units:any}:null};
}

export async function readSplitFreeUnits({apiKey,arrival,departure,property=PREVIO_TEST_73521,fetchImpl=globalThis.fetch,timeoutMs=8000}={}){
 if(String(property?.hotelId)!=='73521'||!day(arrival)||!day(departure)||departure<=arrival)return {status:'unknown'};
 if(typeof apiKey!=='string'||!/^[A-Za-z0-9._~+/=-]{16,512}$/.test(apiKey))return {status:'unknown'};
 const ids=SPLIT_HOUSE_ORDER.flatMap(h=>[...unitsOf(h).ab,...unitsOf(h).c]);
 if(ids.some(id=>!Number.isSafeInteger(property.rooms?.[id])))return {status:'unknown'};
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const r=await fetchImpl('https://api.previo.app/x1/hotel/searchReservations',{method:'POST',redirect:'error',cache:'no-store',signal:controller.signal,
   headers:{Authorization:'ApiKey '+apiKey,'Content-Type':'application/xml',Accept:'application/xml'},body:unitSearchXml({hotelId:property.hotelId,arrival,departure})});
  if(!r.ok)return {status:'unknown'};
  const text=await r.text();
  if(/<error>/.test(text)||!/<reservations/.test(text))return {status:'unknown'};
  const held=new Set(reservationsFromXml(text).filter(x=>!FREEING.has(x.statusId)&&x.from&&x.to&&x.from<departure&&x.to>arrival).map(x=>x.objId));
  return {status:'read',free:new Set(ids.filter(id=>!held.has(property.rooms[id])))};
 }catch{return {status:'unknown'};}
 finally{clearTimeout(timer);}
}

// Same owner switch as the other Level 1 reads (default off; 73521 only).
export function previoSplitPlacementReader(env,fetchImpl){
 if(env?.PREVIO_READ_API_ENABLED!=='sandbox-73521-only'||String(env?.PREVIO_HOTEL_ID)!=='73521')return null;
 return args=>readSplitFreeUnits({...args,apiKey:env.PREVIO_API_KEY,fetchImpl});
}

const DETAIL={
 hu:{terrace:'A két földszinti apartman közös terasszal rendelkezik.',same:'A kért egységek ugyanabban az osztott faházban vannak.',next:'A kért egységek egymás melletti osztott faházakban vannak.',
  noNear:'A kért időszakra sajnos nincs szabad, egymás melletti elhelyezésünk.',alt:'Külön faházakban lévő osztott egységeket tudunk ajánlani; kérjük, jelezze, ha ez megfelel.',
  none:'A kért időszakra sajnos nincs elegendő szabad osztott egységünk.'},
 de:{terrace:'Die beiden Apartments im Erdgeschoss teilen sich eine Terrasse.',same:'Die gewünschten Einheiten liegen im selben geteilten Haus.',next:'Die gewünschten Einheiten liegen in nebeneinanderliegenden geteilten Häusern.',
  noNear:'Für den gewünschten Zeitraum haben wir leider keine freie Unterbringung nebeneinander.',alt:'Wir können Einheiten in getrennten geteilten Häusern anbieten; bitte teilen Sie uns mit, ob das passt.',
  none:'Für den gewünschten Zeitraum haben wir leider nicht genügend freie geteilte Einheiten.'},
 en:{terrace:'The two ground-floor apartments share a terrace.',same:'The requested units are in the same split cabin.',next:'The requested units are in neighbouring split cabins.',
  noNear:'Unfortunately we have no free side-by-side placement for the requested dates.',alt:'We can offer split units in separate cabins; please let us know if this suits you.',
  none:'Unfortunately we do not have enough free split units for the requested dates.'},
 si:{terrace:'Apartmaja v pritličju si delita teraso.',same:'Želene enote so v isti deljeni hiški.',next:'Želene enote so v sosednjih deljenih hiškah.',
  noNear:'Za želeni termin žal nimamo proste namestitve drug ob drugem.',alt:'Ponudimo lahko deljene enote v ločenih hiškah; prosimo, sporočite, ali vam to ustreza.',
  none:'Za želeni termin žal nimamo dovolj prostih deljenih enot.'}
};
// Pure: placement -> guest sentence (starts with the standard "free" line when free, so the price step still
// finds its anchor) + operator note with the unit ids (never in the guest text).
export function splitPlacementSentence(plan,language='hu'){
 const lang=DETAIL[language]?language:'hu',t=DETAIL[lang];
 // Owner 2026-11-12: A and B share one ground-floor terrace - said when the free pair is A+B in one house.
 const abPair=plan?.sameHouse&&plan.units?.some(u=>u.endsWith('/A'))&&plan.units?.some(u=>u.endsWith('/B'));
 if(plan?.status==='available')return {guest:`${CAPACITY_AVAILABLE_LINE[lang]} ${plan.sameHouse?t.same:t.next}${abPair?' '+t.terrace:''}`,
  operator:`Previo (csak olvasó, egységszint): szabad elhelyezés ${plan.units.join(' + ')}${plan.sameHouse?' (azonos ház)':' (szomszédos házak)'}.`};
 if(plan?.status==='unavailable')return plan.alternative
  ?{guest:`${t.noNear} ${t.alt}`,operator:`Previo (csak olvasó, egységszint): azonos/szomszédos ház nem szabad; külön házakban szabad: ${plan.alternative.units.join(' + ')}.`}
  :{guest:t.none,operator:'Previo (csak olvasó, egységszint): nincs elég szabad osztott egység.'};
 return null;
}
