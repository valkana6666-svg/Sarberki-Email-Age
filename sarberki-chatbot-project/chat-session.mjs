import {normalizeInquiryInput} from '../intake-normalize.mjs';
import {buildChatInquiryReply} from '../shared-core/inquiry-channel-adapters.mjs';
import {chatbotReply,renderChatbotIntent} from '../chatbot-v1.mjs';
// Owner 2026-11-27 (question bank, live): the fact-bound model replaced the approved price / capacity / deposit /
// cancellation / check-in / pet / booking answers with a vague „it depends” – these keep the rule answer (no model call).
export const FIXED_FACT_INTENTS=new Set(['price','capacity','deposit','cancel','checkin','pet','booking']);
import {mergeBookingFacts} from '../booking-cases.mjs';
import {childAgesFromText,languageFromText,hasPotentialStayDate,ambiguousPartyFieldsFromText} from '../sarberki-core.mjs';
const SHORT_REPLY={
 thanks:{hu:'Rendben, köszönjük! Ha bármi kérdése van még, írjon bátran.',de:'Alles klar, vielen Dank! Wenn Sie noch Fragen haben, schreiben Sie uns gerne.',en:'Great, thank you! If you have any other questions, just write.',si:'V redu, hvala! Če imate še kakšno vprašanje, nam kar pišite.'},
 handover:{hu:'Természetesen, munkatársunk szívesen segít. Kérjük, adja meg telefonszámát vagy e-mail-címét, és felvesszük Önnel a kapcsolatot.',de:'Selbstverständlich hilft Ihnen gerne ein Mitarbeiter. Bitte geben Sie Ihre Telefonnummer oder E-Mail-Adresse an, wir melden uns bei Ihnen.',
  en:'Of course, a member of our team will be glad to help. Please leave your phone number or e-mail address and we will get in touch.',si:'Seveda, naša ekipa vam z veseljem pomaga. Prosimo, pustite telefonsko številko ali e-naslov in vam se oglasimo.'},
 tubOff:{hu:'Rendben, a dézsát nem számoljuk bele.',de:'In Ordnung, dann ohne Badezuber.',en:'Alright, no hot tub then.',si:'V redu, brez masažne kadi.'}
};
const TUB=/dézs|dezs|hot[ -]?tub|badezuber|badefass|whirlpool|jacuzzi|masažn\p{L}*\s*kad|masazn\p{L}*\s*kad|(?<!\p{L})kad(?:i|jo|e)?(?!\p{L})/iu;
const TUB_OFF=/mégsem|megsem|mégse|megse|nem\s+(?:kér|ker|kell|szeretn)|doch\s+nicht|nicht\s+(?:mehr|nötig)|kein(?:en)?\s+(?:badezuber|badefass|whirlpool)|after all|don'?t\s+(?:need|want)|no\s+hot\s*tub|ne\s+potrebujemo|vseeno\s+ne|ne\s+želimo|brez\s+(?:\p{L}+\s+)?kad|ohne\s+(?:\p{L}+\s+)?(?:badezuber|badefass|whirlpool)|without\s+(?:the\s+|a\s+)?hot\s*tub/iu;
const HANDOVER=/munkatárs|munkatars|élő\s+(?:személy|ember)|emberrel|visszahív|visszahiv|mitarbeiter|rückruf|ruckruf|zurückruf|real\s+person|human|call\s+me\s+back|someone\s+call|talk\s+to\s+(?:a|someone|staff)|osebj|povratni\s+klic|pokličite/iu;
const THANKS=/^(?:[\p{L}]+[,!.]?\s+)?(?:köszi|köszönöm|koszonom|kösz|kosz|rendben|szuper|oké|ok(?:é|e)?|jó\s+lesz|mehet|danke|alles\s+klar|passt|super|thanks|thank\s+you|great|cool|sounds\s+good|perfect|hvala|velja|v\s+redu)(?![\p{L}])/iu;
// A question about THIS stay (price, total, availability, deposit) stays a booking turn: the page shows the checked
// offer again (live language test 2026-11-25: "How much is it in total?" got "cannot confirm" after the change above).
const STAY_QUESTION=/mennyi|mennyibe|(?<!\p{L})ár(?:a|at)?(?!\p{L})|összesen|osszesen|kerül|kerul|szabad|foglal|előleg|eloleg|kost|preis|insgesamt|gesamt|frei|anzahlung|how\s+much|price|cost|total|available|deposit|koliko|cena|stane|skupaj|prost|predplačil|predplacil/iu;
export function shortTurnKind(message){
 const t=String(message||'').trim();
 if(TUB.test(t)&&TUB_OFF.test(t)&&!/\?\s*$/.test(t))return 'tubOff';
 if(HANDOVER.test(t))return 'handover';
 if(THANKS.test(t)&&!/\?/.test(t)&&t.split(/\s+/).length<=8)return 'thanks';
 return null;
}

