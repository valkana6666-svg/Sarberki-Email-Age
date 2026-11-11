// V2 step 3 (owner 2026-11-09: "haladjál 1-től 3-ig"): the Previo booking write, PREPARED and OFF. Builds the
// Previo XML `Hotel.reservation` request (https://xml.apidocs.previo.app, read by Claude 2026-11-09) from a finalized
// V1 booking and its operator-chosen unit, and guards the one network call behind four independent locks:
//  1. API TEST property 73521 only (the live 753011 is refused in code, whatever the switch says);
//  2. server switch PREVIO_WRITE_ENABLED === 'sandbox-73521-only' (default off; not set anywhere);
//  3. a per-operation owner permission id recorded in docs/V1-ALLAPOT.md "Engedélyek" (AGENTS.md);
//  4. idempotency: our voucher "SC-<hash>" is searched first; an existing reservation is never created twice.
// Status ids (System.getReservationStatuses, read 2026-11-09): 1 opce = option (V1 "Véglegesítve", deposit not
// paid yet), 2 potvrzeno = confirmed (V1 "Foglaló beérkezett"), 7 storno. Guest data: only category + count; the
// contact name is the operator's choice and no e-mail/phone is ever sent from here.
import {createHash} from 'node:crypto';
import {PREVIO_TEST_73521} from './previo-booking-intent.mjs';

export const PREVIO_XML_ORIGIN='https://api.previo.app';
export const WRITE_SWITCH_VALUE='sandbox-73521-only';
export const STATUS=Object.freeze({option:1,confirmed:2,cancelled:7});
const HUF_CURRENCY_ID=9;            // REST suggester + public booking page (CUR_ID 9 = HUF), 73521, 2026-11-09
const SOURCE_EMAIL=1;               // cmsId 1 = e-mail (Previo XML docs)
const fail=code=>{const e=Error(code);e.code=code;throw e;};
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const xmlText=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const int=v=>Number.isSafeInteger(v)&&v>0;

// Stable, guest-data-free reservation identifier for idempotency (same tenant + case -> same voucher).
export function voucherFor({tenantId,caseId}){
 if(typeof tenantId!=='string'||!tenantId||typeof caseId!=='string'||!caseId)fail('CASE_REQUIRED');
 return 'SC-'+createHash('sha256').update(tenantId+'\n'+caseId,'utf8').digest('hex').slice(0,16).toUpperCase();
}

// Guests by category only: adults as "Felnőtt", every child 0–17 in its age category (IFA-exempt in Previo).
function guestCategories(values,property){
 const adults=Number(values.adults);if(!Number.isInteger(adults)||adults<1)fail('ADULTS_REQUIRED');
 const ages=String(values.child_ages||'').split(',').filter(Boolean).map(Number);
 if(Number(values.children||0)!==ages.length||ages.some(a=>!Number.isInteger(a)||a<0||a>17))fail('CHILD_AGES_REQUIRED');
 const cats=property.guestCategories;if(!int(cats?.adult))fail('GUEST_CATEGORY_UNVERIFIED');
 const child=age=>{const c=(cats.child||[]).find(c=>age>=c.minAge&&age<=c.maxAge);if(!c||!int(c.id))fail('GUEST_CATEGORY_UNVERIFIED');return c.id;};
 return [...Array(adults).fill(cats.adult),...ages.map(child)];
}

