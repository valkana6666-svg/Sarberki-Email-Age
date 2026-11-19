// Chat two-step booking, step 1 (owner 2026-11-19): the guest's „Foglalási igény elküldése” → free cabin + price.
// Public same-origin page, so: on only while the chat request (INTAKE_CHAT_ENABLED=test-only) AND the existing
// read-only Previo TEST switch (PREVIO_READ_API_ENABLED=sandbox-73521-only) are on; the live property is never read
// here. Same-origin JSON only, exact keys, small body, a per-instance rate limit; nothing is stored, booked or sent.
// Any failure → {offer:null}: the page sends the request to the team as before.
import {buildChatOffer} from '../../shared-core/server-chat-offer.mjs';
import {readPrevioFreeCapacity} from '../../shared-core/server-previo-rest-read.mjs';
import {BUSINESS} from '../../business-config.mjs';

const ORIGIN='https://leafy-chimera-2403e5.netlify.app';
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});

// TEST 73521 only (the same env as the daily view's read); no live branch on this public path.
export function chatOfferCapacity(env,fetchImpl){
 if(env.PREVIO_READ_API_ENABLED!=='sandbox-73521-only'||String(env.PREVIO_HOTEL_ID)!=='73521')return null;
 let mapping;try{mapping=JSON.parse(env.PREVIO_ROOM_KIND_MAP||'');}catch{return null;}
 return ({cabin,arrival,departure})=>readPrevioFreeCapacity({apiKey:env.PREVIO_API_KEY,hotelId:env.PREVIO_HOTEL_ID,ratePlanId:env.PREVIO_RATE_PLAN_ID,
  mapping,cabins:[cabin],arrival,departure,fetchImpl});
}

export function createChatOfferHandler({env=process.env,fetchImpl=fetch,now=()=>Date.now(),perMinute=10}={}){
 let windowStart=0,count=0;
 return async request=>{
  const capacityFn=env.INTAKE_CHAT_ENABLED==='test-only'?chatOfferCapacity(env,fetchImpl):null;
  if(!capacityFn)return json(503,{error:'OFFER_DISABLED'});
  if(request.method!=='POST')return json(405,{error:'METHOD_NOT_ALLOWED'});
  if(request.headers.get('origin')!==ORIGIN||request.headers.get('sec-fetch-site')!=='same-origin'||request.headers.get('content-type')?.split(';')[0]!=='application/json')return json(403,{error:'FORBIDDEN'});
  const raw=await request.text();if(raw.length>2000)return json(413,{error:'TOO_LARGE'});
  let input;try{input=JSON.parse(raw);}catch{return json(400,{error:'INVALID_INPUT'});}
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='facts,language'||!['hu','de','en','si'].includes(input.language))return json(400,{error:'INVALID_INPUT'});
  const t=now();if(t-windowStart>60000){windowStart=t;count=0;}
  if(++count>perMinute)return json(429,{error:'TRY_LATER'});
  try{return json(200,{offer:await buildChatOffer({facts:input.facts,language:input.language,capacityFn,cancellationDays:BUSINESS.bookingRules.cancellationDaysUnder15Guests})});}
  catch{return json(200,{offer:null});}
 };
}
export default createChatOfferHandler();
