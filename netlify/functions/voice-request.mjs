// Owner 2026-11-26 (PERM-20261126-VOICE-OPTION): the phone assistant's booking request (ElevenLabs tool
// sarberki_request). OFF unless VOICE_INTAKE=test-only (plus the existing intake switch and the TEST project); the same
// provider key as voice-turn. The request is saved by the dedicated intake account exactly as the chat request
// (shared-core/server-intake.mjs, channel „phone”, one case per call); the 48-hour Previo TEST option uses the chat's
// pre-fill writer and locks (shared-core/server-chat-prefill.mjs, channel „phone”). Nothing is sent to the caller.
import {voiceAuthorized,callerUtterances} from '../../shared-core/voice-turn.mjs';
import {voiceRequest,voiceAddTub,voiceConfirm,VOICE_INTAKE_SWITCH,PHONE_CONTACT_NAME,callerAllowed,TEST_LINE} from '../../shared-core/voice-request.mjs';
import {createIntakeRequest} from '../../shared-core/server-intake.mjs';
import {createSupabaseTransport} from '../../shared-core/supabase-case-repository.mjs';
import {prefillChatBooking} from '../../shared-core/server-chat-prefill.mjs';
import {previoBookingWriter} from '../../shared-core/server-previo-booking-sync.mjs';
import {buildChatOffer} from '../../shared-core/server-chat-offer.mjs';
import {chatOfferCapacity} from './chat-offer.mjs';
import {notifyOperator} from './intake.mjs';
import {intakeAccountToken} from './chat-intake.mjs';
import {BUSINESS} from '../../business-config.mjs';
import {callTranscript,saveTranscript} from '../../shared-core/voice-transcript.mjs';
import {createHash} from 'node:crypto';

const TEST_PROJECT='https://mojnqizbcaczstguikpv.supabase.co',TENANT='sarberki-test';
// Owner 2026-11-27: after the booking the whole conversation (system__conversation_history) replaces the case's
// transcript – the case of this call (caseId from the conversation id, as at the booking). Never blocks the answer.
export async function saveCallTranscript({env,fetchImpl,args}){
 try{
  const id=String(args?.conversation_id??'').trim(),lines=callTranscript(args?.conversation_history);
  if(!/^[A-Za-z0-9_-]{6,100}$/.test(id)||!lines.length||env.VOICE_INTAKE!==VOICE_INTAKE_SWITCH||env.SUPABASE_URL!==TEST_PROJECT)return false;
  if(!env.SUPABASE_PUBLISHABLE_KEY||!env.INTAKE_ACCOUNT_EMAIL||!env.INTAKE_ACCOUNT_PASSWORD)return false;
  const caseId='tm-'+createHash('sha256').update('phone:voice_'+id,'utf8').digest('hex').slice(0,24);
  const login=await intakeAccountToken(env,fetchImpl);if(!login.token)return false;
  const transport=createSupabaseTransport({url:TEST_PROJECT+'/',publishableKey:env.SUPABASE_PUBLISHABLE_KEY,token:login.token,fetchImpl});
  await saveTranscript({transport,tenantId:TENANT,caseId,lines,attestationKey:env.ISOLATED_APPROVAL_ATTESTATION_KEY});
  return true;
 }catch{return false;}
}
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});

