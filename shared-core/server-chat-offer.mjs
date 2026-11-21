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
import {BUSINESS} from '../business-config.mjs';

const CABINS=['vip','family','deluxe','small','splitA','splitB','splitC'];
const huf=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const dot=d=>d.replaceAll('-','.')+'.';

// The chat's facts (chat-request-client requestFacts) → {input} | {missing:CODE} | null (not a clear stay at all).
// Owner 2026-11-19: when the booking cannot be confirmed, the guest is told exactly what is missing.
export function offerCheck(facts){
 if(!facts||typeof facts!=='object'||Array.isArray(facts))return null;
 const adults=facts.adults,ages=Array.isArray(facts.childAges)?facts.childAges:[],children=Number.isInteger(facts.children)?facts.children:ages.length;
 if(!day(facts.arrival)||!day(facts.departure)||facts.departure<=facts.arrival)return {missing:'DATES'};
 if(!Number.isInteger(adults)||adults<1||adults>12)return {missing:'ADULTS'};
 if(children!==ages.length||ages.some(a=>!Number.isInteger(a)||a<0||a>17))return {missing:'CHILD_AGES'}; // the child price depends on the age
 if(facts.units!==undefined&&facts.units!==1)return {missing:'MULTI_UNIT'}; // several houses: arranged by the team
 const guests=adults+children;
 // Generic "Osztott": the part that fits the party (same rule as the daily view): A/B up to 2, C 3–5.
 const cabin=facts.cabin==='split'?(guests<=2?'splitA':guests<=5?'splitC':'splitC'):facts.cabin;
 if(!CABINS.includes(cabin))return {missing:'CABIN'};
 const max=BUSINESS.accommodationTypes[cabin]?.maxGuests;
 if(Number.isInteger(max)&&guests>max)return {missing:'TOO_MANY',cabin,max};
 return {input:{arrival:facts.arrival,departure:facts.departure,cabin,adults,children:ages}};
}
export function offerInput(facts){return offerCheck(facts)?.input??null;}

