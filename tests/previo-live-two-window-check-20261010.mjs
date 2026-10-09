// Intentionally excluded from npm test. One explicitly authorized, anonymous
// read-only live run on the dedicated Sárberki test branch, October 10, 2026.
// No Gmail messages, guest data, prices, reservation submission or edits.
import assert from 'node:assert/strict';
import {fetchPublicBookingAvailability} from '../price-source/sarberki-public-booking.mjs';
import {wholeCabinCandidates} from '../booking-filter.mjs';

assert.equal(process.env.SARBERKI_EXPLICIT_ANONYMOUS_READ_ONLY_PROBE,'2026-10-10',
  'An explicit owner-authorized test-only run is required.');

const HOST='https://leafy-chimera-2403e5.netlify.app';
const WINDOWS=[
  {arrival:'2026-10-23',departure:'2026-10-25',guests:4,adults:4},
  {arrival:'2026-11-09',departure:'2026-11-13',guests:6,adults:6}
];
const KINDS=['vip','family','deluxe','small','splitA','splitC'];
const compactFailure=error=>String(error?.message||error).slice(0,200);

async function testOne(input){
  const direct={};
  for(const cabin of KINDS){
    // Existing hardened adapter enforces the exact read-only Previo endpoint allowlist.
    try{
      const answer=await fetchPublicBookingAvailability({...input,cabin});
      assert.equal(answer.bookingCompleted,false);
      assert.equal(answer.arrival,input.arrival);
      assert.equal(answer.departure,input.departure);
      assert.equal(answer.cabin,cabin);
      assert.ok(Number.isSafeInteger(answer.availableUnits)&&answer.availableUnits>=0);
      direct[cabin]={status:answer.availability,availableUnits:answer.availableUnits,
        checkedAt:answer.checkedAt};
    }catch(error){
      direct[cabin]={status:'unverified',error:compactFailure(error)};
    }
  }
  const response=await fetch(HOST+'/.netlify/functions/availability-options',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({...input,fallback:true}),
    signal:AbortSignal.timeout(120000)
  });
  const raw=await response.text();
  const result=(()=>{try{return JSON.parse(raw);}catch{return null;}})();
  if(!response.ok||!result){
    console.log('LIVE PREVIO CROSSCHECK BLOCKED',JSON.stringify({input,direct,
      testEndpointStatus:response.status,testEndpointError:result?.error||'Non-JSON response'}));
    return {status:'blocked',input,direct,endpointStatus:response.status};
  }
  assert.equal(result.bookingCompleted,false);
  assert.equal(result.arrival,input.arrival);
  assert.equal(result.departure,input.departure);
  assert.equal(result.guests,input.guests);
  const checked=[...result.available_options,...result.unavailable_options,...result.unverified_options];
  const {candidates}=wholeCabinCandidates(input);
  const eligible=new Set(candidates.map(x=>x.key));
  const discrepancies=[];
  for(const cabin of KINDS){
    const record=direct[cabin];
    const displayed=cabin==='splitA'?result.split_pool_checks?.splitAB:
      cabin==='splitC'?result.split_pool_checks?.splitC:
      eligible.has(cabin)?checked.find(x=>x.key===cabin):null;
    // Capacity-incompatible cabins must be excluded before a guest-facing suggestion.
    if(!displayed){
      if(cabin!=='splitA'&&cabin!=='splitC'&&!eligible.has(cabin))continue;
      discrepancies.push({cabin,problem:'expected_type_or_pool_missing'});continue;
    }
    if(record.status==='unverified'){
      if(displayed.availability!=='unverified'||displayed.verified===true||
        displayed.availability_verified===true)
        discrepancies.push({cabin,problem:'source_unknown_but_server_confirmed'});
      continue;
    }
    if(displayed.availableUnits!==record.availableUnits ||
       (displayed.availability==='unverified') ||
       displayed.availability_verified===false||displayed.verified===false){
      discrepancies.push({cabin,problem:'inventory_or_evidence_mismatch',
        directCount:record.availableUnits,endpointCount:displayed.availableUnits,
        endpointStatus:displayed.availability});
    }
    if(record.availableUnits===0&&checked.some(o=>o.key===cabin&&o.availability==='available'))
      discrepancies.push({cabin,problem:'zero_inventory_offered'});
  }
  for(const o of result.available_options){
    if(o.availability!=='available'||o.availability_verified!==true)
      discrepancies.push({key:o.key,problem:'unverified_option_in_available_list'});
    if(o.individual_unit_mapping_verified===false&&o.same_house_pairing_verified===true)
      discrepancies.push({key:o.key,problem:'pooled_count_claims_physical_pair'});
  }
  const summary={input,direct,endpoint:{
    available:result.available_options.map(o=>({key:o.key,units:o.units})),
    unavailable:result.unavailable_options.map(o=>o.key),
    unverified:result.unverified_options.map(o=>o.key),
    pools:Object.fromEntries(Object.entries(result.split_pool_checks||{}).map(([name,p])=>
      [name,{availableUnits:p.availableUnits,verified:p.verified}])),
    checkedAt:result.checkedAt,bookingCompleted:result.bookingCompleted},
    discrepancies,manualBrowserConfirmationStillRequired:true};
  console.log('LIVE PREVIO CROSSCHECK WINDOW',JSON.stringify(summary));
  assert.equal(discrepancies.length,0,'Direct Previo and test Netlify capacity mismatch.');
  assert.ok(KINDS.every(c=>direct[c].status!=='unverified'),
    'At least one direct Previo request could not be verified; no overall PASS is allowed.');
  return summary;
}
let pass=0,blocked=0;
for(const input of WINDOWS){
  const outcome=await testOne(input);
  if(outcome.status==='blocked')blocked++; else pass++;
}
console.log(blocked?'LIVE PREVIO CROSSCHECK INCOMPLETE':'LIVE PREVIO CROSSCHECK PASS',JSON.stringify({
  passedWindows:pass,totalWindows:WINDOWS.length,
  typePoolChecks:pass*KINDS.length,
  scope:'anonymous type-pool stock only',
  physicalCabinIdentityVerified:false,
  independentManualBrowserComparisonCompleted:false,
  blockedWindows:blocked,
  bookingCreated:false,emailSent:false
}));
if(blocked)throw Error('Live public Previo data collected, but Netlify safety gate stayed closed; comparison not confirmed.');
