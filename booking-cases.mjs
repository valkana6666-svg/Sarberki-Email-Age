import {createCaseState,updateCaseState} from './case-state.mjs';
import {childAgesFromText,languageFromText,ambiguousPartyFieldsFromText} from './sarberki-core.mjs';
import {stageFacts} from './booking-filter.mjs';
import {followupDateUpdate} from './booking-followup.mjs';
import {tubServiceMessage,tubServiceProjection,trustedTubContext,assessTubEligibility} from './shared-core/tub-request.mjs';
const copy=v=>JSON.parse(JSON.stringify(v));
const list=v=>String(v||'').match(/<[^>]+>/g)||[];
const sender=v=>String(v||'').trim().toLowerCase();
const present=v=>v!==''&&v!=null;
// Provider message/thread identifiers are scoped to the mailbox that supplied them.
// Two legacy envelopes with no mailbox may still match; mixed known/unknown must not.
const sameMailbox=(a,b)=>{
 const left=String(a?.mailbox_id||'').trim(),right=String(b?.mailbox_id||'').trim();
 return left===right;
};
function resolveTubCase(cases,envelope,request){
 const from=sender(envelope.sender),owned=cases.filter(c=>c.sender===from&&from&&c.caseKind!=='service_link_review');
 const uncertain=(evidence,candidates=owned)=>({status:'ambiguous',candidates:candidates.map(c=>c.id),evidence,serviceOnly:true});
 if(envelope.case_id)return uncertain('untrusted_case_claim');
 if(request.bookingReferenceConflict)return uncertain('conflicting_service_booking_references');
 const refs=[...list(envelope.in_reply_to),...(Array.isArray(envelope.references)?envelope.references:list(envelope.references))];
 const ref=request.requestedBookingReference;
 const byReference=owned.filter(c=>ref&&String(trustedTubContext(c)?.reference||'').toUpperCase()===ref);
 const direct=owned.filter(c=>c.messages.some(m=>sameMailbox(m,envelope)&&((envelope.thread_id&&m.thread_id===envelope.thread_id)||(m.rfc_message_id&&refs.includes(m.rfc_message_id)))));
 if(direct.length>1||byReference.length>1)return uncertain('conflicting_service_identity');
 const chosen=direct[0]||byReference[0];
 if(!chosen)return uncertain('service_link_unverified');
 if(envelope.thread_id&&chosen.messages.some(m=>m.thread_id)&&!chosen.messages.some(m=>m.thread_id===envelope.thread_id))return uncertain('service_thread_conflict');
 if(ref&&String(trustedTubContext(chosen)?.reference||'').toUpperCase()!==ref)return uncertain('service_booking_reference_conflict');
 if(byReference[0]&&byReference[0]!==chosen)return uncertain('service_booking_reference_conflict');
 return {status:'linked',caseId:chosen.id,evidence:direct.length?'service_thread_or_reference':'trusted_booking_reference',serviceOnly:true};
}
function appendTubRequest(c,envelope,request,resolution){
 if(request.kind!=='tub_request')return;
 const context=trustedTubContext(c);
 c.serviceRequests??=[];
 c.serviceRequests.push({...request,sourceMessageId:envelope.message_id,at:envelope.received_at||c.state.now,
  linkedCaseId:c.caseKind==='service_link_review'?null:c.id,association:resolution.evidence,
  eligibility:assessTubEligibility({unitNumber:context?.unitNumber,unit:c.state.values.unit}),availability:'unverified',confirmationAllowed:false,requiresHumanReview:true});
 const current=tubServiceProjection(c);
 c.state.hotTub={...c.state.hotTub,requested:current.requested,available:null,fee:null,included:null};
}
export function resolveBookingCase(cases,envelope,values={}){
 const service=tubServiceMessage(envelope.text||'');
 if(service.kind==='tub_request'&&service.serviceOnly)return resolveTubCase(cases,envelope,service);
 const from=sender(envelope.sender),refs=[...list(envelope.in_reply_to),...(Array.isArray(envelope.references)?envelope.references:list(envelope.references))].filter(Boolean);
 const owned=cases.filter(c=>c.sender===from&&from);
 // An explicit different Gmail thread ID cannot be overridden by RFC reply references.
 const direct=owned.filter(c=>{
  const scopedMessages=c.messages.filter(m=>sameMailbox(m,envelope));
  const knownThreads=scopedMessages.map(m=>m.thread_id).filter(Boolean);
  if(envelope.thread_id&&knownThreads.length&&!knownThreads.includes(envelope.thread_id))return false;
  return (envelope.thread_id&&scopedMessages.some(m=>m.thread_id===envelope.thread_id))||scopedMessages.some(m=>m.rfc_message_id&&refs.includes(m.rfc_message_id));
 });
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
 const uncertain=ambiguousPartyFieldsFromText(text);
 if(uncertain.length)next.guests='';
 if(uncertain.includes('adults')||uncertain.includes('guests'))next.adults='';
 if(uncertain.includes('children')){next.children='';next.child_ages='';}
 if(!present(incoming.nights)&&next.arrival&&next.departure)next.nights=String((Date.parse(next.departure)-Date.parse(next.arrival))/86400000);
 return next;
}
export function createBookingCaseStore({storage=null,clock=()=>new Date().toISOString(),id=()=>globalThis.crypto.randomUUID(),tenantId='sarberki'}={}){
 if(!/^[a-z][a-z0-9-]{1,63}$/.test(tenantId))throw Error('Érvénytelen vállalkozási azonosító.');
 const key=tenantId==='sarberki'?'sarberki-booking-cases-v2':tenantId+'-booking-cases-v2';let cases=[];
 try{const saved=JSON.parse(storage?.getItem(key)||'[]');if(Array.isArray(saved))cases=saved.filter(c=>c.tenantId===tenantId||tenantId==='sarberki'&&!c.tenantId).map(c=>({...c,tenantId}));}catch{}
 const persist=(next=cases)=>{next.forEach(c=>c.tenantId=tenantId);storage?.setItem(key,JSON.stringify(next));cases=next;};
 return {
  list:()=>copy(cases),get:caseId=>copy(cases.find(c=>c.id===caseId)||null),
  ingest(envelope,incoming,{intent='booking_request',approvedCaseId=null}={}){
   if(envelope.tenantId&&envelope.tenantId!==tenantId)throw Error('Idegen vállalkozás üzenete.');
   const existing=cases.find(c=>envelope.message_id&&c.messages.some(m=>sameMailbox(m,envelope)&&m.message_id===envelope.message_id));
   if(existing){
    if(existing.sender!==sender(envelope.sender))throw Error('Üzenetazonosító ütközés: eltérő feladó.');
    const original=existing.messages.find(m=>sameMailbox(m,envelope)&&m.message_id===envelope.message_id);
    if(original.text!==envelope.text)throw Error('Üzenetazonosító ütközés: eltérő levéltartalom.');
    // A corrected parser must not reuse a legacy general-question approval path.
    // Reclassify only a single, byte-identical message; never overwrite follow-ups.
    if(existing.messages.length===1&&['other','general_question'].includes(existing.state.intent)&&intent==='booking_request'){
     const working=copy(cases),target=working.find(c=>c.id===existing.id);
     const previousRevision=target.state.revision;
     target.state=createCaseState({original:target.state.original,intent,values:target.state.values,now:target.state.now});
     target.state.revision=previousRevision+1;delete target.serverApproval;
     target.events??=[];target.events.push({time:clock(),type:'Régi helyi szállásigény újraosztályozva; új ellenőrzés szükséges',approval:'pending',revision:target.state.revision,scope:'local_unverified_operator'});
     target.updatedAt=clock();persist(working);
     return {resolution:{status:'duplicate',caseId:target.id},bookingCase:copy(target)};
    }
    return {resolution:{status:'duplicate',caseId:existing.id},bookingCase:copy(existing)};
   }
   // Stage the complete ingest on a detached snapshot: failed storage writes must
   // never leak a new message, changed facts, or revoked approval into memory.
   const working=copy(cases);
   let resolution=resolveBookingCase(working,envelope,incoming);
   const service=tubServiceMessage(envelope.text||''),serviceOnly=service.kind==='tub_request'&&service.serviceOnly;
   if(approvedCaseId){const found=working.find(c=>c.id===approvedCaseId&&c.sender===sender(envelope.sender));if(!found)throw Error('Az ügyösszekapcsolás nem igazolható.');resolution={status:'linked',caseId:found.id,evidence:'human_approved',...(serviceOnly?{serviceOnly:true}:{})};}
   const target=resolution.status==='linked'?working.find(c=>c.id===resolution.caseId):null;
   const eventAt=Date.parse(envelope.received_at||clock());
   const latestAt=target?Math.max(...target.messages.map(m=>Date.parse(m.received_at)).filter(Number.isFinite)):-Infinity;
   if(target&&Number.isFinite(eventAt)&&eventAt<latestAt){
    const previousApproval=target.state.approval;
    target.state.approval='pending';delete target.serverApproval;
    if(previousApproval==='internally_approved'){
     target.events??=[];
     target.events.push({time:clock(),type:'Jóváhagyás érvénytelenítve; korábbi vendégüzenet utólag beolvasva',approval:'pending',previousApproval,revision:target.state.revision,scope:'local_unverified_operator'});
    }
    appendTubRequest(target,envelope,service,resolution);
    target.messages.push({...envelope,historical:true,received_at:envelope.received_at});target.updatedAt=clock();persist(working);
    return {resolution:{...resolution,status:'historical',evidence:'older_message_preserved_without_overwrite'},bookingCase:copy(target)};
   }
   if(target&&!/[\p{L}]/u.test(envelope.text||'')){incoming={...incoming};delete incoming.language;}
   if(target&&Number(target.state.values.children)>String(target.state.values.child_ages||'').split(',').filter(x=>x.trim()).length&&!incoming.child_ages){
    const ages=childAgesFromText('gyermek '+envelope.text);if(ages.length)incoming={...incoming,child_ages:ages.join(', ')};
   }
   if(serviceOnly){
    const language=incoming.language||languageFromText(envelope.text);
    incoming={...(target?{request:envelope.text}:{}),...(['hu','de','en','si'].includes(language)?{language}:{})};
   }
   const dateUpdate=target&&!serviceOnly?followupDateUpdate(envelope.text,target.state.values):{status:'none'};
   if(dateUpdate.status==='updated')incoming={...incoming,...dateUpdate.values,nights:String((Date.parse(dateUpdate.values.departure)-Date.parse(dateUpdate.values.arrival))/86400000)};
   // A service-only question cannot rewrite the accommodation party.
   const values=target?mergeBookingFacts(target.state.values,incoming,serviceOnly?'':envelope.text):incoming;
   if(dateUpdate.status==='unverified'){values.arrival='';values.departure='';values.nights='';}
   const previousDates=target?{arrival:target.state.values.arrival,departure:target.state.values.departure}:null;
   const c=target||{id:id(),sender:sender(envelope.sender),messages:[],drafts:[],createdAt:clock(),...(serviceOnly?{caseKind:'service_link_review'}:{}),state:createCaseState({original:envelope.text,values,intent:serviceOnly?'service_request':intent,now:clock()})};
   if(target){
    const previousApproval=c.state.approval;
    c.state=updateCaseState(c.state,{type:'facts',values});
    // Every new message requires a fresh operator review, even if extracted facts are unchanged.
    // Do not carry an earlier draft approval into a newly received guest reply.
    c.state.approval='pending';
    delete c.serverApproval;
    if(previousApproval==='internally_approved'){
     c.events??=[];
     c.events.push({time:clock(),type:'Jóváhagyás érvénytelenítve; új vendégválasz érkezett',approval:'pending',previousApproval,revision:c.state.revision,scope:'local_unverified_operator'});
    }
   }
   if(dateUpdate.status!=='none')c.dateReview={...dateUpdate,previousDates,at:clock()};
   c.state.original=envelope.text;c.state.now=clock();
   c.state.intent=serviceOnly?(target?target.state.intent:'service_request'):target&&['other','general_question'].includes(intent)?target.state.intent:intent;c.facts=stageFacts(values);
   appendTubRequest(c,envelope,service,resolution);
   c.messages.push({...envelope,received_at:envelope.received_at||clock()});c.updatedAt=clock();
   c.status=resolution.status==='ambiguous'?'link_review_required':'preparing';c.linkReview=resolution.status==='ambiguous'?resolution:null;
   if(!target)working.push(c);persist(working);return {resolution,bookingCase:copy(c)};
  },
  save(caseId,state,draft='',{event=null,requirePersistent=false}={}){
   if(requirePersistent&&typeof storage?.setItem!=='function')throw Error('Tartós helyi ügytár nem érhető el.');
   if(event!==null&&(typeof event.type!=='string'||!event.type.trim()||event.type.length>1000))throw Error('Érvénytelen helyi auditesemény.');
   // Commit the complete case only after storage succeeds; a quota failure must not
   // leave an approved case in memory while the disk still contains pending state.
   const next=copy(cases),c=next.find(c=>c.id===caseId);if(!c)throw Error('Ismeretlen foglalási ügy.');
   const previousApproval=c.state.approval,draftChanged=Boolean(draft&&c.drafts.at(-1)?.text!==draft);
   c.state=copy(state);c.facts=stageFacts(state.values);c.updatedAt=clock();c.events??=[];
   if(previousApproval==='internally_approved'&&draftChanged)c.state.approval='pending';
   if(draftChanged)c.drafts.push({text:draft,at:clock(),revision:c.state.revision});
   const append=type=>c.events.push({time:clock(),type,approval:c.state.approval,previousApproval,revision:c.state.revision,scope:'local_unverified_operator'});
   if(previousApproval==='internally_approved'&&c.state.approval==='pending')append('Jóváhagyás érvénytelenítve; ügy vagy tervezet módosult');
   if(event)append(event.type);
   persist(next);return copy(c);
  }
 };
}
