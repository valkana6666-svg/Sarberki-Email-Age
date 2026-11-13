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
const nightsBetween=(a,d)=>Math.round((Date.parse(d+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000);
const WEEKDAYS={hu:['vasárnap','hétfő','kedd','szerda','csütörtök','péntek','szombat'],de:['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'],
 en:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],si:['nedelja','ponedeljek','torek','sreda','četrtek','petek','sobota']};
const weekday=(d,lang)=>WEEKDAYS[lang][new Date(d+'T12:00:00Z').getUTCDay()];
const site=url=>String(url||'').replace(/^https?:\/\//,'').replace(/\/.*$/,'');

// Plain-text voucher block appended to the V2 confirmation letter. Pure; every value comes from the approved config
// or from this booking's own server-checked facts.
export function buildVoucherBlock({lang,bookingNumber,name,values,cabin,party,quote,amount,due,ops=BUSINESS.operationalRules,brand=BUSINESS.brandName,url=BUSINESS.bookingUrl}){
 const n=nightsBetween(values.arrival,values.departure);
 const L={
  hu:{t:'VOUCHER',no:'Voucherszám',h:'Szálláshely',g:'Vendég',a:'Érkezés',d:'Távozás',inn:`bejelentkezés ${ops.checkinFrom}-tól`,out:`kijelentkezés ${ops.checkoutBy}-ig`,
   n:'Éjszakák',c:'Szállás',p:'Vendégek',tot:'Összesen',totx:`szállásdíj ${huf(quote.accommodation)} Ft + idegenforgalmi adó ${huf(quote.tourismTax)} Ft`,cur:'Ft',
   dep:'Foglaló',depx:`határidő: ${due.date} ${due.time} (magyarországi idő)`,s:'Állapot',sx:'rögzítve; a foglaló beérkezése után végleges',f:'Kérjük, érkezéskor mutassa be ezt a vouchert (nyomtatva vagy telefonon).'},
  de:{t:'VOUCHER',no:'Vouchernummer',h:'Unterkunft',g:'Gast',a:'Anreise',d:'Abreise',inn:`Check-in ab ${ops.checkinFrom} Uhr`,out:`Check-out bis ${ops.checkoutBy} Uhr`,
   n:'Nächte',c:'Unterkunftsart',p:'Gäste',tot:'Gesamt',totx:`Übernachtung ${huf(quote.accommodation)} HUF + Kurtaxe ${huf(quote.tourismTax)} HUF`,cur:'HUF',
   dep:'Anzahlung',depx:`fällig bis ${due.date} ${due.time} (ungarische Zeit)`,s:'Status',sx:'erfasst; verbindlich nach Eingang der Anzahlung',f:'Bitte zeigen Sie diesen Voucher bei der Anreise vor (ausgedruckt oder auf dem Handy).'},
  en:{t:'VOUCHER',no:'Voucher number',h:'Property',g:'Guest',a:'Arrival',d:'Departure',inn:`check-in from ${ops.checkinFrom}`,out:`check-out by ${ops.checkoutBy}`,
   n:'Nights',c:'Accommodation',p:'Guests',tot:'Total',totx:`accommodation ${huf(quote.accommodation)} HUF + tourist tax ${huf(quote.tourismTax)} HUF`,cur:'HUF',
   dep:'Deposit',depx:`due by ${due.date} ${due.time} (Hungarian time)`,s:'Status',sx:'recorded; final once the deposit has been received',f:'Please show this voucher on arrival (printed or on your phone).'},
  si:{t:'VAVČER',no:'Številka vavčerja',h:'Nastanitev',g:'Gost',a:'Prihod',d:'Odhod',inn:`prijava od ${ops.checkinFrom}`,out:`odjava do ${ops.checkoutBy}`,
   n:'Noči',c:'Namestitev',p:'Gostje',tot:'Skupaj',totx:`nastanitev ${huf(quote.accommodation)} HUF + turistična taksa ${huf(quote.tourismTax)} HUF`,cur:'HUF',
   dep:'Predplačilo',depx:`rok: ${due.date} ${due.time} (madžarski čas)`,s:'Stanje',sx:'zabeleženo; dokončno po prejemu predplačila',f:'Prosimo, ob prihodu pokažite ta vavčer (natisnjen ali na telefonu).'}}[lang];
 const line='━'.repeat(28);
 return [line,L.t,line,
  `${L.no}: ${bookingNumber}`,`${L.h}: ${brand}${site(url)?` (${site(url)})`:''}`,...(name?[`${L.g}: ${name}`]:[]),
  `${L.a}: ${dot(values.arrival)} (${weekday(values.arrival,lang)}), ${L.inn}`,`${L.d}: ${dot(values.departure)} (${weekday(values.departure,lang)}), ${L.out}`,
  `${L.n}: ${n}`,`${L.c}: ${cabin}`,`${L.p}: ${party}`,`${L.tot}: ${huf(quote.total)} ${L.cur} (${L.totx})`,`${L.dep}: ${huf(amount)} ${L.cur}, ${L.depx}`,
  `${L.s}: ${L.sx}`,line,L.f].join('\n');
}

// Pure: facts + server-computed quote + operator-attested Previo recording -> confirmation text and deposit.
// bookingNumber (optional, V2 owner/ChatGPT 2026-11-11): the Previo voucher number of this very reservation (the
// SC-… value Previo stores and prints on its own voucher). Shown to the guest; the internal resId never is.
export function buildBookingConfirmation({values,quote,previo,language,bookingNumber=null,modified=false,rules=BUSINESS.bookingRules,paymentInstructions=BUSINESS.paymentInstructions}={}){
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
 const cabinName=CABIN_NAMES[quote.cabin]?.[lang]||String(values.unit||quote.cabin||'');
 // Multi-unit booking (V2, owner 2026-11-11): the guest sees how many houses, e.g. "2 × Családi"; never the house numbers.
 const cabin=Number.isInteger(quote.units)&&quote.units>1?`${quote.units} × ${cabinName}`:cabinName;
 if(bookingNumber!==null&&!/^SC-[0-9A-F]{16}$/.test(String(bookingNumber)))fail('BOOKING_NUMBER_INVALID');
 const num=bookingNumber?{hu:`\nFoglalási szám: ${bookingNumber}`,de:`\nBuchungsnummer: ${bookingNumber}`,en:`\nBooking number: ${bookingNumber}`,si:`\nŠtevilka rezervacije: ${bookingNumber}`}:{hu:'',de:'',en:'',si:''};
 const name=typeof values?.name==='string'&&values.name.trim()?values.name.trim():null;
 const cancelDays=Number(rules.cancellationDaysUnder15Guests);
 const cancel=Number.isFinite(cancelDays)&&cancelDays>0&&cancelDays===Number(rules.cancellationDaysFrom15Guests)?cancelDays:null;
 const pay=paymentInstructions?.[lang]||null;
 const party={hu:`${guests} fő (${adults} felnőtt${children?`, ${children} gyermek`:''})`,de:`${guests} Personen (${adults} Erwachsene${children?`, ${children} Kinder`:''})`,
  en:`${guests} guests (${adults} adults${children?`, ${children} children`:''})`,si:`${guests} oseb (${adults} odraslih${children?`, ${children} otrok`:''})`}[lang];
 const T={
  hu:[`${name?`Kedves ${name}!`:'Kedves Vendégünk!'}`,modified?'Foglalását kérésének megfelelően módosítottuk; az alábbi adatok érvényesek.':'Köszönjük foglalását, rendszerünkben rögzítettük.',
   `Foglalás\n${dot(values.arrival)} – ${dot(values.departure)}, ${cabin}, ${party}.${num.hu}`,
   `Ár\nSzállásdíj: ${huf(quote.accommodation)} Ft, idegenforgalmi adó: ${huf(quote.tourismTax)} Ft, összesen: ${huf(quote.total)} Ft.`,
   `Foglaló\nA foglaló a szállásdíj ${policy.depositPct}%-a: ${huf(amount)} Ft. Kérjük, hogy ${due.date} ${due.time}-ig (magyarországi idő) érkezzen meg. A foglalás a foglaló beérkezése után válik véglegessé.${pay?'\n'+pay:'\nA fizetés módjáról külön tájékoztatjuk.'}`,
   ...(cancel?[`Lemondás\nAz érkezés előtt legalább ${cancel} nappal történő lemondásnál a foglaló nem vész el.`]:[]),'Üdvözlettel:\n'+BUSINESS.brandName],
  de:[`${name?`Liebe/r ${name},`:'Liebe Gäste,'}`,modified?'wir haben Ihre Buchung wunschgemäß geändert; es gelten die folgenden Angaben.':'vielen Dank für Ihre Buchung, wir haben sie in unserem System erfasst.',
   `Buchung\n${dot(values.arrival)} – ${dot(values.departure)}, ${cabin}, ${party}.${num.de}`,
   `Preis\nÜbernachtung: ${huf(quote.accommodation)} HUF, Kurtaxe: ${huf(quote.tourismTax)} HUF, gesamt: ${huf(quote.total)} HUF.`,
   `Anzahlung\nDie Anzahlung beträgt ${policy.depositPct}% des Übernachtungspreises: ${huf(amount)} HUF. Bitte sorgen Sie dafür, dass sie bis ${due.date} ${due.time} Uhr (ungarische Zeit) eingeht. Die Buchung wird mit Eingang der Anzahlung verbindlich.${pay?'\n'+pay:'\nÜber die Zahlungsweise informieren wir Sie gesondert.'}`,
   ...(cancel?[`Stornierung\nBei einer Stornierung mindestens ${cancel} Tage vor der Anreise verfällt die Anzahlung nicht.`]:[]),'Mit freundlichen Grüßen\n'+BUSINESS.brandName],
  en:[`${name?`Dear ${name},`:'Dear Guest,'}`,modified?'we have changed your booking as requested; the details below apply.':'thank you for your booking; we have recorded it in our system.',
   `Booking\n${dot(values.arrival)} – ${dot(values.departure)}, ${cabin}, ${party}.${num.en}`,
   `Price\nAccommodation: ${huf(quote.accommodation)} HUF, tourist tax: ${huf(quote.tourismTax)} HUF, total: ${huf(quote.total)} HUF.`,
   `Deposit\nThe deposit is ${policy.depositPct}% of the accommodation price: ${huf(amount)} HUF. Please make sure it arrives by ${due.date} ${due.time} (Hungarian time). The booking becomes final once the deposit has been received.${pay?'\n'+pay:'\nWe will send the payment details separately.'}`,
   ...(cancel?[`Cancellation\nIf you cancel at least ${cancel} days before arrival, the deposit is not forfeited.`]:[]),'Kind regards,\n'+BUSINESS.brandName],
  si:[`${name?`Spoštovani ${name},`:'Spoštovani gost,'}`,modified?'vašo rezervacijo smo spremenili po vaši želji; veljajo spodnji podatki.':'hvala za vašo rezervacijo; zabeležili smo jo v našem sistemu.',
   `Rezervacija\n${dot(values.arrival)} – ${dot(values.departure)}, ${cabin}, ${party}.${num.si}`,
   `Cena\nNastanitev: ${huf(quote.accommodation)} HUF, turistična taksa: ${huf(quote.tourismTax)} HUF, skupaj: ${huf(quote.total)} HUF.`,
   `Predplačilo\nPredplačilo znaša ${policy.depositPct}% cene nastanitve: ${huf(amount)} HUF. Prosimo, da prispe do ${due.date} ${due.time} (madžarski čas). Rezervacija postane dokončna po prejemu predplačila.${pay?'\n'+pay:'\nO načinu plačila vas obvestimo posebej.'}`,
   ...(cancel?[`Odpoved\nPri odpovedi najmanj ${cancel} dni pred prihodom predplačilo ne zapade.`]:[]),'Lep pozdrav,\n'+BUSINESS.brandName]};
 // Voucher (owner 2026-11-13: "a voucher is küldjük ki", modelled on a hotel voucher). Only for a V2 booking with a
 // Previo voucher number; only approved facts (config + this booking); no house number, no internal reference.
 const voucher=bookingNumber?buildVoucherBlock({lang,bookingNumber,name,values,cabin,party,quote,amount,due}):null;
 const text=T[lang].join('\n\n')+(voucher?'\n\n'+voucher:'');
 const operatorReviewText=(lang==='hu'?'':T.hu.join('\n\n')+'\n\n')+'Kezelői (a vendég nem látja):\n'+
  `Previo-hivatkozás: ${reference}; rögzítve: ${previo.recordedAt}.\n`+(bookingNumber?`Previo-voucherszám (a vendég látja, a Previo saját voucherén is ez áll): ${bookingNumber}.\n`:'')+
  `Foglaló: ${policy.depositPct}% × ${huf(quote.accommodation)} Ft = ${huf(amount)} Ft; határidő: ${policy.paymentWindowHours} óra a rögzítéstől (${policy.daysUntilArrival} nap az érkezésig) → ${due.date} ${due.time}.\n`+
  (pay?'':'Teendő: a bankszámlaszámot és a fizetés módját külön üzenetben küldd el a vendégnek (tulajdonosi döntés 2026-11-06: a V1 levél nem tartalmazza).\n')+
  'A Previo-rögzítés nem fizetés: a „Foglaló beérkezett” külön lépés.';
 return {text,operatorReviewText,deposit:{pct:policy.depositPct,amount,receiptDeadlineUtc:policy.receiptDeadlineUtc,windowHours:policy.paymentWindowHours},previo:{reference,recordedAt:previo.recordedAt}};
}
