// Owner 2026-11-25 (#9 7170471506, „Kösd rá”): the phone channel (Retell custom function) answered by OUR shared engine.
// The provider only does speech, the call and the tool call; every reply comes from the same chat engine
// (createChatInquirySession), the same checked offer (buildChatOffer, Previo TEST read-only) and the same fact-bound
// assist as the chatbot – no second decision engine. Stateless: each call replays the caller's utterances of the call
// (from the provider's transcript or the tool arguments), so nothing is stored. No write, request, e-mail or booking.
import {createHmac,timingSafeEqual} from 'node:crypto';
import {createChatInquirySession} from '../sarberki-chatbot-project/chat-session.mjs';
import {requestFacts} from '../sarberki-chatbot-project/chat-request-client.mjs';
import {hotTubWished,withoutPhoneQuestion} from '../sarberki-chatbot-project/chat-view.mjs';
import {normalizeSpoken,speakNumbersHu} from './voice-normalize.mjs';
import {PLACEHOLDER} from './inquiry-channel-adapters.mjs';
import {depositPolicyForBooking} from '../sarberki-core.mjs';
import {cabinPriceInfo} from '../business/sarberki/cabin-price-info.mjs';
import {isTubTurn,tubTexts,parseTubRequest,tubReply} from './voice-tub.mjs';
import {chatbotReply} from '../chatbot-v1.mjs';
const cabinPriceQuestion=t=>chatbotReply({message:t}).intent==='price';

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
 // Owner's call 2026-11-26: „14:00” was read as „tizennégy óra nulla” – clock times as „14 óra” (minutes only when not 00).
 if(lang==='hu')t=t.replace(/(?<![\d:])([01]?\d|2[0-3]):00(?=\s+ór)/g,(m,h)=>String(Number(h)));
 if(lang==='hu')t=t.replace(/(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/g,(m,h,mm)=>Number(h)+' óra'+(mm==='00'?'':' '+Number(mm)+' perc'));
 t=t.replace(/(\d{1,3}(?:[  .]\d{3})+|\d+)\s?(?:Ft|HUF)\b/g,(m,n)=>n.replace(/[  .]/g,'')+' '+(CURRENCY[lang]||CURRENCY.hu));
 return t;
}
// The booking-status / terms part of a letter is not read on the phone (legal text; the checked offer says it briefly).
const CUT=/\n\s*(?:Foglalás állapota|Booking status|Reservierungsstatus|Status rezervacije|Foglalási feltételek|Booking terms|Buchungsbedingungen|Pogoji rezervacije)\s*\n[\s\S]*$/u;
// On the phone the caller speaks, not writes.
const SAY={hu:[[/7=6 kedvezmény/gu,'kedvezmény: minden hetedik éjszaka ingyenes'],[/\/felnőtt\/éj/gu,' felnőttenként és éjszakánként'],[/\/éj(?!\p{L})/gu,' éjszakánként'],[/\+(?=\S)/gu,'plusz '],[/írja meg/gu,'mondja meg'],[/Írja meg/gu,'Mondja meg'],[/írjon nekünk/gu,'szóljon nekünk'],[/írjon bátran/gu,'kérdezzen bátran']],de:[[/7=6-Angebot/gu,'Angebot, jede siebte Nacht gratis'],[/schreiben Sie uns/gu,'sagen Sie uns']],en:[[/the 7=6 offer/giu,'the offer of every seventh night free'],[/please write/giu,'please tell us']],si:[[/ponudba 7=6/gu,'ponudba vsaka sedma noč brezplačno'],[/napišite/gu,'povejte']]};
// Letter placeholders („the availability is confirmed separately”, „the total price follows”) are noise on the phone
// (owner's ElevenLabs call 2026-11-25): the caller hears only the facts and the question.
const dropPlaceholders=(t,lang)=>{for(const p of [...(PLACEHOLDER[lang]||[]),...(PLACEHOLDER.hu||[])])t=t.split(p).join('');return t;};
export function speakable(text,max=700,lang='hu'){
 text=speechify(dropPlaceholders(String(text||'').replace(CUT,''),lang),lang);
 for(const [re,to] of SAY[lang]||[])text=text.replace(re,to);
 if(lang==='hu')text=speakNumbersHu(text);
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
// Live call 2026-11-25 (call_33a50b16…): after a checked offer, „Normál tóra szeretnék” / „két horgászjegy … négy
// napra” got the offer again, and „Szeretném lefoglalni, megfelel” got the data questions again (the free-question
// model saw only that one sentence). Now: the offer is read only when THIS utterance changed the stay or asks about
// it (price / free / total); a side question goes to the fact-bound model WITH the caller's last words as context; a
// booking acceptance gets an honest fixed reply (this line cannot book yet).
// Owner's call 2026-11-26: „Mennyibe kerül?” right after a fishing-ticket question and „És a rekordtóra mennyibe kerül?”
// got the accommodation offer again. A price word about a side topic (ticket, lake, tub, dog…) – or a short price
// question right after one – is a side question; naming the stay („szállás”, „ház”) always means the stay.
const SIDE_TOPIC=/horgász|horgasz|jegy|rekord|(?<!\p{L})t[óo](?:ra|n|ba|hoz|nál)?(?!\p{L})|normáltó|dézsa|dezsa|kutya|háziállat|parkol|reggeli|étkez|ticket|fishing|lake|hot\s*tub|dog|angel|teich|badezuber|hund|ribol|jezer|kad|pes/iu;
const STAY_WORDS=/szállás|szallas|(?<!\p{L})(?:fa)?ház(?:at|ért|ra)?(?!\p{L})|faház|unterkunft|haus|accommodation|cabin|stay|nastanit|hišk|hisk/iu;
function stayQuestion(utterances,last){
 if(!STAY_ASK.test(last))return false;
 // „Actually, no hot tub. What's the total now?” – taking back the tub and asking the total is about the stay.
 if(/\bno\s+hot\s*tub|without\s+(?:the\s+|a\s+)?hot\s*tub|kein(?:en)?\s+badezuber|ohne\s+badezuber|brez\s+(?:\p{L}+\s+)?kad|mégse\p{L}*[^.?!]{0,20}dézs|dézs\p{L}*[^.?!]{0,20}(?:mégse|nem\s+kell)/iu.test(last))return true;
 if(STAY_WORDS.test(last))return true;
 if(SIDE_TOPIC.test(last))return false;
 const short=String(utterances.at(-1)).trim().split(/\s+/).length<=4;
 return !(short&&utterances.length>1&&SIDE_TOPIC.test(String(utterances.at(-2))));
}
const STAY_ASK=/mennyi|mennyibe|(?<!\p{L})ár(?:a|at)?(?!\p{L})|összesen|osszesen|kerül|kerul|szabad|kiadó|kiado|kost|preis|insgesamt|frei|how\s+much|price|cost|total|available|koliko|cena|stane|skupaj|prost/iu;
const ACCEPT=/lefoglal|foglaln[áa]|foglalom|szeretném\s+(?:lefoglalni|foglalni)|elfogad|megfelel|ezt\s+kér|azt\s+kér|book\s+it|we'?ll\s+take|i'?ll\s+take|let'?s\s+book|buchen|nehmen\s+(?:wir|es)|rezerviral|rezervirati|vzamemo/iu;
const ACCEPT_REPLY={hu:'Köszönjük, örülünk, hogy megfelel! Ezen a vonalon most nem tudjuk véglegesíteni a foglalást. Kérjük, küldje el az igényét a honlapunk chatjében vagy e-mailben, és munkatársunk visszaigazolja.',
 de:'Vielen Dank, schön, dass es passt! Über diese Leitung können wir die Buchung derzeit nicht abschließen. Bitte senden Sie Ihre Anfrage über den Chat auf unserer Website oder per E-Mail – unser Team bestätigt sie.',
 en:"Thank you, glad it suits you! We can't complete the booking on this line yet. Please send your request through the chat on our website or by e-mail, and our team will confirm it.",
 si:'Hvala, veseli nas, da vam ustreza! Rezervacije po tej liniji trenutno ne moremo dokončati. Prosimo, pošljite povpraševanje prek klepeta na naši spletni strani ali po e-pošti, naša ekipa ga bo potrdila.'};
// Owner 2026-11-25: on the phone (cost per minute) only the essentials – free or not, and the total price. Deposit,
// payment deadline and cancellation only when the caller asks about them or wants to book; the e-mail offer carries
// the details. The chat-form sentence and the extras are never read on the phone.
const TERMS_ASK=/le\s+(?:\p{L}+\s+){0,2}mond|foglaló|foglalo|előleg|eloleg|befizet|átutal|atutal|utaln|határid|hatarid|lemond|deposit|pay(?:ment)?|cancel|refund|anzahlung|zahl|überweis|storn|predplač|predplac|plačil|placil|nakazil|odpoved|odpov/iu;
const ASK_BOOK={hu:'Szeretné lefoglalni?',de:'Möchten Sie buchen?',en:'Would you like to book it?',si:'Želite rezervirati?'};
const TERMS={hu:(pct,amt,h)=>`Foglalóként a szállásdíj ${pct}%-át, ${amt} forintot kell banki átutalással befizetni, a visszaigazolástól számított ${h<=24?'24 órán':'7 napon'} belül.`,
 de:(pct,amt,h)=>`Als Anzahlung sind ${pct}% des Unterkunftspreises, ${amt} Ft, per Banküberweisung innerhalb von ${h<=24?'24 Stunden':'7 Tagen'} nach der Bestätigung zu zahlen.`,
 en:(pct,amt,h)=>`The deposit is ${pct}% of the accommodation price, ${amt} HUF, by bank transfer within ${h<=24?'24 hours':'7 days'} of the confirmation.`,
 si:(pct,amt,h)=>`Predplačilo je ${pct}% cene nastanitve, ${amt} Ft, z bančnim nakazilom v ${h<=24?'24 urah':'7 dneh'} po potrditvi.`};
// Cancellation only when asked about it (owner 2026-11-25: the phone says as little as needed).
const CANCEL_ASK=/le\s+(?:\p{L}+\s+){0,2}mond|lemond|cancel|refund|storn|odpoved|odpov/iu;
// Deposit / payment words (without the cancellation ones).
const DEPOSIT_ASK=/foglaló|foglalo|előleg|eloleg|befizet|átutal|atutal|utaln|határid|hatarid|deposit|pay(?:ment)?|anzahlung|zahl|überweis|predplač|predplac|plačil|placil|nakazil/iu;
export function voiceOffer(offer,{lang='hu',withTerms=false,withCancel=false,onlyTerms=false,now=new Date()}={}){
 if(!offer||typeof offer.text!=='string')return null;
 const lines=offer.text.split('\n').map(l=>l.trim()).filter(Boolean);
 if(offer.status!=='AVAILABLE')return lines.join(' ');
 // A question about the terms of an offer already given: only the answer (no repeated offer).
 const out=onlyTerms?[]:[lines[0],(lines[1]||'').replace(/\s*\([^)]*\)/,'')];
 if(withTerms&&Number.isSafeInteger(offer.deposit)&&Number.isFinite(offer.depositPct)){
  const p=depositPolicyForBooking({guestCount:2,bookingAt:now.toISOString(),arrivalDate:offer.arrival});
  out.push((TERMS[lang]||TERMS.hu)(offer.depositPct,offer.deposit,p?.paymentWindowHours??168));
 }
 if(withCancel){const cancel=lines.find(l=>/^(Lemondás|Stornierung|Cancellation|Odpoved):/.test(l));if(cancel)out.push(cancel);}
 out.push(ASK_BOOK[lang]||ASK_BOOK.hu);
 return out.filter(Boolean).join(' ');
}
const ACCEPT_TUB={hu:'A dézsabérlést is írja bele az igénybe, a szabad időpontot munkatársunk egyezteti.',de:'Bitte vermerken Sie den Badezuber in der Anfrage; den freien Termin stimmt unser Team ab.',en:'Please mention the hot tub in your request; our team will arrange the free slot.',si:'Masažno kad navedite v povpraševanju, prost termin bo uskladila naša ekipa.'};
// Owner 2026-11-26 (PERM-20261126-VOICE-OPTION): with the phone request on (VOICE_INTAKE=test-only), a booking
// acceptance gets the deposit terms and ONE question for the e-mail address; the agent then reads it back and calls
// sarberki_request (voice-request), which saves the request and pre-fills a 48-hour Previo TEST option.
// Owner 2026-11-26: ask the caller to say the address slowly and clearly (fewer mishearings, no spelling round).
// Owner 2026-11-26 (after the first booking call): the name too, then the e-mail address.
export const ASK_EMAIL={hu:'A foglaláshoz kérem, mondja meg a nevét, majd lassan és tagoltan az e-mail-címét.',de:'Für die Buchung nennen Sie mir bitte Ihren Namen und dann langsam und deutlich Ihre E-Mail-Adresse.',
 en:'To book, please tell me your name, then your e-mail address slowly and clearly.',si:'Za rezervacijo mi prosim povejte svoje ime in nato počasi in razločno svoj e-poštni naslov.'};
