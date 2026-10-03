import {
  cabinFromText,
  guestCountFromText,
  adultCountFromText,
  childCountFromText,
  childAgesFromText,
  dateRangeFromText,
  languageFromText,
  phoneFromText,
  requestedUnitsFromText,
  specialRequestsFromText
} from './sarberki-core.mjs';

const ALLOWED_CHANNELS=new Set(['manual','gmail','web_form','phone_ai']);

export function normalizeInquiryInput({
  sourceChannel,
  rawText='',
  receivedAt=null,
  sender=null,
  now=new Date(),
  timeZone='Europe/Budapest'
}={}){
  if(!ALLOWED_CHANNELS.has(sourceChannel)) throw new Error('Ismeretlen bemeneti csatorna.');
  const text=String(rawText||'').trim();
  if(!text) throw new Error('Üres vendégüzenet nem normalizálható.');

  const dateRange=dateRangeFromText(text,now,timeZone);
  const guests=guestCountFromText(text);
  const adults=adultCountFromText(text);
  const children=childCountFromText(text);
  const childAges=childAgesFromText(text);
  const units=requestedUnitsFromText(text);

  return {
    schema_version:'sarberki_inquiry_v1',
    source:{
      channel:sourceChannel,
      received_at:receivedAt,
      sender:sender||null
    },
    original_text:text,
    normalized:{
      language:languageFromText(text),
      dates:dateRange ? {
        arrival:dateRange.arrival,
        departure:dateRange.departure,
        inferred_year:Boolean(dateRange.inferredYear)
      } : null,
      cabin:cabinFromText(text),
      guests:guests ?? null,
      adults:adults ?? null,
      children:children ?? null,
      child_ages:Array.isArray(childAges)?childAges:[],
      phone:phoneFromText(text),
      units_requested:units?.open ? null : (units?.count||null),
      units_open_request:Boolean(units?.open),
      special_requests:specialRequestsFromText(text)
    }
  };
}

export function normalizePhoneAiTranscript(input={}){
  return normalizeInquiryInput({...input,sourceChannel:'phone_ai'});
}
