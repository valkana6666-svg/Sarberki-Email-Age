// Server-only (excluded from dist by the server- prefix). V3-1 shared intake (owner-approved V3 plan 2026-11-12,
// #9 6822281802): a voice agent (phone) or the chatbot hands over structured stay facts + a short summary.
// 1. checkIntakeAvailability: the existing central decision + the existing read-only Previo path -> a structured
//    status and the guest sentence in the caller's language (no price, no booking).
// 2. createIntakeRequest: the existing case engine + draft path -> one pending test-mailbox case for the operator
//    (sc_intake_create, server-attested, idempotent per channel + external id). Nothing is sent or booked.
// Requests are authenticated with an HMAC signature (verifyIntakeSignature); the database write uses the dedicated
// intake account's own Supabase session (no service role).
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {createBookingCaseStore} from '../booking-cases.mjs';
import {serverInquiryOptions} from './server-inquiry-options.mjs';
import {emailDraftWithCapacity} from './server-capacity-draft.mjs';
import {evaluateCentralInquiry} from './central-inquiry-decision.mjs';
import {guestConversation} from './inquiry-channel-adapters.mjs';
import {buildAvailabilityOptions} from '../netlify/functions/availability-options.mjs';
import {scope} from './server-test-mailbox-case.mjs';

export const INTAKE_SCOPE='intake-source-v1';
const CHANNELS=['phone','chat'],LANGS=['hu','de','en','si'];
const CABINS={vip:'VIP',family:'Családi',deluxe:'Deluxe',small:'Különálló 2 fős',split:'Osztott',splitA:'Osztott A',splitB:'Osztott B',splitC:'Osztott C'};
const fail=code=>{const error=Error(code);error.code=code;throw error;};
const sha=text=>createHash('sha256').update(String(text),'utf8').digest('hex');
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z'));

// HMAC-SHA256 over "<unix seconds>.<raw body>", header "t=<seconds>,v1=<hex>"; 5-minute window, constant-time compare.
export function signIntake(key,body,seconds=Math.floor(Date.now()/1000)){
 return `t=${seconds},v1=${createHmac('sha256',Buffer.from(key,'hex')).update(seconds+'.'+body).digest('hex')}`;
}
export function verifyIntakeSignature({key,header,body,now=Date.now()}){
 if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))fail('SETUP_REQUIRED');
 const m=/^t=(\d{9,11}),v1=([a-f0-9]{64})$/.exec(String(header||''));
 if(!m||typeof body!=='string')fail('FORBIDDEN');
 if(Math.abs(now/1000-Number(m[1]))>300)fail('FORBIDDEN');
 const want=createHmac('sha256',Buffer.from(key,'hex')).update(m[1]+'.'+body).digest();
 if(!timingSafeEqual(want,Buffer.from(m[2],'hex')))fail('FORBIDDEN');
 return true;
}

// Untrusted structured facts from the voice agent / chat -> the engine's string values (strict; unknown keys ignored).
export function intakeValues(facts={}){
 const v={};
 if(day(facts.arrival)&&day(facts.departure)&&facts.departure>facts.arrival){v.arrival=facts.arrival;v.departure=facts.departure;}
 const int=(x,min,max)=>Number.isInteger(x)&&x>=min&&x<=max;
 if(int(facts.adults,1,40))v.adults=String(facts.adults);
 const ages=Array.isArray(facts.childAges)&&facts.childAges.every(a=>int(a,0,17))&&facts.childAges.length<=10?facts.childAges:null;
 if(int(facts.children,0,20))v.children=String(facts.children);else if(ages)v.children=String(ages.length);
 if(ages&&ages.length)v.child_ages=ages.join(',');
 if(v.adults&&v.children!==undefined)v.guests=String(Number(v.adults)+Number(v.children));
 if(typeof facts.cabin==='string'&&CABINS[facts.cabin])v.unit=CABINS[facts.cabin];
 if(int(facts.units,1,6))v.units_requested=String(facts.units);
 if(typeof facts.phone==='string'&&/^\+?[0-9][0-9 ()\/-]{5,22}$/.test(facts.phone.trim()))v.phone=facts.phone.trim();
 if(typeof facts.name==='string'&&/^[\p{L}][\p{L} .'-]{0,78}$/u.test(facts.name.trim()))v.name=facts.name.trim();
 v.language=LANGS.includes(facts.language)?facts.language:'hu';
 return v;
}
// The same values -> the central decision's facts shape (as serverInquiryOptions builds them).
function decisionFacts(v){
 const n=x=>x===undefined?null:Number(x);
 return {dates:v.arrival?{arrival:v.arrival,departure:v.departure,inferred_year:false}:null,guests:n(v.guests),adults:n(v.adults),children:n(v.children),
  child_ages:String(v.child_ages||'').split(',').filter(Boolean).map(Number),cabin:v.unit||'',units_requested:n(v.units_requested),phone:v.phone||null};
}

// Tool 1 (voice agent "check_availability"): status + the guest sentence; Previo read only when a type is named.
export async function checkIntakeAvailability({facts,availabilitySource=null,now=()=>Date.now(),tenantId='sarberki'}={}){
 const v=intakeValues(facts);
 const base={message:'',language:v.language,now:new Date(now()),facts:decisionFacts(v),tenantId,fallback:false};
 let decision=evaluateCentralInquiry(base);
 if(decision.readyForCapacityCheck&&decision.capacity?.input?.cabin&&typeof availabilitySource==='function'&&!decision.capacity.incompatible){
  try{
   const capacity=await buildAvailabilityOptions(decision.capacity.input,availabilitySource,{tenantId,now});
   decision=evaluateCentralInquiry({...base,now:new Date(now()),capacity});
  }catch{}
 }
 const status=decision.missing.length?'missing':decision.contradictions.length?'review':decision.capacity.incompatible?'too_many'
  :decision.capacity.status==='AVAILABLE'?'available':decision.capacity.status==='UNAVAILABLE'?'unavailable':'unknown';
 return {status,missing:[...decision.missing],say:guestConversation(decision,v.language),priceQuoted:false,bookingCreated:false};
}

export function attestIntake({key,tenantId,provider,externalId,receivedAt,bodyText,checkedAt}){
 if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))fail('SETUP_REQUIRED');
 const bodySha256=sha(bodyText);
 const fields=[INTAKE_SCOPE,tenantId,provider,externalId,receivedAt,bodySha256,checkedAt];
 if(fields.some(x=>typeof x!=='string'||!x||/[\r\n]/.test(x)))fail('INVALID_EVIDENCE');
 return {scope:INTAKE_SCOPE,checkedAt,bodySha256,attestation:createHmac('sha256',Buffer.from(key,'hex')).update(fields.join('\n')).digest('hex')};
}