const ACCEPT_TUB_INTAKE={hu:'A dézsát is felírom, a szabad időpontot munkatársunk egyezteti.',de:'Den Badezuber notiere ich, den freien Termin stimmt unser Team ab.',
 en:"I'll note the hot tub; our team will arrange the free slot.",si:'Masažno kad si zabeležim, prost termin bo uskladila naša ekipa.'};
export {ACCEPT};
// The stay as the caller said it (same replay as a turn): facts, language and the hot-tub wish.
export function voiceFacts(utterances,{language='auto',clock=()=>new Date()}={}){
 const s=createChatInquirySession({language,clock});
 for(const u of utterances)s.reply(normalizeSpoken(u));
 const facts=requestFacts(s.snapshot());
 return {facts,language:s.language,hotTub:!!facts&&hotTubWished(utterances)};
}
export async function voiceTurn({utterances,language='auto',clock=()=>new Date(),offerFn=null,assistFn=null,intake=false,booked=false}){
 if(!Array.isArray(utterances)||!utterances.length)return {reply:null,reason:'NO_UTTERANCE'};
 const s=createChatInquirySession({language,clock});let r=null,before=null;
 // Owner 2026-11-27: a hot tub wish („dézsát is március 5-re és 6-ra, öt főre”) is a TUB request, never a new stay –
 // those sentences are kept out of the stay replay, so the thread (dates, guests, cabin) is not lost.
 const lastTub=isTubTurn(utterances,utterances.length-1),replay=utterances.filter((u,i)=>!isTubTurn(utterances,i));
 const seq=replay.length?replay:utterances;
 // Spoken numbers → digits (voice only); the session's own language detection decides the reply language.
 seq.forEach((u,i)=>{if(i===seq.length-1)before=JSON.stringify(requestFacts(s.snapshot()));r=s.reply(normalizeSpoken(u));});
 if(lastTub){
  const sn=s.snapshot(),f=requestFacts(sn),lang0=s.language;
  const guests=Number.isInteger(sn.adults)?sn.adults+(Number.isInteger(sn.children)?sn.children:0):null;
  const req=f?parseTubRequest(normalizeSpoken(tubTexts(utterances).at(-1)),{arrival:f.arrival,departure:f.departure,guests}):null;
  if(req)return {reply:speakable(tubReply(req,lang0),450,lang0),language:lang0,source:'tub',tub:{days:req.days,persons:req.persons,hour:req.hour,total:req.total},
   facts:{arrival:f.arrival,departure:f.departure,adults:Number.isInteger(sn.adults)?sn.adults:null,children:Number.isInteger(sn.children)?sn.children:null,cabin:sn.cabin||null},offer:null};
 }
 const lang=s.language,snap=s.snapshot(),facts=requestFacts(snap),last=normalizeSpoken(utterances.at(-1));
 const changed=JSON.stringify(facts)!==before;
 if(facts&&hotTubWished(utterances))facts.hotTub=true;
 let text=r.text,source='engine',offer=null;
 const stayAsk=stayQuestion(utterances,last);
 if(facts&&!changed&&ACCEPT.test(last)&&!stayAsk){
  // Wants to book: now the deposit and the deadline (owner 2026-11-25), then the honest „this line cannot book yet”.
  let terms='';
  if(offerFn){try{const o=await offerFn({facts,language:lang});
   if(o?.status==='AVAILABLE'&&Number.isSafeInteger(o.deposit)){offer=o;
    const hours=depositPolicyForBooking({guestCount:2,bookingAt:clock().toISOString(),arrivalDate:o.arrival})?.paymentWindowHours??168;
    terms=(TERMS[lang]||TERMS.hu)(o.depositPct,o.deposit,hours)+' ';}}catch{}}
  const tub=hotTubWished([utterances.at(-1)]);
  if(intake&&offer)text=terms+(tub?(ACCEPT_TUB_INTAKE[lang]||ACCEPT_TUB_INTAKE.hu)+' ':'')+(ASK_EMAIL[lang]||ASK_EMAIL.hu);
  else text=terms+(ACCEPT_REPLY[lang]||ACCEPT_REPLY.hu)+(tub?' '+(ACCEPT_TUB[lang]||ACCEPT_TUB.hu):'');
  source=intake&&offer?'accept_email':'accept';
 }
 else if(facts&&offerFn&&(r.decision&&(changed||stayAsk)||TERMS_ASK.test(last))){
  try{offer=await offerFn({facts,language:lang});}catch{offer=null;}
  if(offer&&['AVAILABLE','UNAVAILABLE'].includes(offer.status)){text=voiceOffer(offer,{lang,withTerms:DEPOSIT_ASK.test(last),withCancel:CANCEL_ASK.test(last),onlyTerms:!changed&&TERMS_ASK.test(last),now:clock()});source='offer';}
 }
 const sideQuestion=facts&&r.decision&&!changed&&!stayAsk&&source==='engine';
 if((sideQuestion||!r.decision&&!r.noAssist)&&source==='engine'&&assistFn){
  // The caller's last words (speech is split into fragments), so „… a normál tóra. Minden négy napra.” is one question.
  // Only a short fragment („Minden négy napra.”) is joined with the caller's previous words; a full question stands alone
  // (owner's ElevenLabs call: the hot tub question got the fishing ticket answer from the previous sentence).
  const lastWords=String(utterances.at(-1)).trim().split(/\s+/).length;
  // Owner's call 2026-11-26: „És a horgász napi jegy?” (5 words) was joined with the check-in question and got both
  // answers – only a real fragment (≤3 words: „Minden négy napra.”, „Mennyibe kerül?”) takes the previous words.
  const context=lastWords<=3?utterances.slice(-3).join(' ').slice(-600):String(utterances.at(-1));
  try{const a=await assistFn({message:context,language:lang});if(typeof a==='string'&&a.trim()){text=a;source='assist';}}catch{}
 }
 // Owner 2026-11-27: on the phone the price answer is the cabin line(s) + the question for the dates; the season,
 // one-night and tourist-tax details come with the offer for the dates.
 if(source==='engine'&&/alapára|alapáraink|Grundpreis|base price|osnovn/iu.test(String(text).slice(0,60))&&cabinPriceQuestion(last))text=cabinPriceInfo(last,lang,{short:true});
 // On the phone the caller's number is the call itself: no "please give us a phone number" (as in the chat form).
 if(source==='engine')text=withoutPhoneQuestion(text,lang);
 // After the booking is saved (the agent passes booked:true) the offer is never followed by „would you like to book?”.
 if(booked)text=String(text).replace(new RegExp('\\s*(?:'+Object.values(ASK_BOOK).map(x=>x.replace(/[?]/g,'\\?')).join('|')+')\\s*$'),'');
 return {reply:speakable(text,450,lang),language:lang,source,
  facts:{arrival:snap.dates?.arrival??null,departure:snap.dates?.departure??null,adults:Number.isInteger(snap.adults)?snap.adults:null,
   children:Number.isInteger(snap.children)?snap.children:null,cabin:snap.cabin||null},
  offer:offer?{status:offer.status,total:Number.isSafeInteger(offer.total)?offer.total:null}:null};
}
