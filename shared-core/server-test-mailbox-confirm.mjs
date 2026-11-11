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
import {V2_REFERENCE} from './server-previo-booking-sync.mjs';

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
// V2 (owner 2026-11-11): previoAuto=true lets the server create the Previo TEST option itself (previoWriter from
// server-previo-booking-sync.mjs) instead of the operator's manual Previo step; the reference becomes "V2-<resId>".
export async function confirmTestMailboxBooking({record,previoReference,previoRecorded,previoAuto=false,previoWriter=null,unit,attestationKey,transport,
 quoteFn=fetchPublicPriceReference,unitCheckFn=null,clock=()=>new Date().toISOString()}={}){
 if(previoAuto===true){if(!previoWriter)fail('PREVIO_WRITE_DISABLED');}
 else if(previoRecorded!==true)fail('PREVIO_RECORDING_REQUIRED');
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
 let previoCreated=null;
 if(previoAuto===true){
  // Option expiry = the deposit deadline of this very confirmation (pure; computed before the write).
  const deadline=buildBookingConfirmation({values,quote,previo:{reference:'V2-0',recordedAt:clock()},language}).deposit.receiptDeadlineUtc;
  previoCreated=await previoWriter.createOption({tenantId:record.tenantId,caseId:record.caseId,values,cabin,unit,
   contactName:String(values.name||'').trim()||'Vendég '+record.caseId,totalHuf:quote.total,optionExpiresUtc:deadline});
  previoReference='V2-'+previoCreated.resId;
 }
 const recordedAt=clock();
 const built=buildBookingConfirmation({values,quote,previo:{reference:previoReference,recordedAt},language});
 const draft={text:built.text,operatorReviewText:built.operatorReviewText};
 const booking={previoReference:built.previo.reference,previoRecordedAt:recordedAt,depositPct:built.deposit.pct,depositAmount:built.deposit.amount,depositDeadlineUtc:built.deposit.receiptDeadlineUtc,unit};
 // Internal unit number goes to the operator text only, never to the guest (AGENTS: no internal house numbers).
 draft.operatorReviewText+='\nEgység: '+unit+' (csak kezelői adat, a vendéglevélben nem szerepel).';
 if(previoUnit&&!previoCreated)draft.operatorReviewText+='\n'+previoUnitLine(previoUnit,unit,previoReference);
 if(previoUnit&&previoCreated)draft.operatorReviewText+='\nPrevio (csak olvasó, létrehozás előtt): a(z) '+unit+' egységen nem volt más foglalás erre az időszakra.';
 if(previoCreated)draft.operatorReviewText+=`\nPrevio (V2, automatikus): opció létrehozva a Previo-tesztben – azonosító ${previoCreated.resId}, egység ${unit}, lejár a foglalói határidővel. A foglaló beérkezésekor a rendszer megerősíti.`;
 const proof=attestConfirmation({key:attestationKey,tenantId:record.tenantId,caseId:record.caseId,expectedRevision:record.revision,draft,booking,checkedAt:clock()});
 let saved;
 try{saved=await transport('/rest/v1/rpc/sc_tm_confirm_booking',{method:'POST',body:{p_tenant:record.tenantId,p_case:record.caseId,p_expected:record.revision,p_booking:booking,p_draft:draft,p_proof:proof}});}
 catch(error){
  // Our record was not saved: a Previo option created just now for it must not stay behind.
  if(previoCreated?.created===true){try{await previoWriter.setStatus({resId:previoCreated.resId,status:'cancelled'});}catch{const e=Error('PREVIO_ORPHAN_OPTION');e.code='PREVIO_ORPHAN_OPTION';e.resId=previoCreated.resId;throw e;}}
  throw error;
 }
 // A conflict (nothing saved, no error) must not leave our new Previo option behind either.
 if(!saved&&previoCreated?.created===true){try{await previoWriter.setStatus({resId:previoCreated.resId,status:'cancelled'});}catch{fail('PREVIO_ORPHAN_OPTION');}}
 return {saved,deposit:built.deposit,previo:previoCreated};
}

// Separate operator step: the deposit has arrived (date as the operator saw it on the bank statement).
export async function markTestMailboxDepositReceived({record,receivedOn,depositConfirmed,transport,previoWriter=null}={}){
 if(depositConfirmed!==true)fail('DEPOSIT_NOT_CONFIRMED');
 if(typeof transport!=='function')fail('SETUP_REQUIRED');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(receivedOn||''))fail('INVALID_DATE');
 if(record?.data?.booking?.status!=='finalized')fail('NOT_FINALIZED');
 const v2=String(record.data.booking.previo?.reference||'').match(V2_REFERENCE);
 if(v2&&!previoWriter)fail('PREVIO_WRITE_DISABLED');
 const saved=await transport('/rest/v1/rpc/sc_tm_deposit_received',{method:'POST',body:{p_tenant:record.tenantId,p_case:record.caseId,p_expected:record.revision,p_received_on:receivedOn}});
 // V2: the Previo option becomes "confirmed" (green). Our state is already saved; a failed Previo update is reported.
 let previo=null;
 if(v2&&saved){try{await previoWriter.setStatus({resId:Number(v2[1]),status:'confirmed'});previo='confirmed';}catch{previo='confirm_failed';}}
 return previo?Object.assign(saved,{previoSync:previo}):saved;
}
