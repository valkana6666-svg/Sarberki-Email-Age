import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAvailabilityOptions} from '../netlify/functions/availability-options.mjs';
const at=Date.parse('2026-10-12T10:00:00Z');
const base={arrival:'2026-11-20',departure:'2026-11-22',adults:6};
async function check(input){const calls=[];const result=await buildAvailabilityOptions({...base,...input},async q=>{calls.push(q.cabin);return {...q,tenantId:'sarberki',source:'synthetic-fixture',checkedAt:new Date(at).toISOString(),availability:'available',availableUnits:2};},{now:()=>at});return {calls,result};}
for(const input of [{cabin:'splitC',guests:6,units:1},{cabin:'splitC',guests:6,units:1,placement:{ab:0,c:1,adjacent:false,exactIds:[]}},{cabin:'splitA',guests:3,adults:3,units:1},{cabin:'split',guests:8,units:2,placement:{ab:1,c:1,adjacent:false,exactIds:[]}}]){
 test('physically impossible requested split plan never queries external pools '+JSON.stringify(input),async()=>{const {calls,result}=await check(input);assert.deepEqual(calls,[]);assert.equal(result.available_options.length,0);assert.equal(result.bookingCompleted,false);});
}
test('fifth guest in explicitly requested single C uses one C check and preserves extra-bed warning',async()=>{const {calls,result}=await check({cabin:'splitC',guests:5,adults:5,units:1});assert.deepEqual(calls,['splitC']);assert.equal(result.available_options[0].units,1);assert.equal(result.available_options[0].extraBedRequired,true);assert.equal(result.available_options[0].extraBedFeeVerified,false);});
test('two explicitly requested C units retain exact unit count and query the C pool once',async()=>{const {calls,result}=await check({cabin:'splitC',guests:6,units:2});assert.deepEqual(calls,['splitC']);assert.equal(result.available_options.length,1);assert.equal(result.available_options[0].requiredC,2);assert.equal(result.available_options[0].units,2);});
test('physically suitable explicit mixed A+C plan still queries both required pools exactly once',async()=>{const {calls,result}=await check({cabin:'split',guests:6,units:2,placement:{ab:1,c:1,adjacent:false,exactIds:[]}});assert.deepEqual(calls,['splitA','splitC']);assert.ok(result.available_options.some(x=>x.key==='splitCombination'&&x.units===2));});
