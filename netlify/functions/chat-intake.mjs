// V3-3 (owner-approved V3 plan 2026-11-12): the chatbot sends a booking REQUEST to the operator. Public, same-origin
// page, so: OFF by default (INTAKE_ENABLED=test-only AND INTAKE_CHAT_ENABLED=test-only), consent + a phone number
// required, at most 3 requests per visitor and 30 in total per hour (enforced by sc_intake_create), the IP never
// stored (only a keyed one-way fingerprint in the id), no Previo read from this path. Owner 2026-11-19: the price shown
// in the chat (server-chat-offer.mjs) may come with the request as acceptedTotal; it is re-computed here, not trusted.
// The case is created by the dedicated intake account, exactly as the phone path (shared-core/server-intake.mjs).
import {randomBytes,createHmac} from 'node:crypto';
import {createIntakeRequest} from '../../shared-core/server-intake.mjs';
import {createSupabaseTransport} from '../../shared-core/supabase-case-repository.mjs';
import {notifyOperator} from './intake.mjs';
import {offerInput} from '../../shared-core/server-chat-offer.mjs';
import {fetchPublicPriceReference} from '../../price-source/public-price-fallback.mjs';

const ORIGIN='https://leafy-chimera-2403e5.netlify.app',TEST_PROJECT='https://mojnqizbcaczstguikpv.supabase.co',TENANT='sarberki-test';
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const KEYS='consent,facts,language,phone,transcript',KEYS_EMAIL='consent,email,facts,language,phone,transcript';
// Owner 2026-11-19 (two-step chat): acceptedTotal = the price the guest accepted with „Foglalás véglegesítése”.
const KEY_SETS=[KEYS,KEYS_EMAIL,'acceptedTotal,'+KEYS,'acceptedTotal,consent,email,facts,language,phone,transcript'];
const hufText=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const EMAIL_RE=/^[^\s@<>"(),;:]{1,64}@[^\s@<>"(),;:]{1,190}\.[A-Za-z]{2,}$/;

