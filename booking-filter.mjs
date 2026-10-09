import {normalizeAvailability} from './shared-core/availability-model.mjs';
import {SARBERKI_TENANT} from './tenant-config.mjs';
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
 const cabin=cabinKey(values.unit);
 const isSplit=cabin==='split'||cabin?.startsWith('split');
 let split=isSplit?splitRequestFromText((values.split_request_text||text)+' '+(values.request||'')):{isSplit:false};
 const units=positive(values.units_requested);
 const reviewed=String(values.unit||'');
 if(cabin==='splitC'||/osztott\s+(?:faház\s+)?C\b/iu.test(reviewed))split={...split,isSplit:true,requestedAB:0,requestedC:units||1};
 else if(cabin==='splitA'||cabin==='splitB'||/osztott\s+(?:A|B)\b/iu.test(reviewed)&&!/A\s*\+\s*B/iu.test(reviewed))split={...split,isSplit:true,requestedAB:units||1,requestedC:0};
 if(units&&split.isSplit&&!split.exactUnitIds?.length){
  if(split.requestedAB>0&&!split.requestedC)split.requestedAB=units;
  else if(split.requestedC>0&&!split.requestedAB)split.requestedC=units;
 }

 return {arrival:values.arrival||'',departure:values.departure||'',guests,
  ...(positive(values.adults)?{adults:Number(values.adults)}:{}),
  ...(cabin?{cabin}:{}),
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
 const keys=['arrival','departure','nights','guests','adults','children','child_ages','unit','units_requested','phone','request'];
 const facts=Object.fromEntries(keys.map(k=>[k,{value:values[k]??'',status:values[k]!==''&&values[k]!=null?'known':'missing'}]));
 const invalid=k=>{facts[k].status='contradictory';};
 for(const k of ['guests','adults','units_requested','nights'])if(facts[k].status==='known'&&(!Number.isSafeInteger(Number(values[k]))||Number(values[k])<1))invalid(k);
 if(facts.children.status==='known'&&(!Number.isSafeInteger(Number(values.children))||Number(values.children)<0))invalid('children');
 const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 for(const k of ['arrival','departure'])if(facts[k].status==='known'&&!validDate(values[k]))invalid(k);
 if(validDate(values.arrival)&&validDate(values.departure)){
  const nights=(Date.parse(values.departure)-Date.parse(values.arrival))/86400000;
  if(nights<=0){invalid('arrival');invalid('departure');}
  if(facts.nights.status==='known'&&Number(values.nights)!==nights)invalid('nights');
 }
 const g=positive(values.guests),a=positive(values.adults),c=values.children===''||values.children==null?null:Number(values.children);
 if(g&&a&&c!=null&&g!==a+c)for(const k of ['guests','adults','children'])invalid(k);
 if(facts.child_ages.status==='known'){
  const ages=String(values.child_ages).split(',').map(x=>x.trim());
  if(ages.some(x=>!/^\d{1,2}$/.test(x)||Number(x)>17)||c!=null&&ages.length>c)invalid('child_ages');
  else if(c!=null&&ages.length<c)facts.child_ages.status='clarify';
 }
 if(values.unit&&String(values.unit).startsWith('?'))facts.unit.status='clarify';

 return facts;
}
export function validateCapacityResult(result,input){
 if(!result||!['available','unavailable'].includes(result.availability)||!Number.isSafeInteger(result.availableUnits)||result.availableUnits<0
 ||(result.availability==='available')!==(result.availableUnits>0)
 ||(result.arrival!=null&&result.arrival!==input.arrival)||(result.departure!=null&&result.departure!==input.departure)||(result.cabin!=null&&result.cabin!==input.cabin))throw Error('A forrás nem adott konzisztens kapacitásbizonyítékot.');
 const evidence=normalizeAvailability({...input,...result},input,{tenantId:SARBERKI_TENANT.id});
 if(!evidence.valid)throw Error('Nem aktuális kapacitásbizonyíték: '+evidence.error);
 return {...result,evidence};
}
export function wholeCabinCandidates(input){
 const rejected=[],candidates=[];
 for(const [key,type]of Object.entries(BUSINESS.accommodationTypes)){
  if(!type.bookingName)continue;
  const verifiedCapacity=Math.min(...SARBERKI_TENANT.inventory.filter(x=>x.type===key).map(x=>x.capacity));
  const units=input.units||Math.max(Math.ceil(input.guests/verifiedCapacity),Math.ceil((input.adults||input.guests)/verifiedCapacity));
  const stock=type.physicalHouseNumbers?.length||0;
  if(units>stock||input.guests>units*verifiedCapacity||(input.adults||input.guests)>units*verifiedCapacity){rejected.push({key,availability:'unavailable',reason:'capacity_incompatible',units});continue;}
  candidates.push({key,label:type.label,capacity:verifiedCapacity,units});
 }
 return {candidates,rejected};
}
export function canPriceOption(result,key,units=1){
 return (result?.available_options||[]).some(x=>x.key===key&&x.availability_verified===true&&x.availability==='available'&&x.units>=units);
}
// One client coordinator owns coalescing and freshness; failed requests are never cached.
export function createCapacityClient(request,{clock=Date.now,ttl=CAPACITY_TTL_MS,tenantId='sarberki'}={}){
 const cache=new Map(),pending=new Map();const metrics={requests:0,reused:0,coalesced:0};
 return {metrics,clear(){cache.clear();},async check(input,{force=false}={}){
  const facts=stageFacts({arrival:input.arrival,departure:input.departure,guests:input.guests});
  if(['arrival','departure','guests'].some(k=>facts[k].status!=='known'))throw Error('Pontos, érvényes időszak és létszám szükséges a kapacitásellenőrzéshez.');
  const key=capacityKey(input),old=cache.get(key);
  if(!force&&capacityFresh(old,input,clock(),ttl)){metrics.reused++;return old;}
  if(pending.has(key)){metrics.coalesced++;return pending.get(key);}
  metrics.requests++;
  const operation=(async()=>{
   const result=await request(input);
   if(result.tenantId&&result.tenantId!==tenantId)throw Error('Idegen vállalkozás kapacitásválasza.');
   if(result.arrival!==input.arrival||result.departure!==input.departure||result.guests!==input.guests||!Array.isArray(result.available_options)||!Array.isArray(result.unverified_options)||!Array.isArray(result.unavailable_options))throw Error('Eltérő vagy hiányos kapacitásválasz.');
   if(result.available_options.some(x=>x.availability_verified!==true||x.availability!=='available'||!Number.isInteger(x.units)||x.units<1))throw Error('Nem igazolt lehetőség került a szabad készletbe.');
   if(!capacityFresh({...result,fingerprint:key},input,clock(),ttl))throw Error('Lejárt vagy hiányzó kapacitásbizonyíték.');
   const bound={...result,fingerprint:key};cache.set(key,bound);return bound;
  })();pending.set(key,operation);try{return await operation;}finally{pending.delete(key);}
 }};
}

// Shared selector: the UI and approval consume the server decision, never recompute pools.
export function selectedCapacityOptions(result,input={}){
 const rows=(result?.available_options||[]).filter(x=>x.availability==='available'&&x.availability_verified===true);
 if(!input.cabin)return rows;
 if(input.cabin==='split')return rows.filter(x=>x.key?.startsWith('split'));
 if(['splitA','splitB'].includes(input.cabin))return rows.filter(x=>x.key==='splitAB');
 return rows.filter(x=>x.key===input.cabin);
}
