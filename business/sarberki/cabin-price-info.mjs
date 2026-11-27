// Owner 2026-11-27: „Mennyibe kerül a Deluxe faház?” without dates gets the price itself – the nightly base price up to
// the included guests and the per-guest extra above it, for every cabin type, in HU/DE/EN/SI. Every number comes from
// the signed 2027 tariff (tariffs.mjs) and the existing pricing rules (business-config.mjs); nothing new is decided
// here. The exact total (season, one-night surcharge, children, tourist tax) is still computed from the dates.
import {BUSINESS} from '../../business-config.mjs';
import {SARBERKI_TARIFF_2027 as T} from './tariffs.mjs';

const RULES=BUSINESS.pricingRules;
const ORDER=['deluxe','vip','family','splitC','splitA','small'];   // splitB = splitA (same price, same size)
const NAMES={
 hu:{deluxe:'Deluxe faház',vip:'VIP faház',family:'Családi faház',splitC:'Osztott apartman (4 fős)',splitA:'Osztott apartman (2 fős)',small:'Különálló 2 fős ház'},
 de:{deluxe:'Deluxe-Haus',vip:'VIP-Haus',family:'Familienhaus',splitC:'Apartment (für 4)',splitA:'Apartment (für 2)',small:'Separates Haus für 2'},
 en:{deluxe:'Deluxe cabin',vip:'VIP cabin',family:'Family cabin',splitC:'Apartment (for 4)',splitA:'Apartment (for 2)',small:'Separate cabin for 2'},
 si:{deluxe:'Hiška Deluxe',vip:'Hiška VIP',family:'Družinska hiška',splitC:'Apartma (za 4)',splitA:'Apartma (za 2)',small:'Samostojna hiška za 2'}};
const ft=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ');

// Which cabin type a question names (null = none or several).
export function cabinInQuestion(text){
 const t=String(text||'').toLowerCase();
 const hits=[
  [/delux/u,'deluxe'],[/(?<!\p{L})vip(?!\p{L})/u,'vip'],[/családi|csaladi|family|familien|družinsk|druzinsk/u,'family'],
  [/apartman|apartment|apartma|osztott|wohnung/u,'apart'],[/különálló|kulonallo|2 fős ház|separate/u,'small']].filter(([re])=>re.test(t)).map(([,k])=>k);
 return hits.length===1?hits[0]:null;
}

// The price answer for a question without dates: one cabin type (or the apartments), or every type.
const EXTRA={hu:x=>`Minden további felnőtt plusz ${x} forint éjszakánként.`,de:x=>`Jeder weitere Erwachsene plus ${x} Forint pro Nacht.`,en:x=>`Each additional adult plus ${x} forints per night.`,si:x=>`Vsak dodatni odrasli plus ${x} forintov na noč.`};
const VARY_SHORT={hu:'A végső ár a létszámtól és a szezontól függően változhat.',de:'Der Endpreis hängt von Personenzahl und Saison ab.',en:'The final price depends on the number of guests and the season.',si:'Končna cena je odvisna od števila oseb in sezone.'};
const ASK={hu:'A pontos árhoz kérem, mondja meg az érkezés és távozás dátumát és a létszámot.',de:'Für den genauen Preis nennen Sie mir bitte An- und Abreise und die Personenzahl.',
 en:'For the exact price, please tell me your arrival and departure dates and the number of guests.',si:'Za točno ceno mi prosim povejte datum prihoda in odhoda ter število oseb.'};
