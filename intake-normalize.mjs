import {
  activeMessageText,
  requestFlagsFromText,
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
import { createInquiryEnvelope } from './shared-core/inquiry-contract.mjs';
import { splitRequestFromText } from './split-units.mjs';

export function normalizeInquiryInput({
  sourceChannel,
  rawText='',
  receivedAt=null,
  sender=null,
  now=new Date(),
  timeZone='Europe/Budapest'
}={}){
  const text=activeMessageText(rawText);

  const dateRange=dateRangeFromText(text,now,timeZone);
  const guests=guestCountFromText(text);
  const adults=adultCountFromText(text);
  const children=childCountFromText(text);
  const childAges=childAgesFromText(text);
  const units=requestedUnitsFromText(text);

  return createInquiryEnvelope({
    schemaVersion:'sarberki_inquiry_v1',
    sourceChannel,
    rawText:text,
    receivedAt,
    sender,
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
      ...requestFlagsFromText(text),
      units_requested:units?.open ? null : (units?.count||null),
      units_open_request:Boolean(units?.open),
      special_requests:specialRequestsFromText(text),
      split_request:splitRequestFromText(text)
    }
  });
}

export function normalizePhoneAiTranscript(input={}){
  return normalizeInquiryInput({...input,sourceChannel:'phone_ai'});
}
