// Owner 2026-11-25 (#9 7170471506, „Kösd rá”): the phone channel (Retell custom function) answered by OUR shared engine.
// The provider only does speech, the call and the tool call; every reply comes from the same chat engine
// (createChatInquirySession), the same checked offer (buildChatOffer, Previo TEST read-only) and the same fact-bound
// assist as the chatbot – no second decision engine. Stateless: each call replays the caller's utterances of the call
// (from the provider's transcript or the tool arguments), so nothing is stored. No write, request, e-mail or booking.
import {createHmac,timingSafeEqual} from 'node:crypto';
import {createChatInquirySession} from '../sarberki-chatbot-project/chat-session.mjs';
import {requestFacts} from '../sarberki-chatbot-project/chat-request-client.mjs';
import {hotTubWished,withoutPhoneQuestion} from '../sarberki-chatbot-project/chat-view.mjs';
import {normalizeSpoken} from './voice-normalize.mjs';

const MAX_UTTERANCES=40,MAX_LEN=1000;

// The caller's own utterances, oldest first. Retell sends the call with its transcript; a tool may also pass them as
// arguments (args nested or at the root). Agent lines are never replayed as guest text.
export function callerUtterances(body){
 const b=body&&typeof body==='object'?body:{},args=b.args&&typeof b.args==='object'?b.args:b;
 const fromCall=Array.isArray(b.call?.transcript_object)?b.call.transcript_object.filter(x=>x?.role==='user'&&typeof x.content==='string').map(x=>x.content):null;
 const list=fromCall&&fromCall.length?fromCall:Array.isArray(args.caller_messages)?args.caller_messages:typeof args.message==='string'?[args.message]:[];
 return list.filter(x=>typeof x==='string').map(x=>x.trim().slice(0,MAX_LEN)).filter(Boolean).slice(-MAX_UTTERANCES);
}

// Spoken numbers → written forms the engine knows (HU/DE/EN/SI), voice channel only: shared-core/voice-normalize.mjs.
export {normalizeSpokenHu} from './voice-normalize.mjs';

// Spoken form of an engine reply: no letter greeting or section titles, no bullet dashes, short.
const DROP=/^(?:Kind regards,?|Freundliche Grüße,?|Lep pozdrav,?|Üdvözlettel:?|Tisztelt .*!|Kedves .*[!,]|Dear .*,|Guten Tag.*!|Sehr geehrte.*,|Pozdravljeni.*!|Köszönjük érdeklődését\.|Vielen Dank für Ihre Anfrage\.|Thank you for your enquiry\.|Hvala za vaše povpraševanje\.|Szállás|Accommodation|Unterkunft|Nastanitev|Ár és díjak|Price and charges|Preis und Gebühren|Cena in stroški|Foglalási feltételek|Booking terms|Buchungsbedingungen|Pogoji rezervacije|Az ajánlathoz még szükségünk van|Details still needed|Noch benötigte Angaben|Podatki za dopolnitev|Kiegészítő információk|Additional information|Weitere Informationen|Dodatne informacije|Üdvözlettel.*|Best regards.*|Mit freundlichen Grüßen.*|Lep pozdrav.*|Sárberki.*|\(Automati.*\)|\(Samodejn.*\))$/u;
// Spoken dates and prices (owner 2026-11-25): „2027.06.10.” / „10.06.2027” read badly aloud – month names instead;
// „128 200 Ft” → „128200 forint” (one number for the voice).
const MONTHS={hu:['január','február','március','április','május','június','július','augusztus','szeptember','október','november','december'],
 de:['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'],
 en:['January','February','March','April','May','June','July','August','September','October','November','December'],
 si:['januarja','februarja','marca','aprila','maja','junija','julija','avgusta','septembra','oktobra','novembra','decembra']}; // Slovene dates take the genitive („14. septembra 2027”)
