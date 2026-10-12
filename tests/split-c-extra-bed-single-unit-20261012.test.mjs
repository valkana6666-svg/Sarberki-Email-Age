import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAvailabilityOptions} from '../netlify/functions/availability-options.mjs';
import {availabilitySentence} from '../availability-recommend.mjs';
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
   const option=result.available_options.find(x=>x.key==='splitC'&&x.units===1);
   assert.equal(option.nominalGuests,4);
   assert.equal(option.extraBedRequired,guests===5);
   assert.equal(option.extraBedPlacementRequiresConfirmation,guests===5);
   assert.equal(option.extraBedFeeVerified,false);
  }else{
   assert.equal(calls.includes('splitC'),false);
   assert.equal(calls.includes('splitA'),false);
   assert.equal(result.available_options.some(x=>x.key==='splitC'||x.key==='splitCombination'||x.key==='splitAB'),false);
  }
 });
}

for(const [language,pattern] of [['hu',/ötödik fő részére pótágy/u],['de',/fünfte Person.*Zustellbett/u],['en',/extra bed.*fifth guest/u],['si',/petega gosta.*dodatno ležišče/u]]){
 test(`five-person C reply discloses extra bed in ${language}`,async()=>{
  const result=await buildAvailabilityOptions({arrival:'2026-11-20',departure:'2026-11-22',guests:5,adults:5},source([]),{now:()=>now.getTime()});
  const reply=availabilitySentence(result,language);
  assert.match(reply,pattern);
  assert.doesNotMatch(reply,/\b(?:7|8|9|10)[ABC]\b/u);
 });
}

test('single-unit five-person request has no unsolicited multi-unit review plans',async()=>{
 const result=await buildAvailabilityOptions({arrival:'2026-11-20',departure:'2026-11-22',guests:5,adults:5},source([]),{now:()=>now.getTime()});
 assert.ok(result.available_options.some(x=>x.key==='splitC'&&x.units===1));
 assert.equal(result.available_options.some(x=>x.units>1),false);
 assert.equal(result.manual_review_options.some(x=>x.units.length>1),false);
});
test('explicit A+C request still permits verified two-unit split plan',async()=>{
 const result=await buildAvailabilityOptions({arrival:'2026-11-20',departure:'2026-11-22',guests:6,adults:6,cabin:'split',units:2,placement:{ab:1,c:1,adjacent:false,exactIds:[]}},source([]),{now:()=>now.getTime()});
 assert.ok(result.available_options.some(x=>x.key==='splitCombination'&&x.requiredAB===1&&x.requiredC===1));
});

for(const guests of [3,4,5]){
 test(`${guests} adults without multi-unit request never receive multiple split apartments`,async()=>{
  const result=await buildAvailabilityOptions({arrival:'2026-11-20',departure:'2026-11-22',guests,adults:guests},source([]),{now:()=>now.getTime()});
  for(const category of ['available_options','unavailable_options','unverified_options']){
   assert.ok(result[category].every(x=>x.units===1),`${category} must only contain single units`);
  }
  assert.ok(result.manual_review_options.every(x=>x.units.length===1));
 });
}

for(const guests of [3,4,5]){
 test(`${guests} adults: no unnecessary two-person A/B pool request`,async()=>{
  const calls=[];
  await buildAvailabilityOptions({arrival:'2026-11-20',departure:'2026-11-22',guests,adults:guests},source(calls),{now:()=>now.getTime()});
  assert.equal(calls.includes('splitA'),false);
  assert.ok(calls.includes('splitC'));
 });
}
test('two adults can still query A/B single apartment pool',async()=>{
 const calls=[];
 await buildAvailabilityOptions({arrival:'2026-11-20',departure:'2026-11-22',guests:2,adults:2},source(calls),{now:()=>now.getTime()});
 assert.ok(calls.includes('splitA'));
});

for(const guests of [1,2]){
 test(`${guests} adult request skips unnecessary C pool and does not expose unverified C`,async()=>{
  const calls=[];
  const result=await buildAvailabilityOptions({arrival:'2026-11-20',departure:'2026-11-22',guests,adults:guests},source(calls),{now:()=>now.getTime()});
  assert.equal(calls.includes('splitC'),false);
  assert.ok(calls.includes('splitA'));
  assert.equal(result.unverified_options.some(x=>x.key==='splitC'),false);
 });
}
