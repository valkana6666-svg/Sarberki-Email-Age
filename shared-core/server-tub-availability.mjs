import {AVAILABILITY,EVIDENCE_TTL_MS} from './availability-model.mjs';
import {BUSINESS} from '../business-config.mjs';

// Only a server composition root may inject this adapter. Snapshot strings or
// `verified: true` supplied by a caller cannot select or authenticate a source.
const id=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,255}$/.test(value);
function instant(value){
 if(typeof value!=='string')return NaN;
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
 if(!m)return NaN;
 const [year,month,day,hour,minute,second]=m.slice(1,7).map(Number),date=new Date(Date.UTC(year,month-1,day));
 if(year<2000||date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day||hour>23||minute>59||second>59||Number(m[10])>14||Number(m[11])>59||Number(m[10])===14&&Number(m[11])!==0)return NaN;
 return Date.parse(value);
}
const fields=['tenantId','caseId','caseRevision','houseNumber','resourceId','start','end'];
// Complete, half-open resource calendars are the adapter contract. A physical
// house being eligible never proves the movable/shared rental resource is free.
export function createTubAvailabilityChecker({provider=null,clock=Date.now}={}){
 const configured=provider&&id(provider.sourceId)&&id(provider.provenance)&&id(provider.resourceId)&&typeof provider.readSnapshot==='function';
 // Capture trusted wiring once; later JSON mutations cannot replace its identity.
 const adapter=configured?{sourceId:provider.sourceId,provenance:provider.provenance,resourceId:provider.resourceId,readSnapshot:provider.readSnapshot.bind(provider)}:null;
 return Object.freeze({async check(input){
  const query=Object.freeze(Object.fromEntries(fields.map(key=>[key,input?.[key]])));
  const unknown=error=>Object.freeze({status:AVAILABILITY.UNKNOWN,valid:false,eligible:BUSINESS.hotTubRentalRules.houseNumbers.includes(query.houseNumber),query,error,confirmationAllowed:false});
  const start=instant(query.start),end=instant(query.end);
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!fields.includes(key))||
   typeof query.tenantId!=='string'||!/^[a-z][a-z0-9-]{1,63}$/.test(query.tenantId)||!id(query.caseId)||!id(query.resourceId)||
   !Number.isSafeInteger(query.caseRevision)||query.caseRevision<1||!Number.isInteger(query.houseNumber)||
   !Number.isFinite(start)||!Number.isFinite(end)||end<=start)return unknown('INVALID_QUERY');
  if(!BUSINESS.hotTubRentalRules.houseNumbers.includes(query.houseNumber))return unknown('INELIGIBLE_HOUSE');
  if(!adapter)return unknown('PROVIDER_UNAVAILABLE');
  if(query.resourceId!==adapter.resourceId)return unknown('RESOURCE_MISMATCH');
  let snapshot;try{snapshot=structuredClone(await adapter.readSnapshot(query));}catch{return unknown('PROVIDER_FAILURE');}
  const now=clock(),checkedAt=instant(snapshot?.checkedAt),validUntil=instant(snapshot?.validUntil);
  if(!Number.isFinite(now)||!Number.isFinite(checkedAt)||!Number.isFinite(validUntil)||now<checkedAt||now>=validUntil||now-checkedAt>=EVIDENCE_TTL_MS||validUntil<=checkedAt||validUntil-checkedAt>EVIDENCE_TTL_MS)return unknown('EXPIRED_EVIDENCE');
  if(snapshot?.sourceId!==adapter.sourceId||snapshot?.provenance!==adapter.provenance||!id(snapshot?.evidenceReference)||!id(snapshot?.version))return unknown('INVALID_PROVENANCE');
  if(fields.some(key=>snapshot?.binding?.[key]!==query[key]))return unknown('BINDING_MISMATCH');
  const coverage=snapshot?.coverage;
  if(coverage?.tenantId!==query.tenantId||coverage?.resourceId!==query.resourceId||coverage?.complete!==true||
   !Number.isFinite(instant(coverage?.start))||!Number.isFinite(instant(coverage?.end))||instant(coverage.start)>start||instant(coverage.end)<end||!Array.isArray(snapshot?.bookings))return unknown('INCOMPLETE_CALENDAR');
  let conflicts=0;const seen=new Set();
  for(const booking of snapshot.bookings){
   const from=instant(booking?.start),to=instant(booking?.end);
   // No malformed, foreign-tenant or unknown-state entry can disappear silently.
   if(!id(booking?.id)||seen.has(booking.id)||booking.tenantId!==query.tenantId||!id(booking.resourceId)||!Number.isInteger(booking.houseNumber)||booking.houseNumber<1||booking.houseNumber>15||
    !Number.isFinite(from)||!Number.isFinite(to)||to<=from||!['reserved','blocked','cancelled'].includes(booking.status))return unknown('INVALID_CALENDAR_ENTRY');
   seen.add(booking.id);
   if(booking.resourceId===query.resourceId&&booking.status!=='cancelled'&&from<end&&to>start)conflicts++;
  }
  // Recheck freshness after adapter/validation work. This evidence is a
  // short-lived observation, never an approval, reservation or sending right.
  const finished=clock();
  if(!Number.isFinite(finished)||finished<checkedAt||finished>=validUntil||finished-checkedAt>=EVIDENCE_TTL_MS)return unknown('EXPIRED_EVIDENCE');
  return Object.freeze({status:conflicts?AVAILABILITY.UNAVAILABLE:AVAILABILITY.AVAILABLE,valid:true,eligible:true,query,error:null,confirmationAllowed:false,
   sourceId:adapter.sourceId,provenance:adapter.provenance,evidenceReference:snapshot.evidenceReference,version:snapshot.version,checkedAt:snapshot.checkedAt,validUntil:snapshot.validUntil,conflictCount:conflicts});
 }});
}

// Shared strict parser for server-side binding/approval evidence.
export {instant as parseOffsetInstant};
