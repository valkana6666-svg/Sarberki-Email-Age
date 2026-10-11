import {evaluateCentralInquiry} from './central-inquiry-decision.mjs';
import {buildCentralReply} from '../central-reply.mjs';
import {replyQuestions} from '../sarberki-core.mjs';
const words={
 hu:{pending:'A kapacitás ellenőrzése még nem igazolt.',available:'A teljes kért időszakra megfelelő típusszintű kapacitás igazolt. A végleges ajánlat emberi jóváhagyásra vár.',unavailable:'A kért elhelyezéshez nincs elegendő igazolt szabad kapacitás.',review:'A megadott adatok pontosítása vagy emberi ellenőrzése szükséges.',date:'Kérjük, erősítse meg az érkezés és távozás évét.',units:'Hány szállásegységet szeretnének?',price:'Az ellenőrzött ár belső jóváhagyásra vár; ez még nem végleges ajánlat.'},
 de:{pending:'Die Verfügbarkeit ist noch nicht verifiziert.',available:'Passende Kapazität auf Typebene wurde für den gesamten Aufenthalt geprüft. Das endgültige Angebot benötigt eine manuelle Freigabe.',unavailable:'Für die gewünschte Unterkunft reicht die bestätigte freie Kapazität nicht aus.',review:'Die Angaben müssen präzisiert oder manuell geprüft werden.',date:'Bitte bestätigen Sie das Jahr der An- und Abreise.',units:'Wie viele Unterkunftseinheiten wünschen Sie?',price:'Der geprüfte Preis benötigt eine interne Freigabe und ist noch kein endgültiges Angebot.'},
 en:{pending:'Availability has not yet been verified.',available:'Suitable capacity at accommodation-type level has been verified for the entire stay. The final offer requires human approval.',unavailable:'There is insufficient verified availability for the requested accommodation.',review:'The details need clarification or human review.',date:'Please confirm the year of arrival and departure.',units:'How many accommodation units would you like?',price:'The verified price is awaiting internal approval and is not a final offer.'},
 si:{pending:'Razpoložljivost še ni preverjena.',available:'Ustrezna kapaciteta na ravni tipa nastanitve je preverjena za celotno bivanje. Končna ponudba potrebuje ročno odobritev.',unavailable:'Za zahtevano nastanitev ni dovolj preverjene proste kapacitete.',review:'Podatke je treba pojasniti ali ročno preveriti.',date:'Prosimo, potrdite leto prihoda in odhoda.',units:'Koliko nastanitvenih enot želite?',price:'Preverjena cena čaka na interno odobritev in še ni končna ponudba.'}
};
export function renderCentralConversation(decision){
 const f=decision.facts,m=new Set(decision.missing),t=words[f.language]||words.hu;
 const questions=replyQuestions(f.language,{needDates:m.has('dates'),needAdults:m.has('adults'),needChildStatus:m.has('children_status'),needChildAge:m.has('child_ages'),needCabin:m.has('accommodation'),guests:f.guests});
 if(m.has('dates_confirmation'))questions.push(t.date);
 if(m.has('units_requested'))questions.push(t.units);
 if(questions.length)return questions.join('\n');
 if(decision.requiresHumanReview&&decision.contradictions.length)return t.review;
 const status=decision.capacity.status==='AVAILABLE'?t.available:decision.capacity.status==='UNAVAILABLE'?t.unavailable:t.pending;
 return status+(decision.pricing.verified?' '+t.price:'');
}
export function buildChatInquiryReply(options={}){
 const decision=evaluateCentralInquiry(options);
 return {decision,text:renderCentralConversation(decision),channel:'chat',requiresApproval:true};
}
export function buildEmailInquiryDraft(options={}){
 const decision=evaluateCentralInquiry(options),f=decision.facts;
 const draft=buildCentralReply({language:f.language,original:options.message||f.originalText||'',arrival:f.dates?.arrival,departure:f.dates?.departure,guests:f.guests,adults:f.adults,children:f.children,childAges:f.child_ages,phone:f.phone,cabin:f.cabin});
 // Existing email renderer remains the presentation layer. The shared decision
 // and its current safety status are returned alongside the pending draft.
 const additions=renderCentralConversation(decision).split('\n').filter(line=>!draft.includes(line));
 return {decision,text:draft+(additions.length?'\n\n'+additions.join('\n'):''),channel:'email',requiresApproval:true};
}
