import {normalizeInquiryInput} from '../intake-normalize.mjs';
import {nameFromText} from '../sarberki-core.mjs';

// The Gmail/server ingestion path uses the same normalizer as the chatbot.
// Missing or ambiguous values remain absent, preserving existing thread facts.
export function extractServerMessage(envelope,{previous=null}={}){
 const inquiry=normalizeInquiryInput({sourceChannel:'gmail',rawText:envelope.text,now:new Date(envelope.received_at)});
 const n=inquiry.normalized,values={};
 // A follow-up "inkább június 26-tól 28-ig" (no year) in a booking whose stay is already in that year: the
 // inferred year matches the known stay, so it is a date change, not an unknown year (sweep 2026-11-12).
 const sameYear=n.dates?.inferred_year&&/^\d{4}-/.test(previous?.arrival||'')&&n.dates.arrival.slice(0,4)===previous.arrival.slice(0,4);
 // Owner rule 2026-11-14: a yearless date is the nearest future one and is used as is (sameYear kept for the record).
 void sameYear;
 if(n.dates){values.arrival=n.dates.arrival;values.departure=n.dates.departure;}
 for(const key of ['guests','adults','children'])if(Number.isSafeInteger(n[key])&&n[key]>=0)values[key]=String(n[key]);
 // Language test 2026-11-25: a follow-up changing only the adults ("Doch 2 Erwachsene") set children to 0 (the
 // normaliser assumes no children when none are named) – the booked children vanished. In a follow-up the known
 // children stay unless the letter names children or says "only adults".
 const kidWord=/gyerek|gyermek|child|kid|kind|otro[kc]|baba|baby|csak\s+felnőtt|csak\s+felnott|only\s+adults|nur\s+erwachsene|samo\s+odrasl/iu;
 if(Number(previous?.children)>0&&!kidWord.test(envelope.text||'')){delete values.children;delete values.guests;}
 if(typeof n.phone==='string'&&n.phone.trim())values.phone=n.phone;
 if(n.child_ages.length)values.child_ages=n.child_ages.join(',');
 if(n.cabin&&!n.cabin.startsWith('?'))values.unit=n.cabin;
 if(n.units_requested>0&&!n.units_open_request)values.units_requested=String(n.units_requested);
 // Split requests count their units: "két 2 fős osztott apartman" = 2, "egy osztott faház A és B" = 2 (2026-11-12).
 const splitUnits=n.split_request?.isSplit?Number(n.split_request.requestedAB||0)+Number(n.split_request.requestedC||0):0;
 if(splitUnits>=2&&!n.units_open_request)values.units_requested=String(splitUnits);
 if(n.language!=='unknown')values.language=n.language;
 // The guest's signature name (owner tests 2026-11-06): used for the greeting and the confirmation letter.
 const name=nameFromText(envelope.text);if(name&&name.length<=80)values.name=name;
 if(n.split_request?.isSplit)values.split_request_text=inquiry.rawText||envelope.text;
 if(n.units_open_request||n.hotTubRequested||n.petRequested)values.request=inquiry.rawText||envelope.text;
 return values;
}
