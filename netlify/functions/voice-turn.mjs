// Owner 2026-11-25 (#9 7170471506): phone channel test endpoint – a Retell agent's custom function calls this with the
// call; the reply comes from our shared engine (shared-core/voice-turn.mjs). OFF unless VOICE_TURN=test-only. Server
// authenticated (VOICE_TURN_KEY header; plus the Retell signature when RETELL_API_KEY is set). TEST only: the offer
// reads the Previo TEST property (same switches as chat-offer); nothing is written, requested, sent or booked; the
// caller's words go only to the model provider for a free question (same as the chatbot); nothing is logged or stored.
import {voiceTurn,voiceAuthorized,callerUtterances} from '../../shared-core/voice-turn.mjs';
import {chatOfferCapacity} from './chat-offer.mjs';
import {buildChatOffer} from '../../shared-core/server-chat-offer.mjs';
import {askChatAssist,chatAssistConfigured} from '../../shared-core/chat-assist.mjs';
import {BUSINESS} from '../../business-config.mjs';

const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});

export function createVoiceTurnHandler({env=process.env,fetchImpl=fetch,now=()=>Date.now(),perMinute=60}={}){
 let windowStart=0,count=0;
 return async request=>{
  if(env.VOICE_TURN!=='test-only')return json(503,{error:'VOICE_DISABLED'});
  if(request.method!=='POST')return json(405,{error:'METHOD_NOT_ALLOWED'});
  if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return json(415,{error:'JSON_REQUIRED'});
  const raw=await request.text();if(raw.length>60000)return json(413,{error:'TOO_LARGE'});
  if(!voiceAuthorized({headers:request.headers,raw,env,now:now()}))return json(401,{error:'UNAUTHORIZED'});
  let body;try{body=JSON.parse(raw);}catch{return json(400,{error:'INVALID_INPUT'});}
  const utterances=callerUtterances(body);if(!utterances.length)return json(400,{error:'NO_UTTERANCE'});
  const t=now();if(t-windowStart>60000){windowStart=t;count=0;}
  if(++count>perMinute)return json(429,{error:'TRY_LATER'});
  const lang=['hu','de','en','si'].includes(body?.args?.language??body?.language)?(body.args?.language??body.language):'auto';
  const capacityFn=chatOfferCapacity(env,fetchImpl);
  const offerFn=capacityFn?({facts,language})=>buildChatOffer({facts,language,capacityFn,cancellationDays:BUSINESS.bookingRules.cancellationDaysUnder15Guests}):null;
  const assistFn=chatAssistConfigured(env)?({message,language})=>askChatAssist({message,language},{env,fetchImpl}):null;
  try{return json(200,await voiceTurn({utterances,language:lang,offerFn,assistFn,intake:env.VOICE_INTAKE==='test-only'}));}
  catch{return json(200,{reply:null,reason:'ENGINE_FAILED'});}
 };
}
export default createVoiceTurnHandler();
