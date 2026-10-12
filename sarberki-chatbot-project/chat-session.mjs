import {normalizeInquiryInput} from '../intake-normalize.mjs';
import {buildChatInquiryReply} from '../shared-core/inquiry-channel-adapters.mjs';
import {chatbotReply,renderChatbotIntent} from '../chatbot-v1.mjs';
import {mergeBookingFacts} from '../booking-cases.mjs';
import {childAgesFromText} from '../sarberki-core.mjs';
// Explicit in-memory conversation, no cross-session or browser storage. Each
// new turn invalidates external evidence; facts never imply verified capacity.
export function createChatInquirySession({language='hu',clock=()=>new Date()}={}){
 let facts={},bookingContext=false,turns=0;
 return Object.freeze({
  reset(){facts={};bookingContext=false;turns=0;},
  reply(message,{language:nextLanguage=language}={}){
   if(typeof message!=='string'||message.length>1000||++turns>100)throw Error('CHAT_INPUT_LIMIT');
   language=nextLanguage;const now=clock(),faq=chatbotReply({message,language});
   if(faq.intent==='availability')bookingContext=true;
   if(!bookingContext)return {response:faq,text:faq.reply,operatorReviewText:renderChatbotIntent(faq.intent,'hu'),decision:null};
   // Informational detours do not replace the active stay or its missing facts.
   const bookingUpdate=faq.intent==='booking'?normalizeInquiryInput({sourceChannel:'web_form',rawText:message,now}).normalized:null;
   const hasBookingUpdate=bookingUpdate&&['dates','adults','children','guests','units_requested'].some(key=>bookingUpdate[key]!=null);
   if(['welcome','hotTub','deposit','fishing','booking','cabins'].includes(faq.intent)&&!hasBookingUpdate)
    return {response:faq,text:faq.reply,operatorReviewText:renderChatbotIntent(faq.intent,'hu'),decision:null};
   const n=bookingUpdate||normalizeInquiryInput({sourceChannel:'web_form',rawText:message,now}).normalized;
   const next={...facts};
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
   if(n.cabin&&!n.cabin.startsWith('?'))next.cabin=n.cabin;
   if(n.children===0&&!ages.length&&next.children===0)next.child_ages=[];
   if(n.split_request?.isSplit)next.split_request=structuredClone(n.split_request);
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
