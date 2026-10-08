import {BUSINESS} from './business-config.mjs';
import {splitRequestFromText} from './split-units.mjs';

export const CAPACITY_STATUS=Object.freeze({AVAILABLE:'available',UNAVAILABLE:'unavailable',UNVERIFIED:'unverified'});
export const CAPACITY_TTL_MS=120000;
const positive=v=>Number.isInteger(Number(v))&&Number(v)>0?Number(v):null;
export function cabinKey(value=''){
 if(Object.hasOwn(BUSINESS.accommodationTypes,value))return value;
 if(/deluxe/iu.test(value))return 'deluxe';if(/családi|family/iu.test(value))return 'family';if(/vip/iu.test(value))return 'vip';if(/különálló|small/iu.test(value))return 'small';if(/osztott|split/iu.test(value))return 'split';return null;
}
export function capacityInput(values={},text=''){
 const guests=positive(values.guests)||(positive(values.adults)!=null&&values.children!==''&&values.children!=null?Number(values.adults)+Number(values.children):null);
 const split=splitRequestFromText(values.split_request_text||text);
 return {arrival:values.arrival||'',departure:values.departure||'',guests,
  ...(positive(values.adults)?{adults:Number(values.adults)}:{}),
  ...(cabinKey(values.unit)?{cabin:cabinKey(values.unit)}:{}),
  ...(positive(values.units_requested)?{units:Number(values.units_requested)}:{}),
  ...(split.isSplit?{placement:{ab:split.requestedAB,c:split.requestedC,adjacent:split.requiresAdjacent===true,exactIds:split.exactUnitIds||[]}}:{})};
}
export function capacityKey(input={}){
 return JSON.stringify([input.arrival,input.departure,input.guests,input.adults??null,input.cabin??null,input.units??null,input.placement??null,input.fallback??true]);
}
export function capacityFresh(result,input,now=Date.now(),ttl=CAPACITY_TTL_MS){
 const age=now-Date.parse(result?.checkedAt||'');
 return result?.fingerprint===capacityKey(input)&&Number.isFinite(age)&&age>=0&&age<=ttl;
}
export function stageFacts(values={}){
 const keys=['arrival','departure','guests','adults','children','child_ages','unit','units_requested','phone'];
 const facts=Object.fromEntries(keys.map(k=>[k,{value:values[k]??'',status:values[k]!==''&&values[k]!=null?'known':'missing'}]));
 const g=positive(values.guests),a=positive(values.adults),c=values.children===''||values.children==null?null:Number(values.children);
 if(g&&a&&c!=null&&g!==a+c)for(const k of ['guests','adults','children'])facts[k].status='contradictory';
 if(values.unit&&String(values.unit).startsWith('?'))facts.unit.status='clarify';
 return facts;
}
export function validateCapacityResult(result,input){
 if(!result||!['available','unavailable'].includes(result.availability)||!Number.isSafeInteger(result.availableUnits)||result.availableUnits<0
 ||(result.availability==='available')!==(result.availableUnits>0)
 ||(result.arrival!=null&&result.arrival!==input.arrival)||(result.departure!=null&&result.departure!==input.departure)||(result.cabin!=null&&result.cabin!==input.cabin))throw Error('A forrás nem adott konzisztens kapacitásbizonyítékot.');
 return result;
}
export function wholeCabinCandidates(input){
 const rejected=[],candidates=[];
 for(const [key,type]of Object.entries(BUSINESS.accommodationTypes)){
  if(!type.bookingName)continue;
  const units=input.units||Math.max(Math.ceil(input.guests/type.maxGuests),Math.ceil((input.adults||input.guests)/type.maxAdults));
  const stock=type.physicalHouseNumbers?.length||0;
  if(units>stock||input.guests>units*type.maxGuests||(input.adults||input.guests)>units*type.maxAdults){rejected.push({key,availability:'unavailable',reason:'capacity_incompatible',units});continue;}
  candidates.push({key,label:type.label,capacity:type.maxGuests,units});
 }
 return {candidates,rejected};
}
export function canPriceOption(result,key,units=1){
 return (result?.available_options||[]).some(x=>x.key===key&&x.availability_verified===true&&x.availability==='available'&&x.units>=units);
}
// One client coordinator owns coalescing and freshness; failed requests are never cached.
export function createCapacityClient(request,{clock=Date.now,ttl=CAPACITY_TTL_MS}={}){
 const cache=new Map(),pending=new Map();const metrics={requests:0,reused:0,coalesced:0};
 return {metrics,clear(){cache.clear();},async check(input,{force=false}={}){
  const key=capacityKey(input),old=cache.get(key);
  if(!force&&capacityFresh(old,input,clock(),ttl)){metrics.reused++;return old;}
  if(pending.has(key)){metrics.coalesced++;return pending.get(key);}
  metrics.requests++;
  const operation=(async()=>{
   const result=await request(input);
   if(result.arrival!==input.arrival||result.departure!==input.departure||result.guests!==input.guests||!Array.isArray(result.available_options)||!Array.isArray(result.unverified_options)||!Array.isArray(result.unavailable_options))throw Error('Eltérő vagy hiányos kapacitásválasz.');
   if(result.available_options.some(x=>x.availability_verified!==true||x.availability!=='available'||!Number.isInteger(x.units)||x.units<1))throw Error('Nem igazolt lehetőség került a szabad készletbe.');
   const bound={...result,fingerprint:key,checkedAt:result.checkedAt||new Date(clock()).toISOString()};cache.set(key,bound);return bound;
  })();pending.set(key,operation);try{return await operation;}finally{pending.delete(key);}
 }};
}
