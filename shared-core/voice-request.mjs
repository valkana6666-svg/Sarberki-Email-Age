// Owner 2026-11-26 (PERM-20261126-VOICE-OPTION, #9 7185629371): the phone assistant (ElevenLabs TEST agent) takes a
// booking with ONE contact detail, the e-mail address. Flow: checked offer → „Szeretné lefoglalni?” → yes → e-mail
// (read back once, spelling only when misheard) → this tool. Here, on the server: the stay is replayed from the
// caller's own words (never the model's summary), the free cabin and the price are re-checked, the request is saved
// through the existing intake path (channel „phone”, one case per call) and a 48-hour Previo TEST option is
// pre-filled (same writer and locks as the chat). The agent may say „rögzítettük” ONLY when this returns ok:true.
// The rest of the guest data (name, phone, address) the staff ask by e-mail and fill in Previo by hand.
import {createHash} from 'node:crypto';
import {voiceFacts,ACCEPT} from './voice-turn.mjs';
import {normalizeSpoken} from './voice-normalize.mjs';

export const VOICE_INTAKE_SWITCH='test-only';
export const EMAIL_RE=/^[^\s@<>"(),;:]{1,64}@[^\s@<>"(),;:]{1,190}\.[A-Za-z]{2,}$/;
// Placeholder contact name for the Previo option (the caller is not asked for a name on the phone; owner 2026-11-26).
export const PHONE_CONTACT_NAME='Telefonos foglalás';

// Spoken e-mail → address: „kovacs pont anna kukac gmail pont com” → kovacs.anna@gmail.com (HU/DE/EN/SI words).
const W=(list,to)=>[new RegExp('(?<![\\p{L}\\p{N}])(?:'+list.join('|')+')(?![\\p{L}\\p{N}])','giu'),to];
const SPOKEN=[
 W(['kukac','kukacjel','at\\s*sign','at','ät','et','afna','afno'],'@'),
 W(['pont','dot','punkt','pika','period'],'.'),
 W(['kötőjel','kotojel','mínusz','minusz','minus','dash','hyphen','bindestrich','vezaj','pomišljaj'],'-'),
 W(['alulvonás','alulvonas','aláhúzás','alahuzas','underscore','unterstrich','podčrtaj','podcrtaj'],'_'),
];
export function normalizeSpokenEmail(text){
 let t=String(text??'').normalize('NFC').trim().toLowerCase();
 if(t.length>200)return null;
 for(const [re,to] of SPOKEN)t=t.replace(re,' '+to+' ');
 t=t.replace(/\s+/g,'').replace(/^[.,;:]+|[.,;:!?]+$/gu,'');
 return EMAIL_RE.test(t)&&(t.match(/@/g)||[]).length===1?t:null;
}
// The saved address said back once at the end („… a kovacs pont anna kukac gmail pont com címre”).
const SAY_CHARS={hu:{'@':'kukac','.':'pont','-':'kötőjel','_':'alulvonás'},de:{'@':'at','.':'Punkt','-':'Bindestrich','_':'Unterstrich'},
 en:{'@':'at','.':'dot','-':'dash','_':'underscore'},si:{'@':'afna','.':'pika','-':'vezaj','_':'podčrtaj'}};
export function speakEmail(email,lang='hu'){
 const m=SAY_CHARS[lang]||SAY_CHARS.hu;
 return String(email).replace(/[@._-]/g,c=>' '+m[c]+' ').replace(/\s+/g,' ').trim();
}

// The stay is what the caller said UP TO the booking decision; the e-mail dictation and the „yes” after it are not
// replayed (an address like „anna2027@…” must not become a date or a guest count).
export function stayUtterances(utterances){
 const list=utterances.map(String);
 let last=-1;list.forEach((u,i)=>{if(ACCEPT.test(normalizeSpoken(u)))last=i;});
 const mailLike=u=>/@|(?<!\p{L})(?:kukac|at|afna)(?!\p{L})[\s\S]*(?<!\p{L})(?:pont|dot|punkt|pika)(?!\p{L})/iu.test(u);
 return (last>=0?list.slice(0,last+1):list).filter(u=>!mailLike(u));
}

