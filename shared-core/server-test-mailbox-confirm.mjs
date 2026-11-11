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
import {senderAddress,TEST_GUEST_SENDER} from '../gmail-policy.mjs';

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
  booking.previoRecordedAt,String(booking.depositPct),String(booking.depositAmount),booking.depositDeadlineUtc,
  // Multi-unit (booking-multiunit.sql): the comma-joined list stands in for the single unit.
  Array.isArray(booking.units)?booking.units.join(','):booking.unit,checkedAt];
 if(fields.some(v=>typeof v!=='string'||!v||/[\r\n]/.test(v)))fail('INVALID_EVIDENCE');
 return {scope:CONFIRM_SCOPE,checkedAt,attestation:createHmac('sha256',Buffer.from(key,'hex')).update(fields.join('\n')).digest('hex')};
}

// V2 step 1b (owner 2026-11-07): the operator names the unit; it must belong to the case's cabin type and be
// free in our own finalized bookings (pre-check here for a clear message; the database re-checks under a lock).
async function unitTaken({transport,record,unit,arrival,departure}){
 let rows=[];
 try{rows=await transport('/rest/v1/sc_cases?select=case_id,data&tenant_id=eq.'+encodeURIComponent(record.tenantId)+'&data->booking->>status=in.(finalized,deposit_received)');}catch{return false;}
 const bookings=(Array.isArray(rows)?rows:[]).filter(r=>r.case_id!==record.caseId&&['finalized','deposit_received'].includes(r.data?.booking?.status)
   &&(r.data?.booking?.unit===unit||(Array.isArray(r.data?.booking?.units)&&r.data.booking.units.includes(unit))))
  .map(r=>({key:r.case_id,unit,arrival:r.data?.state?.values?.arrival,departure:r.data?.state?.values?.departure,source:'synthetic',status:'confirmed'}))
  .filter(b=>/^\d{4}-\d{2}-\d{2}$/.test(b.arrival||'')&&/^\d{4}-\d{2}-\d{2}$/.test(b.departure||'')&&b.departure>b.arrival);
 return conflictsFor(bookings,{unit,arrival,departure}).length>0;
}
// Units that may share one booking with the case's type: the type's own units; the 2-person A and B apartments
// are one priced pool (business-config), so an A+B pair (e.g. 7/A + 7/B) is allowed for either of them.
export function unitsForCabin(cabin){
 const keys=cabin==='splitA'||cabin==='splitB'?['splitA','splitB']:[cabin];
 return keys.flatMap(k=>unitsOfType(k).map(u=>u.id));
}