const TEXT={
 hu:{alt:list=>`Ugyanerre az időszakra szabad: ${list}. Ha valamelyik megfelel, írja meg a háztípust, és elkészítjük az ajánlatot.`,noAlt:'Erre az időszakra más háztípusban sincs szabad hely. Kérjük, válasszon másik időpontot, vagy elküldhetjük kérését munkatársunknak.',
  missing:{DATES:'A foglalást még nem tudjuk véglegesíteni: kérjük, ellenőrizze a dátumokat (a távozás napja az érkezés után legyen).',ADULTS:'A foglalást még nem tudjuk véglegesíteni: kérjük, írja meg, hány felnőtt érkezik.',CHILD_AGES:'A foglalást még nem tudjuk véglegesíteni, mert hiányzik a gyermek(ek) életkora – a gyermekár életkortól függ. Kérjük, írja meg (pl. „5 és 6 évesek”), majd nyomja meg újra a gombot.',CABIN:'A foglalást még nem tudjuk véglegesíteni: kérjük, írja meg, melyik háztípust választja (VIP, Családi, Deluxe, Különálló 2 fős, Osztott).',TOO_MANY:(c,m)=>`A foglalást így nem tudjuk véglegesíteni: a kért háztípusba (${c}) legfeljebb ${m} fő fér. Kérjük, válasszon nagyobb háztípust, vagy írja meg, ha több házat szeretne.`,MULTI_UNIT:'Több ház foglalását munkatársunk egyezteti Önnel – elküldhetjük kérését.',UNKNOWN:'A szabad helyet most nem tudtuk automatikusan ellenőrizni, ezért a foglalást itt nem lehet véglegesíteni. Elküldhetjük kérését munkatársunknak, aki hamarosan válaszol.'},
  free:(c,a,d,n,p)=>`Jó hír: ${a} – ${d} között (${n} éj, ${p}) a kért háztípusban (${c}) jelenleg van szabad hely.`,
  price:(t,acc,tax)=>`Ár: ${t} Ft (szállásdíj ${acc} Ft + idegenforgalmi adó ${tax} Ft).`,
  deposit:(pct,amt)=>`Foglaló: a szállásdíj ${pct}%-a, ${amt} Ft, banki átutalással; a pontos határidőt a visszaigazolásban küldjük.`,
  cancel:d=>`Lemondás: az érkezés előtt legalább ${d} nappal díjmentes, a foglaló nem vész el.`,
  extra:'A dézsát és más szolgáltatást külön egyeztetjük. Ha Ön visszatérő vendég (2 éven belül járt nálunk), a 20% törzsvendég-kedvezményt a visszaigazolásban érvényesítjük.',
  confirm:'Ha megfelel, nyomja meg a „Foglalás véglegesítése” gombot. Munkatársunk a foglalást rögzíti és e-mailben visszaigazolja.',
  party:(a,c)=>`${a+c} fő: ${a} felnőtt${c?`, ${c} gyermek`:''}`,
  none:(c,a,d)=>`Sajnos ${a} – ${d} között a kért háztípusban (${c}) nincs szabad hely.`},
 de:{alt:list=>`Im selben Zeitraum frei: ${list}. Wenn Ihnen eines passt, schreiben Sie uns den Haustyp, und wir erstellen das Angebot.`,noAlt:'In diesem Zeitraum ist auch kein anderer Haustyp frei. Bitte wählen Sie andere Daten, oder wir senden Ihre Anfrage an unser Team.',
  missing:{DATES:'Die Buchung kann noch nicht abgeschlossen werden: Bitte prüfen Sie die Daten (die Abreise muss nach der Anreise liegen).',ADULTS:'Die Buchung kann noch nicht abgeschlossen werden: Bitte nennen Sie die Zahl der Erwachsenen.',CHILD_AGES:'Die Buchung kann noch nicht abgeschlossen werden, weil das Alter der Kinder fehlt – der Kinderpreis hängt vom Alter ab. Bitte schreiben Sie es (z. B. „5 und 6 Jahre“) und drücken Sie die Schaltfläche erneut.',CABIN:'Die Buchung kann noch nicht abgeschlossen werden: Bitte wählen Sie einen Haustyp (VIP, Familienhaus, Deluxe, freistehendes 2-Personen-Haus, geteiltes Haus).',TOO_MANY:(c,m)=>`So kann die Buchung nicht abgeschlossen werden: In den gewünschten Haustyp (${c}) passen höchstens ${m} Personen. Bitte wählen Sie einen größeren Typ oder schreiben Sie, ob Sie mehrere Häuser möchten.`,MULTI_UNIT:'Die Buchung mehrerer Häuser stimmt unser Team mit Ihnen ab – wir können Ihre Anfrage senden.',UNKNOWN:'Die Verfügbarkeit konnte gerade nicht automatisch geprüft werden, daher kann die Buchung hier nicht abgeschlossen werden. Wir können Ihre Anfrage an unser Team senden.'},
  free:(c,a,d,n,p)=>`Gute Nachricht: ${c} ist vom ${a} bis ${d} (${n} Nächte, ${p}) derzeit frei.`,
  price:(t,acc,tax)=>`Preis: ${t} Ft (Unterkunft ${acc} Ft + Kurtaxe ${tax} Ft).`,
  deposit:(pct,amt)=>`Anzahlung: ${pct}% des Unterkunftspreises, ${amt} Ft, per Banküberweisung; die genaue Frist senden wir mit der Bestätigung.`,
  cancel:d=>`Stornierung: bis ${d} Tage vor Anreise kostenlos, die Anzahlung verfällt nicht.`,
  extra:'Badezuber und weitere Leistungen stimmen wir gesondert ab. Wenn Sie in den letzten 2 Jahren bei uns waren, berücksichtigen wir den Stammgastrabatt von 20% in der Bestätigung.',
  confirm:'Wenn es passt, drücken Sie „Buchung verbindlich abschließen“. Wir erfassen die Buchung und bestätigen sie per E-Mail.',
  party:(a,c)=>`${a+c} Personen: ${a} Erwachsene${c?`, ${c} Kinder`:''}`,
  none:(c,a,d)=>`Leider ist ${c} vom ${a} bis ${d} nicht frei.`},
 en:{alt:list=>`Free for the same dates: ${list}. If one suits you, write the cabin type and we will prepare the offer.`,noAlt:'No other cabin type is free for these dates either. Please choose other dates, or we can send your request to our team.',
  missing:{DATES:'The booking cannot be confirmed yet: please check the dates (departure must be after arrival).',ADULTS:'The booking cannot be confirmed yet: please tell us how many adults are coming.',CHILD_AGES:'The booking cannot be confirmed yet because the children’s ages are missing – the child price depends on age. Please write them (e.g. „5 and 6 years old“) and press the button again.',CABIN:'The booking cannot be confirmed yet: please choose a cabin type (VIP, Family, Deluxe, standalone 2-person, split cabin).',TOO_MANY:(c,m)=>`The booking cannot be confirmed like this: the requested cabin type (${c}) sleeps at most ${m} guests. Please choose a larger type or tell us if you would like several cabins.`,MULTI_UNIT:'Bookings of several cabins are arranged by our team – we can send your request.',UNKNOWN:'We could not check availability automatically right now, so the booking cannot be confirmed here. We can send your request to our team.'},
  free:(c,a,d,n,p)=>`Good news: the ${c} is currently free from ${a} to ${d} (${n} nights, ${p}).`,
  price:(t,acc,tax)=>`Price: ${t} HUF (accommodation ${acc} HUF + tourist tax ${tax} HUF).`,
  deposit:(pct,amt)=>`Deposit: ${pct}% of the accommodation price, ${amt} HUF, by bank transfer; the exact deadline comes with the confirmation.`,
  cancel:d=>`Cancellation: free of charge up to ${d} days before arrival, the deposit is not lost.`,
  extra:'The hot tub and other services are arranged separately. If you stayed with us within the last 2 years, the 20% returning-guest discount is applied in the confirmation.',
  confirm:'If this suits you, press „Confirm booking“. We will record the booking and confirm it by e-mail.',
  party:(a,c)=>`${a+c} guests: ${a} adults${c?`, ${c} children`:''}`,
  none:(c,a,d)=>`Unfortunately the ${c} is not free from ${a} to ${d}.`},
 si:{alt:list=>`Za iste datume je prosto: ${list}. Če vam katera ustreza, napišite vrsto hiške in pripravimo ponudbo.`,noAlt:'Za te datume ni prosta tudi nobena druga vrsta hiške. Prosimo, izberite druge datume ali pa vašo zahtevo pošljemo naši ekipi.',
  missing:{DATES:'Rezervacije še ne moremo dokončati: prosimo, preverite datume (odhod mora biti po prihodu).',ADULTS:'Rezervacije še ne moremo dokončati: prosimo, sporočite število odraslih.',CHILD_AGES:'Rezervacije še ne moremo dokončati, ker manjka starost otrok – cena za otroke je odvisna od starosti. Prosimo, napišite jo (npr. „5 in 6 let“) in ponovno pritisnite gumb.',CABIN:'Rezervacije še ne moremo dokončati: prosimo, izberite vrsto hiške (VIP, družinska, Deluxe, samostojna za 2 osebi, deljena).',TOO_MANY:(c,m)=>`Rezervacije tako ne moremo dokončati: v izbrano vrsto hiške (${c}) gre največ ${m} oseb. Prosimo, izberite večjo vrsto ali nam sporočite, če želite več hišk.`,MULTI_UNIT:'Rezervacijo več hišk uredi naša ekipa – vašo zahtevo lahko pošljemo.',UNKNOWN:'Razpoložljivosti trenutno nismo mogli samodejno preveriti, zato rezervacije tukaj ni mogoče dokončati. Vašo zahtevo lahko pošljemo naši ekipi.'},
  free:(c,a,d,n,p)=>`Dobra novica: ${c} je od ${a} do ${d} (${n} noči, ${p}) trenutno prosta.`,
  price:(t,acc,tax)=>`Cena: ${t} Ft (nastanitev ${acc} Ft + turistična taksa ${tax} Ft).`,
  deposit:(pct,amt)=>`Predplačilo: ${pct}% cene nastanitve, ${amt} Ft, z bančnim nakazilom; točen rok pošljemo s potrditvijo.`,
  cancel:d=>`Odpoved: brezplačno do ${d} dni pred prihodom, predplačilo ni izgubljeno.`,
  extra:'Masažno kad in druge storitve uredimo posebej. Če ste bili pri nas v zadnjih 2 letih, 20% popust za stalne goste upoštevamo v potrditvi.',
  confirm:'Če vam ustreza, pritisnite „Dokončaj rezervacijo“. Rezervacijo bomo zabeležili in potrdili po e-pošti.',
  party:(a,c)=>`${a+c} oseb: ${a} odraslih${c?`, ${c} otrok`:''}`,
  none:(c,a,d)=>`Žal ${c} od ${a} do ${d} ni prosta.`}
};

