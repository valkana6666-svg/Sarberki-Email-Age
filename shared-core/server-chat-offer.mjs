// Chat two-step booking (owner 2026-11-19): 1) „Foglalási igény elküldése” → the chat answers with the checked free
// cabin and the price; 2) „Foglalás véglegesítése” → the request reaches the daily view as a booking the guest has
// accepted. This module builds step 1: one single-unit stay, the free count read-only from Previo TEST (73521, the
// existing read and switch) and the price-list price (the same calculator as the daily view). Nothing is stored,
// booked or sent here. Unknown/failed read → no offer (the request goes to the team as before); a free count is a
// snapshot, the operator's one-click step reads Previo again before writing.
import {fetchPublicPriceReference} from '../price-source/public-price-fallback.mjs';
import {capacityDecision} from './server-previo-rest-read.mjs';
import {CABIN_NAMES} from './price-insert-sentence.mjs';
import {depositReceiptDeadline} from '../sarberki-core.mjs';

const CABINS=['vip','family','deluxe','small','splitA','splitB','splitC'];
const huf=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const dot=d=>d.replaceAll('-','.')+'.';

// The chat's facts (chat-request-client requestFacts) → calculator input, or null when not a clear single-unit stay.
export function offerInput(facts){
 if(!facts||typeof facts!=='object'||Array.isArray(facts))return null;
 const adults=facts.adults,ages=Array.isArray(facts.childAges)?facts.childAges:[],children=Number.isInteger(facts.children)?facts.children:ages.length;
 if(!day(facts.arrival)||!day(facts.departure)||facts.departure<=facts.arrival||!Number.isInteger(adults)||adults<1||adults>12)return null;
 if(children!==ages.length||ages.some(a=>!Number.isInteger(a)||a<0||a>17))return null; // every child's age is needed for the price
 if(facts.units!==undefined&&facts.units!==1)return null; // multi-unit requests stay with the team
 const guests=adults+children;
 // Generic "Osztott": the part that fits the party (same rule as the daily view): A/B up to 2, C 3–5.
 const cabin=facts.cabin==='split'?(guests<=2?'splitA':guests<=5?'splitC':null):facts.cabin;
 if(!CABINS.includes(cabin))return null;
 return {arrival:facts.arrival,departure:facts.departure,cabin,adults,children:ages};
}

