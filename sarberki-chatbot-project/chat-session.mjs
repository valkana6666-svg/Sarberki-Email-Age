import {normalizeInquiryInput} from '../intake-normalize.mjs';
import {buildChatInquiryReply} from '../shared-core/inquiry-channel-adapters.mjs';
import {chatbotReply,renderChatbotIntent} from '../chatbot-v1.mjs';
import {mergeBookingFacts} from '../booking-cases.mjs';
import {childAgesFromText,languageFromText,hasPotentialStayDate,ambiguousPartyFieldsFromText} from '../sarberki-core.mjs';
// Explicit in-memory conversation, no cross-session or browser storage. Each
// new turn invalidates external evidence; facts never imply verified capacity.
export function createChatInquirySession({language='auto',clock=()=>new Date()}={}){
 const mode=value=>value==='sl'?'si':['auto','hu','de','en','si'].includes(value)?value:'auto';
 let languageMode=mode(language);
 language=languageMode==='auto'?'hu':languageMode;
 let facts={},bookingContext=false,turns=0;
 return Object.freeze({
  get language(){return language;},
  get languageMode(){return languageMode;},
  setLanguage(value){languageMode=mode(value);if(languageMode!=='auto')language=languageMode;},
  reset(){facts={};bookingContext=false;turns=0;language=languageMode==='auto'?'hu':languageMode;},
  reply(message,{language:nextLanguage}={}){
   if(typeof message!=='string'||message.length>1000||++turns>100)throw Error('CHAT_INPUT_LIMIT');
   if(nextLanguage!==undefined){languageMode=mode(nextLanguage);if(languageMode!=='auto')language=languageMode;}
   if(languageMode==='auto'){const detected=languageFromText(message,{conservative:turns>1});if(detected!=='unknown')language=detected;}
   const now=clock(),faq=chatbotReply({message,language});
   if(faq.intent==='availability')bookingContext=true;
   if(!bookingContext)return {response:faq,text:faq.reply,operatorReviewText:renderChatbotIntent(faq.intent,'hu'),decision:null};
   // Informational detours do not replace the active stay or its missing facts.
   const bookingUpdate=['booking','cabins','checkin'].includes(faq.intent)?normalizeInquiryInput({sourceChannel:'web_form',rawText:message,now}).normalized:null;
   const unparsedStayDate=!bookingUpdate?.dates&&hasPotentialStayDate(message);
   const uncertainParty=ambiguousPartyFieldsFromText(message);
   const hasBookingUpdate=bookingUpdate&&(unparsedStayDate||uncertainParty.length>0||['dates','adults','children','guests','units_requested'].some(key=>bookingUpdate[key]!=null)||(bookingUpdate.cabin&&!bookingUpdate.cabin.startsWith('?')));
   if(['welcome','hotTub','deposit','fishing','booking','cabins','checkin'].includes(faq.intent)&&!hasBookingUpdate)
    return {response:faq,text:faq.reply,operatorReviewText:renderChatbotIntent(faq.intent,'hu'),decision:null};
   const n=bookingUpdate||normalizeInquiryInput({sourceChannel:'web_form',rawText:message,now}).normalized;
   const next={...facts};
   // A newly supplied date that cannot form a validated range must not leave
   // the earlier stay silently active. Ask for the complete dates again.
   if(!n.dates&&hasPotentialStayDate(message))next.dates=null;
   for(const key of ['dates','phone','units_requested'])if(n[key]!==null&&n[key]!==undefined&&n[key]!=='')next[key]=structuredClone(n[key]);
   const priorParty={},incomingParty={};
   for(const key of ['guests','adults','children']){
    if(facts[key]!==null&&facts[key]!==undefined)priorParty[key]=String(facts[key]);
    // An inferred zero from an adult-only follow-up must not erase children
    // already established earlier in the same booking conversation.
    if(n[key]!==null&&n[key]!==undefined&&!(key==='children'&&n[key]===0&&facts.children>0&&!/gyermek|gyerek|gyermekek|gyerekek|child|kid|kind|otrok/iu.test(message)))incomingParty[key]=String(n[key]);
   }
   if(facts.child_ages?.length)priorParty.child_ages=facts.child_ages.join(',');
   let ages=n.child_ages||[];
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
   return {...result,response:{...faq,reply:result.text},extracted:structuredClone(result.decision.facts)};
  },
  snapshot(){return structuredClone(facts);}
 });
}
