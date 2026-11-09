// V1 (ChatGPT/owner task 2026-11-06: "a vendég foglalási szándékának felismerése"). Recognises an explicit
// acceptance in a guest's REPLY ("ok, please book the Deluxe", "Wir möchten verbindlich buchen") – not in a first
// inquiry, where "szeretnénk foglalni" only means interest. A hint for the operator only: nothing is booked,
// stored or sent; the operator still records the booking in Previo and finalizes it by hand.
import {activeMessageText} from '../sarberki-core.mjs';

const ACCEPT=[
 // Hungarian
 /lefoglaln[áé]\p{L}*/iu,/foglalj(?:uk|átok|ák|a)\s+le\b/iu,/(?:kérjük|kérem|szeretnénk|szeretném)\s+(?:a\s+)?(?:foglalás\p{L}*\s+)?(?:lefoglalni|véglegesíteni|rögzíteni)/iu,
 /(?:kérjük|kérem)\s+(?:a\s+)?(?:foglalást|foglalni)/iu,/elfogadjuk\s+(?:az\s+)?(?:ajánlat|árat)/iu,/mehet\s+a\s+foglalás/iu,/(?:rendben|jó|oké|ok),?\s+(?:akkor\s+)?(?:foglaljuk|lefoglaljuk|kérjük)/iu,
 // German
 /(?:möchten|würden|wollen)\s+(?:\p{L}+\s+){0,5}?(?:verbindlich\s+)?(?:buchen|reservieren)\b/iu,/bitte\s+(?:\p{L}+\s+){0,4}?(?:buchen|reservieren)\b/iu,/verbindlich\s+(?:buchen|reservieren|zusagen)/iu,
 /(?:wir\s+)?nehmen\s+(?:das|den|die)\s+(?:angebot|haus|häuser|ferienhaus)/iu,/(?:buchen|reservieren)\s+(?:wir|ich)\b/iu,
 // English
 /(?:we(?:'d|\s+would)?|i(?:'d|\s+would)?)\s+like\s+to\s+(?:book|reserve|confirm)\b/iu,/please\s+(?:book|reserve|confirm)\b/iu,/(?:we|i)(?:'ll|\s+will)\s+take\s+(?:it|the)\b/iu,/go\s+ahead\s+(?:with\s+)?(?:the\s+)?booking/iu,
 // Slovene
 /rezervirali\s+bi/iu,/(?:prosim|prosimo),?\s+rezervirajte/iu,/potrjujemo\s+rezervacijo/iu
];
const NEGATION=/(?:^|[\s,.;!?])(?:nem|még\s+nem|mégsem|ne|not|don't|do\s+not|nicht|noch\s+nicht|kein\p{L}*|nicht\s+mehr|ne\s+bomo)\s+(?:\p{L}+\s+){0,3}$/iu;

// {accepted, phrase} for ONE message text. Quoted history (our own offer) is ignored.
export function bookingAcceptanceFromText(text){
 const current=activeMessageText(String(text||''));
 for(const pattern of ACCEPT){
  const m=current.match(pattern);
  if(!m)continue;
  const before=current.slice(Math.max(0,m.index-40),m.index);
  if(NEGATION.test(before)||/(?:^|\s)(?:nicht|kein\p{L}*|nem|not|ne)(?:\s|$)/iu.test(m[0]))continue;
  return Object.freeze({accepted:true,phrase:m[0].trim().slice(0,80)});
 }
 return Object.freeze({accepted:false,phrase:null});
}

// Case-level hint: only a guest REPLY (not the first inquiry) on a booking not finalized yet.
export function bookingIntentHint(messages,bookingStatus){
 if(!Array.isArray(messages)||messages.length<2)return null;
 if(['finalized','deposit_received'].includes(bookingStatus))return null;
 const r=bookingAcceptanceFromText(messages.at(-1)?.text);
 return r.accepted?r.phrase:null;
}