// → {status:'AVAILABLE',text,total,...} | {status:'UNAVAILABLE',text} | {status:'MISSING',reason,fixable,text}.
// MISSING tells the guest why the booking cannot be confirmed: fixable reasons (dates, ages, type, size) are answered
// in the chat and the same button is pressed again; the others (several houses, unknown read/price) go to the team.
const FIXABLE=['DATES','ADULTS','CHILD_AGES','CABIN','TOO_MANY'];
export async function buildChatOffer({facts,language,capacityFn,quoteFn=fetchPublicPriceReference,cancellationDays=14,now=()=>new Date().toISOString(),alternatives=true}={}){
 const lang=TEXT[language]?language:'hu',t=TEXT[lang],check=offerCheck(facts);
 const missing=(reason,extra)=>({status:'MISSING',reason,fixable:FIXABLE.includes(reason),text:typeof t.missing[reason]==='function'?t.missing[reason](...extra):t.missing[reason]});
 if(!check)return missing('DATES');
 if(check.missing)return missing(check.missing,[CABIN_NAMES[check.cabin]?.[lang]||check.cabin,check.max]);
 const input=check.input;
 if(typeof capacityFn!=='function')return missing('UNKNOWN');
 const cabinName=CABIN_NAMES[input.cabin]?.[lang]||input.cabin;
 let read;try{read=await capacityFn({cabin:input.cabin,arrival:input.arrival,departure:input.departure});}catch{return missing('UNKNOWN');}
 const decision=capacityDecision(read,input.cabin,1);
 if(decision==='UNAVAILABLE'){
  // Owner 2026-11-19: no free cabin of the requested type → offer the free alternatives at once. AGENTS: alternatives
  // only after a VERIFIED "booked" answer; each type gets its own capacity read; unknown reads are left out.
  const guests=input.adults+input.children.length,found=[];
  if(alternatives){
   for(const cabin of ['family','deluxe','vip','small','splitA','splitC']){
    if(cabin===input.cabin||cabin==='splitA'&&input.cabin==='splitB'||!(BUSINESS.accommodationTypes[cabin]?.maxGuests>=guests))continue;
    let r;try{r=await capacityFn({cabin,arrival:input.arrival,departure:input.departure});}catch{continue;}
    if(capacityDecision(r,cabin,1)!=='AVAILABLE')continue;
    let q;try{q=await quoteFn({...input,cabin});}catch{continue;}
    if(q?.status==='public_reference'&&Number.isSafeInteger(q.total)&&q.cabin===cabin)found.push({cabin,name:CABIN_NAMES[cabin]?.[lang]||cabin,total:q.total});
   }
   found.sort((a,b)=>a.total-b.total);
  }
  const top=found.slice(0,3);
  const text=t.none(cabinName,dot(input.arrival),dot(input.departure))+(alternatives?'\n'+(top.length?t.alt(top.map(a=>`${a.name} – ${huf(a.total)} Ft`).join('; ')):t.noAlt):'');
  return {status:'UNAVAILABLE',text,alternatives:top};
 }
 if(decision!=='AVAILABLE')return missing('UNKNOWN');
 let quote;try{quote=await quoteFn(input);}catch{return missing('UNKNOWN');}
 if(quote?.status!=='public_reference'||!Number.isSafeInteger(quote.total)||!Number.isSafeInteger(quote.accommodation)||!Number.isSafeInteger(quote.tourismTax)||quote.cabin!==input.cabin)return missing('UNKNOWN');
 const guests=input.adults+input.children.length;
 const policy=depositReceiptDeadline({guestCount:guests,bookingAt:now(),arrivalDate:input.arrival});
 if(policy?.status!=='calculated')return missing('UNKNOWN');
 const deposit=Math.round(quote.accommodation*policy.depositPct/100);
 const nights=Math.round((Date.parse(input.departure)-Date.parse(input.arrival))/86400000);
 const text=[t.free(cabinName,dot(input.arrival),dot(input.departure),nights,t.party(input.adults,input.children.length)),
  t.price(huf(quote.total),huf(quote.accommodation),huf(quote.tourismTax)),t.deposit(policy.depositPct,huf(deposit)),t.cancel(cancellationDays),t.extra,t.confirm].join('\n');
 return {status:'AVAILABLE',text,cabin:input.cabin,arrival:input.arrival,departure:input.departure,total:quote.total,accommodation:quote.accommodation,tourismTax:quote.tourismTax,depositPct:policy.depositPct,deposit,checkedAt:now()};
}
