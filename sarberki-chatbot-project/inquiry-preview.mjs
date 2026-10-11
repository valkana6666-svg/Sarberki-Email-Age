// Chatbot inquiry extraction reuses the existing central normalization rules.
// This module never checks capacity, prices, PMS data, or sends messages.
import {normalizeInquiryInput} from '../intake-normalize.mjs';
import {chatbotReply} from '../chatbot-v1.mjs';

export function chatbotInquiryPreview({message='',language='hu',now=new Date()}={}){
 const response=chatbotReply({message,language});
 const raw=String(message||'').trim();
 if(!raw)return {response,extracted:null,missing:[],readyForCapacityCheck:false};
 const envelope=normalizeInquiryInput({sourceChannel:'web_form',rawText:raw,now});
 const n=envelope.normalized;
 const dates=n.dates||null;
 const adults=Number.isInteger(n.adults)&&n.adults>=0?n.adults:null;
 const children=Number.isInteger(n.children)&&n.children>=0?n.children:null;
 const missing=[];
 if(response.intent==='availability'){
  if(!dates?.arrival||!dates?.departure)missing.push('dates');
  if(adults===null||children===null)missing.push('adult_child_breakdown');
  if(children>0&&(!Array.isArray(n.child_ages)||n.child_ages.length!==children))missing.push('child_ages');
 }
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
  readyForCapacityCheck:response.intent==='availability'&&missing.length===0,
  capacityChecked:false,
  bookingCreated:false
 };
}