// Pure: the XML body for creating ONE room reservation in status "option" (V1 finalized, deposit pending).
// contact (optional, V2 owner 2026-11-11): {email, phone} of the contact person. The caller decides whether guest
// contact data may leave our system (server-previo-booking-sync.mjs: test-pair sender only); invalid values refuse.
export function contactPersonXml(name,contact){
 const email=contact?.email==null?null:String(contact.email).trim().toLowerCase();
 const phone=contact?.phone==null?null:String(contact.phone).trim();
 if(email!==null&&!/^[^\s@<>"']{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/.test(email))fail('CONTACT_EMAIL_INVALID');
 if(phone!==null&&!/^\+?[0-9][0-9 ()\/-]{5,22}$/.test(phone))fail('CONTACT_PHONE_INVALID');
 return `<contactPerson><name>${xmlText(name)}</name>${email?`<email>${xmlText(email)}</email>`:''}${phone?`<phone>${xmlText(phone)}</phone>`:''}</contactPerson>`;
}
// Multi-unit (owner 2026-11-11): units (2..6, first = unit) and parties [{adults,children:[ages]}] per unit -> one
// reservation with one commission per unit (Previo XML "New group reservation").
export function buildReservationXml({tenantId,caseId,values,cabin,unit,units=null,parties=null,contactName,contact=null,totalHuf,optionExpiresUtc,property=PREVIO_TEST_73521}){
 if(String(property?.hotelId)!=='73521')fail('SANDBOX_ONLY');
 if(!day(values?.arrival)||!day(values?.departure)||values.departure<=values.arrival)fail('DATES_REQUIRED');
 const obkId=property.roomKinds?.[cabin];if(!int(obkId))fail('ROOM_KIND_UNKNOWN');
 const list=Array.isArray(units)&&units.length>1?units:[unit];
 if(list[0]!==unit||new Set(list).size!==list.length||list.length>6||list.some(u=>!int(property.rooms?.[u])))fail('UNIT_UNKNOWN');
 if(list.length>1&&(!Array.isArray(parties)||parties.length!==list.length))fail('PARTIES_REQUIRED');
 if(!Number.isSafeInteger(totalHuf)||totalHuf<=0)fail('PRICE_REQUIRED');
 const name=String(contactName||'').trim();if(!name||name.length>80||/[\r\n]/.test(name))fail('CONTACT_NAME_REQUIRED');
 if(typeof optionExpiresUtc!=='string'||Number.isNaN(Date.parse(optionExpiresUtc)))fail('OPTION_EXPIRY_REQUIRED');
 const partyValues=list.length>1?parties.map(p=>({adults:String(p.adults),children:String((p.children||[]).length),child_ages:(p.children||[]).join(',')})):[values];
 const guestsPerUnit=partyValues.map(v=>guestCategories(v,property));
 const voucher=voucherFor({tenantId,caseId});
 const expiry=new Date(optionExpiresUtc).toISOString().slice(0,19).replace('T',' ');
 const xml=['<?xml version="1.0"?>','<request>',`<hotId>${property.hotelId}</hotId>`,'<newReservation>','<commissions>',
  ...list.map((u,i)=>['<commission>',`<guests><numGuest>${guestsPerUnit[i].length}</numGuest>`,...guestsPerUnit[i].map(g=>`<guest><guaId>${g}</guaId></guest>`),'</guests>',
   `<obkId>${obkId}</obkId><objId>${property.rooms[u]}</objId><cosId>${STATUS.option}</cosId><cmsId>${SOURCE_EMAIL}</cmsId><prlId>${property.ratePlanId}</prlId>`,
   '</commission>'].join('')),
  '</commissions>',
  `<optionExpiration>${expiry}</optionExpiration>`,
  `<term><from>${values.arrival} 14:00:00</from><to>${values.departure} 10:00:00</to></term>`,
  `<voucher>${voucher}</voucher>`,
  contactPersonXml(name,contact),
  `<price><total>${totalHuf}</total><curId>${HUF_CURRENCY_ID}</curId></price>`,
  '</newReservation>','</request>'].join('');
 return Object.freeze({url:PREVIO_XML_ORIGIN+'/x1/hotel/reservation',hotelId:property.hotelId,voucher,arrival:values.arrival,departure:values.departure,xml});
}

// Modification (owner 2026-11-11): new dates and/or a new unit of the same room kind for a single-room reservation.
// Previo XML "Modify" (resId + term + price; the room by its commission comId + objId).
export function buildModifyXml({resId,comId,cabin,unit,values,totalHuf,property=PREVIO_TEST_73521}){
 if(String(property?.hotelId)!=='73521')fail('SANDBOX_ONLY');
 if(!int(resId)||!int(comId))fail('RESERVATION_ID_REQUIRED');
 if(!day(values?.arrival)||!day(values?.departure)||values.departure<=values.arrival)fail('DATES_REQUIRED');
 const obkId=property.roomKinds?.[cabin];if(!int(obkId))fail('ROOM_KIND_UNKNOWN');
 const objId=property.rooms?.[unit];if(!int(objId))fail('UNIT_UNKNOWN');
 if(!Number.isSafeInteger(totalHuf)||totalHuf<=0)fail('PRICE_REQUIRED');
 return Object.freeze({url:PREVIO_XML_ORIGIN+'/x1/hotel/reservation',hotelId:property.hotelId,
  xml:['<?xml version="1.0"?>','<request>',`<hotId>${property.hotelId}</hotId>`,'<newReservation>',`<resId>${resId}</resId>`,
   `<commissions><commission><comId>${comId}</comId><obkId>${obkId}</obkId><objId>${objId}</objId></commission></commissions>`,
   `<term><from>${values.arrival} 14:00:00</from><to>${values.departure} 10:00:00</to></term>`,
   `<price><total>${totalHuf}</total><curId>${HUF_CURRENCY_ID}</curId></price>`,'</newReservation>','</request>'].join('')});
}

// Status change on an existing reservation: deposit arrived -> confirmed; cancellation -> storno.
export function buildStatusXml({resId,status,property=PREVIO_TEST_73521}){
 if(String(property?.hotelId)!=='73521')fail('SANDBOX_ONLY');
 if(!int(resId))fail('RESERVATION_ID_REQUIRED');
 const cos=STATUS[status];if(!cos||status==='option')fail('STATUS_NOT_ALLOWED');
 return Object.freeze({url:PREVIO_XML_ORIGIN+'/x1/hotel/reservation',hotelId:property.hotelId,
  xml:`<?xml version="1.0"?><request><hotId>${property.hotelId}</hotId><newReservation><resId>${resId}</resId><gCosId>${cos}</gCosId></newReservation></request>`});
}

// Hotel.searchReservations needs a term; fulltext also matches the voucher number (Previo XML docs).
// Default search omits cancelled records (73521 readback, 2026-11-10). Include all eight
// reservation statuses: a cancelled/no-show voucher still belongs to the same case.
export function buildVoucherSearchXml({hotelId,voucher,arrival,departure}){
 if(String(hotelId)!=='73521')fail('SANDBOX_ONLY');
 if(!/^SC-[0-9A-F]{16}$/.test(voucher||'')||!day(arrival)||!day(departure))fail('SEARCH_INVALID');
 const statuses=[1,2,3,4,5,6,7,8].map(id=>`<cosId>${id}</cosId>`).join('');
 return `<?xml version="1.0"?><request><hotId>${hotelId}</hotId><term><from>${arrival}</from><to>${departure}</to></term><fulltext>${voucher}</fulltext><statuses>${statuses}</statuses><limit><offset>0</offset><limit>10</limit></limit></request>`;
}
// Every reservation block with exactly our voucher (fulltext may also match names etc.).
export function reservationsWithVoucher(text,voucher){
 return [...String(text||'').matchAll(/<reservation>([\s\S]*?)<\/reservation>/g)].map(m=>parseReservationResponse(m[1]))
  .filter(r=>r.ok&&r.voucher===voucher);
}

// Minimal response reading: an <error> or the first reservation's ids and status.
export function parseReservationResponse(text){
 const s=String(text||'');
 const err=s.match(/<error>\s*<code>(\d+)<\/code>\s*<message>([^<]*)<\/message>/);
 if(err){const code=Number(err[1]);return Object.freeze({ok:false,previoCode:code,code:code===1001?'UNIT_TAKEN':code===401?'PREVIO_AUTH_REFUSED':'PREVIO_REJECTED'});}
 const pick=tag=>{const m=s.match(new RegExp(`<${tag}>(\\d+)</${tag}>`));return m?Number(m[1]):null;};
 const resId=pick('resId'),comId=pick('comId'),statusId=pick('statusId');
 const voucher=s.match(/<voucher>([^<]*)<\/voucher>/)?.[1]??null;
 if(!int(resId))return Object.freeze({ok:false,previoCode:null,code:'PREVIO_RESPONSE_UNREADABLE'});
 return Object.freeze({ok:true,resId,comId,statusId,voucher});
}

// The only network path. Every lock is checked before any request; the search runs first (idempotency).
// Default 60 s: a 73521 create answered after more than 20 s on 2026-11-11 (sandbox trial; the reservation existed).
// A timeout is never a failure to create: the caller re-reads by voucher (idempotent) before any retry.
export async function writePrevioReservation({env={},permissionId,request,fetchImpl=globalThis.fetch,timeoutMs=60000}={}){
 if(env.PREVIO_WRITE_ENABLED!==WRITE_SWITCH_VALUE)fail('WRITE_DISABLED');
 if(typeof permissionId!=='string'||!/^PERM-\d{8}-[A-Z0-9-]{2,40}$/.test(permissionId))fail('OWNER_PERMISSION_REQUIRED');
 if(!request||String(request.hotelId)!=='73521'||request.url!==PREVIO_XML_ORIGIN+'/x1/hotel/reservation')fail('SANDBOX_ONLY');
 if(typeof env.PREVIO_API_KEY!=='string'||env.PREVIO_API_KEY.length<16)fail('PREVIO_KEY_MISSING');
 const call=async(path,xml)=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const r=await fetchImpl(PREVIO_XML_ORIGIN+path,{method:'POST',redirect:'error',cache:'no-store',signal:controller.signal,
    headers:{Authorization:'ApiKey '+env.PREVIO_API_KEY,'Content-Type':'application/xml',Accept:'application/xml'},body:xml});
   if(r.status===401||r.status===403)fail('PREVIO_AUTH_REFUSED');
   return await r.text();
  }catch(e){if(e?.code)throw e;fail(controller.signal.aborted?'PREVIO_TIMEOUT':'PREVIO_UNAVAILABLE');}
  finally{clearTimeout(timer);}
 };
 const found=await call('/x1/hotel/searchReservations',buildVoucherSearchXml(request));
 if(/<error>/.test(found))fail('PREVIO_SEARCH_FAILED');   // unknown -> never create blindly
 const existing=reservationsWithVoucher(found,request.voucher);
 if(existing.length)return Object.freeze({...existing[0],created:false,permissionId});
 const result=parseReservationResponse(await call('/x1/hotel/reservation',request.xml));
 if(!result.ok)fail(result.code);
 return Object.freeze({...result,created:true,permissionId});
}
