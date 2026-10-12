import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAvailabilityOptions} from '../netlify/functions/availability-options.mjs';
const now=new Date('2026-10-12T08:00:00Z');
const source=calls=>async ({cabin,...q})=>{
 calls.push(cabin);
 return {...q,cabin,availability:'available',availableUnits:2,checkedAt:now.toISOString(),source:'SYNTHETIC_PREVIO'};
};
for(const guests of [4,5,6]){
 test(`${guests} guests: C extra-bed eligibility and no unsolicited split combination`,async()=>{
  const calls=[];
  const result=await buildAvailabilityOptions({arrival:'2026-11-20',departure:'2026-11-22',guests,adults:guests},source(calls),{now:()=>now.getTime()});
  if(guests<=5){
   assert.ok(calls.includes('splitC'));
   assert.ok(result.available_options.some(x=>x.key==='splitC'&&x.units===1));
  }else{
   assert.equal(calls.includes('splitC'),false);
   assert.equal(calls.includes('splitA'),false);
   assert.equal(result.available_options.some(x=>x.key==='splitC'||x.key==='splitCombination'||x.key==='splitAB'),false);
  }
 });
}
