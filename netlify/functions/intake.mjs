// V3-1 shared intake endpoint (owner-approved V3 plan 2026-11-12, #9 6822281802). Called server-to-server by the
// voice agent (later also by the chat proxy). OFF by default: INTAKE_ENABLED must be "test-only" (TEST project only).
// Every request is HMAC-signed (INTAKE_HMAC_KEY, header x-sarberki-signature "t=..,v1=.."); the database write uses
// the dedicated intake account's own Supabase session (INTAKE_ACCOUNT_EMAIL/PASSWORD; registry sc_intake_actors,
// no read/write membership, no service role). Actions:
//   check_availability     -> {status, missing, say}   (read-only Previo 73521 when the read switch is on; no price)
//   create_booking_request -> {caseId}                  (one pending case for the operator; idempotent per call id)
// Responses carry fixed codes only; no upstream text, no secrets, no personal data echoed back.
import {verifyIntakeSignature,checkIntakeAvailability,createIntakeRequest} from '../../shared-core/server-intake.mjs';
import {previoAvailabilitySource} from '../../shared-core/server-capacity-draft.mjs';
import {previoSplitPlacementReader} from '../../shared-core/server-previo-split-placement.mjs';
import {createSupabaseTransport} from '../../shared-core/supabase-case-repository.mjs';
import {previoCapacityReader} from './booking-cases.mjs';

const TEST_PROJECT='https://mojnqizbcaczstguikpv.supabase.co',TENANT='sarberki-test';
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});

export function createIntakeHandler({env=process.env,fetchImpl=fetch,now=()=>Date.now()}={}){
 return async request=>{
  if(env.INTAKE_ENABLED!=='test-only'||env.SUPABASE_URL!==TEST_PROJECT)return json(503,{error:'INTAKE_DISABLED'});
  if(request.method!=='POST')return json(405,{error:'METHOD_NOT_ALLOWED'});
  const raw=await request.text();
  if(raw.length>16384)return json(413,{error:'TOO_LARGE'});
  try{verifyIntakeSignature({key:env.INTAKE_HMAC_KEY,header:request.headers.get('x-sarberki-signature'),body:raw,now:now()});}
  catch(error){return json(error.code==='SETUP_REQUIRED'?503:401,{error:error.code==='SETUP_REQUIRED'?'SETUP_REQUIRED':'FORBIDDEN'});}
  let input;try{input=JSON.parse(raw);}catch{return json(400,{error:'INVALID_INPUT'});}
  if(!input||typeof input!=='object'||Array.isArray(input)||typeof input.facts!=='object'||input.facts===null)return json(400,{error:'INVALID_INPUT'});
  const reader=previoCapacityReader(env,fetchImpl);
  const source=reader?previoAvailabilitySource(reader,previoSplitPlacementReader(env,fetchImpl)):null;
  if(input.action==='check_availability'){
   const r=await checkIntakeAvailability({facts:input.facts,availabilitySource:source,now});
   return json(200,{status:r.status,missing:r.missing,say:r.say});
  }
  if(input.action==='create_booking_request'){
   if(!/^[^@\s]+@[^@\s]+$/.test(env.INTAKE_ACCOUNT_EMAIL||'')||!env.INTAKE_ACCOUNT_PASSWORD||!env.SUPABASE_PUBLISHABLE_KEY)return json(503,{error:'SETUP_REQUIRED'});
   let token;
   try{
    const r=await fetchImpl(TEST_PROJECT+'/auth/v1/token?grant_type=password',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
     headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:env.INTAKE_ACCOUNT_EMAIL,password:env.INTAKE_ACCOUNT_PASSWORD})});
    if(!r.ok)return json(503,{error:'INTAKE_AUTH_FAILED'});
    token=(await r.json())?.access_token;
   }catch{return json(503,{error:'INTAKE_AUTH_FAILED'});}
   if(typeof token!=='string'||!token)return json(503,{error:'INTAKE_AUTH_FAILED'});
   try{
    const transport=createSupabaseTransport({url:TEST_PROJECT+'/',publishableKey:env.SUPABASE_PUBLISHABLE_KEY,token,fetchImpl});
    const {caseId}=await createIntakeRequest({channel:input.channel,externalId:input.externalId,facts:input.facts,summary:input.summary,
     transport,attestationKey:env.ISOLATED_APPROVAL_ATTESTATION_KEY,availabilitySource:source,tenantId:TENANT});
    return json(200,{caseId,status:'pending_operator_approval'});
   }catch(error){
    const code=['INVALID_INPUT','FORBIDDEN','SETUP_REQUIRED'].includes(error?.code)?error.code:'STORAGE_FAILURE';
    return json({INVALID_INPUT:400,FORBIDDEN:403,SETUP_REQUIRED:503}[code]||502,{error:code});
   }
  }
  return json(400,{error:'UNKNOWN_ACTION'});
 };
}
export default createIntakeHandler();