const CURRENCY={hu:'forint',de:'Forint',en:'forints',si:'forintov'};
export function speechify(text,lang='hu'){
 const M=MONTHS[lang]||MONTHS.hu;let t=String(text||'');
 t=t.replace(/\b(20\d{2})\.\s?(\d{2})\.\s?(\d{2})(\.?)(?=(\s+\p{Lu})?)/gu,(m,y,mo,d,dot,cap)=>Number(mo)>=1&&Number(mo)<=12?(lang==='hu'?`${y}. ${M[mo-1]} ${Number(d)}.`:(lang==='en'?`${Number(d)} ${M[mo-1]} ${y}`:`${Number(d)}. ${M[mo-1]} ${y}`)+(dot&&cap?'.':'')):m);
 t=t.replace(/\b(\d{2})\.(\d{2})\.(20\d{2})\b/g,(m,d,mo,y)=>Number(mo)>=1&&Number(mo)<=12?(lang==='hu'?`${y}. ${M[mo-1]} ${Number(d)}.`:lang==='en'?`${Number(d)} ${M[mo-1]} ${y}`:`${Number(d)}. ${M[mo-1]} ${y}`):m);
 t=t.replace(/(\d{1,3}(?:[  .]\d{3})+|\d+)\s?(?:Ft|HUF)\b/g,(m,n)=>n.replace(/[  .]/g,'')+' '+(CURRENCY[lang]||CURRENCY.hu));
 return t;
}
// The booking-status / terms part of a letter is not read on the phone (legal text; the checked offer says it briefly).
const CUT=/\n\s*(?:Foglalás állapota|Booking status|Reservierungsstatus|Status rezervacije|Foglalási feltételek|Booking terms|Buchungsbedingungen|Pogoji rezervacije)\s*\n[\s\S]*$/u;
export function speakable(text,max=700,lang='hu'){
 text=speechify(String(text||'').replace(CUT,''),lang);
 const lines=String(text||'').split('\n').map(l=>l.trim()).filter(l=>l&&!DROP.test(l)).map(l=>l.replace(/^[–-]\s*/,''));
 let out=lines.join(' ').replace(/\s+/g,' ').trim();
 if(out.length>max){
  // Keep the first sentences and the question the caller must answer (a long reply is interrupted on the phone).
  const sentences=out.match(/[^.?!]+[.?!]+(?=\s|$)|[^.?!]+$/g)||[out],question=sentences.find(x=>x.trim().endsWith('?'));
  let keep='';for(const x of sentences){if((keep+x).length>max-(question&&!keep.includes(question)?question.length:0))break;keep+=x;}
  if(question&&!keep.includes(question.trim()))keep=keep.trim()+' '+question.trim();
  out=(keep||out.slice(0,max)).replace(/\s+/g,' ').trim();
 }
 return out;
}

// Provider authentication: our own shared key header (constant time), and – when the provider key is configured –
// the Retell signature "v=<ms>,d=<hex HMAC-SHA256(apiKey, body+ms)>" within 5 minutes (retell-sdk webhook_auth).
export function voiceAuthorized({headers,raw,env,now=Date.now()}){
 const key=env.VOICE_TURN_KEY,got=headers.get('x-sarberki-voice-key')||'';
 if(typeof key!=='string'||key.length<32)return false;
 const a=Buffer.from(got),b=Buffer.from(key);if(a.length!==b.length||!timingSafeEqual(a,b))return false;
 if(typeof env.RETELL_API_KEY==='string'&&env.RETELL_API_KEY.length>=16){
  const m=/^v=(\d+),d=([a-f0-9]{64})$/.exec(headers.get('x-retell-signature')||'');if(!m)return false;
  if(Math.abs(now-Number(m[1]))>5*60000)return false;
  const want=createHmac('sha256',env.RETELL_API_KEY).update(raw+m[1]).digest('hex');
  if(!timingSafeEqual(Buffer.from(want),Buffer.from(m[2])))return false;
 }
 return true;
}

// One phone turn: replay → engine reply → checked offer when the stay is complete → fact-bound assist for a free question.
export async function voiceTurn({utterances,language='auto',clock=()=>new Date(),offerFn=null,assistFn=null}){
 if(!Array.isArray(utterances)||!utterances.length)return {reply:null,reason:'NO_UTTERANCE'};
 const s=createChatInquirySession({language,clock});let r=null;
 // Spoken Hungarian numbers → digits (voice only); the session's own language detection decides the reply language.
 for(const u of utterances)r=s.reply(normalizeSpoken(u));
 const lang=s.language,snap=s.snapshot(),facts=requestFacts(snap);
 if(facts&&hotTubWished(utterances))facts.hotTub=true;
 let text=r.text,source='engine',offer=null;
 if(facts&&r.decision&&offerFn){
  try{offer=await offerFn({facts,language:lang});}catch{offer=null;}
  if(offer&&['AVAILABLE','UNAVAILABLE'].includes(offer.status)){text=offer.text;source='offer';}
 }
 if(!r.decision&&!r.noAssist&&assistFn){try{const a=await assistFn({message:utterances.at(-1),language:lang});if(typeof a==='string'&&a.trim()){text=a;source='assist';}}catch{}}
 // On the phone the caller's number is the call itself: no "please give us a phone number" (as in the chat form).
 if(source==='engine')text=withoutPhoneQuestion(text,lang);
 return {reply:speakable(text,450,lang),language:lang,source,
  facts:{arrival:snap.dates?.arrival??null,departure:snap.dates?.departure??null,adults:Number.isInteger(snap.adults)?snap.adults:null,
   children:Number.isInteger(snap.children)?snap.children:null,cabin:snap.cabin||null},
  offer:offer?{status:offer.status,total:Number.isSafeInteger(offer.total)?offer.total:null}:null};
}
