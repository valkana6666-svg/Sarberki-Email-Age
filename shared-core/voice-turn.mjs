// Owner 2026-11-25 (#9 7170471506, „Kösd rá”): the phone channel (Retell custom function) answered by OUR shared engine.
// The provider only does speech, the call and the tool call; every reply comes from the same chat engine
// (createChatInquirySession), the same checked offer (buildChatOffer, Previo TEST read-only) and the same fact-bound
// assist as the chatbot – no second decision engine. Stateless: each call replays the caller's utterances of the call
// (from the provider's transcript or the tool arguments), so nothing is stored. No write, request, e-mail or booking.
import {createHmac,timingSafeEqual} from 'node:crypto';
import {createChatInquirySession} from '../sarberki-chatbot-project/chat-session.mjs';
import {requestFacts} from '../sarberki-chatbot-project/chat-request-client.mjs';
import {hotTubWished} from '../sarberki-chatbot-project/chat-view.mjs';

const MAX_UTTERANCES=40,MAX_LEN=1000;

// The caller's own utterances, oldest first. Retell sends the call with its transcript; a tool may also pass them as
// arguments (args nested or at the root). Agent lines are never replayed as guest text.
export function callerUtterances(body){
 const b=body&&typeof body==='object'?body:{},args=b.args&&typeof b.args==='object'?b.args:b;
 const fromCall=Array.isArray(b.call?.transcript_object)?b.call.transcript_object.filter(x=>x?.role==='user'&&typeof x.content==='string').map(x=>x.content):null;
 const list=fromCall&&fromCall.length?fromCall:Array.isArray(args.caller_messages)?args.caller_messages:typeof args.message==='string'?[args.message]:[];
 return list.filter(x=>typeof x==='string').map(x=>x.trim().slice(0,MAX_LEN)).filter(Boolean).slice(-MAX_UTTERANCES);
}

// Live Retell call 2026-11-25 (call_80ab29bb…): speech-to-text writes numbers as a person SAYS them – „kétezer 27
// június 2től június nyolcig”, „három felnőttet” – which no chat guest types, so the engine found no dates and never
// opened the booking. Voice channel only (chat and e-mail unchanged): Hungarian spoken numbers → digits before the
// shared engine. Only date-like forms (with -tól/-től/-ig/-án/-én or ordinal), a party count before felnőtt/gyerek/fő/
// éjszaka, and „kétezer N” years are rewritten; a bare word („egy”, „hét” = week) stays as is.
const HU_UNITS={egy:1,kettő:2,ketto:2,két:2,ket:2,három:3,harom:3,négy:4,negy:4,öt:5,ot:5,hat:6,hét:7,het:7,nyolc:8,kilenc:9};
const HU_TENS={tizen:10,huszon:20,harminc:30};
const HU_ORD={első:1,elso:1,elseje:1,elsej:1,második:2,masodik:2,harmadik:3,negyedik:4,ötödik:5,otodik:5,hatodik:6,hetedik:7,nyolcadik:8,kilencedik:9,tizedik:10,huszadik:20,harmincadik:30,egyedik:1,kettedik:2};
function huNumber(word){
 const w=word.toLocaleLowerCase('hu-HU');
 if(HU_ORD[w]!==undefined)return HU_ORD[w];
 if(w==='tíz'||w==='tiz')return 10;if(w==='húsz'||w==='husz')return 20;if(w==='harminc')return 30;
 for(const [t,v] of Object.entries(HU_TENS))if(w.startsWith(t)){const rest=w.slice(t.length);if(!rest)return null;const u=HU_UNITS[rest]??HU_ORD[rest];return u!==undefined&&u<10?v+u:null;}
 return HU_UNITS[w]??null;
}
const STEM='(elsej|első|elso|második|masodik|harmadik|negyedik|ötödik|otodik|hatodik|hetedik|nyolcadik|kilencedik|tizedik|huszadik|harmincadik|(?:tizen|huszon|harminc)(?:egyedik|kettedik|harmadik|negyedik|ötödik|otodik|hatodik|hetedik|nyolcadik|kilencedik|egy|kettő|ketto|két|három|harom|négy|negy|öt|ot|hat|hét|het|nyolc|kilenc)|tíz|tiz|húsz|husz|harminc|egy|kettő|ketto|két|három|harom|négy|negy|öt|ot|hat|hét|het|nyolc|kilenc)';
export function normalizeSpokenHu(text){
 let t=String(text||'');
 // „kétezer 27”, „kétezer-huszonhét”, „kétezerhuszonhét” → 2027
 t=t.replace(/kétezer[\s-]*(\d{1,2})(?!\d)/giu,(m,n)=>String(2000+Number(n)));
 t=t.replace(new RegExp('kétezer[\\s-]*'+STEM+'(?!\\p{L})','giu'),(m,w)=>{const n=huNumber(w);return n!==null?String(2000+n):m;});
 // day with a date suffix: „nyolcig”, „tizedikétől”, „elsejéig”, „másodikán”, „2től”
 t=t.replace(new RegExp('(?<!\\p{L})'+STEM+'(?:ik[aáeé]|ej[eé]|[aáeé])?(t[óo]l|t[őo]l|ig|[aáeé]n)(?!\\p{L})','giu'),(m,w,suf)=>{const n=huNumber(w.replace(/(?:ik[aáeé]|ej[eé])$/u,''));return n!==null&&n>=1&&n<=31?`${n}-${suf}`:m;});
 t=t.replace(/(?<![\d.])(\d{1,2})\s?(t[óo]l|t[őo]l|ig)(?!\p{L})/giu,'$1-$2');
 // party: „három felnőtt(et)”, „két gyerek”, „négy fő”, „három éjszaka”
 t=t.replace(new RegExp('(?<!\\p{L})'+STEM+'(?=\\s+(?:felnőtt|felnott|gyerek|gyermek|fő|fo(?!\\p{L})|éjszak|ejszak|éjjel))','giu'),(m,w)=>{const n=huNumber(w);return n!==null?String(n):m;});
 return t;
}

