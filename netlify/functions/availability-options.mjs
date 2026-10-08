import {wholeCabinCandidates,validateCapacityResult,capacityKey} from '../../booking-filter.mjs';
import {fetchPublicBookingAvailability} from '../../price-source/sarberki-public-booking.mjs';
import {splitCapacityOptions as buildSplitCapacityOptions} from '../../split-units.mjs';

const LIVE_TEST_HOSTS=new Set(['leafy-chimera-2403e5.netlify.app']);

export function isLiveAvailabilityEnabled(request){
  try{return LIVE_TEST_HOSTS.has(new URL(request.url).hostname);}catch{return false;}
}

function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(+new Date(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}

const checkedCapacity=validateCapacityResult;

export function splitCapacityOptions(guests,poolChecks={}){
  return buildSplitCapacityOptions(guests,poolChecks);
}

export async function buildAvailabilityOptions(input,source=fetchPublicBookingAvailability){
  const {arrival,departure,guests}=input||{};
  if(!validDate(arrival)||!validDate(departure)||new Date(departure+'T00:00:00Z')<=new Date(arrival+'T00:00:00Z')) throw Error('Pontos, érvényes érkezési és távozási dátum szükséges.');
  if(!Number.isInteger(guests)||guests<1||guests>40) throw Error('Érvényes összlétszám szükséges.');

  if(input.adults!=null&&(!Number.isInteger(input.adults)||input.adults<1||input.adults>guests))throw Error('Érvénytelen felnőttlétszám.');
  if(input.units!=null&&(!Number.isInteger(input.units)||input.units<1||input.units>10))throw Error('Érvénytelen egységszám.');
  if(input.cabin!=null&&!['vip','family','deluxe','small','split','splitA','splitB','splitC'].includes(input.cabin))throw Error('Ismeretlen háztípus.');
  if(input.placement!=null){
    const p=input.placement;
    if(!p||!Number.isInteger(p.ab)||p.ab<0||p.ab>8||!Number.isInteger(p.c)||p.c<0||p.c>4||typeof p.adjacent!=='boolean'||!Array.isArray(p.exactIds)||p.exactIds.some(id=>! /^(?:7|8|9|10)[ABC]$/.test(id))||new Set(p.exactIds).size!==p.exactIds.length)throw Error('Érvénytelen osztott elhelyezési igény.');
    if(input.units!=null&&p.ab+p.c>0&&input.units!==p.ab+p.c)throw Error('Az apartmanszám és az elhelyezési kombináció ellentmondásos.');
  }
  const {candidates,rejected}=wholeCabinCandidates(input);
  const mapped=input.cabin?candidates.filter(x=>x.key===input.cabin):candidates;

  const checkOption=async option=>{
    try{
      const result=checkedCapacity(await source({arrival,departure,cabin:option.key}),{arrival,departure,cabin:option.key});
      const enough=result.availability==='available'&&Number(result.availableUnits)>=option.units;
      return {...option,availability:enough?'available':'unavailable',availableUnits:Number(result.availableUnits)||0,checkedAt:result.checkedAt||null,source:result.source||null,availability_verified:true};
    }catch(error){
      return {...option,availability:'unverified',availableUnits:null,availability_verified:false,error:error.message};
    }
  };
  const checked=await Promise.all(mapped.map(checkOption));
  if(input.cabin&&!input.cabin.startsWith('split')&&input.fallback!==false&&!checked.some(x=>x.availability==='available'))checked.push(...await Promise.all(candidates.filter(x=>x.key!==input.cabin).map(checkOption)));

  const checkPool=async cabin=>{
    try{
      const result=checkedCapacity(await source({arrival,departure,cabin}),{arrival,departure,cabin});
      return {verified:true,availability:result.availability,availableUnits:Number(result.availableUnits)||0,checkedAt:result.checkedAt||null,source:result.source||null};
    }catch(error){
      return {verified:false,availability:'unverified',availableUnits:null,error:error.message};
    }
  };
  const splitNeeded=!input.cabin||input.cabin.startsWith('split')||input.fallback!==false&&!checked.some(x=>x.key===input.cabin&&x.availability==='available');
  const unknown={verified:false,availability:'unverified',availableUnits:null,reason:'not_requested'};
  const placement=input.placement||null;
  const [splitAB,splitC]=await Promise.all([splitNeeded&&(!placement||placement.ab>0)?checkPool('splitA'):unknown,splitNeeded&&(!placement||placement.c>0)?checkPool('splitC'):unknown]);
  const split_pool_checks={splitAB,splitC};
  // One upper apartment needs only a verified C pool. No physical pairing is claimed.
  if(splitNeeded&&guests<=4&&(!placement||placement.c===1&&placement.ab===0)&&!placement?.adjacent&&!placement?.exactIds?.length){
    checked.push({key:'splitC',label:'Osztott C (emeleti apartman)',capacity:4,units:1,
      availability:splitC.verified?splitC.availability:'unverified',availableUnits:splitC.availableUnits,
      checkedAt:splitC.checkedAt||null,source:splitC.source||null,availability_verified:splitC.verified,
      verification_scope:'type_pool',individual_unit_mapping_verified:false});
  }

  const request=placement?{kind:placement.exactIds?.length?'exact':'mixed',requestedAB:placement.ab,requestedC:placement.c,exactUnitIds:placement.exactIds||[],requiresAdjacent:placement.adjacent===true}:null;
  const plans=splitNeeded?buildSplitCapacityOptions(guests,split_pool_checks,request):[];
  for(const plan of plans){
    const pools=[[plan.requiredAB,splitAB],[plan.requiredC,splitC]].filter(([n])=>n>0);
    const unavailable=pools.some(([n,pool])=>pool.verified&&pool.availableUnits<n);
    const enough=plan.capacity>=guests;
    const availability=!enough||unavailable?'unavailable':plan.availability;
    if(plan.requiredC===1&&!plan.requiredAB&&checked.some(x=>x.key==='splitC'))continue;
    checked.push({...plan,key:plan.requiredC&&!plan.requiredAB?'splitC':plan.requiredAB&&!plan.requiredC?'splitAB':'splitCombination',units:plan.units.length,availability,availability_verified:availability!=='unverified',availableUnits:plan.requiredAB&&!plan.requiredC?splitAB.availableUnits:plan.requiredC&&!plan.requiredAB?splitC.availableUnits:null});
  }
  const excluded_options=rejected.filter(x=>!input.cabin||x.key===input.cabin);
  const checkedAt=new Date().toISOString();

  return {
    status:'review_required',
    arrival,departure,guests,checkedAt,fingerprint:capacityKey(input),excluded_options,
    available_options:checked.filter(x=>x.availability==='available'),
    unavailable_options:checked.filter(x=>x.availability==='unavailable'),
    unverified_options:checked.filter(x=>x.availability==='unverified'),
    split_pool_checks,
    manual_review_options:plans.filter(x=>!x.availability_verified),
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
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||Object.keys(parsed).some(k=>!['arrival','departure','guests','adults','cabin','units','placement','fallback'].includes(k))) throw Error('Csak személyes adatot nem tartalmazó kapacitásfeltételek küldhetők.');
    if(parsed.placement){const p=parsed.placement;if(typeof p!=='object'||Object.keys(p).some(k=>!['ab','c','adjacent','exactIds'].includes(k))||![p.ab,p.c].every(n=>Number.isInteger(n)&&n>=0&&n<=8)||typeof p.adjacent!=='boolean'||!Array.isArray(p.exactIds)||p.exactIds.length>12||p.exactIds.some(id=>!/^(7|8|9|10)[ABC]$/.test(id)))throw Error('Érvénytelen elhelyezési feltételek.');}
    const result=await buildAvailabilityOptions({...parsed,guests:Number(parsed.guests)},source);
    return Response.json(result,{headers:{'cache-control':'no-store'}});
  }catch(error){
    return Response.json({status:'unverified',error:'HITELES KAPACITÁSELLENŐRZÉS SZÜKSÉGES · '+error.message},{status:503,headers:{'cache-control':'no-store'}});
  }
}

export default request=>handleAvailabilityOptions(request,fetchPublicBookingAvailability,isLiveAvailabilityEnabled(request));
