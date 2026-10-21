import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticPrevioContractAdapter} from '../shared-core/server-previo-contract-adapter.mjs';
import {expectedSarberkiApiUnits} from '../shared-core/server-previo-api-preflight.mjs';
import {assertReadOnlyPmsAdapter} from '../shared-core/pms-adapter.mjs';

const clock=Date.parse('2026-10-21T12:00:00Z');
const preparation=()=>({tenantId:'sarberki-test',propertyId:'SYNTHETIC-HOTEL',environment:'sandbox',access:{officiallyGranted:true,credentialConfigured:true,reviewedBy:'synthetic-reviewer',scopes:['read_availability','read_quote'],sourceReference:'https://example.invalid/access'},mapping:{tenantId:'sarberki-test',propertyId:'SYNTHETIC-HOTEL',sourceReference:'https://example.invalid/mapping',verifiedAt:'2026-10-21T10:00:00Z',reviewedBy:'synthetic-reviewer',units:expectedSarberkiApiUnits().map(u=>({...u,roomId:'SYNTHETIC-'+u.localUnitId,roomKindId:'SYNTHETIC-KIND'})),ratePlanId:'SYNTHETIC-RATE',currency:'HUF',timezone:'Europe/Budapest'},contracts:Object.fromEntries(['availability','quote'].map(k=>[k,{documented:true,sideEffectFree:true,sourceReference:'https://example.invalid/'+k,reviewedBy:'synthetic-reviewer',propertyBound:true}])),operational:{timeoutMs:1000,maxReadAttempts:1,auditRepositoryBound:true,caseRevisionBound:true,readOnlyFlag:true,stopSwitch:true}});
const query=()=>({tenantId:'sarberki-test',propertyId:'SYNTHETIC-HOTEL',caseId:'SYNTHETIC-CASE',caseRevision:1,draftHash:'a'.repeat(64),approvalReference:'SYNTHETIC-APPROVAL',arrival:'2026-11-01',departure:'2026-11-03',localUnitIds:['7A','7B']});
const response=r=>({tenantId:r.tenantId,propertyId:r.propertyId,operation:r.operation,requestFingerprint:r.requestFingerprint,arrival:r.arrival,departure:r.departure,checkedAt:'2026-10-21T12:00:00Z',reference:'SYNTHETIC-RECEIPT',units:r.units.map(u=>({roomId:u.roomId,available:true})),...(r.operation==='read_quote'?{currency:'HUF',totalMinor:12000000}:{})});
const adapter=(request=r=>response(r),options={})=>createSyntheticPrevioContractAdapter({syntheticOnly:true,preparation:preparation(),transport:{kind:'synthetic-fixture',request},timeoutMs:100,now:()=>clock,...options});

