// Server-only (excluded from dist by the server- prefix). Owner decision 2026-11-04: one operator may save,
// price, approve and send a test-mailbox reply. The SERVER computes the price-list price for the stored case
// and the cabin the operator chose after checking availability by hand, replaces the engine's generic price
// sentence in the latest draft and attests the exact new text for sc_tm_price_redraft. The browser sends
// no text. No price rule, tariff, availability or booking is changed.
import {createHash,createHmac} from 'node:crypto';
import {fetchPublicPriceReference} from '../price-source/public-price-fallback.mjs';
import {PRICE_LINE,priceSentence,priceExplanation,pricedCabinNote} from './price-insert-sentence.mjs';
import {replyQuestions} from '../sarberki-core.mjs';

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

export function pricedDraft({latest,quote,language}){
 const lang=PRICE_LINE[language]?language:'hu',generic=PRICE_LINE[lang];
 if(typeof latest?.text!=='string'||!latest.text.includes(generic))fail('PRICE_LINE_MISSING');
 const text=replaceCabinQuestion(latest.text.replace(generic,priceSentence(quote,lang)),lang,pricedCabinNote(quote,lang));
 const review=typeof latest.operatorReviewText==='string'&&latest.operatorReviewText.includes(PRICE_LINE.hu)?
  replaceCabinQuestion(latest.operatorReviewText.replace(PRICE_LINE.hu,priceSentence(quote,'hu')),'hu',pricedCabinNote(quote,'hu')):String(latest.operatorReviewText||'');
 const operatorReviewText=(review?review+'\n\n':'')+'Ár-részletezés (kezelői, a vendég nem látja):\n'+priceExplanation(quote);
 return {text,operatorReviewText};
}

export function attestPrice({key,tenantId,caseId,expectedRevision,draft,checkedAt}){
 if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))fail('SETUP_REQUIRED');
 const fields=[PRICE_SCOPE,tenantId,caseId,String(expectedRevision),sha(draft.text),sha(draft.operatorReviewText),checkedAt];
 if(fields.some(v=>typeof v!=='string'||!v||/[\r\n]/.test(v)))fail('INVALID_EVIDENCE');
 return {scope:PRICE_SCOPE,checkedAt,attestation:createHmac('sha256',Buffer.from(key,'hex')).update(fields.join('\n')).digest('hex')};
}

export async function priceTestMailboxCase({record,cabin,availabilityConfirmed,attestationKey,transport,
 quoteFn=fetchPublicPriceReference,fxFn=null,clock=()=>new Date().toISOString()}={}){
 if(availabilityConfirmed!==true)fail('AVAILABILITY_NOT_CONFIRMED');
 if(typeof transport!=='function')fail('SETUP_REQUIRED');
 const values=record?.data?.state?.values||{},latest=record?.data?.drafts?.at?.(-1);
 let quote;
 try{quote=quoteFn(quoteInputFromCase(values,cabin));}catch(error){if(error?.code)throw error;const e=Error('PRICE_REFUSED');e.code='PRICE_REFUSED';e.detail=String(error?.message||'').slice(0,300);throw e;}
 if(quote?.status!=='public_reference'||!Number.isSafeInteger(quote.total)||quote.cabin!==cabin)fail('PRICE_REFUSED');
 let eurConversion={status:'unavailable'};
 if(typeof fxFn==='function'){try{const fx=await fxFn();if(Number.isFinite(fx?.rate)&&fx.rate>0&&/^\d{4}-\d{2}-\d{2}$/.test(fx.date||''))
  eurConversion={status:'available',rateHufPerEur:fx.rate,rateDate:fx.date,source:fx.source,totalEur:Math.round(quote.total/fx.rate*100)/100};}catch{}}
 const full={...quote,eurConversion};
 const language=/^(hu|de|en|si)$/.test(values.language||'')?values.language:'hu';
 const draft=pricedDraft({latest,quote:full,language});
 const proof=attestPrice({key:attestationKey,tenantId:record.tenantId,caseId:record.caseId,expectedRevision:record.revision,draft,checkedAt:clock()});
 const saved=await transport('/rest/v1/rpc/sc_tm_price_redraft',{method:'POST',body:{p_tenant:record.tenantId,p_case:record.caseId,p_expected:record.revision,p_draft:draft,p_proof:proof}});
 return {saved,quote:full};
}
