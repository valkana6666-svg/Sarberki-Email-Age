import {createCaseState,updateCaseState} from './case-state.mjs';
import {childAgesFromText} from './sarberki-core.mjs';
import {stageFacts} from './booking-filter.mjs';
const copy=v=>JSON.parse(JSON.stringify(v));
const list=v=>String(v||'').match(/<[^>]+>/g)||[];
const sender=v=>String(v||'').trim().toLowerCase();
const present=v=>v!==''&&v!=null;
export function resolveBookingCase(cases,envelope,values={}){
 const from=sender(envelope.sender),refs=[envelope.in_reply_to,...(Array.isArray(envelope.references)?envelope.references:list(envelope.references))].filter(Boolean);
 const owned=cases.filter(c=>c.sender===from&&from);
 const direct=owned.filter(c=>envelope.case_id===c.id||(envelope.thread_id&&c.messages.some(m=>m.thread_id===envelope.thread_id))||c.messages.some(m=>m.rfc_message_id&&refs.includes(m.rfc_message_id)));
 if(direct.length&&/(?:\b(?:új|másik|külön)\s+(?:önálló\s+)?foglalá|\b(?:new|separate|another)\s+(?:booking|inquiry)|\b(?:neue|separate)\s+(?:Buchung|Anfrage)|\b(?:nova|ločena)\s+rezervacija)/iu.test(envelope.text||''))return {status:'ambiguous',candidates:direct.map(c=>c.id),evidence:'explicit_independent_request'};
 if(direct.length===1)return {status:'linked',caseId:direct[0].id,evidence:'thread_or_reference'};
 if(direct.length>1)return {status:'ambiguous',candidates:direct.map(c=>c.id),evidence:'conflicting_references'};
 const related=owned.filter(c=>(!values.arrival||c.state.values.arrival===values.arrival)&&(!values.departure||c.state.values.departure===values.departure));
 if(related.length)return {status:'ambiguous',candidates:related.map(c=>c.id),evidence:'sender_alone_not_sufficient'};
 return {status:'new',evidence:'no_proven_link'};
}
export function mergeBookingFacts(previous,incoming,text=''){
 const next={...previous};
 for(const [key,value]of Object.entries(incoming))if(present(value))next[key]=value;
 // Partial age answers fill outstanding positions; a complete answer replaces the list.
 if(present(incoming.children)&&String(incoming.children)!==String(previous.children)&&!present(incoming.child_ages))next.child_ages='';
 if(present(incoming.unit)&&incoming.unit!==previous.unit&&!present(incoming.split_request_text))next.split_request_text='';
 if(present(incoming.child_ages)){
  const old=String(previous.child_ages||'').split(',').filter(x=>x.trim()!==''),added=String(incoming.child_ages).split(',').filter(x=>x.trim()!=='');
  const expected=Number(next.children);
  if(expected>added.length&&old.length&&old.length<expected&&!/javít|helyett|korrek|correction|instead/iu.test(text))next.child_ages=[...old,...added].slice(0,expected).join(', ');
 }
 if(present(incoming.adults)||present(incoming.children)){
  if(!present(incoming.guests)&&present(next.adults)&&present(next.children))next.guests=String(Number(next.adults)+Number(next.children));
 }
 if(!present(incoming.nights)&&next.arrival&&next.departure)next.nights=String((Date.parse(next.departure)-Date.parse(next.arrival))/86400000);
 return next;
}
export function createBookingCaseStore({storage=null,clock=()=>new Date().toISOString(),id=()=>globalThis.crypto.randomUUID()}={}){
 const key='sarberki-booking-cases-v2';let cases=[];
 try{const saved=JSON.parse(storage?.getItem(key)||'[]');if(Array.isArray(saved))cases=saved;}catch{}
 const persist=()=>{storage?.setItem(key,JSON.stringify(cases));};
 return {
  list:()=>copy(cases),get:caseId=>copy(cases.find(c=>c.id===caseId)||null),
  ingest(envelope,incoming,{intent='booking_request',approvedCaseId=null}={}){
   const existing=cases.find(c=>envelope.message_id&&c.messages.some(m=>m.message_id===envelope.message_id));
   if(existing)return {resolution:{status:'duplicate',caseId:existing.id},bookingCase:copy(existing)};
   let resolution=resolveBookingCase(cases,envelope,incoming);
   if(approvedCaseId){const found=cases.find(c=>c.id===approvedCaseId&&c.sender===sender(envelope.sender));if(!found)throw Error('Az ügyösszekapcsolás nem igazolható.');resolution={status:'linked',caseId:found.id,evidence:'human_approved'};}
   const target=resolution.status==='linked'?cases.find(c=>c.id===resolution.caseId):null;
   const eventAt=Date.parse(envelope.received_at||clock());
   const latestAt=target?Math.max(...target.messages.map(m=>Date.parse(m.received_at)).filter(Number.isFinite)):-Infinity;
   if(target&&Number.isFinite(eventAt)&&eventAt<latestAt){
    target.messages.push({...envelope,historical:true,received_at:envelope.received_at});target.updatedAt=clock();persist();
    return {resolution:{...resolution,status:'historical',evidence:'older_message_preserved_without_overwrite'},bookingCase:copy(target)};
   }
   if(target&&!/[\p{L}]/u.test(envelope.text||'')){incoming={...incoming};delete incoming.language;}
   if(target&&Number(target.state.values.children)>String(target.state.values.child_ages||'').split(',').filter(x=>x.trim()).length&&!incoming.child_ages){
    const ages=childAgesFromText('gyermek '+envelope.text);if(ages.length)incoming={...incoming,child_ages:ages.join(', ')};
   }
   const values=target?mergeBookingFacts(target.state.values,incoming,envelope.text):incoming;
   const c=target||{id:id(),sender:sender(envelope.sender),messages:[],drafts:[],createdAt:clock(),state:createCaseState({original:envelope.text,values,intent,now:clock()})};
   if(target)c.state=updateCaseState(c.state,{type:'facts',values});
   c.state.original=envelope.text;c.state.now=clock();
   c.state.intent=target&&['other','general_question'].includes(intent)?target.state.intent:intent;c.facts=stageFacts(values);
   c.messages.push({...envelope,received_at:envelope.received_at||clock()});c.updatedAt=clock();
   c.status=resolution.status==='ambiguous'?'link_review_required':'preparing';c.linkReview=resolution.status==='ambiguous'?resolution:null;
   if(!target)cases.push(c);persist();return {resolution,bookingCase:copy(c)};
  },
  save(caseId,state,draft=''){
   const c=cases.find(c=>c.id===caseId);if(!c)throw Error('Ismeretlen foglalási ügy.');c.state=copy(state);c.facts=stageFacts(state.values);c.updatedAt=clock();
   if(draft&&c.drafts.at(-1)?.text!==draft)c.drafts.push({text:draft,at:clock(),revision:state.revision});persist();
  }
 };
}
