import test from 'node:test';
import assert from 'node:assert/strict';
import {BUSINESS} from '../business-config.mjs';
import {wholeCabinCandidates,capacityInput} from '../booking-filter.mjs';
import {buildAvailabilityOptions} from '../netlify/functions/availability-options.mjs';

// Synthetic-only regressions. Never query live Previo or create a booking.
const dates={arrival:'2026-11-26',departure:'2026-11-28'};
const input=(guests,cabin,units=1)=>capacityInput({...dates,guests,adults:guests,children:0,unit:cabin,units_requested:units});
test('deposit remains 50% on both sides of 15-guest boundary',()=>{
 assert.equal(BUSINESS.bookingRules.depositPctUnder15Guests,50);
 assert.equal(BUSINESS.bookingRules.depositPctFrom15Guests,50);
 assert.equal(BUSINESS.bookingRules.depositDueDays,10);
});
test('nine guests requesting one family house cannot silently become two',async()=>{
 const i=input(9,'family');
 assert.equal(i.units,1);
 assert.equal(wholeCabinCandidates(i).candidates.some(x=>x.key==='family'),false);
 let calls=0;
 const result=await buildAvailabilityOptions(i,async()=>{calls++;throw Error('Unexpected capacity call');});
 assert.equal(calls,0);
 assert.equal(result.available_options.length,0);
});
test('six guests requesting one split C cannot be offered that unit',async()=>{
 const i=input(6,'splitC');
 const calls=[];
 const result=await buildAvailabilityOptions(i,async q=>{calls.push(q.cabin);return {...q,availability:'available',availableUnits:1,checkedAt:'2026-10-12T10:00:00.000Z',source:'SYNTHETIC'};},{now:()=>Date.parse('2026-10-12T10:00:00Z')});
 assert.equal(calls.includes('splitC'),false);
 assert.equal(result.available_options.some(x=>x.key==='splitC'),false);
});
test('five guests requesting one split C require extra bed and unverified fee',async()=>{
 const i=input(5,'splitC');
 const now=Date.parse('2026-10-12T10:00:00Z');
 const result=await buildAvailabilityOptions(i,async q=>({...q,availability:'available',availableUnits:1,checkedAt:new Date(now).toISOString(),source:'SYNTHETIC'}),{now:()=>now});
 const c=result.available_options.find(x=>x.key==='splitC'&&x.units===1);
 assert.ok(c);
 assert.equal(c.extraBedRequired,true);
 assert.equal(c.extraBedPlacementRequiresConfirmation,true);
 assert.equal(c.extraBedFeeVerified,false);
});