export function cabinPriceInfo(text,language='hu',{short=false}={}){
 const lang=NAMES[language]?language:'hu',k=cabinInQuestion(text);
 const keys=k==='apart'?['splitC','splitA']:k?[k]:ORDER;
 if(short){
  // Phone (owner 2026-11-25/27): as little as needed. One type: its base price, the guests it covers, the maximum.
  // No type named: the three cabin types grouped by price and the apartments' lowest price.
  const P=x=>String(T.rates[x].nightlyHuf),G=x=>T.rates[x].includedGuests,MX=x=>{const t=BUSINESS.accommodationTypes[x];return t.maxGuests??t.capacity;};
  let head;
  if(k&&k!=='apart')head={hu:`A ${NAMES.hu[k]} alapára ${P(k)} forint éjszakánként, ${G(k)} főre; legfeljebb ${MX(k)} fő fér el.`,
   de:`Der Grundpreis für ${NAMES.de[k]} beträgt ${P(k)} Forint pro Nacht für ${G(k)} Personen, höchstens ${MX(k)} Personen.`,
   en:`The base price of the ${NAMES.en[k]} is ${P(k)} forints per night for ${G(k)} guests, at most ${MX(k)} guests.`,
   si:`Osnovna cena za ${NAMES.si[k]} je ${P(k)} forintov na noč za ${G(k)} osebe, največ ${MX(k)} oseb.`}[lang];
  else if(k==='apart')head={hu:`Az apartman alapára ${P('splitA')} forint éjszakánként 2 főre, a 4 fős apartmané ${P('splitC')} forint.`,
   de:`Das Apartment kostet ${P('splitA')} Forint pro Nacht für 2 Personen, das Apartment für 4 ${P('splitC')} Forint.`,
   en:`The apartment is ${P('splitA')} forints per night for 2 guests, the apartment for 4 is ${P('splitC')} forints.`,
   si:`Apartma stane ${P('splitA')} forintov na noč za 2 osebi, apartma za 4 ${P('splitC')} forintov.`}[lang];
  else head={hu:`A faházak alapára éjszakánként, négy főre: Deluxe és VIP ${P('deluxe')} forint, Családi ${P('family')} forint; apartman és kisebb ház ${P('splitA')} forinttól.`,
   de:`Grundpreise pro Nacht für 4 Personen: Deluxe und VIP ${P('deluxe')} Forint, Familienhaus ${P('family')} Forint; Apartments und kleinere Häuser ab ${P('splitA')} Forint.`,
   en:`Base prices per night for 4 guests: Deluxe and VIP ${P('deluxe')} forints, Family ${P('family')} forints; apartments and smaller cabins from ${P('splitA')} forints.`,
   si:`Osnovne cene na noč za 4 osebe: Deluxe in VIP ${P('deluxe')} forintov, družinska hiška ${P('family')} forintov; apartmaji in manjše hiške od ${P('splitA')} forintov.`}[lang];
  const extra=(k==='apart'||k==='small')?'':EXTRA[lang](String(T.extraAdultNightlyHuf));
  return [head,extra,VARY_SHORT[lang],ASK[lang]].filter(Boolean).join(' ');
 }
 return prose(keys,lang);
}