test('fixture transport is explicit and no default, production or real property transport is enabled',()=>{
 assert.throws(()=>createSyntheticPrevioContractAdapter(),/INVALID_SYNTHETIC/);
 for(const options of [{syntheticOnly:false},{transport:{kind:'live',request:()=>{}}},{timeoutMs:0},{timeoutMs:15001}])assert.throws(()=>adapter(undefined,options),/INVALID_SYNTHETIC/);
 for(const mutate of [p=>{p.environment='production';},p=>{p.propertyId='REAL-HOTEL';p.mapping.propertyId='REAL-HOTEL';},p=>{p.mapping.units[0].roomId='REAL-ROOM';},p=>{p.apiKey='SYNTHETIC-SECRET';}]){const p=preparation();mutate(p);assert.throws(()=>adapter(undefined,{preparation:p}),/INVALID_SYNTHETIC/);}
});
test('read interface accepts only synthetic bound evidence and never marks live availability verified',async()=>{
 const a=assertReadOnlyPmsAdapter(adapter());const r=await a.getAvailability(query());
 assert.equal(r.status,'SYNTHETIC_CONTRACT_ACCEPTED');assert.equal(r.valid,false);assert.equal(r.liveVerified,false);assert.equal(r.auditCandidate.requiresExistingRepositoryPersistence,true);assert.equal(a.authenticationStatus,'NOT_CONNECTED');
 const core=await a.getVerifiedAvailability({cabin:'split_ab',arrival:'2026-11-01',departure:'2026-11-03'},{tenantId:'sarberki-test'});
 assert.equal(core.status,'UNKNOWN');assert.equal(core.valid,false);assert.equal(core.availableUnits,null);
});
test('mapped physical room IDs, fixed rate/currency and immutable request reach fixture without guest data',async()=>{
 let captured;const a=adapter(r=>{captured=r;assert.ok(Object.isFrozen(r));assert.ok(Object.isFrozen(r.units));assert.ok(Object.isFrozen(r.units[0]));return response(r);});
 const q=query();const pending=a.getQuote(q);q.localUnitIds.push('8C');const r=await pending;
 assert.equal(r.status,'SYNTHETIC_CONTRACT_ACCEPTED');assert.deepEqual(captured.units.map(u=>u.roomId),['SYNTHETIC-7A','SYNTHETIC-7B']);assert.equal(captured.ratePlanId,'SYNTHETIC-RATE');assert.equal(r.fixtureEvidence.totalMinor,12000000);
 assert.ok(!('approvalReference' in captured));assert.ok(!('draftHash' in captured));
});
test('foreign tenant/property, malformed date, missing/duplicate unit and guest/credential fields are rejected before transport',async()=>{
 let count=0;const a=adapter(r=>{count++;return response(r);});
 for(const q of [{...query(),tenantId:'other'},{...query(),propertyId:'SYNTHETIC-OTHER'},{...query(),arrival:'2026-02-30'},{...query(),departure:'2026-10-31'},{...query(),localUnitIds:['7A','7A']},{...query(),localUnitIds:['99']},{...query(),guestEmail:'synthetic@example.invalid'},{...query(),apiKey:'SYNTHETIC-SECRET'},{...query(),caseId:'REAL-CASE'}])assert.equal((await a.getAvailability(q)).code,'INVALID_QUERY');
 assert.equal(count,0);
});
test('verified bool, foreign response, changed stay/fingerprint and duplicate physical results cannot establish evidence',async()=>{
 for(const mutate of [r=>({...r,verified:true}),r=>({...r,propertyId:'SYNTHETIC-OTHER'}),r=>({...r,tenantId:'foreign'}),r=>({...r,departure:'2026-11-04'}),r=>({...r,requestFingerprint:'b'.repeat(64)}),r=>({...r,units:[r.units[0],r.units[0]]}),r=>({...r,units:[{roomId:'SYNTHETIC-OTHER',available:true},r.units[1]]}),r=>({...r,units:r.units.map(u=>({...u,available:'yes'}))})])assert.equal((await adapter(q=>mutate(response(q))).getAvailability(query())).code,'INVALID_RESPONSE');
});
test('expired/future provenance and incomplete or inconsistent quote are rejected',async()=>{
 for(const mutate of [r=>({...r,checkedAt:'2026-10-21T11:57:59Z'}),r=>({...r,checkedAt:'2026-10-21T12:00:01Z'}),r=>({...r,checkedAt:'2026-10-21'}),r=>({...r,currency:'EUR'}),r=>({...r,totalMinor:-1}),r=>({...r,totalMinor:1.5}),r=>({...r,units:r.units.map(u=>({...u,available:false}))}),r=>({...r,reference:'untrusted'})])assert.equal((await adapter(q=>mutate(response(q))).getQuote(query())).code,'INVALID_RESPONSE');
});
test('failure and deadline are sanitized and never retried; abort signal and late result cannot update accepted state',async()=>{
 let calls=0;const failure=await adapter(()=>{calls++;throw new Error('apiKey=TOP_SECRET https://private.invalid');}).getAvailability(query());
 assert.equal(calls,1);assert.equal(failure.code,'TRANSPORT_FAILURE');assert.ok(!JSON.stringify(failure).includes('TOP_SECRET'));
 let signal,finish;const a=adapter((_q,o)=>{calls++;signal=o.signal;return new Promise(resolve=>{finish=resolve;});},{timeoutMs:5});
 const r=await a.getAvailability(query());assert.equal(r.code,'TIMEOUT');assert.equal(signal.aborted,true);assert.equal(r.autoRetry,false);assert.equal(calls,2);finish(response({ ...query(),units:[],operation:'read_availability',requestFingerprint:'a'.repeat(64)}));assert.equal(r.code,'TIMEOUT');
});
test('concurrent identical read uses one fixture request; changed binding and dates receive different fingerprints',async()=>{
 let calls=0,release;const a=adapter(async r=>{calls++;await new Promise(resolve=>{release=resolve;});return response(r);});
 const p=a.getAvailability(query()),q=a.getAvailability(query());await Promise.resolve();release();const [x,y]=await Promise.all([p,q]);assert.equal(calls,1);assert.deepEqual(x,y);
 const b=adapter();const initial=await b.getAvailability(query());
 for(const changed of [{caseRevision:2},{arrival:'2026-11-02'},{draftHash:'b'.repeat(64)},{approvalReference:'SYNTHETIC-OTHER'}])assert.notEqual((await b.getAvailability({...query(),...changed})).requestFingerprint,initial.requestFingerprint);
 assert.equal(initial.requiresDurableJournal,true);
});
test('configuration mutation cannot change mapping and write methods remain blocked without reaching fixture',async()=>{
 const p=preparation();let count=0;const a=adapter(r=>{count++;return response(r);},{preparation:p});p.mapping.units=[];
 assert.equal((await a.getAvailability(query())).status,'SYNTHETIC_CONTRACT_ACCEPTED');
 for(const method of ['createBooking','finalizeBooking']){const r=await a[method]({...query(),apiKey:'SYNTHETIC-SECRET'});assert.equal(r.code,'WRITE_DISABLED');assert.equal(r.dispatchEnabled,false);assert.ok(!JSON.stringify(r).includes('SECRET'));}
 assert.equal(count,1);assert.equal(a.capabilities.createBooking,false);assert.equal(a.capabilities.finalizeBooking,false);
});