// Spoken form of an engine reply: no letter greeting or section titles, no bullet dashes, short.
const DROP=/^(?:Tisztelt .*!|Kedves .*[!,]|Dear .*,|Guten Tag.*!|Sehr geehrte.*,|Pozdravljeni.*!|Köszönjük érdeklődését\.|Vielen Dank für Ihre Anfrage\.|Thank you for your enquiry\.|Hvala za vaše povpraševanje\.|Szállás|Accommodation|Unterkunft|Nastanitev|Ár és díjak|Price and charges|Preis und Gebühren|Cena in stroški|Foglalási feltételek|Booking terms|Buchungsbedingungen|Pogoji rezervacije|Az ajánlathoz még szükségünk van|Details still needed|Noch benötigte Angaben|Podatki za dopolnitev|Kiegészítő információk|Additional information|Weitere Informationen|Dodatne informacije|Üdvözlettel.*|Best regards.*|Mit freundlichen Grüßen.*|Lep pozdrav.*|Sárberki.*|\(Automati.*\)|\(Samodejn.*\))$/u;
export function speakable(text,max=700){
 const lines=String(text||'').split('\n').map(l=>l.trim()).filter(l=>l&&!DROP.test(l)).map(l=>l.replace(/^[–-]\s*/,''));
 let out=lines.join(' ').replace(/\s+/g,' ').trim();
 if(out.length>max){const cut=out.slice(0,max);const end=Math.max(cut.lastIndexOf('. '),cut.lastIndexOf('? '),cut.lastIndexOf('! '));out=(end>200?cut.slice(0,end+1):cut).trim();}
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
 for(const u of utterances)r=s.reply(language==='de'||language==='en'||language==='si'?u:normalizeSpokenHu(u));
 const lang=s.language,snap=s.snapshot(),facts=requestFacts(snap);
 if(facts&&hotTubWished(utterances))facts.hotTub=true;
 let text=r.text,source='engine',offer=null;
 if(facts&&r.decision&&offerFn){
  try{offer=await offerFn({facts,language:lang});}catch{offer=null;}
  if(offer&&['AVAILABLE','UNAVAILABLE'].includes(offer.status)){text=offer.text;source='offer';}
 }
 if(!r.decision&&!r.noAssist&&assistFn){try{const a=await assistFn({message:utterances.at(-1),language:lang});if(typeof a==='string'&&a.trim()){text=a;source='assist';}}catch{}}
 return {reply:speakable(text),language:lang,source,
  facts:{arrival:snap.dates?.arrival??null,departure:snap.dates?.departure??null,adults:Number.isInteger(snap.adults)?snap.adults:null,
   children:Number.isInteger(snap.children)?snap.children:null,cabin:snap.cabin||null},
  offer:offer?{status:offer.status,total:Number.isSafeInteger(offer.total)?offer.total:null}:null};
}
