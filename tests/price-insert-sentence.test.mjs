import test from 'node:test';
import assert from 'node:assert/strict';
import {priceSentence,PRICE_LINE,priceExplanation} from '../shared-core/price-insert-sentence.mjs';
import {fetchPublicPriceReference} from '../price-source/public-price-fallback.mjs';

// The quote comes from the existing public price-list calculator (no network, no availability).
const quote={...fetchPublicPriceReference({arrival:'2027-05-14',departure:'2027-05-16',cabin:'deluxe',adults:2,children:[]}),eurConversion:{status:'available',totalEur:330.12}};

test('price sentence in the guest language: total, tourist tax, EUR, availability caveat',()=>{
 assert.equal(quote.total,128200);
 assert.equal(priceSentence(quote,'hu'),'Tájékoztató ár (Deluxe): 128 200 Ft (kb. 330,12 EUR), amely 2 200 Ft idegenforgalmi adót tartalmaz. A végleges árat a szabad hely ellenőrzése után erősítjük meg.');
 assert.match(priceSentence(quote,'en'),/^Indicative price \(Deluxe\): 128 200 HUF \(approx\. 330\.12 EUR\) including 2 200 HUF tourist tax\. We will confirm/);
 assert.match(priceSentence({...quote,cabin:'family'},'de'),/^Richtpreis \(Familienhaus\): 128 200 HUF \(ca\. 330,12 EUR\) inklusive 2 200 HUF Kurtaxe/);
 assert.match(priceSentence(quote,'si'),/^Okvirna cena \(Deluxe\)/);
 assert.doesNotMatch(priceSentence({...quote,eurConversion:{status:'unavailable'}},'hu'),/EUR/);
 assert.match(priceSentence(quote,'xx'),/^Tájékoztató ár/,'unknown language falls back to Hungarian');
 // The generic engine sentence it replaces exists in every language.
 for(const lang of ['hu','de','en','si'])assert.ok(PRICE_LINE[lang].length>20);
 // Same total and tax in every language.
 for(const lang of ['hu','de','en','si'])assert.ok(priceSentence(quote,lang).includes('128 200')&&priceSentence(quote,lang).includes('2 200')&&priceSentence(quote,lang).includes(lang==='en'?'330.12':'330,12'),lang);
});

test('operator explanation lists every step and adds up to the total',()=>{
 const text=priceExplanation(quote);
 assert.match(text,/^TÁJÉKOZTATÓ ÁR – Deluxe, 2027-05-14 → 2027-05-16 \(2 éjszaka\)/);
 assert.match(text,/Szabad hely: a rendszer NEM ellenőrizte\./);
 assert.match(text,/• 2027-05-14 éjszaka: 63 000 Ft alapár = 63 000 Ft\n• 2027-05-15 éjszaka: 63 000 Ft alapár = 63 000 Ft/);
 assert.match(text,/Szállás összesen: 126 000 Ft/);
 assert.match(text,/Idegenforgalmi adó \(IFA\): 2 felnőtt × 2 éj × 550 Ft = 2 200 Ft\./);
 assert.match(text,/VÉGÖSSZEG: 128 200 Ft ≈ 330\.12 EUR/);
 const one={...fetchPublicPriceReference({arrival:'2027-07-20',departure:'2027-07-21',cabin:'vip',adults:5,children:[]}),eurConversion:{status:'unavailable'}};
 const t2=priceExplanation(one);
 assert.match(t2,/63 000 Ft alapár \+ 10 000 Ft pótfelnőtt \+ 10% főszezoni felár = 80 300 Ft/);
 assert.match(t2,/Egy éjszakás felár: \+20% → 96 360 Ft/);
 assert.match(t2,/VÉGÖSSZEG: 99 110 Ft \(EUR-árfolyam nem elérhető\)/);
});

test('after pricing, the cabin-type question becomes a note about the priced cabin',async()=>{
 const {pricedDraft}=await import('../shared-core/server-test-mailbox-price.mjs');
 const latest={text:'Ár és díjak\n'+PRICE_LINE.hu+'\n\nAz ajánlathoz még szükségünk van\nMelyik háztípust szeretné: VIP, Családi, Deluxe, Osztott vagy Különálló 2 fős?\n',operatorReviewText:'Ár és díjak\n'+PRICE_LINE.hu+'\nMelyik háztípust szeretné: VIP, Családi, Deluxe, Osztott vagy Különálló 2 fős?'};
 const out=pricedDraft({latest,quote,language:'hu'});
 assert.match(out.text,/Tájékoztató ár \(Deluxe\): 128 200 Ft \(kb\. 330,12 EUR\)/);
 assert.match(out.text,/A fenti ár a Deluxe faházra vonatkozik; ha másik háztípust szeretne, kérjük, jelezze\./);
 assert.doesNotMatch(out.text,/Melyik háztípust szeretné/);
 assert.doesNotMatch(out.operatorReviewText,/Melyik háztípust szeretné/);
 assert.match(pricedDraft({latest,quote:{...quote,cabin:'splitA'},language:'hu'}).text,/A fenti ár az Osztott A faházra vonatkozik/);
 const en=pricedDraft({latest:{text:PRICE_LINE.en+'\nPlease reply to this email and tell us which of the offered cabin types you would like to choose.'},quote,language:'en'});
 assert.match(en.text,/The price above is for the Deluxe; if you would like a different cabin type, please let us know\./);
});
