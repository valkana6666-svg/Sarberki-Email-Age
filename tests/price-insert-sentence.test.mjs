import test from 'node:test';
import assert from 'node:assert/strict';
import {priceSentence,PRICE_LINE} from '../shared-core/price-insert-sentence.mjs';
import {fetchPublicPriceReference} from '../price-source/public-price-fallback.mjs';

// The quote comes from the existing public price-list calculator (no network, no availability).
const quote={...fetchPublicPriceReference({arrival:'2027-05-14',departure:'2027-05-16',cabin:'deluxe',adults:2,children:[]}),eurConversion:{status:'available',totalEur:330.12}};

test('price sentence in the guest language: total, tourist tax, EUR, availability caveat',()=>{
 assert.equal(quote.total,128200);
 assert.equal(priceSentence(quote,'hu'),'Tájékoztató ár (Deluxe): 128 200 Ft, amely 2 200 Ft idegenforgalmi adót tartalmaz. (kb. 330.12 EUR) A végleges árat a szabad hely ellenőrzése után erősítjük meg.');
 assert.match(priceSentence(quote,'en'),/^Indicative price \(Deluxe\): 128 200 HUF including 2 200 HUF tourist tax\. \(approx\. 330\.12 EUR\) We will confirm/);
 assert.match(priceSentence({...quote,cabin:'family'},'de'),/^Richtpreis \(Familienhaus\): 128 200 HUF inklusive 2 200 HUF Kurtaxe/);
 assert.match(priceSentence(quote,'si'),/^Okvirna cena \(Deluxe\)/);
 assert.doesNotMatch(priceSentence({...quote,eurConversion:{status:'unavailable'}},'hu'),/EUR/);
 assert.match(priceSentence(quote,'xx'),/^Tájékoztató ár/,'unknown language falls back to Hungarian');
 // The generic engine sentence it replaces exists in every language.
 for(const lang of ['hu','de','en','si'])assert.ok(PRICE_LINE[lang].length>20);
 // Same total and tax in every language.
 for(const lang of ['hu','de','en','si'])assert.ok(priceSentence(quote,lang).includes('128 200')&&priceSentence(quote,lang).includes('2 200')&&priceSentence(quote,lang).includes('330.12'),lang);
});
