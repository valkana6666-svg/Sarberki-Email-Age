// Server-only. Owner 2026-11-19 (PERM-20261119-CHAT-PREFILL, TEST 73521 only): when the guest presses „Foglalás
// véglegesítése” in the chat, the system fills in the Previo TEST booking as an OPTION right away (dates, a free unit,
// guests by category, contact, accommodation price, source „weboldal”, the case's booking number) so the staff only
// check it. Own switch CHAT_PREVIO_PREFILL=test-only (default off) on top of the existing V2 writer locks; the option
// expires in 48 hours unless the staff approve it in the daily view (that step sets the deposit deadline). Idempotent:
// one case = one booking number. Any failure leaves the case as it is (the one-click step still works).
import {previoBookingWriter} from './server-previo-booking-sync.mjs';
import {previoTotalHuf} from './server-test-mailbox-confirm.mjs';
import {previoUnitChecker} from './server-previo-unit-check.mjs';
import {offerCheck} from './server-chat-offer.mjs';
import {unitsForCabin} from './server-test-mailbox-confirm.mjs';
import {fetchPublicPriceReference} from '../price-source/public-price-fallback.mjs';
import {isTestGuestSender} from '../gmail-policy.mjs';
import {previoGuestHistoryChecker} from './server-previo-guest-history.mjs';
import {applyReturningDiscount} from './returning-guest.mjs';

export const PREFILL_SWITCH='test-only';
export const PREFILL_OPTION_HOURS=48;

// Owner 2026-11-26 (PERM-20261126-VOICE-OPTION): the phone assistant uses the same pre-fill with channel 'phone' – own
// switch VOICE_INTAKE=test-only, Previo source „telefon”, its own staff note, no returning-guest check (the phone asks
// only for the e-mail; the name is a placeholder the staff replace).
export async function prefillChatBooking({env,fetchImpl=globalThis.fetch,tenantId,caseId,facts,name,email,phone,channel='chat',mainNote=null,
 quoteFn=fetchPublicPriceReference,writer=undefined,unitCheckFn=undefined,historyFn=undefined,now=()=>Date.now()}={}){
 if(!['chat','phone'].includes(channel))return {status:'off'};
 if((channel==='phone'?env?.VOICE_INTAKE:env?.CHAT_PREVIO_PREFILL)!==PREFILL_SWITCH)return {status:'off'};
 const w=writer===undefined?previoBookingWriter(env,fetchImpl):writer,check=unitCheckFn===undefined?previoUnitChecker(env,fetchImpl):unitCheckFn;
 if(!w||typeof check!=='function')return {status:'off'};
 const contactName=String(name||'').trim();if(!contactName)return {status:'skipped',reason:'NAME_REQUIRED'};
 const input=offerCheck(facts)?.input;if(!input)return {status:'skipped',reason:'FACTS'};
 // #9 7005064928: the staff approve in Previo, so Previo gets the right price: a certain returning guest (name + e-mail
 // + phone, RETURNING_GUEST_CHECK on) pays 20% less; a partial match is left to the staff (note).
 const history=channel==='phone'?null:historyFn===undefined?previoGuestHistoryChecker(env,fetchImpl):historyFn;
 let returning=null;
 if(typeof history==='function'){try{returning=await history({guest:{name:contactName,email,phone},referenceDay:input.arrival});}catch{returning={status:'unknown'};}} // owner 2026-11-21: from the arrival
 let quote;try{quote=applyReturningDiscount(await quoteFn(input),returning);}catch{return {status:'failed',reason:'PRICE'};}
 if(quote?.status!=='public_reference'||!Number.isSafeInteger(quote.accommodation)||quote.accommodation<=0||quote.cabin!==input.cabin)return {status:'failed',reason:'PRICE'};
 let unit=null;
 for(const u of unitsForCabin(input.cabin)){let r=null;try{r=await check({unit:u,arrival:input.arrival,departure:input.departure});}catch{}if(r?.status==='free'){unit=u;break;}}
 if(!unit)return {status:'skipped',reason:'NO_FREE_UNIT'};
 const mail=String(email||'').trim().toLowerCase(),tel=String(phone||'').trim();
 // Contact data to Previo: TEST test-pair senders only (AGENTS: no real guest data on TEST).
 const contact=isTestGuestSender(mail)?{email:mail,phone:/^\+?[0-9][0-9 ()\/-]{5,22}$/.test(tel)?tel:null}:null;
 const values={arrival:input.arrival,departure:input.departure,adults:String(input.adults),children:String(input.children.length),child_ages:input.children.join(',')};
 try{
  const r=await w.createOption({tenantId,caseId,values,cabin:input.cabin,unit,contactName,contact,totalHuf:previoTotalHuf(quote), // owner 2026-11-27: Previo's price is gross (stay + tourist tax),
   optionExpiresUtc:new Date(now()+PREFILL_OPTION_HOURS*3600000).toISOString(),channel,note:channel==='phone'?PHONE_NOTE+weeklyNote(quote):prefillNote(returning,quote),...(mainNote?{mainNote}:{})});
  return {status:'created',unit,resId:r.resId,created:r.created,returning:returning?.status??null};
 }catch(error){return {status:'failed',reason:typeof error?.code==='string'?error.code:'WRITE'};}
}

// Phone note: no comma/colon/dash (Previo drops them). Not „Chatből” – the chat's expiry auto-cancel does not apply.
export const PHONE_NOTE='Telefonról érkezett. A hívó elfogadta az ajánlatot. Nevet és email címet adott. A többi adatot kérd el emailben és töltsd ki. Ellenőrizd és ha rendben van állítsd megerősítettre.';
// Staff note in Previo (no guest contact data): where the booking came from and what was checked.
// 7=6 (owner 2026-11-27): the free nights are written for the staff too (short sentence, Previo drops punctuation).
const weeklyNote=quote=>quote?.weeklyFree?.amount>0?` 7=6 kedvezmény ${quote.weeklyFree.freeNights} éjszaka ingyenes (${quote.weeklyFree.amount} Ft) beszámítva.`:'';
export function prefillNote(returning,quote){return prefillNoteBase(returning,quote)+weeklyNote(quote);}
function prefillNoteBase(returning,quote){
 // Previo keeps letters, digits, dots and brackets but drops commas, colons and dashes (live TEST 2026-11-21): short
 // sentences only.
 const base='Chatből érkezett. A vendég véglegesítette. A rendszer töltötte ki. Ellenőrizd és ha rendben van állítsd megerősítettre.';
 if(returning?.status==='eligible')return base+` Törzsvendég (név és e-mail és telefon egyezik. Utolsó tartózkodás ${returning.lastStay}). ${returning.pct} százalék kedvezmény beszámítva (${quote?.returningDiscount?.amount??'?'} Ft). A dézsa árából is ${returning.pct} százalék jár.`;
 if(returning?.status==='possible')return base+` Lehetséges törzsvendég (részleges egyezés. Utolsó tartózkodás ${returning.lastStay}). A kedvezményről te döntesz.`;
 return base;
}
