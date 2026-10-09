import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildAvailabilityOptions} from '../netlify/functions/availability-options.mjs';
import {availabilitySentence} from '../availability-recommend.mjs';

// Historic evidence gathered on 2026-10-08. OFFLINE replay only.
// This file MUST NOT contact Previo or treat old counts as current availability.
const record=JSON.parse(readFileSync(new URL('../reports/availability-audit-2026-10-08/live-evidence.json',import.meta.url),'utf8'));
const original=new Map(record.results.map(({cabin,result})=>[cabin,result]));
const query={arrival:'2026-10-23',departure:'2026-10-25',guests:4,adults:4};

// The values below were independently observed in the public booking UI in the
// 2026-10-08 manual audit, as recorded in reports/availability-audit-2026-10-08/REPORT.md.
const manuallyObserved={vip:0,family:0,deluxe:0,splitC:2,splitA:0};

function recordedSource({refreshTimestamps=false}={}){
  return async({arrival,departure,cabin})=>{
    const historic=original.get(cabin);
    if(!historic)throw Error('No historic Previo observation for this type');
    assert.equal(arrival,query.arrival);
    assert.equal(departure,query.departure);
    return {...historic,...(refreshTimestamps?{checkedAt:new Date().toISOString(),source:'OFFLINE_REPLAY_OF_2026_10_08'}:{})};
  };
}

test('historic Previo type-pool results match independently recorded manual screen counts',()=>{
  assert.equal(record.guests,4);
  assert.deepEqual(record.probeStartedFor,{arrival:query.arrival,departure:query.departure});
  assert.deepEqual(Object.fromEntries(Object.keys(manuallyObserved).map(cabin=>[cabin,original.get(cabin)?.availableUnits])),manuallyObserved);
  for(const [cabin,count] of Object.entries(manuallyObserved)){
    const row=original.get(cabin);
    assert.equal(row.availability,count>0?'available':'unavailable');
    assert.equal(row.status,'review_required');
    assert.equal(row.bookingCompleted,false);
    assert.equal(row.source,'Sárberki hivatalos foglalási felület');
  }
});

test('stale real Previo results MUST NOT be accepted as freshly verified availability',async()=>{
  const result=await buildAvailabilityOptions(query,recordedSource());
  assert.equal(result.available_options.length,0);
  assert.ok(result.unverified_options.some(x=>x.key==='splitC'));
  assert.ok(result.unverified_options.every(x=>x.availability_verified===false));
  assert.equal(result.bookingCompleted,false);
});

test('offline replay reproduces four-guest split-C alternative but never invents a physical unit',async()=>{
  // Refreshing the timestamp is legitimate ONLY for testing the decision logic
  // against a historic fixture. It is NOT a new Previo availability check.
  const calls=[],source=recordedSource({refreshTimestamps:true});
  const result=await buildAvailabilityOptions(query,q=>{calls.push(q.cabin);return source(q);});
  assert.deepEqual(result.available_options.map(x=>x.key),['splitC']);
  assert.equal(result.available_options[0].availableUnits,2);
  assert.equal(result.available_options[0].verification_scope,'type_pool');
  assert.equal(result.available_options[0].individual_unit_mapping_verified,false);
  assert.deepEqual(result.unavailable_options.map(x=>x.key).sort(),['deluxe','family','splitAB','vip']);
  // Four guests cannot fit the two-person cabin: exclude it before PMS lookup.
  assert.ok(result.excluded_options.some(x=>x.key==='small'&&x.reason==='capacity_incompatible'));
  assert.equal(calls.includes('small'),false);
  assert.equal(result.bookingCompleted,false);
  const guestText=availabilitySentence(result,'hu');
  assert.match(guestText,/Osztott/u);
  assert.doesNotMatch(guestText,/\b(?:7|8|9|10)[ABC]\b/u);
});

test('offline replay declines unavailable VIP and offers only independently checked alternatives',async()=>{
  const input={...query,cabin:'vip',fallback:false};
  const result=await buildAvailabilityOptions(input,recordedSource({refreshTimestamps:true}));
  assert.equal(result.available_options.length,0);
  assert.deepEqual(result.unavailable_options.map(x=>x.key),['vip']);
  assert.equal(result.bookingCompleted,false);
});
