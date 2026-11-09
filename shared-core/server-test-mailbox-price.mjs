// Server-only (excluded from dist by the server- prefix). Owner decision 2026-11-04: one operator may save,
// price, approve and send a test-mailbox reply. The SERVER computes the price-list price for the stored case
// and the cabin the operator chose after checking availability by hand, replaces the engine's generic price
// sentence in the latest draft and attests the exact new text for sc_tm_price_redraft. The browser sends
// no text. No price rule, tariff, availability or booking is changed.
import {previoPriceLine} from './server-previo-price-check.mjs';
import {createHash,createHmac} from 'node:crypto';
import {fetchPublicPriceReference} from '../price-source/public-price-fallback.mjs';
import {PRICE_LINE,priceSentence,priceExplanation,pricedCabinNote} from './price-insert-sentence.mjs';
import {replyQuestions} from '../sarberki-core.mjs';
import {capacityDecision} from './server-previo-rest-read.mjs';
import {CAPACITY_PENDING_LINE,CAPACITY_AVAILABLE_LINE} from './inquiry-channel-adapters.mjs';

// The engine's cabin-type questions (with/without the 2-person cabin) and the "choose an offered type" line.
const OFFERED_TYPE_QUESTION=Object.freeze({hu:'Kérjük, válaszoljon erre az e-mailre, és írja meg, melyik felajánlott faháztípust választja.',
 de:'Bitte antworten Sie auf diese E-Mail und teilen Sie uns mit, welchen der angebotenen Haustypen Sie wählen.',
 en:'Please reply to this email and tell us which of the offered cabin types you would like to choose.',
 si:'Prosimo, odgovorite na to e-pošto in nam sporočite, katero od ponujenih vrst hišk izberete.'});
function cabinQuestions(lang){return [...new Set([replyQuestions(lang,{needCabin:true,guests:2})[0],replyQuestions(lang,{needCabin:true,guests:4})[0],OFFERED_TYPE_QUESTION[lang]].filter(Boolean))];}
function replaceCabinQuestion(text,lang,note){let done=false;for(const q of cabinQuestions(lang))if(!done&&text.includes(q)){text=text.replace(q,note);done=true;}return text;}

export const PRICE_SCOPE='test-mailbox-price-v1';
const fail=code=>{const error=Error(code);error.code=code;throw error;};
const sha=text=>createHash('sha256').update(String(text),'utf8').digest('hex');

// The case's own facts only; anything missing or ambiguous refuses (no guessing a party or an age).
export function quoteInputFromCase(values,cabin){
 const ages=String(values?.child_ages||'').split(',').filter(Boolean).map(Number);
 const adults=Number(values?.adults),children=Number(values?.children||0);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(values?.arrival||'')||!/^\d{4}-\d{2}-\d{2}$/.test(values?.departure||'')||!Number.isInteger(adults)||adults<1||
  !Number.isInteger(children)||children!==ages.length||ages.some(a=>!Number.isInteger(a)))fail('PRICE_FACTS_MISSING');
 return {arrival:values.arrival,departure:values.departure,cabin,adults,children:ages};
}

// The engine writes the generic price sentence only when the guest's text asked about price. A complete case
// (e.g. after a follow-up without a price question, owner test 2026-11-06) carries the internal status line
// "capacity not yet verified" instead: the price sentence takes its place (it also says the final price follows
// the availability check). Neither present -> refused, as before.
// After pricing the status line is gone in both cases, so a second pricing is refused (no double price).
function placePrice(text,lang,sentence){
 if(typeof text!=='string')return null;
 const generic=PRICE_LINE[lang],pending=CAPACITY_PENDING_LINE[lang];
 const lines=text.split('\n'),at=lines.findIndex(l=>l.startsWith(pending));
 if(text.includes(generic)){
  if(at<0)return text.replace(generic,sentence);
  lines.splice(at,1);return lines.join('\n').replace(/\n{3,}/g,'\n\n').replace(generic,sentence);
 }
 if(at>=0){lines[at]=sentence;return lines.join('\n');}
 // Level 1: the Previo-verified free line stays; the price follows it (once).
 const free=CAPACITY_AVAILABLE_LINE[lang],fi=lines.findIndex(l=>l.startsWith(free));
 if(fi<0||text.includes(sentence.split(':')[0]+':'))return null;
 lines.splice(fi+1,0,'',sentence);return lines.join('\n');
}
export function pricedDraft({latest,quote,language}){
 const lang=PRICE_LINE[language]?language:'hu';
 const placed=placePrice(latest?.text,lang,priceSentence(quote,lang));
 if(placed===null)fail('PRICE_LINE_MISSING');
 const text=replaceCabinQuestion(placed,lang,pricedCabinNote(quote,lang));
 const reviewPlaced=placePrice(latest?.operatorReviewText,'hu',priceSentence(quote,'hu'));
 const review=reviewPlaced!==null?replaceCabinQuestion(reviewPlaced,'hu',pricedCabinNote(quote,'hu')):String(latest?.operatorReviewText||'');
 const operatorReviewText=(review?review+'\n\n':'')+'Ár-részletezés (kezelői, a vendég nem látja):\n'+priceExplanation(quote);
 return {text,operatorReviewText};
}

