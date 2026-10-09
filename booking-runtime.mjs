import {createCapacityClient,capacityInput,canPriceOption,stageFacts,selectedCapacityOptions} from './booking-filter.mjs';
import {createBookingCaseStore} from './booking-cases.mjs';
export function createBookingRuntime({request,storage=null,clock=Date.now,tenantId='sarberki'}={}){
 const client=createCapacityClient(request,{clock,tenantId});
 const cases=createBookingCaseStore({storage,tenantId});
 return {cases,metrics:client.metrics,input:capacityInput,selected:selectedCapacityOptions,
  async check(values,text='',options={}){if(Object.entries(stageFacts(values)).some(([k,f])=>['arrival','departure','guests','adults','children','units_requested'].includes(k)&&f.status==='contradictory'))throw Error('Ellentmondásos vendéglétszám; kapacitás nem igazolható.');return client.check(capacityInput(values,text),options);},
  async beforePrice(input){
   const key=input.cabin==='splitA'||input.cabin==='splitB'?'splitAB':input.cabin;
   const placement=key==='splitAB'?{ab:input.units||1,c:0,adjacent:false,exactIds:[]}:key==='splitC'?{ab:0,c:input.units||1,adjacent:false,exactIds:[]}:undefined;
   const query={arrival:input.arrival,departure:input.departure,guests:input.adults+input.children.length,adults:input.adults,cabin:input.cabin,units:input.units||1,fallback:false,...(placement?{placement}:{})};
   const data=await client.check(query);
   if(!canPriceOption(data,key,input.units||1))throw Error('A kért szállás kapacitása nem igazoltan elérhető; árlekérés nem történt.');return data;
  },
  async beforeApproval(values,text=''){
   if(Object.values(stageFacts(values)).some(f=>f.status==='contradictory'))throw Error('Ellentmondásos vendéglétszám.');
   const data=await client.check(capacityInput(values,text),{force:true});
   const selected=selectedCapacityOptions(data,capacityInput(values,text));
   return {data,allowed:selected.some(x=>x.availability_verified===true&&x.availability==='available')};
  }
 };
}
if(typeof window!=='undefined'){
 let storage=null;try{storage=window.localStorage;}catch{}
 window.SarberkiBookingRuntime=createBookingRuntime({storage,request:async input=>{
  const response=await fetch('/api/availability-options',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input),cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'Kapacitásellenőrzési hiba.');return data;
 }});
}
