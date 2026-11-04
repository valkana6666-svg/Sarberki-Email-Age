// Server-only (excluded from dist by the server- prefix). Owner request 2026-11-04: when the operator has
// checked Previo by hand and no suitable cabin is free, the reply must say so, carry NO price and stop the
// booking flow. The SERVER builds the text from the stored draft (greeting and signature kept, body replaced)
// and attests it for sc_tm_unavailable_redraft. The browser sends no text. No price rule, availability or
// booking is changed; this is the manual stand-in for the later Previo read-only check.
import {createHash,createHmac} from 'node:crypto';

export const UNAVAILABLE_SCOPE='test-mailbox-unavailable-v1';
const CLOSING=Object.freeze({hu:'Üdvözlettel:',de:'Mit freundlichen Grüßen',en:'Kind regards,',si:'Lep pozdrav'});
export const UNAVAILABLE_TEXT=Object.freeze({
 hu:'Köszönjük érdeklődését. Sajnos a kért időszakra nincs a megadott létszámnak megfelelő szabad faházunk.\n\nHa más időpont is megfelelne, kérjük, válaszoljon erre az e-mailre, és szívesen megnézzük a lehetőségeket.',
 de:'Vielen Dank für Ihre Anfrage. Leider haben wir für den gewünschten Zeitraum kein freies Ferienhaus, das für die angegebene Personenzahl geeignet ist.\n\nFalls Ihnen ein anderer Termin passt, antworten Sie bitte auf diese E-Mail – wir prüfen gerne die Möglichkeiten.',
 en:'Thank you for your enquiry. Unfortunately, we have no available cabin suitable for your party for the requested dates.\n\nIf other dates would suit you, please reply to this email and we will gladly check the options.',
 si:'Hvala za vaše povpraševanje. Žal za želeni termin nimamo proste hiške, primerne za navedeno število oseb.\n\nČe vam ustreza drug termin, odgovorite na to e-pošto in z veseljem bomo preverili možnosti.'});
const fail=code=>{const error=Error(code);error.code=code;throw error;};
const sha=text=>createHash('sha256').update(String(text),'utf8').digest('hex');

// Keeps the engine's own greeting (first paragraph) and closing block; anything unexpected refuses.
export function unavailableDraft({latest,language}){
 const lang=UNAVAILABLE_TEXT[language]?language:'hu',text=latest?.text;
 if(typeof text!=='string')fail('DRAFT_SHAPE_UNKNOWN');
 const greeting=text.split('\n\n')[0],at=text.lastIndexOf('\n\n'+CLOSING[lang]+'\n');
 if(!greeting||greeting.length>200||/[.?]$/.test(greeting)||at<greeting.length)fail('DRAFT_SHAPE_UNKNOWN');
 const reply=greeting+'\n\n'+UNAVAILABLE_TEXT[lang]+text.slice(at);
 if(reply===text)fail('ALREADY_UNAVAILABLE');
 const operatorReviewText='Nincs szabad hely – a kezelő a Previóban ellenőrizte, hogy a kért időszakra nincs a paramétereknek megfelelő szabad szállás. '+
  'Ár nem került a válaszba; foglalás nem jön létre.'+(lang==='hu'?'':'\n\nA vendégnek küldött tartalom magyarul:\n'+UNAVAILABLE_TEXT.hu);
 return {text:reply,operatorReviewText};
}

export function attestUnavailable({key,tenantId,caseId,expectedRevision,draft,checkedAt}){
 if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))fail('SETUP_REQUIRED');
 const fields=[UNAVAILABLE_SCOPE,tenantId,caseId,String(expectedRevision),sha(draft.text),sha(draft.operatorReviewText),checkedAt];
 if(fields.some(v=>typeof v!=='string'||!v||/[\r\n]/.test(v)))fail('INVALID_EVIDENCE');
 return {scope:UNAVAILABLE_SCOPE,checkedAt,attestation:createHmac('sha256',Buffer.from(key,'hex')).update(fields.join('\n')).digest('hex')};
}

export async function markTestMailboxUnavailable({record,unavailableConfirmed,attestationKey,transport,clock=()=>new Date().toISOString()}={}){
 if(unavailableConfirmed!==true)fail('UNAVAILABILITY_NOT_CONFIRMED');
 if(typeof transport!=='function')fail('SETUP_REQUIRED');
 const values=record?.data?.state?.values||{},latest=record?.data?.drafts?.at?.(-1);
 const language=/^(hu|de|en|si)$/.test(values.language||'')?values.language:'hu';
 const draft=unavailableDraft({latest,language});
 const proof=attestUnavailable({key:attestationKey,tenantId:record.tenantId,caseId:record.caseId,expectedRevision:record.revision,draft,checkedAt:clock()});
 return transport('/rest/v1/rpc/sc_tm_unavailable_redraft',{method:'POST',body:{p_tenant:record.tenantId,p_case:record.caseId,p_expected:record.revision,p_draft:draft,p_proof:proof}});
}