// Tool 2 (voice agent "create_booking_request" / chat "send request"): one pending case for the operator.
export async function createIntakeRequest({channel,externalId,facts,summary,transport,attestationKey,availabilitySource=null,
 clock=()=>new Date().toISOString(),tenantId='sarberki-test'}={}){
 if(typeof transport!=='function')fail('SETUP_REQUIRED');
 if(!CHANNELS.includes(channel)||typeof externalId!=='string'||!/^[A-Za-z0-9_.:-]{6,128}$/.test(externalId))fail('INVALID_INPUT');
 if(typeof summary!=='string'||!summary.trim()||summary.length>8000)fail('INVALID_INPUT');
 const v=intakeValues(facts);
 const at=clock(),caseId='tm-'+sha(channel+':'+externalId).slice(0,24);
 // The operator reads what was said (summary) and the structured facts; no recording is stored (owner 2026-11-12).
 const label={phone:'Telefonos foglalási igény (AI-recepciós)',chat:'Chates foglalási igény'}[channel];
 // A reply-quote header ("… ezt írta:", "… wrote:") would make the engine drop everything after it as an old quoted
 // letter (found 2026-11-12): neutralise such markers in the agent/chat summary.
 summary=summary.replace(/(ezt írta|írta|wrote|schrieb|je napisal|je napisala)\s*:/giu,'$1 –');
 const text=`${label}\n\n${summary.trim()}${v.phone?'\nTelefon: '+v.phone:''}${v.name?'\nNév: '+v.name:''}`;
 const envelope={mailbox_id:'intake:'+channel,message_id:externalId,thread_id:externalId,rfc_message_id:'<'+externalId+'@intake>',
  sender:'intake:'+channel,received_at:at,text};
 let saved;
 const store=createBookingCaseStore({storage:{getItem:()=>'[]',setItem:(_,value)=>{saved=JSON.parse(value);}},tenantId,clock,id:()=>caseId});
 store.ingest(scope(envelope),v,{approvedCaseId:null});
 const data=saved?.find(c=>c.id===caseId);
 if(!data||data.messages.length!==1||data.caseKind||data.linkReview)fail('INVALID_DRAFT');
 delete data.linkReview;
 data.messages=data.messages.map(m=>scope(m,true));
 data.sender='intake:'+channel;
 data.sourceReceipt={provider:channel,external_id:externalId,received_at:at};
 data.state.values={...data.state.values,...v};
 const plan=await emailDraftWithCapacity({...serverInquiryOptions({tenantId,caseId,data},new Date(at)),message:summary},availabilitySource,{clock:()=>Date.parse(clock())});
 if(typeof plan.text!=='string'||!plan.text.trim())fail('INVALID_DRAFT');
 data.drafts=[{text:plan.text,operatorReviewText:`${label} – a vendégnek visszahívással vagy e-mailben válaszolj; ez a tervezet csak segítség.\n\n`+String(plan.operatorReviewText||''),
  at,revision:data.state.revision,basedOnMessageCount:1,reviewStatus:'manual_review_required'}];
 data.state.approval='pending';
 const proof=attestIntake({key:attestationKey,tenantId,provider:channel,externalId,receivedAt:at,bodyText:text,checkedAt:clock()});
 try{
  const record=await transport('/rest/v1/rpc/sc_intake_create',{method:'POST',body:{p_tenant:tenantId,p_case:caseId,p_data:data,p_proof:proof}});
  return {caseId,revision:record?.revision??1};
 }catch(error){fail(error?.code==='FORBIDDEN'?'FORBIDDEN':'STORAGE_FAILURE');}
}
