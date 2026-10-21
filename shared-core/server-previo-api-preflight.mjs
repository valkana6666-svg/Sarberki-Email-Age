// Offline preparation only. This module never reads a secret or calls a provider.
// The existing PMS adapter, case repository, permissions and audit remain authoritative.
import {createHash} from 'node:crypto';
import {BUSINESS} from '../business-config.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(x);
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const dated=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const source=x=>typeof x==='string'&&/^https:\/\/[^\s?#]+$/.test(x);
const cleanKeys=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).every(k=>keys.includes(k));

export function expectedSarberkiApiUnits(){
 const split=BUSINESS.splitPhysicalUnits.map(u=>({localUnitId:u.id,physicalHouse:u.physicalHouse}));
 const single=Object.values(BUSINESS.accommodationTypes).flatMap(t=>t.physicalHouseNumbers||[])
  .filter(n=>n<7||n>10).map(n=>({localUnitId:String(n),physicalHouse:n}));
 return Object.freeze([...new Map([...single,...split].map(x=>[x.localUnitId,Object.freeze(x)])).values()]);
}

export function assessPrevioApiPreparation(config={}, {tenantId='sarberki-test'}={}){
 const blockers=[];const add=(ok,code)=>{if(!ok)blockers.push(code);};
 const top=['tenantId','propertyId','environment','access','mapping','contracts','operational'];
 if(!cleanKeys(config,top))return Object.freeze({status:'INVALID_PREPARATION',blockers:['INVALID_CONFIGURATION_SHAPE'],executionEnabled:false,bookingEnabled:false});
 add(config.tenantId===tenantId&&tenantId==='sarberki-test','TENANT_NOT_ISOLATED_TEST');
 add(config.environment==='sandbox','SANDBOX_NOT_CONFIRMED');
 add(id(config.propertyId),'PROPERTY_ID_UNVERIFIED');
 const a=config.access||{};
 add(cleanKeys(a,['officiallyGranted','credentialConfigured','reviewedBy','scopes','sourceReference'])&&a.officiallyGranted===true&&a.credentialConfigured===true&&id(a.reviewedBy)&&source(a.sourceReference),'OFFICIAL_ACCESS_UNVERIFIED');
 add(Array.isArray(a.scopes)&&a.scopes.includes('read_availability')&&a.scopes.includes('read_quote')&&a.scopes.every(s=>['read_availability','read_quote','read_units','read_notes'].includes(s)),'READ_ONLY_SCOPE_UNVERIFIED');
 const m=config.mapping||{},expected=expectedSarberkiApiUnits(),seen=new Set(),remote=new Set();
 let valid=cleanKeys(m,['tenantId','propertyId','sourceReference','verifiedAt','reviewedBy','units','ratePlanId','currency','timezone'])&&m.tenantId===tenantId&&m.propertyId===config.propertyId&&source(m.sourceReference)&&dated(m.verifiedAt)&&id(m.reviewedBy)&&id(m.ratePlanId)&&m.currency==='HUF'&&m.timezone===BUSINESS.timezone&&Array.isArray(m.units)&&m.units.length===expected.length;
 if(valid)for(const u of m.units){
  const local=expected.find(x=>x.localUnitId===u?.localUnitId);
  if(!cleanKeys(u,['localUnitId','physicalHouse','roomId','roomKindId'])||!local||u.physicalHouse!==local.physicalHouse||!id(u.roomId)||!id(u.roomKindId)||seen.has(u.localUnitId)||remote.has(u.roomId)){valid=false;break;}
  seen.add(u.localUnitId);remote.add(u.roomId);
 }
 add(valid,'UNIT_OR_RATE_MAPPING_UNVERIFIED');
 const c=config.contracts||{};
 add(cleanKeys(c,['availability','quote','notes','createReservation','finalizeReservation']),'CONTRACT_SHAPE_INVALID');
 for(const name of ['availability','quote']){
  const op=c[name];
  add(cleanKeys(op,['documented','sideEffectFree','sourceReference','reviewedBy','propertyBound'])&&op.documented===true&&op.sideEffectFree===true&&op.propertyBound===true&&source(op.sourceReference)&&id(op.reviewedBy),name==='availability'?'AVAILABILITY_CONTRACT_UNVERIFIED':'FULL_QUOTE_CONTRACT_UNVERIFIED');
 }
 const o=config.operational||{};
 add(cleanKeys(o,['timeoutMs','maxReadAttempts','auditRepositoryBound','caseRevisionBound','readOnlyFlag','stopSwitch'])&&Number.isSafeInteger(o.timeoutMs)&&o.timeoutMs>=1000&&o.timeoutMs<=15000&&o.maxReadAttempts===1&&o.auditRepositoryBound===true&&o.caseRevisionBound===true&&o.readOnlyFlag===true&&o.stopSwitch===true,'OPERATIONAL_GATES_UNVERIFIED');
 return Object.freeze({status:blockers.length?'PREPARATION_BLOCKED':'READY_FOR_SANDBOX_READ_REVIEW',blockers:Object.freeze(blockers),expectedUnitCount:expected.length,
  executionEnabled:false,bookingEnabled:false,notesCalendarComplete:false,ownerActivationRequired:true});
}

// Stable internal transaction intent, NOT a claimed Previo idempotency header.
// Persist through the existing transaction/CAS/audit boundary before any future dispatch.
export function preparePrevioTransactionIntent(input){
 const keys=['tenantId','propertyId','caseId','caseRevision','draftHash','approvalReference','operation'];
 if(!cleanKeys(input,keys)||input.tenantId!=='sarberki-test'||!id(input.propertyId)||!id(input.caseId)||!Number.isSafeInteger(input.caseRevision)||input.caseRevision<1||!hash(input.draftHash)||!id(input.approvalReference)||!['read_availability','read_quote','create_reservation','finalize_reservation'].includes(input.operation))throw new TypeError('INVALID_PREVIO_INTENT');
 const bound=Object.fromEntries(keys.map(k=>[k,input[k]]));
 const fingerprint=createHash('sha256').update(JSON.stringify(bound)).digest('hex');
 return Object.freeze({intentId:'previo-intent:'+fingerprint,fingerprint,operation:input.operation,requiresDurableUniqueReservation:true,requiresCurrentCaseAndApproval:true,dispatchEnabled:false});
}

export function previoOperationRecovery({operation,outcome,providerReference=null}={}){
 if(!['read_availability','read_quote','create_reservation','finalize_reservation'].includes(operation)||!['not_dispatched','timeout','disconnected','rejected','accepted_unverified','verified'].includes(outcome))throw new TypeError('INVALID_PREVIO_OUTCOME');
 const write=['create_reservation','finalize_reservation'].includes(operation);
 if(outcome==='not_dispatched')return Object.freeze({state:'NOT_DISPATCHED',next:'HUMAN_REVIEW',autoRetry:false,executionEnabled:false});
 if(outcome==='rejected')return Object.freeze({state:'REJECTED',next:'HUMAN_REVIEW',autoRetry:false,executionEnabled:false});
 if(outcome==='verified'&&id(providerReference))return Object.freeze({state:'EVIDENCE_RECORDED',next:'HUMAN_REVIEW_CURRENT_CASE',autoRetry:false,executionEnabled:false});
 return Object.freeze({state:write?'OUTCOME_UNKNOWN':'READ_UNVERIFIED',next:write?'RECONCILE_PROVIDER_REFERENCE_BEFORE_ANY_RETRY':'HUMAN_REVIEW',autoRetry:false,executionEnabled:false});
}
