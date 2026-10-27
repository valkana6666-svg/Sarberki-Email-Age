import {matchesEditableFixture,EDITABLE_FIXTURE_DATES} from './server-pending-editable-fixture.mjs';
import {syntheticReaderFixtureRequest} from './synthetic-reader-fixture.mjs';
import {CaseServiceError} from './server-case-service.mjs';
import {matchesClosedSyntheticMailRecord,isClosedTubPreviousRecord} from './synthetic-mail-fixtures.mjs';

export function cloudSyntheticApprovalEnabled(env){
 return env.CASE_APPROVAL_ENABLED==='sarberki-test-synthetic-only'&&
  env.SUPABASE_URL==='https://mojnqizbcaczstguikpv.supabase.co'&&
  env.URL==='https://leafy-chimera-2403e5.netlify.app'&&
  /^[a-f0-9]{64}$/.test(env.ISOLATED_APPROVAL_ATTESTATION_KEY||'');
}
// Only the original Reader fixture, four exact fictional mail records or
// the single exact editable acceptance fixture is accepted. A .invalid address alone is insufficient.
export function assertCloudSyntheticReviewCase(record){
 if(matchesEditableFixture(record)||matchesClosedSyntheticMailRecord(record))return;
 const fixture=syntheticReaderFixtureRequest().envelope;
 if(record?.tenantId!=='sarberki-test'||record.data?.tenantId!=='sarberki-test'||
  record.data.sender!==fixture.sender||record.data.messages?.length!==1||
  !['sender','text','mailbox_id','message_id'].every(key=>record.data.messages[0][key]===fixture[key]))
  throw new CaseServiceError('FORBIDDEN','FORBIDDEN');
}
// Read eligibility is deliberately separate from review/write/approval eligibility.
// Only this already stored HU case and its exact registered follow-up are added.
export function assertCloudSyntheticReadCase(record){
 try{assertCloudSyntheticReviewCase(record);return;}catch(error){if(error.code!=='FORBIDDEN')throw error;}
 if(record?.caseId==='fa570d0b-1ea9-4568-a8f2-08b4dec446d0'&&
   Number.isSafeInteger(record.revision)&&record.revision>=1&&
   record.data?.messages?.length===2&&isClosedTubPreviousRecord(record))return;
 throw new CaseServiceError('FORBIDDEN','FORBIDDEN');
}
// Explicit fictional evidence, never a live availability/price assertion. The
// existing review module checks matching tenant, dates, scope and freshness.
export function cloudSyntheticReviewProviders(){
 const scope=q=>{
  if(q.tenantId!==undefined&&q.tenantId!=='sarberki-test'||!((q.arrival==='2026-10-23'&&q.departure==='2026-10-25')||(q.arrival===EDITABLE_FIXTURE_DATES.arrival&&q.departure===EDITABLE_FIXTURE_DATES.departure))||!['deluxe','Deluxe'].includes(q.cabin)||q.guests!==2)throw Error('FIXTURE_SCOPE_REQUIRED');
  return {...q,tenantId:'sarberki-test',source:'synthetic-fixture',checkedAt:new Date().toISOString()};
 };
 return {availability:async q=>({...scope(q),availability:'available',availableUnits:1}),
  pricing:async q=>({...scope(q),unitId:q.cabin,capacity:6,nightly:100,basis:'per_unit',verified:true})};
}
