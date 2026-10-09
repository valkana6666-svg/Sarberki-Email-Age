import {dateRangeFromText,guestCountFromText,adultCountFromText,childCountFromText,
 childAgesFromText,cabinFromText,requestedUnitsFromText,languageFromText} from '../sarberki-core.mjs';

// Reuse the established parser; absent or ambiguous facts never clear known facts.
export function extractServerMessage(envelope){
 const text=envelope.text, values={};
 const dates=dateRangeFromText(text,new Date(envelope.received_at));
 // An inferred year needs operator review; it is not a confirmed booking date.
 if(dates&&!dates.inferredYear){values.arrival=dates.arrival;values.departure=dates.departure;}
 for(const [key,parse] of [['guests',guestCountFromText],['adults',adultCountFromText],['children',childCountFromText]]){
  const number=parse(text);if(Number.isSafeInteger(number)&&number>=0)values[key]=String(number);
 }
 const ages=childAgesFromText(text);if(ages.length)values.child_ages=ages.join(',');
 const cabin=cabinFromText(text);if(!cabin.startsWith('?'))values.unit=cabin;
 const units=requestedUnitsFromText(text);if(units.count>0&&!units.open)values.units_requested=String(units.count);
 const language=languageFromText(text);if(language!=='unknown')values.language=language;
 return values;
}
