// V3-3 (owner-approved V3 plan 2026-11-12): the chatbot sends a booking REQUEST to the operator. Public, same-origin
// page, so: OFF by default (INTAKE_ENABLED=test-only AND INTAKE_CHAT_ENABLED=test-only), consent + a phone number
// required, at most 3 requests per visitor and 30 in total per hour (enforced by sc_intake_create), the IP never
// stored (only a keyed one-way fingerprint in the id), no Previo read from this public path (AGENTS), no price.
// The case is created by the dedicated intake account, exactly as the phone path (shared-core/server-intake.mjs).
import {randomBytes,createHmac} from 'node:crypto';
import {createIntakeRequest} from '../../shared-core/server-intake.mjs';
import {createSupabaseTransport} from '../../shared-core/supabase-case-repository.mjs';
import {notifyOperator} from './intake.mjs';

const ORIGIN='https://leafy-chimera-2403e5.netlify.app',TEST_PROJECT='https://mojnqizbcaczstguikpv.supabase.co',TENANT='sarberki-test';
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const KEYS='consent,facts,language,phone,transcript';

export function createChatIntakeHandler({env=process.env,fetchImpl=fetch,random=()=>randomBytes(8).toString('hex')}={}){
 return async request=>{
  if(env.INTAKE_ENABLED!=='test-only'||env.INTAKE_CHAT_ENABLED!=='test-only'||env.SUPABASE_URL!==TEST_PROJECT)return json(503,{error:'INTAKE_DISABLED'});
  if(request.method!=='POST')return json(405,{error:'METHOD_NOT_ALLOWED'});
  if(request.headers.get('origin')!==ORIGIN||request.headers.get('sec-fetch-site')!=='same-origin'||request.headers.get('content-type')?.split(';')[0]!=='application/json')return json(403,{error:'FORBIDDEN'});
  const raw=await request.text();if(raw.length>12000)return json(413,{error:'TOO_LARGE'});
  let input;try{input=JSON.parse(raw);}catch{return json(400,{error:'INVALID_INPUT'});}
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!==KEYS)return json(400,{error:'INVALID_INPUT'});
  if(input.consent!==true)return json(400,{error:'CONSENT_REQUIRED'});
  if(typeof input.phone!=='string'||!/^\+?[0-9][0-9 ()\/-]{5,22}$/.test(input.phone.trim()))return json(400,{error:'PHONE_REQUIRED'});
  if(!Array.isArray(input.transcript)||!input.transcript.length||input.transcript.length>12||input.transcript.some(t=>typeof t!=='string'||!t.trim()||t.length>1000))return json(400,{error:'INVALID_INPUT'});
  if(typeof input.facts!=='object'||input.facts===null||Array.isArray(input.facts))return json(400,{error:'INVALID_INPUT'});
  if(!/^[a-f0-9]{64}$/.test(env.INTAKE_HMAC_KEY||'')||!/^[^@\s]+@[^@\s]+$/.test(env.INTAKE_ACCOUNT_EMAIL||'')||!env.INTAKE_ACCOUNT_PASSWORD||!env.SUPABASE_PUBLISHABLE_KEY)return json(503,{error:'SETUP_REQUIRED'});
  // Visitor fingerprint: keyed hash of the client IP (Netlify header); the IP itself is not kept anywhere.
  const ip=request.headers.get('x-nf-client-connection-ip')||'unknown';
  const visitor=createHmac('sha256',Buffer.from(env.INTAKE_HMAC_KEY,'hex')).update('chat-visitor:'+ip).digest('hex').slice(0,16);
  const externalId=`chat_${visitor}_${random()}`;
  const summary='A vendég üzenetei a chatben (kezelői összefoglaló):\n'+input.transcript.map(t=>'– '+t.trim().replace(/\s+/g,' ')).join('\n');
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
   await createIntakeRequest({channel:'chat',externalId,facts:{...input.facts,phone:input.phone.trim(),language:input.language},summary,
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
