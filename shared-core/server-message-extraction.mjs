import {normalizeInquiryInput} from '../intake-normalize.mjs';

// The Gmail/server ingestion path uses the same normalizer as the chatbot.
// Missing or ambiguous values remain absent, preserving existing thread facts.
export function extractServerMessage(envelope){
 const inquiry=normalizeInquiryInput({sourceChannel:'gmail',rawText:envelope.text,now:new Date(envelope.received_at)});
 const n=inquiry.normalized,values={};
 if(n.dates&&!n.dates.inferred_year){values.arrival=n.dates.arrival;values.departure=n.dates.departure;}
 for(const key of ['guests','adults','children'])if(Number.isSafeInteger(n[key])&&n[key]>=0)values[key]=String(n[key]);
 if(typeof n.phone==='string'&&n.phone.trim())values.phone=n.phone;
 if(n.child_ages.length)values.child_ages=n.child_ages.join(',');
 if(n.cabin&&!n.cabin.startsWith('?'))values.unit=n.cabin;
 if(n.units_requested>0&&!n.units_open_request)values.units_requested=String(n.units_requested);
 if(n.language!=='unknown')values.language=n.language;
 if(n.split_request?.isSplit)values.split_request_text=inquiry.rawText||envelope.text;
 if(n.units_open_request||n.hotTubRequested||n.petRequested)values.request=inquiry.rawText||envelope.text;
 return values;
}
