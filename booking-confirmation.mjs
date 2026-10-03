import {BUSINESS} from './business-config.mjs';

export function cancellationDaysForGuests(guests){
  const n=Number(guests);
  if(!Number.isInteger(n)||n<1) throw new Error('Érvényes vendéglétszám szükséges.');
  return n>=15 ? BUSINESS.bookingRules.cancellationDaysFrom15Guests : BUSINESS.bookingRules.cancellationDaysUnder15Guests;
}

export function depositPercentForGuests(guests){
  const n=Number(guests);
  if(!Number.isInteger(n)||n<1) throw new Error('Érvényes vendéglétszám szükséges.');
  return n>=15 ? BUSINESS.bookingRules.depositPctFrom15Guests : BUSINESS.bookingRules.depositPctUnder15Guests;
}

export function generateDepositReceivedDraft({
  language='HU',
  name='',
  arrival='',
  departure='',
  cabin='',
  guests
}={}){
  const n=Number(guests);
  if(!Number.isInteger(n)||n<1) throw new Error('Érvényes vendéglétszám szükséges.');
  const cancelDays=cancellationDaysForGuests(n);
  const depositPct=depositPercentForGuests(n);
  const lang=String(language||'HU').toUpperCase();
  const stay=arrival&&departure ? `${arrival} – ${departure}` : '';
  const cabinText=cabin ? String(cabin) : '';

  if(lang==='DE'){
    return [
      `Guten Tag${name?', '+name:''}!`,
      '',
      `Wir bestätigen, dass Ihre Anzahlung in Höhe von ${depositPct} % eingegangen ist und Ihre Buchung damit endgültig bestätigt wurde.`,
      stay?`Aufenthalt: ${stay}.`:'',
      cabinText?`Unterkunft: ${cabinText}.`:'',
      `Die Buchung kann bis ${cancelDays} Tage vor der Anreise gemäß den Buchungsbedingungen storniert werden.`,
      '',
      'Mit freundlichen Grüßen',
      BUSINESS.brandName
    ].filter(Boolean).join('\n');
  }
  if(lang==='SL'){
    return [
      `Pozdravljeni${name?', '+name:''}!`,
      '',
      `Potrjujemo, da smo prejeli vašo akontacijo v višini ${depositPct} % in da je vaša rezervacija s tem dokončno potrjena.`,
      stay?`Termin bivanja: ${stay}.`:'',
      cabinText?`Nastanitev: ${cabinText}.`:'',
      `Rezervacijo je mogoče odpovedati do ${cancelDays} dni pred prihodom v skladu s pogoji rezervacije.`,
      '',
      'Lep pozdrav,',
      BUSINESS.brandName
    ].filter(Boolean).join('\n');
  }
  if(lang==='EN'){
    return [
      `Dear ${name||'Guest'},`,
      '',
      `We confirm that we have received your ${depositPct}% booking deposit and your reservation has now been finalized.`,
      stay?`Stay: ${stay}.`:'',
      cabinText?`Accommodation: ${cabinText}.`:'',
      `The reservation may be cancelled up to ${cancelDays} days before arrival in accordance with the booking conditions.`,
      '',
      'Kind regards,',
      BUSINESS.brandName
    ].filter(Boolean).join('\n');
  }
  return [
    `Kedves ${name||'Vendég'}!`,
    '',
    `Tájékoztatjuk, hogy a ${depositPct}%-os foglaló összege megérkezett, ezért foglalását véglegesítettük.`,
    stay?`Foglalás időpontja: ${stay}.`:'',
    cabinText?`Háztípus: ${cabinText}.`:'',
    `A foglalás az érkezést megelőző ${cancelDays}. napig mondható le a foglalási feltételek szerint.`,
    '',
    'Üdvözlettel:',
    BUSINESS.brandName
  ].filter(Boolean).join('\n');
}
