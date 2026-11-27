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

function line(key,lang){
 const r=T.rates[key],type=BUSINESS.accommodationTypes[key],max=type.maxGuests??type.capacity,n=NAMES[lang][key];
 const extraAdult=type.extraAdultPricing==='standard'&&max>r.includedGuests;
 const extraChild=!extraAdult&&max>r.includedGuests;   // the extra bed is for a child only
 const L={
  hu:()=>`${n}: ${ft(r.nightlyHuf)} Ft/éj ${r.includedGuests} főig`+(extraAdult?`, minden további felnőtt +${ft(T.extraAdultNightlyHuf)} Ft/éj`:extraChild?`, a ${max}. ágy csak gyermeknek (+${ft(T.child3to8NightlyHuf)} Ft/éj)`:'')+`, legfeljebb ${max} fő.`,
  de:()=>`${n}: ${ft(r.nightlyHuf)} Ft/Nacht bis ${r.includedGuests} Personen`+(extraAdult?`, jeder weitere Erwachsene +${ft(T.extraAdultNightlyHuf)} Ft/Nacht`:extraChild?`, das ${max}. Bett nur für ein Kind (+${ft(T.child3to8NightlyHuf)} Ft/Nacht)`:'')+`, höchstens ${max} Personen.`,
  en:()=>`${n}: ${ft(r.nightlyHuf)} HUF/night for up to ${r.includedGuests} guests`+(extraAdult?`, each additional adult +${ft(T.extraAdultNightlyHuf)} HUF/night`:extraChild?`, the ${max}rd bed for a child only (+${ft(T.child3to8NightlyHuf)} HUF/night)`:'')+`, at most ${max} guests.`,
  si:()=>`${n}: ${ft(r.nightlyHuf)} Ft/noč do ${r.includedGuests} oseb`+(extraAdult?`, vsak dodatni odrasli +${ft(T.extraAdultNightlyHuf)} Ft/noč`:extraChild?`, ${max}. ležišče samo za otroka (+${ft(T.child3to8NightlyHuf)} Ft/noč)`:'')+`, največ ${max} oseb.`};
 return (L[lang]||L.hu)();
}
function terms(lang){
 const [hs,he]=[T.highSeasonStart,T.highSeasonEnd].map(x=>x.split('-').map(Number));
 const M={hu:['január','február','március','április','május','június','július','augusztus','szeptember','október','november','december'],
  de:['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'],
  en:['January','February','March','April','May','June','July','August','September','October','November','December'],
  si:['januarja','februarja','marca','aprila','maja','junija','julija','avgusta','septembra','oktobra','novembra','decembra']}[lang]||[];
 const c=ft(T.child3to8NightlyHuf),hp=RULES.highSeasonSurchargePct,op=RULES.oneNightSurchargePct,ifa=ft(RULES.tourismTaxAdultNightlyHuf);
 return {
  hu:`Pótágyon gyermek 3 éves kortól +${c} Ft/éj, 3 év alatt ingyenes. ${M[hs[0]-1][0].toUpperCase()+M[hs[0]-1].slice(1)} ${hs[1]}. és ${M[he[0]-1]} ${he[1]}. között +${hp}%, egyetlen éjszakára +${op}%, idegenforgalmi adó ${ifa} Ft/felnőtt/éj. A pontos árhoz és a szabad helyhez kérjük, írja meg az érkezés és távozás dátumát, valamint a felnőttek és gyermekek számát.`,
  de:`Kind im Zusatzbett ab 3 Jahren +${c} Ft/Nacht, unter 3 Jahren kostenlos. Vom ${hs[1]}. ${M[hs[0]-1]} bis ${he[1]}. ${M[he[0]-1]} +${hp}%, für eine einzige Nacht +${op}%, Kurtaxe ${ifa} Ft/Erwachsener/Nacht. Für den genauen Preis und die Verfügbarkeit nennen Sie bitte An- und Abreise sowie die Zahl der Erwachsenen und Kinder.`,
  en:`A child on an extra bed from age 3 +${c} HUF/night, under 3 free. From ${M[hs[0]-1]} ${hs[1]} to ${M[he[0]-1]} ${he[1]} +${hp}%, a single night +${op}%, tourist tax ${ifa} HUF/adult/night. For the exact price and availability, please tell us your arrival and departure dates and the number of adults and children.`,
  si:`Otrok na dodatnem ležišču od 3. leta +${c} Ft/noč, do 3 let brezplačno. Od ${hs[1]}. ${M[hs[0]-1]} do ${he[1]}. ${M[he[0]-1]} +${hp}%, za eno samo noč +${op}%, turistična taksa ${ifa} Ft/odraslo osebo/noč. Za točno ceno in razpoložljivost nam prosimo sporočite datum prihoda in odhoda ter število odraslih in otrok.`}[lang]||'';
}
const LEAD={hu:'A 2027-es árak:',de:'Preise 2027:',en:'2027 prices:',si:'Cene za leto 2027:'};
// The price answer for a question without dates: one cabin type (or the apartments), or every type.
// short (phone, owner 2026-11-25: as little as needed): the price per type in one short clause each, the extra-adult
// price once, and the question for the dates; the season, one-night and tax details come with the dated offer.
const SHORT={hu:(n,p,g,m)=>`${n} ${p} Ft/éj ${g} főig, legfeljebb ${m} fő`,de:(n,p,g,m)=>`${n} ${p} Ft/Nacht bis ${g} Personen, höchstens ${m}`,
 en:(n,p,g,m)=>`${n} ${p} HUF/night up to ${g} guests, at most ${m}`,si:(n,p,g,m)=>`${n} ${p} Ft/noč do ${g} oseb, največ ${m}`};
