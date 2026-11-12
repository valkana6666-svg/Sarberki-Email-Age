// Server-only. Level 1 (owner/ChatGPT 2026-11-06): the guest's draft rests on the Previo free-unit read when the
// owner switch enables it. Uses the EXISTING path: buildAvailabilityOptions -> evaluateCentralInquiry(capacity)
// -> buildEmailInquiryDraft. A failed/unknown read leaves the draft exactly as without Previo (never "sold out").
import {buildAvailabilityOptions} from '../netlify/functions/availability-options.mjs';
import {evaluateCentralInquiry} from './central-inquiry-decision.mjs';
import {buildEmailInquiryDraft,CAPACITY_PENDING_LINE,LAYOUT_QUESTION} from './inquiry-channel-adapters.mjs';
import {planSplitPlacement,splitPlacementSentence} from './server-previo-split-placement.mjs';

// Adapter: readPrevioFreeCapacity(...) -> the availability-options source contract.
export function previoAvailabilitySource(reader,splitPlacementReader=null){
 if(typeof reader!=='function')return null;
 const source=async({arrival,departure,cabin})=>{
  const r=await reader({cabin,arrival,departure});
  const n=r?.freeByCabin?.[cabin];
  if(!Number.isSafeInteger(n)||n<0)throw Error('PREVIO_CAPACITY_UNKNOWN');
  return {arrival,departure,cabin,availability:n>0?'available':'unavailable',availableUnits:n,checkedAt:r.checkedAt,source:'previo-rest-'+r.hotelId};
 };
 // Unit-level split placement (same house / neighbouring houses), owner 2026-11-12.
 if(typeof splitPlacementReader==='function')source.splitPlacement=splitPlacementReader;
 return source;
}

// `clock` is read when the Previo answer is validated, not when the draft started: the read finishes after the
// start, and an answer "from the future" was rejected as invalid evidence (owner iPhone test 2026-11-09).
export async function emailDraftWithCapacity(options,availabilitySource=null,{clock=Date.now}={}){
 if(typeof availabilitySource!=='function')return buildEmailInquiryDraft(options);
 const decision=evaluateCentralInquiry(options);
 if(!decision.readyForCapacityCheck)return buildEmailInquiryDraft(options);
 // No cabin type chosen: the letter asks for the type first, so no Previo call (AGENTS.md: only the needed reads).
 if(!decision.capacity?.input?.cabin)return buildEmailInquiryDraft(options);
 let capacity=null;
 try{capacity=await buildAvailabilityOptions(decision.capacity.input,availabilitySource,{tenantId:options.tenantId,now:()=>Math.max(+new Date(options.now),Number(clock()))});}catch{}
 // The decision re-checks the evidence's freshness against `now`: use the moment after the read.
 const draft=buildEmailInquiryDraft(capacity?{...options,now:new Date(Math.max(+new Date(options.now),Number(clock()))),capacity}:options);
 return withSplitPlacement(draft,decision,availabilitySource.splitPlacement,options.message);
}

// Same house / neighbouring split houses: the pool read cannot prove it, so the draft still holds the pending line.
// One unit-level read replaces it with a verified sentence; unknown -> draft unchanged (never "sold out").
const ADJACENT_LINE={hu:'A szomszédos elhelyezést külön ellenőrizzük.',de:'Eine Unterbringung nebeneinander prüfen wir gesondert.',
 en:'We will check separately whether adjacent cabins are possible.',si:'Sosednjo namestitev preverimo posebej.'};
const CABIN_LINE={hu:'A kért háztípus:',de:'Gewünschter Haustyp:',en:'Requested cabin type:',si:'Želeni tip hiške:'};
const EXTRAS_TITLE={hu:'Kiegészítő információk',de:'Weitere Informationen',en:'Additional information',si:'Dodatne informacije'};
function patchText(text,lang,sentence){
 const pending=CAPACITY_PENDING_LINE[lang];
 if(typeof text!=='string'||!text.includes(pending))return null;
 // The verified sentence belongs in the stay section, right after the cabin-type line (else where the pending line was).
 let lines=text.split('\n');const at=lines.findIndex(l=>l.startsWith(CABIN_LINE[lang]));
 if(at>=0){lines=lines.filter(l=>l.trim()!==pending);lines.splice(lines.findIndex(l=>l.startsWith(CABIN_LINE[lang]))+1,0,sentence);}
 let out=(at>=0?lines.join('\n'):text.replace(pending,sentence)).split(ADJACENT_LINE[lang]).join('');
 out=out.replace(new RegExp(EXTRAS_TITLE[lang]+'\\n(?=\\n|$)','u'),'');
 return out.replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n');
}
export async function withSplitPlacement(draft,decision,reader,message=''){
 const input=decision?.capacity?.input,p=input?.placement;
 if(typeof reader!=='function'||!input?.cabin?.startsWith?.('split')||!p||p.exactIds?.length||decision.capacity.incompatible)return draft;
 const lang=draft?.decision?.facts?.language||'hu';
 const asked=p.sameHouse||p.adjacent;
 // Owner 2026-11-12: two or more split units in one booking -> aim for neighbouring units even when not asked.
 // Nothing is promised to the guest then; the operator gets the suggestion for the finalize step.
 if(!asked){
  if(!(p.ab+p.c>=2))return draft;
  let read;try{read=await reader({arrival:input.arrival,departure:input.departure});}catch{return draft;}
  if(read?.status!=='read')return draft;
  const near=planSplitPlacement(read.free,{ab:p.ab,c:p.c,mode:'adjacent'});
  const note=near.status==='available'?`Previo (csak olvasó, egységszint) – javaslat egymás mellett: ${near.units.join(' + ')}${near.sameHouse?' (azonos ház)':' (szomszédos házak)'}. Véglegesítéskor ezeket válaszd, ha lehet.`
   :near.alternative?`Previo (csak olvasó, egységszint): egymás mellett nincs szabad; külön házakban szabad: ${near.alternative.units.join(' + ')}.`:null;
  return note?{...draft,operatorReviewText:String(draft.operatorReviewText||'')+'\n\n'+note,splitPlacement:near}:draft;
 }
 if(!String(draft?.text||'').includes(CAPACITY_PENDING_LINE[lang]||CAPACITY_PENDING_LINE.hu))return draft;
 let read;try{read=await reader({arrival:input.arrival,departure:input.departure});}catch{return draft;}
 if(read?.status!=='read')return draft;
 const plan=planSplitPlacement(read.free,{ab:p.ab,c:p.c,mode:p.sameHouse?'same-house':'adjacent'});
 const layoutAsked=LAYOUT_QUESTION.test(String(message||decision.facts?.originalText||decision.facts?.split_request_text||''));
 const guest=splitPlacementSentence(plan,lang,{layoutAsked}),hu=splitPlacementSentence(plan,'hu',{layoutAsked});
 const text=guest&&patchText(draft.text,lang,guest.guest);
 if(!text)return draft;
 const review=patchText(draft.operatorReviewText,'hu',hu.guest)??draft.operatorReviewText;
 return {...draft,text,operatorReviewText:review+'\n\n'+hu.operator,splitPlacement:plan};
}
