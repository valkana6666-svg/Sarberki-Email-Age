// Server-only (excluded from dist by the server- prefix). V1 booking completion (owner/ChatGPT task 2026-11-06):
// the operator records the booking in Previo BY HAND and attests it here (Previo reference). The SERVER recomputes
// the price-list price for the stored case, builds the confirmation draft with deposit and deadline
// (booking-confirmation-draft.mjs) and attests it for sc_tm_confirm_booking. The browser sends no text.
// "Deposit received" is a separate operator step (sc_tm_deposit_received). Nothing is sent, paid or booked here.
import {createHash,createHmac} from 'node:crypto';
import {fetchPublicPriceReference} from '../price-source/public-price-fallback.mjs';
import {quoteInputFromCase} from './server-test-mailbox-price.mjs';
import {CABIN_NAMES} from './price-insert-sentence.mjs';
import {buildBookingConfirmation} from './booking-confirmation-draft.mjs';
import {unitsOfType,conflictsFor} from './unit-inventory.mjs';
import {previoUnitLine} from './server-previo-unit-check.mjs';

export const CONFIRM_SCOPE='test-mailbox-confirm-v1';
const fail=code=>{const error=Error(code);error.code=code;throw error;};
const sha=text=>createHash('sha256').update(String(text),'utf8').digest('hex');

// The case's reviewed cabin type (e.g. "Deluxe") -> price-list key; anything else refuses (no guessing).
export function cabinKeyFromUnit(unit){
 const wanted=String(unit||'').trim().toLowerCase();
 const hit=Object.entries(CABIN_NAMES).find(([,names])=>names.hu.toLowerCase()===wanted);
 if(!hit)fail('CONFIRMATION_CABIN_UNKNOWN');
 return hit[0];
}

export function attestConfirmation({key,tenantId,caseId,expectedRevision,draft,booking,checkedAt}){
 if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))fail('SETUP_REQUIRED');
 const fields=[CONFIRM_SCOPE,tenantId,caseId,String(expectedRevision),sha(draft.text),sha(draft.operatorReviewText),booking.previoReference,
  booking.previoRecordedAt,String(booking.depositPct),String(booking.depositAmount),booking.depositDeadlineUtc,booking.unit,checkedAt];
 if(fields.some(v=>typeof v!=='string'||!v||/[\r\n]/.test(v)))fail('INVALID_EVIDENCE');
 return {scope:CONFIRM_SCOPE,checkedAt,attestation:createHmac('sha256',Buffer.from(key,'hex')).update(fields.join('\n')).digest('hex')};
}

// V2 step 1b (owner 2026-11-07): the operator names the unit; it must belong to the case's cabin type and be
// free in our own finalized bookings (pre-check here for a clear message; the database re-checks under a lock).
async function unitTaken({transport,record,unit,arrival,departure}){
 let rows=[];
 try{rows=await transport('/rest/v1/sc_cases?select=case_id,data&tenant_id=eq.'+encodeURIComponent(record.tenantId)+'&data->booking->>unit=eq.'+encodeURIComponent(unit));}catch{return false;}
 const bookings=(Array.isArray(rows)?rows:[]).filter(r=>r.case_id!==record.caseId&&r.data?.booking?.unit===unit&&['finalized','deposit_received'].includes(r.data?.booking?.status))
  .map(r=>({key:r.case_id,unit,arrival:r.data?.state?.values?.arrival,departure:r.data?.state?.values?.departure,source:'synthetic',status:'confirmed'}))
  .filter(b=>/^\d{4}-\d{2}-\d{2}$/.test(b.arrival||'')&&/^\d{4}-\d{2}-\d{2}$/.test(b.departure||'')&&b.departure>b.arrival);
 return conflictsFor(bookings,{unit,arrival,departure}).length>0;
}
export async function confirmTestMailboxBooking({record,previoReference,previoRecorded,unit,attestationKey,transport,
 quoteFn=fetchPublicPriceReference,unitCheckFn=null,clock=()=>new Date().toISOString()}={}){
 if(previoRecorded!==true)fail('PREVIO_RECORDING_REQUIRED');
 if(typeof transport!=='function')fail('SETUP_REQUIRED');
 if(['finalized','deposit_received'].includes(record?.data?.booking?.status))fail('ALREADY_FINALIZED');
 const values=record?.data?.state?.values||{};
 const cabin=cabinKeyFromUnit(values.unit);
 if(!unitsOfType(cabin).some(u=>u.id===unit))fail('UNIT_NOT_IN_TYPE');
 let quote;
 try{quote=quoteFn(quoteInputFromCase(values,cabin));}catch(error){if(error?.code==='PRICE_FACTS_MISSING')fail('CONFIRMATION_FACTS_MISSING');fail('CONFIRMATION_PRICE_MISSING');}
 if(await unitTaken({transport,record,unit,arrival:values.arrival,departure:values.departure}))fail('UNIT_TAKEN');
 // V2 step 4: the same unit in Previo itself (read-only). Another reservation there -> refuse; unreadable -> note only.
 let previoUnit=null;
 if(typeof unitCheckFn==='function'){try{previoUnit=await unitCheckFn({unit,arrival:values.arrival,departure:values.departure,previoReference});}catch{previoUnit={status:'unknown'};}
  if(previoUnit?.status==='taken')fail('UNIT_TAKEN_IN_PREVIO');}
 const language=/^(hu|de|en|si)$/.test(values.language||'')?values.language:'hu';
 const recordedAt=clock();
 const built=buildBookingConfirmation({values,quote,previo:{reference:previoReference,recordedAt},language});
 const draft={text:built.text,operatorReviewText:built.operatorReviewText};
 const booking={previoReference:built.previo.reference,previoRecordedAt:recordedAt,depositPct:built.deposit.pct,depositAmount:built.deposit.amount,depositDeadlineUtc:built.deposit.receiptDeadlineUtc,unit};
 // Internal unit number goes to the operator text only, never to the guest (AGENTS: no internal house numbers).
 draft.operatorReviewText+='\nEgység: '+unit+' (csak kezelői adat, a vendéglevélben nem szerepel).';
 if(previoUnit)draft.operatorReviewText+='\n'+previoUnitLine(previoUnit,unit,previoReference);
 const proof=attestConfirmation({key:attestationKey,tenantId:record.tenantId,caseId:record.caseId,expectedRevision:record.revision,draft,booking,checkedAt:clock()});
 const saved=await transport('/rest/v1/rpc/sc_tm_confirm_booking',{method:'POST',body:{p_tenant:record.tenantId,p_case:record.caseId,p_expected:record.revision,p_booking:booking,p_draft:draft,p_proof:proof}});
 return {saved,deposit:built.deposit};
}

// Separate operator step: the deposit has arrived (date as the operator saw it on the bank statement).
export async function markTestMailboxDepositReceived({record,receivedOn,depositConfirmed,transport}={}){
 if(depositConfirmed!==true)fail('DEPOSIT_NOT_CONFIRMED');
 if(typeof transport!=='function')fail('SETUP_REQUIRED');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(receivedOn||''))fail('INVALID_DATE');
 if(record?.data?.booking?.status!=='finalized')fail('NOT_FINALIZED');
 return transport('/rest/v1/rpc/sc_tm_deposit_received',{method:'POST',body:{p_tenant:record.tenantId,p_case:record.caseId,p_expected:record.revision,p_received_on:receivedOn}});
}