const REPLY={
 option:{hu:(m)=>`Köszönöm, a foglalási igényét rögzítettük, és a faházat negyvennyolc órára előzetesen lefoglaltuk Önnek. Munkatársunk a ${m} címre küldi a visszaigazolást és a foglaló befizetésének részleteit.`,
  de:(m)=>`Vielen Dank, Ihre Buchungsanfrage ist erfasst und das Haus ist für 48 Stunden vorläufig für Sie reserviert. Unser Team sendet die Bestätigung und die Details zur Anzahlung an ${m}.`,
  en:(m)=>`Thank you, your booking request is saved and the cabin is provisionally held for you for 48 hours. Our team will send the confirmation and the deposit details to ${m}.`,
  si:(m)=>`Hvala, vaše povpraševanje je zabeleženo in hiška je za vas začasno rezervirana za 48 ur. Naša ekipa bo potrditev in podrobnosti predplačila poslala na ${m}.`},
 saved:{hu:(m)=>`Köszönöm, a foglalási igényét rögzítettük. Munkatársunk a ${m} címre küldi a visszaigazolást és a foglaló befizetésének részleteit.`,
  de:(m)=>`Vielen Dank, Ihre Buchungsanfrage ist erfasst. Unser Team sendet die Bestätigung und die Details zur Anzahlung an ${m}.`,
  en:(m)=>`Thank you, your booking request is saved. Our team will send the confirmation and the deposit details to ${m}.`,
  si:(m)=>`Hvala, vaše povpraševanje je zabeleženo. Naša ekipa bo potrditev in podrobnosti predplačila poslala na ${m}.`},
 email:{hu:'Elnézést, az e-mail-címet nem értettem pontosan. Kérem, betűzze el lassan.',de:'Entschuldigung, die E-Mail-Adresse habe ich nicht genau verstanden. Bitte buchstabieren Sie sie langsam.',
  en:"Sorry, I didn't catch the e-mail address exactly. Please spell it slowly.",si:'Oprostite, e-poštnega naslova nisem natančno razumel. Prosim, počasi ga črkujte.'},
 consent:{hu:'Rögzíthetem a foglalási igényt ezzel az e-mail-címmel?',de:'Darf ich die Buchungsanfrage mit dieser E-Mail-Adresse erfassen?',
  en:'May I save the booking request with this e-mail address?',si:'Ali lahko povpraševanje zabeležim s tem e-poštnim naslovom?'},
 stay:{hu:'Elnézést, a foglaláshoz nem minden adat egyértelmű. Kérem, mondja meg még egyszer az érkezés és a távozás napját, a létszámot és a háztípust.',
  de:'Entschuldigung, für die Buchung ist nicht alles eindeutig. Bitte nennen Sie noch einmal An- und Abreise, Personenzahl und Haustyp.',
  en:'Sorry, not every detail is clear for the booking. Please tell me again the arrival and departure dates, the number of guests and the cabin type.',
  si:'Oprostite, za rezervacijo ni vse jasno. Prosim, še enkrat povejte datum prihoda in odhoda, število oseb in tip hiške.'},
 full:{hu:'Sajnos ez a faház a kért időszakra időközben már nem szabad, így a foglalást nem tudom rögzíteni. Szívesen megnézek más időpontot vagy háztípust.',
  de:'Leider ist dieses Haus für den Zeitraum inzwischen nicht mehr frei, daher kann ich die Buchung nicht erfassen. Gerne prüfe ich einen anderen Termin oder Haustyp.',
  en:'Unfortunately this cabin is no longer free for those dates, so I cannot save the booking. I can gladly check another date or cabin type.',
  si:'Žal ta hiška za ta termin ni več prosta, zato rezervacije ne morem zabeležiti. Z veseljem preverim drug termin ali tip hiške.'},
 failed:{hu:'Elnézést, a foglalási igényt most nem sikerült rögzítenem. Kérem, írja meg az igényét e-mailben, vagy hívjon minket később.',
  de:'Entschuldigung, die Buchungsanfrage konnte ich gerade nicht erfassen. Bitte senden Sie sie per E-Mail oder rufen Sie später an.',
  en:"Sorry, I couldn't save the booking request right now. Please send it by e-mail or call us again later.",
  si:'Oprostite, povpraševanja trenutno nisem mogel zabeležiti. Prosim, pošljite ga po e-pošti ali nas pokličite kasneje.'},
};
const say=(k,lang,...a)=>{const v=REPLY[k][lang]||REPLY[k].hu;return typeof v==='function'?v(...a):v;};