// Owner 2026-11-27: a plain question about a cabin's price (no dates) gets a few sentences: the base price and the
// guests it covers, then what can change it (guests, season, one night, tourist tax), then that the exact price comes
// with the dates and the number of guests. Every number from the signed 2027 tariff and the pricing rules.
function prose(keys,lang){
 const g=x=>T.rates[x].includedGuests,m=x=>{const t=BUSINESS.accommodationTypes[x];return t.maxGuests??t.capacity;},p=x=>ft(T.rates[x].nightlyHuf),n=x=>NAMES[lang][x];
 const c=ft(T.child3to8NightlyHuf),xa=ft(T.extraAdultNightlyHuf),hp=RULES.highSeasonSurchargePct,op=RULES.oneNightSurchargePct,ifa=ft(RULES.tourismTaxAdultNightlyHuf);
 const [hs,he]=[T.highSeasonStart,T.highSeasonEnd].map(v=>v.split('-').map(Number));
 const one=keys.length===1;
 const base={
  hu:one?`A ${n(keys[0])} alapára ${p(keys[0])} Ft/éj, ez ${g(keys[0])} főre vonatkozik (legfeljebb ${m(keys[0])} fő fér el).`
   :'Alapáraink éjszakánként: '+keys.map(x=>`${n(x)} ${p(x)} Ft (${g(x)} főre, legfeljebb ${m(x)} fő)`).join(', ')+'.',
  de:one?`Der Grundpreis für ${n(keys[0])} beträgt ${p(keys[0])} Ft/Nacht für ${g(keys[0])} Personen (höchstens ${m(keys[0])} Personen).`
   :'Unsere Grundpreise pro Nacht: '+keys.map(x=>`${n(x)} ${p(x)} Ft (für ${g(x)} Personen, höchstens ${m(x)})`).join(', ')+'.',
  en:one?`The base price of the ${n(keys[0])} is ${p(keys[0])} HUF/night for ${g(keys[0])} guests (at most ${m(keys[0])} guests).`
   :'Our base prices per night: '+keys.map(x=>`${n(x)} ${p(x)} HUF (for ${g(x)} guests, at most ${m(x)})`).join(', ')+'.',
  si:one?`Osnovna cena za ${n(keys[0])} je ${p(keys[0])} Ft/noč za ${g(keys[0])} osebe (največ ${m(keys[0])} oseb).`
   :'Naše osnovne cene na noč: '+keys.map(x=>`${n(x)} ${p(x)} Ft (za ${g(x)} osebe, največ ${m(x)})`).join(', ')+'.'}[lang];
 const M={hu:['január','február','március','április','május','június','július','augusztus','szeptember','október','november','december'],
  de:['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'],
  en:['January','February','March','April','May','June','July','August','September','October','November','December'],
  si:['januarja','februarja','marca','aprila','maja','junija','julija','avgusta','septembra','oktobra','novembra','decembra']}[lang];
 const vary={
  hu:`A végső ár a létszámtól és az időponttól függően változhat: minden további felnőtt +${xa} Ft/éj, gyermek 3 éves kortól +${c} Ft/éj (3 év alatt ingyenes); nyári főszezonban (${M[hs[0]-1]} ${hs[1]}. – ${M[he[0]-1]} ${he[1]}.) +${hp}%, egyetlen éjszakára +${op}%, ezen felül idegenforgalmi adó ${ifa} Ft/felnőtt/éj.`,
  de:`Der Endpreis hängt von Personenzahl und Termin ab: jeder weitere Erwachsene +${xa} Ft/Nacht, Kinder ab 3 Jahren +${c} Ft/Nacht (unter 3 kostenlos); in der Hauptsaison (${hs[1]}. ${M[hs[0]-1]} – ${he[1]}. ${M[he[0]-1]}) +${hp}%, für eine einzige Nacht +${op}%, dazu Kurtaxe ${ifa} Ft/Erwachsener/Nacht.`,
  en:`The final price depends on the number of guests and the dates: each additional adult +${xa} HUF/night, children from age 3 +${c} HUF/night (under 3 free); in the summer high season (${M[hs[0]-1]} ${hs[1]} – ${M[he[0]-1]} ${he[1]}) +${hp}%, a single night +${op}%, plus tourist tax ${ifa} HUF/adult/night.`,
  si:`Končna cena je odvisna od števila oseb in termina: vsak dodatni odrasli +${xa} Ft/noč, otroci od 3. leta +${c} Ft/noč (do 3 let brezplačno); v poletni sezoni (${hs[1]}. ${M[hs[0]-1]} – ${he[1]}. ${M[he[0]-1]}) +${hp}%, za eno samo noč +${op}%, poleg tega turistična taksa ${ifa} Ft/odraslo osebo/noč.`}[lang];
 const exact={hu:'Ha megírja az érkezés és távozás dátumát, valamint a felnőttek és gyermekek számát, pontos árajánlatot adunk.',
  de:'Wenn Sie uns An- und Abreise sowie die Zahl der Erwachsenen und Kinder nennen, erhalten Sie ein genaues Angebot.',
  en:'If you tell us your arrival and departure dates and the number of adults and children, we will give you an exact quote.',
  si:'Če nam sporočite datum prihoda in odhoda ter število odraslih in otrok, vam pripravimo točno ponudbo.'}[lang];
 return [base,vary,exact].join(' ');
}