// Tricky test 2026-11-27 (#9 7212441419): a stay given in pieces – „VIP június 24-től” → „27-ig maradnánk” → „hárman”
// → „bocs, mégis négyen” – and an explicit language request („Können Sie auf Deutsch antworten?”).
const MONTHS=[['január','januar','january','januarja','jan'],['február','februar','february','februarja','feb'],['március','marec','march','marca','märz','marz','mar'],['április','april','aprila','apr'],
 ['május','mai','may','maj','maja'],['június','juni','june','junij','junija','jun'],['július','juli','july','julij','julija','jul'],['augusztus','august','avgust','avgusta','aug'],
 ['szeptember','september','septembra','sep'],['október','oktober','october','oktobra','okt','oct'],['november','novembra','nov'],['december','dezember','decembra','dez','dec']];
const monthIndex=w=>{const x=String(w||'').toLowerCase().normalize('NFC');const f=x.normalize('NFD').replace(/[̀-ͯ]/g,'');return MONTHS.findIndex(ns=>ns.some(n=>n===x||n.normalize('NFD').replace(/[̀-ͯ]/g,'')===f));};
const iso=(y,m,d)=>`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
function arrivalOnly(text,now){
 const t=String(text);let m,y,mo,d;
 if((m=t.match(/(?:(20\d\d)\.?\s*)?(\p{L}+)\s+(\d{1,2})\.?\s*-?\s*(?:t[óő]l|é?t[óő]l|jétől|ától|étől)/u))){y=m[1];mo=monthIndex(m[2]);d=+m[3];}
 else if((m=t.match(/\bab\s+(?:dem\s+)?(\d{1,2})\.\s*(\p{L}+)(?:\s+(20\d\d))?/u))){d=+m[1];mo=monthIndex(m[2]);y=m[3];}
 else if((m=t.match(/\bfrom\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(\p{L}+)(?:,?\s+(20\d\d))?/iu))){d=+m[1];mo=monthIndex(m[2]);y=m[3];}
 else if((m=t.match(/\bfrom\s+(\p{L}+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d\d))?/iu))){mo=monthIndex(m[1]);d=+m[2];y=m[3];}
 else if((m=t.match(/(?<!\p{L})od\s+(\d{1,2})\.\s*(\p{L}+)(?:\s+(20\d\d))?/iu))){d=+m[1];mo=monthIndex(m[2]);y=m[3];}
 if(!(mo>=0)||!(d>=1&&d<=31))return null;
 const year=y?+y:(()=>{const n=clockYear(now);const c=iso(n,mo,d);return c<now.toISOString().slice(0,10)?n+1:n;})();
 return {year,month:mo,day:d};
}
const clockYear=now=>now.getUTCFullYear();
function endDayOnly(text){
 const t=String(text);let m;
 if((m=t.match(/(?<!\d)(\d{1,2})\.?\s*-?\s*(?:ig|éig|áig)(?!\p{L})/u))||(m=t.match(/\bbis\s+(?:zum\s+)?(\d{1,2})\./iu))||(m=t.match(/\b(?:until|till)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?!\d)/iu))||(m=t.match(/\bto\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/iu))||(m=t.match(/(?<!\p{L})do\s+(\d{1,2})\.?(?!\d)/iu)))return +m[1];
 return null;
}
const CORRECTION=/mégis|inkább|bocs|bocsánat|elnézést|doch|eigentlich|entschuldigung|actually|sorry|rather|raje|pravzaprav|oprostite/iu;
const COUNT_WORDS={egy:1,ketten:2,kettő:2,két:2,hárman:3,három:3,négyen:4,négy:4,öten:5,öt:5,hatan:6,hat:6,heten:7,hét:7,nyolcan:8,nyolc:8,
 eins:1,zwei:2,drei:3,vier:4,fünf:5,sechs:6,sieben:7,acht:8,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,
 ena:1,dva:2,trije:3,tri:3,štirje:4,štiri:4,pet:5,šest:6,sedem:7,osem:8};
function correctedCount(text){
 if(!CORRECTION.test(text))return null;
 const d=String(text).match(/(?<!\d)(\d{1,2})(?!\d)/);if(d)return +d[1];
 for(const w of String(text).toLowerCase().split(/[^\p{L}]+/u))if(COUNT_WORDS[w])return COUNT_WORDS[w];
 return null;
}
const LANG_REQUEST=[[/(?:auf|in)\s+deutsch|deutsch\s+bitte|németül|in\s+german|v\s+nemščini/iu,'de'],[/in\s+english|english\s+please|angolul|auf\s+englisch|v\s+angleščini/iu,'en'],
 [/magyarul|in\s+hungarian|auf\s+ungarisch|v\s+madžarščini/iu,'hu'],[/v\s+slovenščini|slovensko|in\s+slovenian|auf\s+slowenisch|szlovénül/iu,'si']];
// Explicit in-memory conversation, no cross-session or browser storage. Each
// new turn invalidates external evidence; facts never imply verified capacity.
export function createChatInquirySession({language='auto',clock=()=>new Date()}={}){
 const mode=value=>value==='sl'?'si':['auto','hu','de','en','si'].includes(value)?value:'auto';
 let languageMode=mode(language);
 language=languageMode==='auto'?'hu':languageMode;
 let facts={},early={},bookingContext=false,turns=0,lastDecision=null,lastTurn=null,pendingArrival=null;
 return Object.freeze({
  get language(){return language;},
  get languageMode(){return languageMode;},
  setLanguage(value){languageMode=mode(value);if(languageMode!=='auto')language=languageMode;},
  reset(){facts={};early={};bookingContext=false;turns=0;lastDecision=null;lastTurn=null;pendingArrival=null;language=languageMode==='auto'?'hu':languageMode;},
  reply(message,{language:nextLanguage}={}){
   if(typeof message!=='string'||message.length>1000||++turns>100)throw Error('CHAT_INPUT_LIMIT');
   // Owner's calls 2026-11-27/28: „május 15-étől 20-áig”, „1-jétől”, „3-ától” = „15-től 20-ig” (chat and phone alike).
   message=message.replace(/(?<![\d.])(\d{1,2})\s*-\s*(?:j?[eé]|j?[aá])(t[óőo]l|ig)(?!\p{L})/giu,(m,d,suf)=>d+'-'+suf);
   // An explicit request for another language switches at once (auto mode only).
   if(languageMode==='auto'){const req=LANG_REQUEST.find(([re])=>re.test(message));if(req)language=req[1],languageMode='auto';}
   if(message.trim()){const now0=clock();let probe0=normalizeInquiryInput({sourceChannel:'web_form',rawText:message,now:now0}).normalized;
    // Owner's call 2026-11-27: „2027” was heard as „2021” and the past stay was accepted; then „2027, nem 2021” changed
    // nothing. A stay in the past drops its year (the nearest future date is taken and said back, so it can be
    // corrected); a year alone corrects the year of the stay already given.
    const today=now0.toISOString().slice(0,10);
    // Owner 2026-11-27: guests book for this year or next, never two years ahead – an earlier year, or a date of this
    // year already past, means the next such date.
    if(probe0.dates?.arrival&&probe0.dates.arrival<today&&/(?<!\d)20\d\d(?!\d)/.test(message)){
     message=message.replace(/(?<!\d)20\d\d\.?(?!\d)/g,' ');probe0=normalizeInquiryInput({sourceChannel:'web_form',rawText:message,now:now0}).normalized;
    }else if(!probe0.dates){
     const cur=facts.dates||early.dates,years=[...message.matchAll(/(?<!\d)(20\d\d)(?!\d)/g)].map(m=>+m[1]).filter(y=>String(y)>=today.slice(0,4));
     if(cur?.arrival&&cur?.departure&&years.length&&String(years[0])!==cur.arrival.slice(0,4)){
      const shift=years[0]-Number(cur.arrival.slice(0,4)),move=d=>(Number(d.slice(0,4))+shift)+d.slice(4);
      message=message+' '+move(cur.arrival)+' – '+move(cur.departure);probe0=normalizeInquiryInput({sourceChannel:'web_form',rawText:message,now:now0}).normalized;
     }
    }
    if(!probe0.dates){
     const end=pendingArrival?endDayOnly(message):null;
     if(pendingArrival&&end){
      const a=pendingArrival,depMonth=end>a.day?a.month:(a.month+1)%12,depYear=end>a.day?a.year:(a.month===11?a.year+1:a.year);
      message=message+' '+iso(a.year,a.month,a.day)+' – '+iso(depYear,depMonth,end);pendingArrival=null;
     }else{const arr=arrivalOnly(message,now0);if(arr)pendingArrival=arr;}
    }else pendingArrival=null;
    // „Bocs, mégis négyen” after a party size: the corrected number of adults (children are kept as given).
    const n=correctedCount(message);
    if(n&&Number.isInteger(facts.adults)&&!Number.isInteger(probe0.adults)&&!probe0.dates)message=message+' '+n+' felnőtt';
   }
   if(nextLanguage!==undefined){languageMode=mode(nextLanguage);if(languageMode!=='auto')language=languageMode;}
   if(languageMode==='auto'){const detected=languageFromText(message,{conservative:turns>1});if(detected!=='unknown')language=detected;}
   const now=clock(),faq=chatbotReply({message,language});
   // A stay request usually starts with dates and the party, not with "is there a free place?" (owner demo check
   // 2026-11-11): stay dates together with a party size also open the booking conversation; FAQ questions do not.
   if(faq.intent==='availability')bookingContext=true;
   else if(!bookingContext){
    const probe=normalizeInquiryInput({sourceChannel:'web_form',rawText:message,now:clock()}).normalized;
    const party=Number.isInteger(probe.adults)||Number.isInteger(probe.guests),stay=probe.dates||hasPotentialStayDate(message);
    const info=['hotTub','fishing','deposit','pet'].includes(faq.intent);
    // Dates AND a party size: a date alone ("szeretnénk foglalni") stays the booking FAQ answer, as before.
    // Owner iPhone test 2026-11-14: a stay request with a side question ("… május 22-25, három felnőtt. Hoznának egy
    // kutyát.") opens the booking too; the central reply answers the side question as well.
    if(stay&&(party||info&&probe.cabin&&!probe.cabin.startsWith('?')))bookingContext=true;
   }
   if(!bookingContext){
    // An informational first turn may already name the cabin, dates or party ("zanima nas družinska hiška poleti"):
    // keep them for the booking conversation that follows, so they are not asked again (sweep 2026-11-12).
    // Held aside (not an active inquiry, the snapshot stays empty) until the booking conversation opens.
    const seen=normalizeInquiryInput({sourceChannel:'web_form',rawText:message,now}).normalized;
    if(seen.cabin&&!seen.cabin.startsWith('?'))early.cabin=seen.cabin;
    if(seen.dates)early.dates=structuredClone(seen.dates); // yearless = nearest future (owner rule 2026-11-14)
    for(const key of ['guests','adults','children'])if(Number.isInteger(seen[key]))early[key]=seen[key];
    // Chat test 2026-11-16: a stay given in pieces ("foglalnék" → "Deluxe" → "június 1-4" → "négyen") opens the booking
    // once the dates and a cabin or party size are known, instead of answering each piece as a separate question.
    const party=Number.isInteger(early.adults)||Number.isInteger(early.guests);
    if(!(early.dates&&(party||early.cabin)&&(faq.intent==='unknown'||faq.intent==='booking'||faq.intent==='cabins'||seen.dates||Number.isInteger(seen.adults)||Number.isInteger(seen.guests))))
     return {response:faq,text:faq.reply,operatorReviewText:renderChatbotIntent(faq.intent,'hu'),decision:null,noAssist:FIXED_FACT_INTENTS.has(faq.intent)};
    bookingContext=true;
   }

   // Language test 2026-11-25 (#9 7162176483): in an active stay, a thank-you / "that's all", a request for a person,
   // or taking back the hot tub wish got the whole booking summary (or the tub price) again. A short, natural reply
   // instead; no fact changes, no model call (noAssist). A message that carries stay facts is never caught here.
   if(message.trim()&&(facts.dates||facts.cabin||Number.isInteger(facts.adults))){
    const p=normalizeInquiryInput({sourceChannel:'web_form',rawText:message,now}).normalized;
    const carriesFacts=p.dates||Number.isInteger(p.adults)||Number.isInteger(p.guests)||Number.isInteger(p.children)||(p.cabin&&!p.cabin.startsWith('?'))||(typeof p.phone==='string'&&p.phone.trim());
    const kind=carriesFacts?null:shortTurnKind(message);
    // A question the rules do not know ("Is there a helipad?", regular-guest discount) is a question, not a stay
    // update: the rule answer stays, and the page may ask the fact-bound model.
    if(!carriesFacts&&!kind&&faq.intent==='unknown'&&/\?\s*$/.test(message.trim())&&!STAY_QUESTION.test(message)){lastDecision=null;return {response:faq,text:faq.reply,operatorReviewText:renderChatbotIntent(faq.intent,'hu'),decision:null,noAssist:FIXED_FACT_INTENTS.has(faq.intent)};}
    if(kind){lastDecision=null;const t=SHORT_REPLY[kind][language]||SHORT_REPLY[kind].hu;return {response:{...faq,reply:t},text:t,operatorReviewText:SHORT_REPLY[kind].hu,decision:null,noAssist:true};}
   }
   // Informational detours do not replace the active stay or its missing facts.
   let bookingUpdate=['booking','cabins','checkin'].includes(faq.intent)?normalizeInquiryInput({sourceChannel:'web_form',rawText:message,now}).normalized:null;
   // An informational question that also brings a phone number or full stay dates ("Telefonszámom … Lehet kutyát
   // hozni?") updates the stay too; the central reply then answers the question as well (sweep 2026-11-12).
   if(!bookingUpdate&&['hotTub','fishing','deposit','pet'].includes(faq.intent)){
    const info=normalizeInquiryInput({sourceChannel:'web_form',rawText:message,now}).normalized;
    // Owner iPhone test 2026-11-14: "Egy családi faház érdekelne, három felnőtt, május 22-25. Hoznának egy kutyát."
    // got only the pet answer. A date without year still marks a stay when party size or a cabin comes with it.
    const party=Number.isInteger(info.adults)||Number.isInteger(info.guests),cabin=typeof info.cabin==='string'&&info.cabin&&!info.cabin.startsWith('?');
    // Chat test 2026-11-24 (DE): in a stay already being arranged, naming the cabin ("Ein Familienhaus bitte, und wir
    // hätten gern auch einen Badezuber") is a booking update, not a hot tub question.
    if((typeof info.phone==='string'&&info.phone.trim())||(info.dates&&!info.dates.inferred_year)||(info.dates&&(party||cabin))||(party&&cabin)||(cabin&&bookingContext&&facts.dates&&!/\?\s*$/.test(message.trim())))bookingUpdate=info; // a question about the cabin's tub stays a question
   }
   const unparsedStayDate=!bookingUpdate?.dates&&hasPotentialStayDate(message);
   const uncertainParty=ambiguousPartyFieldsFromText(message);
   // An isolated number has no reliable category once the prior party is
   // complete. Preserve an outstanding child-age or unit-count question.
   const bareNumber=/^\s*\d{1,2}\s*[.!?]?\s*$/u.test(message);
   const childAgesPending=Number(facts.children)>Number(facts.child_ages?.length||0);
   if(bareNumber&&facts.dates&&Number.isInteger(facts.adults)&&Number.isInteger(facts.children)&&!childAgesPending&&!facts.units_open_request)
    uncertainParty.push('adults','children','guests');
   const hasBookingUpdate=bookingUpdate&&(unparsedStayDate||uncertainParty.length>0||['dates','adults','children','guests','units_requested','phone'].some(key=>bookingUpdate[key]!=null&&bookingUpdate[key]!=='')||(bookingUpdate.cabin&&!bookingUpdate.cabin.startsWith('?')));
   if(['welcome','hotTub','deposit','fishing','pet','booking','cabins','checkin'].includes(faq.intent)&&!hasBookingUpdate){
    // A standalone number after an informational answer has no clear referent.
    lastDecision=null;
    return {response:faq,text:faq.reply,operatorReviewText:renderChatbotIntent(faq.intent,'hu'),decision:null,noAssist:FIXED_FACT_INTENTS.has(faq.intent)};
   }
   const n=bookingUpdate||normalizeInquiryInput({sourceChannel:'web_form',rawText:message,now}).normalized;
   const next={...early,...facts};early={};
   // A newly supplied date that cannot form a validated range must not leave
   // the earlier stay silently active. Ask for the complete dates again.
   if(!n.dates&&hasPotentialStayDate(message))next.dates=null;
   for(const key of ['dates','phone','units_requested'])if(n[key]!==null&&n[key]!==undefined&&n[key]!=='')next[key]=structuredClone(n[key]);
   // "inkább június 26-tól 28-ig" (no year) while the stay is already in that year: a date change, not an unknown year.
   if(next.dates?.inferred_year&&n.dates&&/^\d{4}-/.test(facts.dates?.arrival||'')&&next.dates.arrival.slice(0,4)===facts.dates.arrival.slice(0,4))next.dates={...next.dates,inferred_year:false};
   const priorParty={},incomingParty={};
   for(const key of ['guests','adults','children']){
    if(facts[key]!==null&&facts[key]!==undefined)priorParty[key]=String(facts[key]);
    // An inferred zero from an adult-only follow-up must not erase children
    // already established earlier in the same booking conversation.
    if(n[key]!==null&&n[key]!==undefined&&!(key==='children'&&n[key]===0&&facts.children>0&&!/gyermek|gyerek|gyermekek|gyerekek|child|kid|kind|otrok/iu.test(message)))incomingParty[key]=String(n[key]);
   }
   if(facts.child_ages?.length)priorParty.child_ages=facts.child_ages.join(',');
   let ages=n.child_ages||[];
   // A bare integer is an age only when exactly one age is the only pending
   // field and no contradictory facts require a human review.
   const onlyAgeMissing=lastDecision?.missing.length===1&&lastDecision.missing[0]==='child_ages'&&lastDecision.contradictions.length===0;
   const ageMatch=message.match(/^\s*(\d{1,2})\s*[.!?]?\s*$/u);
   if(!ages.length&&onlyAgeMissing&&Number(facts.children)-Number(facts.child_ages?.length||0)===1&&ageMatch&&Number(ageMatch[1])<=17)
    ages=[Number(ageMatch[1])];
   if(!ages.length&&Number(facts.children)>Number(facts.child_ages?.length||0))
    ages=childAgesFromText('gyermek '+message);
   if(ages.length)incomingParty.child_ages=ages.join(',');
   const merged=mergeBookingFacts(priorParty,incomingParty,message);
   for(const key of ['guests','adults','children'])if(merged[key]!==undefined)next[key]=Number(merged[key]);
   if(merged.child_ages!==undefined)next.child_ages=String(merged.child_ages).split(',').map(x=>x.trim()).filter(Boolean).map(Number);
   if(uncertainParty.length)next.guests=null;
   if(uncertainParty.includes('adults')||uncertainParty.includes('guests'))next.adults=null;
   if(uncertainParty.includes('children')){next.children=null;next.child_ages=[];}
   if(n.cabin&&!n.cabin.startsWith('?'))next.cabin=n.cabin;
   if(n.children===0&&!ages.length&&next.children===0)next.child_ages=[];
   if(n.split_request?.isSplit)next.split_request=structuredClone(n.split_request);
   else if(n.cabin&&!n.cabin.startsWith('?')&&n.cabin!==facts.cabin)delete next.split_request;
   if(n.units_open_request)next.units_open_request=true;
   else if(n.units_requested)next.units_open_request=false;
   next.language=language;next.originalText=message;
   facts=next;
   const result=buildChatInquiryReply({message,language,now,facts});
   lastDecision=result.decision;lastTurn={message,language,now,facts:structuredClone(facts),turn:turns};
   // A complete request for one named cabin type may be checked against Previo (authenticated operator only).
   const capacityInput=result.decision.readyForCapacityCheck&&result.decision.capacity?.input?.cabin?structuredClone(result.decision.capacity.input):null;
   return {...result,response:{...faq,reply:result.text},extracted:structuredClone(result.decision.facts),capacityInput};
  },
  // The same reply re-rendered with a verified Previo read (existing central decision path, as in the e-mail draft).
  // Only for the latest turn; a later message makes an older answer stale.
  withCapacity(capacity,{turn}={}){
   if(!lastTurn||turn!==lastTurn.turn||turns!==lastTurn.turn||!capacity||typeof capacity!=='object')return null;
   const checked=Date.parse(capacity.available_options?.[0]?.checkedAt||capacity.unavailable_options?.[0]?.checkedAt||'')||0;
   const now=new Date(Math.max(+new Date(lastTurn.now),Date.now(),checked));
   // Only the requested type counts (as in the e-mail draft): another free type must never read as "this type is free".
   const result=buildChatInquiryReply({message:lastTurn.message,language:lastTurn.language,now,facts:lastTurn.facts,capacity,fallback:false});
   return ['AVAILABLE','UNAVAILABLE'].includes(result.decision.capacity?.status)?result:null;
  },
  get turn(){return turns;},
  snapshot(){return structuredClone(facts);}
 });
}
