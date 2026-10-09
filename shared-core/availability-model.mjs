// Provider-independent evidence. UNKNOWN never means zero stock.
export const AVAILABILITY=Object.freeze({AVAILABLE:'AVAILABLE',UNAVAILABLE:'UNAVAILABLE',UNKNOWN:'UNKNOWN'});
export const EVIDENCE_TTL_MS=120000;
export function normalizeAvailability(raw,query,{tenantId,now=Date.now(),ttl=EVIDENCE_TTL_MS}={}){
 const result={tenantId,unit:query.cabin,arrival:query.arrival,departure:query.departure,
  checkedAt:raw?.checkedAt||null,source:raw?.source||null,status:AVAILABILITY.UNKNOWN,
  availableUnits:null,valid:false,error:null,scope:raw?.verification_scope||'type_pool'};
 const count=raw?.availableUnits,age=now-Date.parse(raw?.checkedAt||'');
 if(raw?.error){result.error=String(raw.error);return Object.freeze(result);}
 const mismatch=['arrival','departure','cabin'].some(k=>raw?.[k]!==query[k]);
 if(!tenantId||raw?.tenantId&&raw.tenantId!==tenantId)result.error='tenant_mismatch';
 else if(mismatch)result.error='query_mismatch';
 else if(!raw?.source||!Number.isFinite(age)||age<0||age>ttl)result.error='missing_or_expired_evidence';
 else if(!Number.isSafeInteger(count)||count<0||!['available','unavailable'].includes(raw.availability)||(raw.availability==='available')!==(count>0))result.error='inconsistent_capacity';
 else {result.status=count>0?AVAILABILITY.AVAILABLE:AVAILABILITY.UNAVAILABLE;result.availableUnits=count;result.valid=true;}
 return Object.freeze(result);
}
export function assertCurrentEvidence(evidence,tenantId,query,now=Date.now()){
 const age=now-Date.parse(evidence?.checkedAt||'');
 if(!evidence?.valid||evidence.tenantId!==tenantId||evidence.arrival!==query.arrival||evidence.departure!==query.departure||evidence.unit!==query.cabin||!Number.isFinite(age)||age<0||age>EVIDENCE_TTL_MS)throw Error('Nem aktuális vagy idegen foglalhatósági bizonyíték.');
 return evidence;
}