const TEXT={
 hu:{free:(c,a,d,n,p)=>`Jó hír: a(z) ${c} ${a} – ${d} között (${n} éj, ${p}) jelenleg szabad.`,
  price:(t,acc,tax)=>`Ár: ${t} Ft (szállásdíj ${acc} Ft + idegenforgalmi adó ${tax} Ft).`,
  deposit:(pct,amt)=>`Foglaló: a szállásdíj ${pct}%-a, ${amt} Ft, banki átutalással; a pontos határidőt a visszaigazolásban küldjük.`,
  cancel:d=>`Lemondás: az érkezés előtt legalább ${d} nappal díjmentes, a foglaló nem vész el.`,
  extra:'A dézsát és más szolgáltatást külön egyeztetjük.',
  confirm:'Ha megfelel, nyomja meg a „Foglalás véglegesítése” gombot. Munkatársunk a foglalást rögzíti és e-mailben visszaigazolja.',
  party:(a,c)=>`${a+c} fő: ${a} felnőtt${c?`, ${c} gyermek`:''}`,
  none:(c,a,d)=>`Sajnos a(z) ${c} ${a} – ${d} között nem szabad. Elküldhetjük kérését munkatársunknak, aki más időpontot vagy háztípust ajánl.`},
 de:{free:(c,a,d,n,p)=>`Gute Nachricht: ${c} ist vom ${a} bis ${d} (${n} Nächte, ${p}) derzeit frei.`,
  price:(t,acc,tax)=>`Preis: ${t} Ft (Unterkunft ${acc} Ft + Kurtaxe ${tax} Ft).`,
  deposit:(pct,amt)=>`Anzahlung: ${pct}% des Unterkunftspreises, ${amt} Ft, per Banküberweisung; die genaue Frist senden wir mit der Bestätigung.`,
  cancel:d=>`Stornierung: bis ${d} Tage vor Anreise kostenlos, die Anzahlung verfällt nicht.`,
  extra:'Badezuber und weitere Leistungen stimmen wir gesondert ab.',
  confirm:'Wenn es passt, drücken Sie „Buchung verbindlich abschließen“. Wir erfassen die Buchung und bestätigen sie per E-Mail.',
  party:(a,c)=>`${a+c} Personen: ${a} Erwachsene${c?`, ${c} Kinder`:''}`,
  none:(c,a,d)=>`Leider ist ${c} vom ${a} bis ${d} nicht frei. Wir können Ihre Anfrage an unser Team senden, das Ihnen eine Alternative anbietet.`},
 en:{free:(c,a,d,n,p)=>`Good news: the ${c} is currently free from ${a} to ${d} (${n} nights, ${p}).`,
  price:(t,acc,tax)=>`Price: ${t} HUF (accommodation ${acc} HUF + tourist tax ${tax} HUF).`,
  deposit:(pct,amt)=>`Deposit: ${pct}% of the accommodation price, ${amt} HUF, by bank transfer; the exact deadline comes with the confirmation.`,
  cancel:d=>`Cancellation: free of charge up to ${d} days before arrival, the deposit is not lost.`,
  extra:'The hot tub and other services are arranged separately.',
  confirm:'If this suits you, press „Confirm booking“. We will record the booking and confirm it by e-mail.',
  party:(a,c)=>`${a+c} guests: ${a} adults${c?`, ${c} children`:''}`,
  none:(c,a,d)=>`Unfortunately the ${c} is not free from ${a} to ${d}. We can send your request to our team, who will offer an alternative.`},
 si:{free:(c,a,d,n,p)=>`Dobra novica: ${c} je od ${a} do ${d} (${n} noči, ${p}) trenutno prosta.`,
  price:(t,acc,tax)=>`Cena: ${t} Ft (nastanitev ${acc} Ft + turistična taksa ${tax} Ft).`,
  deposit:(pct,amt)=>`Predplačilo: ${pct}% cene nastanitve, ${amt} Ft, z bančnim nakazilom; točen rok pošljemo s potrditvijo.`,
  cancel:d=>`Odpoved: brezplačno do ${d} dni pred prihodom, predplačilo ni izgubljeno.`,
  extra:'Masažno kad in druge storitve uredimo posebej.',
  confirm:'Če vam ustreza, pritisnite „Dokončaj rezervacijo“. Rezervacijo bomo zabeležili in potrdili po e-pošti.',
  party:(a,c)=>`${a+c} oseb: ${a} odraslih${c?`, ${c} otrok`:''}`,
  none:(c,a,d)=>`Žal ${c} od ${a} do ${d} ni prosta. Vašo zahtevo lahko pošljemo naši ekipi, ki vam bo ponudila drugo možnost.`}
};

// → {status:'AVAILABLE',text,total,...} | {status:'UNAVAILABLE',text} | null (unknown: no offer, the team decides).
export async function buildChatOffer({facts,language,capacityFn,quoteFn=fetchPublicPriceReference,cancellationDays=14,now=()=>new Date().toISOString()}={}){
 const lang=TEXT[language]?language:'hu',t=TEXT[lang],input=offerInput(facts);
 if(!input||typeof capacityFn!=='function')return null;
 const cabinName=CABIN_NAMES[input.cabin]?.[lang]||input.cabin;
 let read;try{read=await capacityFn({cabin:input.cabin,arrival:input.arrival,departure:input.departure});}catch{return null;}
 const decision=capacityDecision(read,input.cabin,1);
 if(decision==='UNAVAILABLE')return {status:'UNAVAILABLE',text:t.none(cabinName,dot(input.arrival),dot(input.departure))};
 if(decision!=='AVAILABLE')return null;
 let quote;try{quote=await quoteFn(input);}catch{return null;}
 if(quote?.status!=='public_reference'||!Number.isSafeInteger(quote.total)||!Number.isSafeInteger(quote.accommodation)||!Number.isSafeInteger(quote.tourismTax)||quote.cabin!==input.cabin)return null;
 const guests=input.adults+input.children.length;
 const policy=depositReceiptDeadline({guestCount:guests,bookingAt:now(),arrivalDate:input.arrival});
 if(policy?.status!=='calculated')return null;
 const deposit=Math.round(quote.accommodation*policy.depositPct/100);
 const nights=Math.round((Date.parse(input.departure)-Date.parse(input.arrival))/86400000);
 const text=[t.free(cabinName,dot(input.arrival),dot(input.departure),nights,t.party(input.adults,input.children.length)),
  t.price(huf(quote.total),huf(quote.accommodation),huf(quote.tourismTax)),t.deposit(policy.depositPct,huf(deposit)),t.cancel(cancellationDays),t.extra,t.confirm].join('\n');
 return {status:'AVAILABLE',text,cabin:input.cabin,arrival:input.arrival,departure:input.departure,total:quote.total,accommodation:quote.accommodation,tourismTax:quote.tourismTax,depositPct:policy.depositPct,deposit,checkedAt:now()};
}