// One call = one request: the ElevenLabs conversation id, or (if the provider sends none) a hash of the stay + address.
export function voiceExternalId(conversationId,utterances,email){
 const id=String(conversationId??'').trim();
 if(/^[A-Za-z0-9_-]{6,100}$/.test(id))return 'voice_'+id;
 return 'voice_h'+createHash('sha256').update(JSON.stringify([utterances,email])).digest('hex').slice(0,32);
}

// Pure orchestration (all I/O injected): returns {ok, reply, status, caseId?, option?}. ok:true only after a saved case.
// The caller's number from the phone line (ElevenLabs system__caller_id on a real phone call; owner 2026-11-26: „a
// telefonszámot nem kell elkérni”). A web/app test call or a hidden number gives none – then only the e-mail.
export function callerPhone(value){
 const t=String(value??'').trim();
 return /^\+?[0-9]{6,15}$/.test(t.replace(/[ ()\/-]/g,''))&&/^\+?[0-9][0-9 ()\/-]{5,22}$/.test(t)?t:null;
}
export async function voiceRequest({utterances,email,consent,conversationId,callerId=null,language='auto',clock=()=>new Date(),
 offerFn,createFn,prefillFn=null,notifyFn=null}){
 const stay=stayUtterances(utterances);
 const {facts,language:lang}=voiceFacts(stay.length?stay:utterances,{language,clock});
 const address=normalizeSpokenEmail(email);
 if(!address)return {ok:false,status:'EMAIL_INVALID',reply:say('email',lang)};
 if(consent!==true)return {ok:false,status:'CONSENT_REQUIRED',reply:say('consent',lang)};
 if(!facts)return {ok:false,status:'FACTS_INCOMPLETE',reply:say('stay',lang)};
 let offer=null;try{offer=await offerFn({facts,language:lang});}catch{offer=null;}
 if(offer?.status==='UNAVAILABLE')return {ok:false,status:'NOT_FREE',reply:say('full',lang)};
 if(offer?.status!=='AVAILABLE'||!Number.isSafeInteger(offer.total))return {ok:false,status:'CHECK_FAILED',reply:say('failed',lang)};
 const externalId=voiceExternalId(conversationId,stay,address),phone=callerPhone(callerId);
 const summary='✅ A hívó telefonon elfogadta az ajánlatot és kérte a foglalást. A rendszer újraellenőrzött ára: '+String(offer.total).replace(/\B(?=(\d{3})+(?!\d))/g,' ')+' Ft.\n'+
  (phone?'A hívó száma a telefonvonalról: '+phone+'. Csak az e-mail-címet kértük el: a nevet és a többi adatot e-mailben kérd el, és töltsd ki a Previóban.\n\n'
   :'Csak e-mail-címet kértünk (a hívószám nem érkezett meg): a nevet, a telefonszámot és a többi adatot e-mailben kérd el, és töltsd ki a Previóban.\n\n')+
  'A hívó mondatai (kezelői összefoglaló):\n'+stay.map(t=>'– '+String(t).trim().replace(/\s+/g,' ').slice(0,500)).join('\n');
 let created;
 try{created=await createFn({externalId,facts:{...facts,email:address,...(phone?{phone}:{}),language:lang},summary});}catch{created=null;}
 if(!created?.caseId)return {ok:false,status:'SAVE_FAILED',reply:say('failed',lang)};
 let option={status:'off'};
 if(prefillFn){try{option=await prefillFn({caseId:created.caseId,facts,email:address,phone:phone||''});}catch{option={status:'failed'};}}
 const opt=option?.status==='created';
 if(notifyFn){try{await notifyFn(opt?'Csak e-mail-cím; a Previo-tesztben 48 órás opcióként előre kitöltve ('+option.unit+'. egység) – ellenőrizd, a többi adatot kérd el e-mailben.':'Csak e-mail-cím – a Previo-opció nem jött létre, kezeld a napi kezelőben.');}catch{}}
 return {ok:true,status:opt?'OPTION_CREATED':'REQUEST_SAVED',caseId:created.caseId,option:opt?{unit:option.unit}:null,
  reply:say(opt?'option':'saved',lang,speakEmail(address,lang))};
}