export function attestPrice({key,tenantId,caseId,expectedRevision,draft,checkedAt}){
 if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))fail('SETUP_REQUIRED');
 const fields=[PRICE_SCOPE,tenantId,caseId,String(expectedRevision),sha(draft.text),sha(draft.operatorReviewText),checkedAt];
 if(fields.some(v=>typeof v!=='string'||!v||/[\r\n]/.test(v)))fail('INVALID_EVIDENCE');
 return {scope:PRICE_SCOPE,checkedAt,attestation:createHmac('sha256',Buffer.from(key,'hex')).update(fields.join('\n')).digest('hex')};
}

// Optional Previo gate (owner request 2026-11-04): capacityFn reads the free count read-only
// (server-previo-rest-read.mjs). A complete "no free unit" stops the price step BEFORE any price is computed;
// an unknown/failed read leaves today's manual Previo check (checkbox) in force. Off unless the server wires it.
export async function priceTestMailboxCase({record,cabin,availabilityConfirmed,attestationKey,transport,
 quoteFn=fetchPublicPriceReference,fxFn=null,capacityFn=null,priceCheckFn=null,clock=()=>new Date().toISOString()}={}){
 if(availabilityConfirmed!==true)fail('AVAILABILITY_NOT_CONFIRMED');
 if(typeof transport!=='function')fail('SETUP_REQUIRED');
 const values=record?.data?.state?.values||{},latest=record?.data?.drafts?.at?.(-1);
 let previo=null;
 if(typeof capacityFn==='function'){
  let read=null;
  try{read=await capacityFn({cabin,arrival:values.arrival,departure:values.departure});}catch{}
  previo={decision:capacityDecision(read,cabin,1),free:Number.isSafeInteger(read?.freeByCabin?.[cabin])?read.freeByCabin[cabin]:null,checkedAt:read?.checkedAt??null};
  if(previo.decision==='UNAVAILABLE')fail('PREVIO_NO_FREE_UNIT');
 }
 let quote;
 try{quote=quoteFn(quoteInputFromCase(values,cabin));}catch(error){if(error?.code)throw error;const e=Error('PRICE_REFUSED');e.code='PRICE_REFUSED';e.detail=String(error?.message||'').slice(0,300);throw e;}
 if(quote?.status!=='public_reference'||!Number.isSafeInteger(quote.total)||quote.cabin!==cabin)fail('PRICE_REFUSED');
 let eurConversion={status:'unavailable'};
 if(typeof fxFn==='function'){try{const fx=await fxFn();if(Number.isFinite(fx?.rate)&&fx.rate>0&&/^\d{4}-\d{2}-\d{2}$/.test(fx.date||''))
  eurConversion={status:'available',rateHufPerEur:fx.rate,rateDate:fx.date,source:fx.source,totalEur:Math.round(quote.total/fx.rate*100)/100};}catch{}}
 const full={...quote,eurConversion};
 const language=/^(hu|de|en|si)$/.test(values.language||'')?values.language:'hu';
 const draft=pricedDraft({latest,quote:full,language});
 // The price-list explanation says the free unit was not checked; with a verified Previo read, say what was checked.
 if(previo?.decision==='AVAILABLE')draft.operatorReviewText=draft.operatorReviewText.replace('Szabad hely: a rendszer NEM ellenőrizte.','Szabad hely: Previo-teszt (csak olvasó), lásd lent.');
 if(previo)draft.operatorReviewText+='\n'+(previo.decision==='AVAILABLE'?`Previo (csak olvasó): ${previo.free} szabad egység, ellenőrizve ${previo.checkedAt}. Pillanatfelvétel, nem foglalás.`
  :'Previo (csak olvasó): az ellenőrzés nem adott biztos eredményt – a kézi Previo-ellenőrzés érvényes.');
 // Operator-only cross-check against the Previo price (read-only; the guest text is unchanged).
 if(typeof priceCheckFn==='function'){let check=null;try{check=await priceCheckFn({values,cabin});}catch{}draft.operatorReviewText+='\n'+previoPriceLine(check,quote.total);}
 const proof=attestPrice({key:attestationKey,tenantId:record.tenantId,caseId:record.caseId,expectedRevision:record.revision,draft,checkedAt:clock()});
 const saved=await transport('/rest/v1/rpc/sc_tm_price_redraft',{method:'POST',body:{p_tenant:record.tenantId,p_case:record.caseId,p_expected:record.revision,p_draft:draft,p_proof:proof}});
 return {saved,quote:full,previo};
}
