// Server-only. V2 (owner 2026-11-11: "jussunk el a V2 szintig"): the operator's existing buttons drive the Previo
// TEST booking – "Véglegesítés" creates an option on the chosen unit, "Foglaló beérkezett" confirms it. Built on the
// proven pieces (server-previo-reservation-write.mjs: create/confirm/cancel PASS on 73521, 2026-11-10/11).
// Locks: API TEST 73521 only; switch PREVIO_WRITE_ENABLED=sandbox-73521-only (default off); a recorded owner
// permission id in PREVIO_WRITE_PERMISSION_ID; idempotent voucher per case. No guest e-mail/phone is sent.
import {buildReservationXml,buildStatusXml,buildVoucherSearchXml,reservationsWithVoucher,parseReservationResponse,
 writePrevioReservation,WRITE_SWITCH_VALUE,PREVIO_XML_ORIGIN} from './server-previo-reservation-write.mjs';

const fail=code=>{const e=Error(code);e.code=code;throw e;};
export const V2_REFERENCE=/^V2-(\d{1,12})$/;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// null = V2 writing is off (the V1 manual Previo step applies).
export function previoBookingWriter(env,fetchImpl=globalThis.fetch,{pauseMs=5000}={}){
 if(env?.PREVIO_WRITE_ENABLED!==WRITE_SWITCH_VALUE||String(env?.PREVIO_HOTEL_ID)!=='73521')return null;
 const permissionId=env.PREVIO_WRITE_PERMISSION_ID;
 if(typeof permissionId!=='string'||!/^PERM-\d{8}-[A-Z0-9-]{2,40}$/.test(permissionId))return null;
 if(typeof env.PREVIO_API_KEY!=='string'||env.PREVIO_API_KEY.length<16)return null;
 const writeEnv={PREVIO_WRITE_ENABLED:WRITE_SWITCH_VALUE,PREVIO_API_KEY:env.PREVIO_API_KEY};
 // Guest contact (e-mail, phone) goes to Previo only with its own switch; TEST: fictional test-pair letters only.
 const sendContact=env.PREVIO_SEND_GUEST_CONTACT==='test-pair-only';
 const post=async(path,xml)=>{
  const r=await fetchImpl(PREVIO_XML_ORIGIN+path,{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(60000),
   headers:{Authorization:'ApiKey '+env.PREVIO_API_KEY,'Content-Type':'application/xml',Accept:'application/xml'},body:xml});
  if(r.status===401||r.status===403)fail('PREVIO_AUTH_REFUSED');
  return r.text();
 };
 const findOwn=async request=>{const text=await post('/x1/hotel/searchReservations',buildVoucherSearchXml(request));
  if(/<error>/.test(text))fail('PREVIO_SEARCH_FAILED');return reservationsWithVoucher(text,request.voucher);};
 return Object.freeze({permissionId,sendContact,
  // Creates (or finds, if this case already has one) the option on the unit. A slow answer is re-read by voucher,
  // never re-sent: an unconfirmed outcome stops with PREVIO_WRITE_UNCERTAIN for a manual Previo check.
  async createOption({tenantId,caseId,values,cabin,unit,units=null,parties=null,contactName,contact=null,totalHuf,optionExpiresUtc}){
   const request=buildReservationXml({tenantId,caseId,values,cabin,unit,units,parties,contactName,contact:sendContact?contact:null,totalHuf,optionExpiresUtc});
   try{
    const r=await writePrevioReservation({env:writeEnv,permissionId,request,fetchImpl});
    // An existing record for this case is reused only while it is active (option/confirmed); a cancelled one stops.
    if(r.created===false&&![1,2].includes(r.statusId))fail('PREVIO_BOOKING_NOT_ACTIVE');
    return {resId:r.resId,voucher:request.voucher,created:r.created};
   }catch(error){
    if(!['PREVIO_TIMEOUT','PREVIO_UNAVAILABLE','PREVIO_RESPONSE_UNREADABLE'].includes(error?.code))throw error;
    await sleep(pauseMs);
    let found=[];try{found=await findOwn(request);}catch{fail('PREVIO_WRITE_UNCERTAIN');}
    if(found.length===1&&found[0].ok)return {resId:found[0].resId,voucher:request.voucher,created:true};
    fail('PREVIO_WRITE_UNCERTAIN');
   }
  },
  async setStatus({resId,status}){
   const result=parseReservationResponse(await post('/x1/hotel/reservation',buildStatusXml({resId,status}).xml));
   if(!result.ok)fail(result.code);
   return result;
  }
 });
}
