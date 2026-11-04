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
 const eur=quote.eurConversion?.status==='available'?quote.eurConversion.totalEur.toFixed(2):null;
 return {hu:`Tájékoztató ár (${cabin}): ${total} Ft, amely ${tax} Ft idegenforgalmi adót tartalmaz.${eur?` (kb. ${eur} EUR)`:''} A végleges árat a szabad hely ellenőrzése után erősítjük meg.`,
  de:`Richtpreis (${cabin}): ${total} HUF inklusive ${tax} HUF Kurtaxe.${eur?` (ca. ${eur} EUR)`:''} Den endgültigen Preis bestätigen wir nach Prüfung der Verfügbarkeit.`,
  en:`Indicative price (${cabin}): ${total} HUF including ${tax} HUF tourist tax.${eur?` (approx. ${eur} EUR)`:''} We will confirm the final price after checking availability.`,
  si:`Okvirna cena (${cabin}): ${total} HUF, vključno s ${tax} HUF turistične takse.${eur?` (pribl. ${eur} EUR)`:''} Končno ceno potrdimo po preverjanju razpoložljivosti.`}[lang];
}
