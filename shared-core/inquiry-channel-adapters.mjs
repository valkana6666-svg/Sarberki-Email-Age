import {evaluateCentralInquiry} from './central-inquiry-decision.mjs';
import {buildCentralReply} from '../central-reply.mjs';
import {replyQuestions,stayCancellationFromText} from '../sarberki-core.mjs';
const words={
 hu:{pending:'A kapacitás ellenőrzése még nem igazolt.',available:'A teljes kért időszakra megfelelő típusszintű kapacitás igazolt. A végleges ajánlat emberi jóváhagyásra vár.',unavailable:'A kért elhelyezéshez nincs elegendő igazolt szabad kapacitás.',review:'A megadott adatok pontosítása vagy emberi ellenőrzése szükséges.',date:'Kérjük, erősítse meg az érkezés és távozás évét.',units:'Hány szállásegységet szeretnének?',price:'Az ellenőrzött ár belső jóváhagyásra vár; ez még nem végleges ajánlat.'},
 de:{pending:'Die Verfügbarkeit ist noch nicht verifiziert.',available:'Passende Kapazität auf Typebene wurde für den gesamten Aufenthalt geprüft. Das endgültige Angebot benötigt eine manuelle Freigabe.',unavailable:'Für die gewünschte Unterkunft reicht die bestätigte freie Kapazität nicht aus.',review:'Die Angaben müssen präzisiert oder manuell geprüft werden.',date:'Bitte bestätigen Sie das Jahr der An- und Abreise.',units:'Wie viele Unterkunftseinheiten wünschen Sie?',price:'Der geprüfte Preis benötigt eine interne Freigabe und ist noch kein endgültiges Angebot.'},
 en:{pending:'Availability has not yet been verified.',available:'Suitable capacity at accommodation-type level has been verified for the entire stay. The final offer requires human approval.',unavailable:'There is insufficient verified availability for the requested accommodation.',review:'The details need clarification or human review.',date:'Please confirm the year of arrival and departure.',units:'How many accommodation units would you like?',price:'The verified price is awaiting internal approval and is not a final offer.'},
 si:{pending:'Razpoložljivost še ni preverjena.',available:'Ustrezna kapaciteta na ravni tipa nastanitve je preverjena za celotno bivanje. Končna ponudba potrebuje ročno odobritev.',unavailable:'Za zahtevano nastanitev ni dovolj preverjene proste kapacitete.',review:'Podatke je treba pojasniti ali ročno preveriti.',date:'Prosimo, potrdite leto prihoda in odhoda.',units:'Koliko nastanitvenih enot želite?',price:'Preverjena cena čaka na interno odobritev in še ni končna ponudba.'}
};
// Either the open questions of the shared decision, or (when nothing is missing) one status line.
function centralConversationParts(decision,language){
 const f=decision.facts,m=new Set(decision.missing),t=words[language]||words.hu;
 const questions=replyQuestions(language,{needDates:m.has('dates'),needAdults:m.has('adults'),needChildStatus:m.has('children_status'),needChildAge:m.has('child_ages'),needCabin:m.has('accommodation'),guests:f.guests});
 if(m.has('dates_confirmation'))questions.push(t.date);
 if(m.has('units_requested'))questions.push(t.units);
 if(questions.length)return {questions,status:null};
 if(decision.requiresHumanReview&&decision.contradictions.length)return {questions:[],status:t.review};
 const status=decision.capacity.status==='AVAILABLE'?t.available:decision.capacity.status==='UNAVAILABLE'?t.unavailable:t.pending;
 return {questions:[],status:status+(decision.pricing.verified?' '+t.price:'')};
}
export function renderCentralConversation(decision,{language=decision.facts.language}={}){
 const {questions,status}=centralConversationParts(decision,language);
 return questions.length?questions.join('\n'):status;
}
export function buildChatInquiryReply(options={}){
 const decision=evaluateCentralInquiry(options);
 const original=options.message||decision.facts.originalText||'';
 return {decision,text:renderEmailDecision(decision,original,decision.facts.language),operatorReviewText:renderEmailDecision(decision,original,'hu'),operatorReviewLanguage:'hu',channel:'chat',requiresApproval:true};
}
function renderEmailDecision(decision,original,language){
 const f=decision.facts;
 // An explicit stay cancellation gets the existing approved acknowledgement, not booking questions.
 // The decision, facts and safety flags are unchanged; a human still reviews before anything is sent.
 if(stayCancellationFromText(original))return buildCentralReply({language,original,intent:'cancellation_request'});
 const draft=buildCentralReply({language,original,arrival:f.dates?.arrival,departure:f.dates?.departure,guests:f.guests,adults:f.adults,children:f.children,childAges:f.child_ages,phone:f.phone,cabin:f.cabin});
 // Existing email renderer remains the presentation layer. The shared decision
 // and its current safety status are returned alongside the pending draft.
 const parts=centralConversationParts(decision,language);
 let additions=parts.questions.filter(line=>line&&!draft.includes(line));
 // When the draft already asks the guest to choose among the capacity-suitable offered types, the
 // generic "VIP, Családi, Deluxe or Osztott?" question would re-offer unsuitable types.
 if(OFFERED_CHOICE.some(text=>draft.includes(text))){
  const generic=new Set([...replyQuestions(language,{needCabin:true}),...replyQuestions(language,{needCabin:true,guests:2})]);
  additions=additions.filter(line=>!generic.has(line));
 }
 const withQuestions=placeAdditions(draft,additions,language);
 return parts.status&&!draft.includes(parts.status)?placeStatus(withQuestions,parts.status,language):withQuestions;
}
const OFFERED_CHOICE=['melyik felajánlott faháztípust választja','welchen der angebotenen Haustypen','which of the offered cabin types','katero od ponujenih vrst hišk'];
const MISSING_TITLE={hu:'Az ajánlathoz még szükségünk van',de:'Noch benötigte Angaben',en:'Details still needed',si:'Podatki za dopolnitev'};
const STATUS_TITLE={hu:'Foglalás állapota',de:'Reservierungsstatus',en:'Booking status',si:'Status rezervacije'};
const CLOSING={hu:'Üdvözlettel:',de:'Mit freundlichen Grüßen',en:'Kind regards,',si:'Lep pozdrav'};
// A status sentence is its own paragraph directly before the closing, never after the signature.
function placeStatus(draft,status,language){
 const lines=draft.split('\n'),at=lines.indexOf(CLOSING[MISSING_TITLE[language]?language:'hu']);
 if(at<0)return draft+'\n\n'+status;
 lines.splice(at,0,status,'');return lines.join('\n');
}
// Extra questions belong inside the letter: in the "still needed" section, otherwise as their own
// section before the booking status or the closing. Never after the signature.
function placeAdditions(draft,additions,language){
 if(!additions.length)return draft;
 const lang=MISSING_TITLE[language]?language:'hu',lines=draft.split('\n');
 const missingAt=lines.indexOf(MISSING_TITLE[lang]);
 if(missingAt>=0){
  let end=missingAt+1;while(end<lines.length&&lines[end]!=='')end++;
  lines.splice(end,0,...additions);return lines.join('\n');
 }
 let at=lines.indexOf(STATUS_TITLE[lang]);
 if(at<0)at=lines.indexOf(CLOSING[lang]);
 if(at<0)return draft+'\n\n'+additions.join('\n');
 lines.splice(at,0,MISSING_TITLE[lang],...additions,'');return lines.join('\n');
}
export function buildEmailInquiryDraft(options={}){
 const decision=evaluateCentralInquiry(options),original=options.message||decision.facts.originalText||'';
 return {decision,text:renderEmailDecision(decision,original,decision.facts.language),operatorReviewText:renderEmailDecision(decision,original,'hu'),operatorReviewLanguage:'hu',channel:'email',requiresApproval:true};
}
