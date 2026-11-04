// Guest-language price sentence for the daily view (public price-list reference, availability not checked).
// Shared so it can be tested without the page; no network, no state.
export const PRICE_LINE=Object.freeze({hu:'A teljes árat a ténylegesen szabad lehetőség alapján adjuk meg.',de:'Den Gesamtpreis nennen wir anhand der tatsächlich verfügbaren Möglichkeit.',
 en:'We will quote the total price for the option that is actually available.',si:'Skupno ceno navedemo za možnost, ki je dejansko na voljo.'});
export const CABIN_NAMES=Object.freeze({deluxe:{hu:'Deluxe',de:'Deluxe',en:'Deluxe',si:'Deluxe'},family:{hu:'Családi',de:'Familienhaus',en:'Family cabin',si:'Družinska hiška'},
 vip:{hu:'VIP',de:'VIP',en:'VIP',si:'VIP'},small:{hu:'Különálló 2 fős',de:'freistehende Hütte für 2 Personen',en:'standalone 2-person cabin',si:'samostojna hiška za 2 osebi'},
 splitA:{hu:'Osztott A',de:'geteiltes Haus A',en:'split cabin A',si:'deljena hiška A'},splitB:{hu:'Osztott B',de:'geteiltes Haus B',en:'split cabin B',si:'deljena hiška B'},
 splitC:{hu:'Osztott C',de:'geteiltes Haus C',en:'split cabin C',si:'deljena hiška C'}});
// Same grouping everywhere (browser locales differ): 2 200, 128 200.
export const huf=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
export function priceSentence(quote,language){
 const lang=PRICE_LINE[language]?language:'hu',cabin=CABIN_NAMES[quote.cabin]?.[lang]||quote.cabin,total=huf(quote.total),tax=huf(quote.tourismTax);
 // EUR right after the amount; decimal comma except in English.
 const raw=quote.eurConversion?.status==='available'?quote.eurConversion.totalEur.toFixed(2):null,eur=raw&&lang!=='en'?raw.replace('.',','):raw;
 return {hu:`Tájékoztató ár (${cabin}): ${total} Ft${eur?` (kb. ${eur} EUR)`:''}, amely ${tax} Ft idegenforgalmi adót tartalmaz. A végleges árat a szabad hely ellenőrzése után erősítjük meg.`,
  de:`Richtpreis (${cabin}): ${total} HUF${eur?` (ca. ${eur} EUR)`:''} inklusive ${tax} HUF Kurtaxe. Den endgültigen Preis bestätigen wir nach Prüfung der Verfügbarkeit.`,
  en:`Indicative price (${cabin}): ${total} HUF${eur?` (approx. ${eur} EUR)`:''} including ${tax} HUF tourist tax. We will confirm the final price after checking availability.`,
  si:`Okvirna cena (${cabin}): ${total} HUF${eur?` (pribl. ${eur} EUR)`:''}, vključno s ${tax} HUF turistične takse. Končno ceno potrdimo po preverjanju razpoložljivosti.`}[lang];
}
// After a price for one cabin type, the engine's "which cabin type" question becomes this note.
export function pricedCabinNote(quote,language){
 const lang=PRICE_LINE[language]?language:'hu',cabin=CABIN_NAMES[quote.cabin]?.[lang]||quote.cabin;
 const article=/^[aáeéiíoóöőuúüű]/i.test(CABIN_NAMES[quote.cabin]?.hu||'')?'az':'a';
 return {hu:`A fenti ár ${article} ${CABIN_NAMES[quote.cabin]?.hu||quote.cabin} faházra vonatkozik; ha másik háztípust szeretne, kérjük, jelezze.`,
  de:`Der obige Preis gilt für ${cabin}; wenn Sie einen anderen Haustyp wünschen, teilen Sie es uns bitte mit.`,
  en:`The price above is for the ${cabin}; if you would like a different cabin type, please let us know.`,
  si:`Zgornja cena velja za ${cabin}; če želite drugo vrsto hiške, nam to sporočite.`}[lang];
}

// Operator-facing, line-by-line explanation of how the calculator reached the price (Hungarian).
export function priceExplanation(quote){
 const c=quote.calculation||{},lines=[];
 lines.push(`TÁJÉKOZTATÓ ÁR – ${CABIN_NAMES[quote.cabin]?.hu||quote.cabin}, ${quote.arrival} → ${quote.departure} (${c.nights??'?'} éjszaka)`);
 lines.push(`Forrás: ${c.priceList||quote.source||'árlista'}. Szabad hely: a rendszer NEM ellenőrizte.`);
 lines.push(`Vendégek: ${quote.adults} felnőtt${(quote.children||[]).length?`, gyermek(ek): ${quote.children.join(', ')} év`:''}; az alapár ${c.includedGuests??'?'} főt tartalmaz.`);
 for(const n of c.nightLines||[]){
  const parts=[`${huf(n.baseNightlyHuf)} Ft alapár`];
  if(n.extraAdultNightlyHuf)parts.push(`+ ${huf(n.extraAdultNightlyHuf)} Ft pótfelnőtt`);
  if(n.highSeason)parts.push(`+ ${n.highSeasonSurchargePct}% főszezoni felár`);
  lines.push(`• ${n.date} éjszaka: ${parts.join(' ')} = ${huf(n.amountHuf)} Ft`);
 }
 if(c.oneNightSurchargePct)lines.push(`• Egy éjszakás felár: +${c.oneNightSurchargePct}% → ${huf(c.accommodationPerUnitHuf)} Ft`);
 lines.push(`Szállás összesen: ${huf(quote.accommodation)} Ft${c.units>1?` (${c.units} egység)`:''}`);
 lines.push(`Idegenforgalmi adó (IFA): ${c.tourismTaxPayingAdults??quote.adults} felnőtt × ${c.nights??'?'} éj × ${huf(c.tourismTaxAdultNightlyHuf??0)} Ft = ${huf(quote.tourismTax)} Ft. ${c.childrenTourismTax||''}`.trim());
 lines.push(`VÉGÖSSZEG: ${huf(quote.total)} Ft`+(quote.eurConversion?.status==='available'?` ≈ ${quote.eurConversion.totalEur.toFixed(2)} EUR (MNB-árfolyam ${quote.eurConversion.rateHufPerEur} Ft/EUR, ${quote.eurConversion.rateDate})`:' (EUR-árfolyam nem elérhető)'));
 return lines.join('\n');
}