export function createVoiceRequestHandler({env=process.env,fetchImpl=fetch,now=()=>Date.now(),perHour=20}={}){
 let windowStart=0,count=0;
 return async request=>{
  if(env.VOICE_INTAKE!==VOICE_INTAKE_SWITCH||env.VOICE_TURN!=='test-only'||env.INTAKE_ENABLED!=='test-only'||env.SUPABASE_URL!==TEST_PROJECT)return json(503,{error:'VOICE_INTAKE_DISABLED'});
  if(request.method!=='POST')return json(405,{error:'METHOD_NOT_ALLOWED'});
  if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return json(415,{error:'JSON_REQUIRED'});
  const raw=await request.text();if(raw.length>400000)return json(413,{error:'TOO_LARGE'});
  if(!voiceAuthorized({headers:request.headers,raw,env,now:now()}))return json(401,{error:'UNAUTHORIZED'});
  let body;try{body=JSON.parse(raw);}catch{return json(400,{error:'INVALID_INPUT'});}
  const args=body?.args&&typeof body.args==='object'?body.args:body||{};
  const utterances=callerUtterances(body);if(!utterances.length)return json(400,{error:'NO_UTTERANCE'});
  // Owner 2026-11-26: unknown caller numbers on the TEST line – nothing is saved, only the test-line sentence.
  if(!callerAllowed(env,args.caller_id)){const l=['hu','de','en','si'].includes(args.language)?args.language:'hu';return json(200,{ok:false,status:'TEST_LINE',reply:TEST_LINE[l]});}
  // Owner 2026-11-27 (PERM-20261127-VOICE-TUB-NOTE): a hot tub request after the booking → the case's Previo option note.
  if(args.action==='add_hot_tub'){
   const writer=previoBookingWriter(env,fetchImpl);
   const lang=['hu','de','en','si'].includes(args.language)?args.language:'auto';
   const r=await voiceAddTub({utterances,email:args.email,conversationId:args.conversation_id,language:lang,
    noteFn:writer?({caseId,arrival,departure,lines})=>writer.appendNote({tenantId:TENANT,caseId,arrival,departure,lines}):async()=>null,
    notifyFn:extra=>notifyOperator(env,fetchImpl,'phone',extra)});
   await saveCallTranscript({env,fetchImpl,args});
   return json(200,r);
  }
  // Read-back only (nothing saved, no rate count): the agent says this reply and asks the caller once.
  if(args.preview===true)return json(200,voiceConfirm({email:args.email,name:args.name,callerId:args.caller_id,phone:args.phone,language:['hu','de','en','si'].includes(args.language)?args.language:'hu'}));
  const t=now();if(t-windowStart>3600000){windowStart=t;count=0;}
  if(++count>perHour)return json(200,{ok:false,status:'TRY_LATER',reply:'Elnézést, a foglalási igényt most nem sikerült rögzítenem. Kérem, írja meg az igényét e-mailben, vagy hívjon minket később.'});
  if(!/^[a-f0-9]{64}$/.test(env.INTAKE_HMAC_KEY||'')||!env.INTAKE_ACCOUNT_EMAIL||!env.INTAKE_ACCOUNT_PASSWORD||!env.SUPABASE_PUBLISHABLE_KEY)return json(503,{error:'SETUP_REQUIRED'});
  const lang=['hu','de','en','si'].includes(args.language)?args.language:'auto';
  const capacityFn=chatOfferCapacity(env,fetchImpl);
  const offerFn=capacityFn?({facts,language})=>buildChatOffer({facts,language,capacityFn,cancellationDays:BUSINESS.bookingRules.cancellationDaysUnder15Guests}):async()=>null;
  const createFn=async({externalId,facts,summary})=>{
   const login=await intakeAccountToken(env,fetchImpl);if(!login.token)return null;
   const transport=createSupabaseTransport({url:TEST_PROJECT+'/',publishableKey:env.SUPABASE_PUBLISHABLE_KEY,token:login.token,fetchImpl});
   return createIntakeRequest({channel:'phone',externalId,facts,summary,transport,attestationKey:env.ISOLATED_APPROVAL_ATTESTATION_KEY,availabilitySource:null,tenantId:TENANT,transcript:callTranscript(args.conversation_history)});
  };
  const prefillFn=({caseId,facts,email,phone,name,mainNote})=>prefillChatBooking({env,fetchImpl,tenantId:TENANT,caseId,facts,name:name||PHONE_CONTACT_NAME,email,phone,channel:'phone',mainNote});
  const notifyFn=extra=>notifyOperator(env,fetchImpl,'phone',extra);
  try{
   const r=await voiceRequest({utterances,email:args.email,name:args.name,phone:args.phone,consent:args.consent===true,conversationId:args.conversation_id,callerId:args.caller_id,language:lang,offerFn,createFn,prefillFn,notifyFn});
   return json(200,r);
  }catch{return json(200,{ok:false,status:'FAILED',reply:'Elnézést, a foglalási igényt most nem sikerült rögzítenem. Kérem, írja meg az igényét e-mailben, vagy hívjon minket később.'});}
 };
}
export default createVoiceRequestHandler();
