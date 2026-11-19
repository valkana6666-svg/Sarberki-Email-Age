// Server-only. Owner 2026-11-19 (PERM-20261119-CHAT-PREFILL, TEST 73521 only): when the guest presses „Foglalás
// véglegesítése” in the chat, the system fills in the Previo TEST booking as an OPTION right away (dates, a free unit,
// guests by category, contact, accommodation price, source „weboldal”, the case's booking number) so the staff only
// check it. Own switch CHAT_PREVIO_PREFILL=test-only (default off) on top of the existing V2 writer locks; the option
// expires in 48 hours unless the staff approve it in the daily view (that step sets the deposit deadline). Idempotent:
// one case = one booking number. Any failure leaves the case as it is (the one-click step still works).
import {previoBookingWriter} from './server-previo-booking-sync.mjs';
import {previoUnitChecker} from './server-previo-unit-check.mjs';
import {offerCheck} from './server-chat-offer.mjs';
import {unitsForCabin} from './server-test-mailbox-confirm.mjs';
import {fetchPublicPriceReference} from '../price-source/public-price-fallback.mjs';
import {isTestGuestSender} from '../gmail-policy.mjs';

export const PREFILL_SWITCH='test-only';
export const PREFILL_OPTION_HOURS=48;

export async function prefillChatBooking({env,fetchImpl=globalThis.fetch,tenantId,caseId,facts,name,email,phone,
 quoteFn=fetchPublicPriceReference,writer=undefined,unitCheckFn=undefined,now=()=>Date.now()}={}){
 if(env?.CHAT_PREVIO_PREFILL!==PREFILL_SWITCH)return {status:'off'};
 const w=writer===undefined?previoBookingWriter(env,fetchImpl):writer,check=unitCheckFn===undefined?previoUnitChecker(env,fetchImpl):unitCheckFn;
 if(!w||typeof check!=='function')return {status:'off'};
 const contactName=String(name||'').trim();if(!contactName)return {status:'skipped',reason:'NAME_REQUIRED'};
 const input=offerCheck(facts)?.input;if(!input)return {status:'skipped',reason:'FACTS'};
 let quote;try{quote=await quoteFn(input);}catch{return {status:'failed',reason:'PRICE'};}
 if(quote?.status!=='public_reference'||!Number.isSafeInteger(quote.accommodation)||quote.accommodation<=0||quote.cabin!==input.cabin)return {status:'failed',reason:'PRICE'};
 let unit=null;
 for(const u of unitsForCabin(input.cabin)){let r=null;try{r=await check({unit:u,arrival:input.arrival,departure:input.departure});}catch{}if(r?.status==='free'){unit=u;break;}}
 if(!unit)return {status:'skipped',reason:'NO_FREE_UNIT'};
 const mail=String(email||'').trim().toLowerCase(),tel=String(phone||'').trim();
 // Contact data to Previo: TEST test-pair senders only (AGENTS: no real guest data on TEST).
 const contact=isTestGuestSender(mail)?{email:mail,phone:/^\+?[0-9][0-9 ()\/-]{5,22}$/.test(tel)?tel:null}:null;
 const values={arrival:input.arrival,departure:input.departure,adults:String(input.adults),children:String(input.children.length),child_ages:input.children.join(',')};
 try{
  const r=await w.createOption({tenantId,caseId,values,cabin:input.cabin,unit,contactName,contact,totalHuf:quote.accommodation,
   optionExpiresUtc:new Date(now()+PREFILL_OPTION_HOURS*3600000).toISOString(),channel:'chat'});
  return {status:'created',unit,resId:r.resId,created:r.created};
 }catch(error){return {status:'failed',reason:typeof error?.code==='string'?error.code:'WRITE'};}
}