const EXTRA={hu:x=>`Minden további felnőtt +${x} Ft/éj.`,de:x=>`Jeder weitere Erwachsene +${x} Ft/Nacht.`,en:x=>`Each additional adult +${x} HUF/night.`,si:x=>`Vsak dodatni odrasli +${x} Ft/noč.`};
const FROM={hu:x=>`Apartman és kisebb ház éjszakánként ${x} forinttól.`,de:x=>`Apartments und kleinere Häuser ab ${x} Ft/Nacht.`,en:x=>`Apartments and smaller cabins from ${x} HUF/night.`,si:x=>`Apartmaji in manjše hiške od ${x} Ft/noč.`};
const ASK={hu:'A pontos árhoz kérem, mondja meg az érkezés és távozás dátumát és a létszámot.',de:'Für den genauen Preis nennen Sie mir bitte An- und Abreise und die Personenzahl.',
 en:'For the exact price, please tell me your arrival and departure dates and the number of guests.',si:'Za točno ceno mi prosim povejte datum prihoda in odhoda ter število oseb.'};
export function cabinPriceInfo(text,language='hu',{short=false}={}){
 const lang=NAMES[language]?language:'hu',k=cabinInQuestion(text);
 const keys=k==='apart'?['splitC','splitA']:k?[k]:ORDER;
 if(short){
  // Phone, no type named: the three cabin types and the apartments' lowest price, so the answer stays short.
  const phoneKeys=k?keys:['deluxe','vip','family'];
  const parts=phoneKeys.map(x=>{const r=T.rates[x],t=BUSINESS.accommodationTypes[x];return SHORT[lang](NAMES[lang][x],ft(r.nightlyHuf),r.includedGuests,t.maxGuests??t.capacity);});
  const extra=phoneKeys.some(x=>BUSINESS.accommodationTypes[x].extraAdultPricing==='standard'&&(BUSINESS.accommodationTypes[x].maxGuests??0)>T.rates[x].includedGuests);
  const from=k?'':FROM[lang](String(Math.min(T.rates.splitA.nightlyHuf,T.rates.small.nightlyHuf)));
  return [LEAD[lang],parts.join('; ')+'.',from,extra?EXTRA[lang](ft(T.extraAdultNightlyHuf)):'',ASK[lang]].filter(Boolean).join(' ');
 }
 return [LEAD[lang],...keys.map(x=>line(x,lang)),terms(lang)].join('\n');
}
export const PRICE_LEAD=LEAD;