export function createChatIntakeHandler({env=process.env,fetchImpl=fetch,random=()=>randomBytes(8).toString('hex')}={}){
 return async request=>{
  if(env.INTAKE_ENABLED!=='test-only'||env.INTAKE_CHAT_ENABLED!=='test-only'||env.SUPABASE_URL!==TEST_PROJECT)return json(503,{error:'INTAKE_DISABLED'});
  if(request.method!=='POST')return json(405,{error:'METHOD_NOT_ALLOWED'});
  if(request.headers.get('origin')!==ORIGIN||request.headers.get('sec-fetch-site')!=='same-origin'||request.headers.get('content-type')?.split(';')[0]!=='application/json')return json(403,{error:'FORBIDDEN'});
  const raw=await request.text();if(raw.length>12000)return json(413,{error:'TOO_LARGE'});
  let input;try{input=JSON.parse(raw);}catch{return json(400,{error:'INVALID_INPUT'});}
  if(!input||typeof input!=='object'||Array.isArray(input)||!KEY_SETS.includes(Object.keys(input).sort().join(',')))return json(400,{error:'INVALID_INPUT'});
  if(input.consent!==true)return json(400,{error:'CONSENT_REQUIRED'});
  // Owner 2026-11-14: phone and/or e-mail - at least one valid contact (the e-mail receives the confirmation + voucher).
  const phoneOk=typeof input.phone==='string'&&/^\+?[0-9][0-9 ()\/-]{5,22}$/.test(input.phone.trim()),email=typeof input.email==='string'?input.email.trim().replace(/[.,;]+$/u,''):''; // iOS trailing '.' (owner test 2026-11-15)
  if(email&&!EMAIL_RE.test(email))return json(400,{error:'EMAIL_INVALID'});
  if(!phoneOk&&!email)return json(400,{error:'PHONE_REQUIRED'});
  if(typeof input.phone!=='string'||input.phone.trim()&&!phoneOk)return json(400,{error:'PHONE_REQUIRED'});
  if(!Array.isArray(input.transcript)||!input.transcript.length||input.transcript.length>12||input.transcript.some(t=>typeof t!=='string'||!t.trim()||t.length>1000))return json(400,{error:'INVALID_INPUT'});
  if(typeof input.facts!=='object'||input.facts===null||Array.isArray(input.facts))return json(400,{error:'INVALID_INPUT'});
  if(!/^[a-f0-9]{64}$/.test(env.INTAKE_HMAC_KEY||'')||!/^[^@\s]+@[^@\s]+$/.test(env.INTAKE_ACCOUNT_EMAIL||'')||!env.INTAKE_ACCOUNT_PASSWORD||!env.SUPABASE_PUBLISHABLE_KEY)return json(503,{error:'SETUP_REQUIRED'});
  // Visitor fingerprint: keyed hash of the client IP (Netlify header); the IP itself is not kept anywhere.
  const ip=request.headers.get('x-nf-client-connection-ip')||'unknown';
  const visitor=createHmac('sha256',Buffer.from(env.INTAKE_HMAC_KEY,'hex')).update('chat-visitor:'+ip).digest('hex').slice(0,16);
  const externalId=`chat_${visitor}_${random()}`;
  if(input.acceptedTotal!==undefined&&!(Number.isSafeInteger(input.acceptedTotal)&&input.acceptedTotal>0&&input.acceptedTotal<100000000))return json(400,{error:'INVALID_INPUT'});
  // The accepted price is re-computed here (never trusted from the page); the operator's one click reads Previo again.
  let accepted='';
  if(input.acceptedTotal!==undefined){
   let now=null;try{const q=offerInput(input.facts);now=q?(await fetchPublicPriceReference(q))?.total:null;}catch{}
   accepted='✅ A vendég a chatben VÉGLEGESÍTETTE a foglalási igényét a felajánlott áron: '+hufText(input.acceptedTotal)+' Ft'+
    (now===input.acceptedTotal?' (árlista szerint egyezik).':Number.isSafeInteger(now)?' – FIGYELEM: az árlista most '+hufText(now)+' Ft, ellenőrizd.':' – az ár újraszámítása nem sikerült, ellenőrizd.')+'\n\n';
  }
  const summary=accepted+'A vendég üzenetei a chatben (kezelői összefoglaló):\n'+input.transcript.map(t=>'– '+t.trim().replace(/\s+/g,' ')).join('\n');
  let token;
  try{
   const r=await fetchImpl(TEST_PROJECT+'/auth/v1/token?grant_type=password',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
    headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:env.INTAKE_ACCOUNT_EMAIL,password:env.INTAKE_ACCOUNT_PASSWORD})});
   // stage (TEST diagnostics, owner switch-on 2026-11-14): which step failed - no detail, no secret.
   if(!r.ok){let code='';try{code=String((await r.json())?.error_code||'').replace(/[^a-z_]/g,'').slice(0,40);}catch{}
    return json(503,{error:'TRY_LATER',stage:'auth-'+r.status+(code?'-'+code:'')});}
   token=(await r.json())?.access_token;
  }catch{return json(503,{error:'TRY_LATER',stage:'auth-network'});}
  if(typeof token!=='string'||!token)return json(503,{error:'TRY_LATER',stage:'auth-token'});
  try{
   const transport=createSupabaseTransport({url:TEST_PROJECT+'/',publishableKey:env.SUPABASE_PUBLISHABLE_KEY,token,fetchImpl});
   await createIntakeRequest({channel:'chat',externalId,facts:{...input.facts,...(phoneOk?{phone:input.phone.trim()}:{}),...(email?{email}:{}),language:input.language},summary,
    transport,attestationKey:env.ISOLATED_APPROVAL_ATTESTATION_KEY,availabilitySource:null,tenantId:TENANT});
   await notifyOperator(env,fetchImpl,'chat');
   return json(200,{status:'sent'});
  }catch(error){
   // A limit hit and a storage failure look the same to the visitor: "try later" (no detail leaks).
   return json(error?.code==='INVALID_INPUT'?400:503,{error:error?.code==='INVALID_INPUT'?'INVALID_INPUT':'TRY_LATER',stage:'store-'+(['FORBIDDEN','STORAGE_FAILURE','SETUP_REQUIRED','INVALID_EVIDENCE'].includes(error?.code)?error.code:'other')});
  }
 };
}
export default createChatIntakeHandler();
