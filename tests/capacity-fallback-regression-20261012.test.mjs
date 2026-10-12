import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAvailabilityOptions} from '../netlify/functions/availability-options.mjs';
const now=new Date('2026-10-12T08:00:00Z');
const input={arrival:'2026-11-20',departure:'2026-11-22',guests:2,adults:2,cabin:'deluxe',units:1};
const fixture=(status,calls)=>async ({cabin,...q})=>{
 calls.push(cabin);
 if(cabin==='deluxe'&&status==='unknown')throw Error('SYNTHETIC_TIMEOUT');
 const availableUnits=cabin==='deluxe'?(status==='available'?1:0):1;
 return {...q,cabin,availability:availableUnits?'available':'unavailable',availableUnits,checkedAt:now.toISOString(),source:'SYNTHETIC_PREVIO'};
};
for(const status of ['available','unavailable','unknown']){
 test(`requested deluxe ${status}: fallback query discipline`,async()=>{
  const calls=[];
  const r=await buildAvailabilityOptions(input,fixture(status,calls),{now:()=>now.getTime()});
  assert.equal(calls.filter(x=>x==='deluxe').length,1);
  if(status==='available'){
   assert.deepEqual(calls,['deluxe']);
   assert.ok(r.available_options.some(x=>x.key==='deluxe'));
  }else if(status==='unknown'){
   assert.deepEqual(calls,['deluxe']);
   assert.ok(r.unverified_options.some(x=>x.key==='deluxe'));
   assert.equal(r.available_options.length,0);
  }else{
   assert.ok(calls.length>1);
   assert.ok(calls.includes('family'));
   assert.ok(calls.includes('vip'));
   assert.equal(calls.includes('splitC'),false);
   assert.ok(r.unavailable_options.some(x=>x.key==='deluxe'));
  }
 });
}
test('without a specified type, search all suitable cabin families',async()=>{
 const calls=[];
 const {cabin,...openInput}=input;
 const r=await buildAvailabilityOptions(openInput,fixture('available',calls),{now:()=>now.getTime()});
 for(const key of ['vip','family','deluxe','small','splitA'])assert.ok(calls.includes(key),key);
 assert.equal(calls.includes('splitC'),false);
 assert.ok(r.available_options.length>0);
});
