// V1 booking confirmation draft (owner/ChatGPT task 2026-11-06). The OPERATOR records the booking in Previo by
// hand; only after the operator attests that recording (Previo reference + time) does the server build this
// confirmation draft. It states the stay, the price-list price, the deposit (percentage of the ACCOMMODATION price,
// IFA excluded) and its receipt deadline from the central deposit policy, plus the approved cancellation sentence.
// Nothing is sent or booked here; the draft goes through the existing human approval and send path.
// Recording in Previo is NOT payment: "deposit received" is a separate, later operator step.
import {BUSINESS} from '../business-config.mjs';
import {depositReceiptDeadline} from '../sarberki-core.mjs';
import {CABIN_NAMES} from './price-insert-sentence.mjs';

const fail=code=>{const error=Error(code);error.code=code;throw error;};
const huf=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const LANGS=['hu','de','en','si'];

// Deadline in the property's own time zone, e.g. 2027.05.27. 18:00.
export function localDeadline(isoUtc,timeZone=BUSINESS.timezone){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(isoUtc)).map(x=>[x.type,x.value]));
 return {date:`${p.year}.${p.month}.${p.day}.`,time:`${p.hour}:${p.minute}`};
}
const dot=d=>d.replaceAll('-','.')+'.';

// Pure: facts + server-computed quote + operator-attested Previo recording -> confirmation text and deposit.
export function buildBookingConfirmation({values,quote,previo,language,rules=BUSINESS.bookingRules,paymentInstructions=BUSINESS.paymentInstructions}={}){
 const lang=LANGS.includes(language)?language:'hu';
 const adults=Number(values?.adults),children=Number(values?.children||0),guests=adults+children;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(values?.arrival||'')||!/^\d{4}-\d{2}-\d{2}$/.test(values?.departure||'')||!Number.isInteger(adults)||adults<1||!Number.isInteger(children)||children<0)fail('CONFIRMATION_FACTS_MISSING');
 if(quote?.status!=='public_reference'||!Number.isSafeInteger(quote.accommodation)||!Number.isSafeInteger(quote.tourismTax)||!Number.isSafeInteger(quote.total)||quote.accommodation<=0)fail('CONFIRMATION_PRICE_MISSING');
 const reference=typeof previo?.reference==='string'?previo.reference.trim():'';
 if(!/^[A-Za-z0-9\/_.-]{1,40}$/.test(reference)||typeof previo?.recordedAt!=='string')fail('PREVIO_RECORDING_REQUIRED');
 const policy=depositReceiptDeadline({guestCount:guests,bookingAt:previo.recordedAt,arrivalDate:values.arrival});
 if(policy.status!=='calculated')fail('DEPOSIT_POLICY_UNVERIFIED');
 const amount=Math.round(quote.accommodation*policy.depositPct/100);
 const due=localDeadline(policy.receiptDeadlineUtc);
 const cabin=CABIN_NAMES[quote.cabin]?.[lang]||String(values.unit||quote.cabin||'');
 const name=typeof values?.name==='string'&&values.name.trim()?values.name.trim():null;
 const cancelDays=Number(rules.cancellationDaysUnder15Guests);
 const cancel=Number.isFinite(cancelDays)&&cancelDays>0&&cancelDays===Number(rules.cancellationDaysFrom15Guests)?cancelDays:null;
 const pay=paymentInstructions?.[lang]||null;
 const party={hu:`${guests} fő (${adults} felnőtt${children?`, ${children} gyermek`:''})`,de:`${guests} Personen (${adults} Erwachsene${children?`, ${children} Kinder`:''})`,
  en:`${guests} guests (${adults} adults${children?`, ${children} children`:''})`,si:`${guests} oseb (${adults} odraslih${children?`, ${children} otrok`:''})`}[lang];
 const T={
  hu:[`${name?`Kedves ${name}!`:'Kedves Vendégünk!'}`,'Köszönjük foglalását, rendszerünkben rögzítettük.',
   `Foglalás\n${dot(values.arrival)} – ${dot(values.departure)}, ${cabin}, ${party}.`,
   `Ár\nSzállásdíj: ${huf(quote.accommodation)} Ft, idegenforgalmi adó: ${huf(quote.tourismTax)} Ft, összesen: ${huf(quote.total)} Ft.`,
   `Foglaló\nA foglaló a szállásdíj ${policy.depositPct}%-a: ${huf(amount)} Ft. Kérjük, hogy ${due.date} ${due.time}-ig (magyarországi idő) érkezzen meg. A foglalás a foglaló beérkezése után válik véglegessé.${pay?'\n'+pay:'\nA fizetés módjáról külön tájékoztatjuk.'}`,
   ...(cancel?[`Lemondás\nAz érkezés előtt legalább ${cancel} nappal történő lemondásnál a foglaló nem vész el.`]:[]),'Üdvözlettel:\n'+BUSINESS.brandName],
  de:[`${name?`Liebe/r ${name},`:'Liebe Gäste,'}`,'vielen Dank für Ihre Buchung, wir haben sie in unserem System erfasst.',
   `Buchung\n${dot(values.arrival)} – ${dot(values.departure)}, ${cabin}, ${party}.`,
   `Preis\nÜbernachtung: ${huf(quote.accommodation)} HUF, Kurtaxe: ${huf(quote.tourismTax)} HUF, gesamt: ${huf(quote.total)} HUF.`,
   `Anzahlung\nDie Anzahlung beträgt ${policy.depositPct}% des Übernachtungspreises: ${huf(amount)} HUF. Bitte sorgen Sie dafür, dass sie bis ${due.date} ${due.time} Uhr (ungarische Zeit) eingeht. Die Buchung wird mit Eingang der Anzahlung verbindlich.${pay?'\n'+pay:'\nÜber die Zahlungsweise informieren wir Sie gesondert.'}`,
   ...(cancel?[`Stornierung\nBei einer Stornierung mindestens ${cancel} Tage vor der Anreise verfällt die Anzahlung nicht.`]:[]),'Mit freundlichen Grüßen\n'+BUSINESS.brandName],
  en:[`${name?`Dear ${name},`:'Dear Guest,'}`,'thank you for your booking; we have recorded it in our system.',
   `Booking\n${dot(values.arrival)} – ${dot(values.departure)}, ${cabin}, ${party}.`,
   `Price\nAccommodation: ${huf(quote.accommodation)} HUF, tourist tax: ${huf(quote.tourismTax)} HUF, total: ${huf(quote.total)} HUF.`,
   `Deposit\nThe deposit is ${policy.depositPct}% of the accommodation price: ${huf(amount)} HUF. Please make sure it arrives by ${due.date} ${due.time} (Hungarian time). The booking becomes final once the deposit has been received.${pay?'\n'+pay:'\nWe will send the payment details separately.'}`,
   ...(cancel?[`Cancellation\nIf you cancel at least ${cancel} days before arrival, the deposit is not forfeited.`]:[]),'Kind regards,\n'+BUSINESS.brandName],
  si:[`${name?`Spoštovani ${name},`:'Spoštovani gost,'}`,'hvala za vašo rezervacijo; zabeležili smo jo v našem sistemu.',
   `Rezervacija\n${dot(values.arrival)} – ${dot(values.departure)}, ${cabin}, ${party}.`,
   `Cena\nNastanitev: ${huf(quote.accommodation)} HUF, turistična taksa: ${huf(quote.tourismTax)} HUF, skupaj: ${huf(quote.total)} HUF.`,
   `Predplačilo\nPredplačilo znaša ${policy.depositPct}% cene nastanitve: ${huf(amount)} HUF. Prosimo, da prispe do ${due.date} ${due.time} (madžarski čas). Rezervacija postane dokončna po prejemu predplačila.${pay?'\n'+pay:'\nO načinu plačila vas obvestimo posebej.'}`,
   ...(cancel?[`Odpoved\nPri odpovedi najmanj ${cancel} dni pred prihodom predplačilo ne zapade.`]:[]),'Lep pozdrav,\n'+BUSINESS.brandName]};
 const text=T[lang].join('\n\n');
 const operatorReviewText=(lang==='hu'?'':T.hu.join('\n\n')+'\n\n')+'Kezelői (a vendég nem látja):\n'+
  `Previo-hivatkozás: ${reference}; rögzítve: ${previo.recordedAt}.\n`+
  `Foglaló: ${policy.depositPct}% × ${huf(quote.accommodation)} Ft = ${huf(amount)} Ft; határidő: ${policy.paymentWindowHours} óra a rögzítéstől (${policy.daysUntilArrival} nap az érkezésig) → ${due.date} ${due.time}.\n`+
  (pay?'':'Teendő: a bankszámlaszámot és a fizetés módját külön üzenetben küldd el a vendégnek (tulajdonosi döntés 2026-11-06: a V1 levél nem tartalmazza).\n')+
  'A Previo-rögzítés nem fizetés: a „Foglaló beérkezett” külön lépés.';
 return {text,operatorReviewText,deposit:{pct:policy.depositPct,amount,receiptDeadlineUtc:policy.receiptDeadlineUtc,windowHours:policy.paymentWindowHours},previo:{reference,recordedAt:previo.recordedAt}};
}
