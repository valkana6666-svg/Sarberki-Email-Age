import {
  cabinFromText,
  guestCountFromText,
  adultCountFromText,
  childCountFromText,
  childAgesFromText,
  dateRangeFromText,
  phoneFromText,
  languageFromText
} from './sarberki-core.mjs';
import { assessAccommodationInquiry } from './shared-core/inquiry-assessment.mjs';

export const BOOKING_CHANNELS=Object.freeze(['email','web_form','phone_ai','manual']);

function explicitNoChildren(text=''){
  return /\b(?:nincs(?:enek)?\s+gyerek|nincs(?:enek)?\s+gyermek|gyermek\s+nélkül|gyerek\s+nélkül|no\s+children|without\s+children|keine\s+kinder|ohne\s+kinder|brez\s+otrok)\b/iu.test(text);
}

export function normalizeBookingInput({channel='manual',text='',sourceId=null,receivedAt=null,now=new Date(),timeZone='Europe/Budapest'}={}){
  if(!BOOKING_CHANNELS.includes(channel)) throw new Error('Nem támogatott foglalási csatorna.');
  const original=String(text||'').trim();
  if(!original) throw new Error('A foglalási bemenet nem lehet üres.');
  const dates=dateRangeFromText(original,now,timeZone);
  const guests=guestCountFromText(original);
  const adults=adultCountFromText(original);
  const parsedChildren=childCountFromText(original);
  const children=parsedChildren==null?(explicitNoChildren(original)?0:null):parsedChildren;
  const childAges=childAgesFromText(original);
  const cabin=cabinFromText(original);
  const assessment=assessAccommodationInquiry({
    arrival:dates?.arrival||null,
    departure:dates?.departure||null,
    accommodation:cabin,
    guests:Number.isInteger(guests)?guests:null,
    adults:Number.isInteger(adults)?adults:null,
    children:Number.isInteger(children)?children:null,
    childAges
  });
  const missing=assessment.missing.map(key=>key==='accommodation'?'cabin':key);

  return Object.freeze({
    schema:'sarberki.booking-input.v1',
    channel,
    sourceId:sourceId||null,
    receivedAt:receivedAt||null,
    original,
    language:languageFromText(original),
    booking:Object.freeze({
      arrival:dates?.arrival||null,
      departure:dates?.departure||null,
      dateYearInferred:Boolean(dates?.inferredYear),
      cabin,
      guests:Number.isInteger(guests)?guests:null,
      adults:Number.isInteger(adults)?adults:null,
      children:Number.isInteger(children)?children:null,
      childAges:Object.freeze([...childAges]),
      phone:phoneFromText(original)
    }),
    missing:Object.freeze(missing),
    contradictions:assessment.contradictions,
    humanReviewRequired:assessment.human_review_required,
    readyForPrice:assessment.ready
  });
}