export async function confirmTestMailboxBooking({record,previoReference,previoRecorded,previoAuto=false,previoWriter=null,unit,units=null,attestationKey,transport,
 quoteFn=fetchPublicPriceReference,unitCheckFn=null,clock=()=>new Date().toISOString()}={}){
 if(previoAuto===true){if(!previoWriter)fail('PREVIO_WRITE_DISABLED');}
 else if(previoRecorded!==true)fail('PREVIO_RECORDING_REQUIRED');
 if(typeof transport!=='function')fail('SETUP_REQUIRED');
 if(['finalized','deposit_received'].includes(record?.data?.booking?.status))fail('ALREADY_FINALIZED');
 const values=record?.data?.state?.values||{};
 const cabin=cabinKeyFromUnit(values.unit);
 // Multi-unit (owner 2026-11-11): exactly the requested number of distinct units, first = unit.
 const requested=Number(values.units_requested||1);
 const list=Array.isArray(units)&&units.length>1?units:[unit];
 if(list.length>1&&(list[0]!==unit||new Set(list).size!==list.length||list.length>6))fail('UNITS_INVALID');
 if(list.length!==(Number.isInteger(requested)&&requested>0?requested:1))fail('UNITS_COUNT_MISMATCH');
 const allowed=unitsForCabin(cabin);
 if(list.some(u=>!allowed.includes(u)))fail('UNIT_NOT_IN_TYPE');
 let quote;
 try{quote=quoteFn({...quoteInputFromCase(values,cabin),...(list.length>1?{units:list.length}:{})});}catch(error){if(error?.code==='PRICE_FACTS_MISSING')fail('CONFIRMATION_FACTS_MISSING');fail('CONFIRMATION_PRICE_MISSING');}
 for(const u of list)if(await unitTaken({transport,record,unit:u,arrival:values.arrival,departure:values.departure}))fail('UNIT_TAKEN');
 // V2 step 4: the same unit(s) in Previo itself (read-only). Another reservation there -> refuse; unreadable -> note only.
 let previoUnit=null;
 if(typeof unitCheckFn==='function'){
  for(const u of list){let r;try{r=await unitCheckFn({unit:u,arrival:values.arrival,departure:values.departure,previoReference});}catch{r={status:'unknown'};}
   if(r?.status==='taken')fail('UNIT_TAKEN_IN_PREVIO');
   if(!previoUnit||r?.status!=='free')previoUnit=r;}
 }
 const language=/^(hu|de|en|si)$/.test(values.language||'')?values.language:'hu';
 let previoCreated=null,sentContact=null;
 if(previoAuto===true){
  // Option expiry = the deposit deadline of this very confirmation (pure; computed before the write).
  const deadline=buildBookingConfirmation({values,quote,previo:{reference:'V2-0',recordedAt:clock()},language}).deposit.receiptDeadlineUtc;
  // Contact data only from the fictional test-pair sender (AGENTS: no real guest data on TEST); phone if extracted.
  const email=senderAddress(record.data?.sender);
  const contact=sentContact=email===TEST_GUEST_SENDER?{email,phone:/^\+?[0-9][0-9 ()\/-]{5,22}$/.test(String(values.phone||'').trim())?String(values.phone).trim():null}:null;
  previoCreated=await previoWriter.createOption({tenantId:record.tenantId,caseId:record.caseId,values,cabin,unit,
   ...(list.length>1?{units:list,parties:quote.unitBreakdown.map(b=>({adults:b.adults,children:b.children}))}:{}),
   contactName:String(values.name||'').trim()||'Vendég '+record.caseId,contact,totalHuf:quote.total,optionExpiresUtc:deadline});
  previoReference='V2-'+previoCreated.resId;
 }
 const recordedAt=clock();
 const built=buildBookingConfirmation({values,quote,previo:{reference:previoReference,recordedAt},language,bookingNumber:previoCreated?.voucher??null});
 const draft={text:built.text,operatorReviewText:built.operatorReviewText};
 const booking={previoReference:built.previo.reference,previoRecordedAt:recordedAt,depositPct:built.deposit.pct,depositAmount:built.deposit.amount,depositDeadlineUtc:built.deposit.receiptDeadlineUtc,unit};
 if(list.length>1)booking.units=list;
 // Internal unit number goes to the operator text only, never to the guest (AGENTS: no internal house numbers).
 draft.operatorReviewText+='\n'+(list.length>1?'Egységek: '+list.join(', '):'Egység: '+unit)+' (csak kezelői adat, a vendéglevélben nem szerepel).';
 if(previoUnit&&!previoCreated)draft.operatorReviewText+='\n'+previoUnitLine(previoUnit,unit,previoReference);
 if(previoUnit&&previoCreated)draft.operatorReviewText+='\nPrevio (csak olvasó, létrehozás előtt): a(z) '+unit+' egységen nem volt más foglalás erre az időszakra.';
 if(previoCreated)draft.operatorReviewText+=`\nPrevio (V2, automatikus): opció létrehozva a Previo-tesztben – azonosító ${previoCreated.resId}, ${list.length>1?'egységek '+list.join(', '):'egység '+unit}, lejár a foglalói határidővel${previoWriter.sendContact&&sentContact?'; kapcsolattartó: név, e-mail'+(sentContact.phone?', telefon':''):'; kapcsolattartó: csak név'}. A foglaló beérkezésekor a rendszer megerősíti.`;
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

// V2 (owner 2026-11-11): cancellation from the operator view. Our state first (database, under CAS); then, for a V2
// booking, the Previo TEST record is cancelled (7). A manual V1 reference is only marked here: the operator cancels in
// Previo by hand. No guest letter is generated or sent.
export async function cancelTestMailboxBooking({record,reason,cancelConfirmed,transport,previoWriter=null}={}){
 if(cancelConfirmed!==true)fail('CANCEL_NOT_CONFIRMED');
 if(typeof transport!=='function')fail('SETUP_REQUIRED');
 const text=String(reason||'').trim();
 if(!text||text.length>300||/[\r\n]/.test(text))fail('INVALID_REASON');
 if(!['finalized','deposit_received'].includes(record?.data?.booking?.status))fail('NOT_ACTIVE_BOOKING');
 const v2=String(record.data.booking.previo?.reference||'').match(V2_REFERENCE);
 if(v2&&!previoWriter)fail('PREVIO_WRITE_DISABLED');
 const saved=await transport('/rest/v1/rpc/sc_tm_cancel_booking',{method:'POST',body:{p_tenant:record.tenantId,p_case:record.caseId,p_expected:record.revision,p_reason:text}});
 let previo=null;
 if(v2&&saved){try{await previoWriter.setStatus({resId:Number(v2[1]),status:'cancelled'});previo='cancelled';}catch{previo='cancel_failed';}}
 else if(saved)previo='manual';
 return saved?Object.assign(saved,{previoSync:previo}):saved;
}
