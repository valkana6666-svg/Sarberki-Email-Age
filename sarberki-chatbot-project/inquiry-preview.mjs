// Chatbot inquiry extraction reuses the existing central normalization rules.
// This module never checks capacity, prices, PMS data, or sends messages.
import {buildChatInquiryReply} from '../shared-core/inquiry-channel-adapters.mjs';
import {chatbotReply} from '../chatbot-v1.mjs';

export function chatbotInquiryPreview({message='',language='hu',now=new Date()}={}){
 const response=chatbotReply({message,language});
 const raw=String(message||'').trim();
 if(!raw)return {response,extracted:null,missing:[],readyForCapacityCheck:false};
 const {decision,text}=buildChatInquiryReply({message:raw,language,now});
 const n=decision.facts;
 const dates=n.dates||null;
 const adults=n.adults,children=n.children;
 const missing=response.intent==='availability'?[...decision.missing]:[];
 if(response.intent==='availability')response.reply=text;
 return {
  response,
  extracted:{
   dates:dates?{arrival:dates.arrival,departure:dates.departure,inferredYear:dates.inferred_year}:null,
   adults,children,childAges:n.child_ages||[],cabin:n.cabin||null,
   unitsRequested:n.units_requested||null,
   phoneProvided:Boolean(n.phone),
   splitRequest:n.split_request||null
  },
  missing,
  readyForCapacityCheck:response.intent==='availability'&&decision.readyForCapacityCheck,
  decision,
  capacityChecked:false,
  bookingCreated:false
 };
}
