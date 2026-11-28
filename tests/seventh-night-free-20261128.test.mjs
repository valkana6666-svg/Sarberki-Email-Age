// Owner 2026-11-27 (ChatGPT #9 7225251453, 7225266950): „7=6” – every full week of a stay is charged as six nights;
// the week's average night (its own night amounts ÷ 7) is deducted; for a returning guest the 20% comes first.
// IFA, hot tub and other fees unchanged. Synthetic only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchPublicPriceReference} from '../price-source/public-price-fallback.mjs';
import {applyReturningDiscount} from '../shared-core/returning-guest.mjs';
import {buildBookingConfirmation} from '../shared-core/booking-confirmation-draft.mjs';
import {previoTotalHuf} from '../shared-core/server-test-mailbox-confirm.mjs';
import {prefillNote} from '../shared-core/server-chat-prefill.mjs';
import {SARBERKI_TARIFF_2027} from '../business/sarberki/tariffs.mjs';

const day=(a,n)=>new Date(Date.parse(a+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const q=(n,{arrival='2027-10-04',adults=2,children=[],cabin='deluxe'}={})=>fetchPublicPriceReference({arrival,departure:day(arrival,n),cabin,adults,children});
const ELIGIBLE={status:'eligible',pct:20,lastStay:'2026-10-10'};

test('the approved rule is in the canonical tariff source',()=>{
 assert.equal(SARBERKI_TARIFF_2027.seventhNightFree.everyNights,7);
 assert.equal(SARBERKI_TARIFF_2027.seventhNightFree.method,'weekly-average');
 assert.equal(SARBERKI_TARIFF_2027.seventhNightFree.afterReturningDiscount,true);
});

test('paid nights: 6→6, 7→6, 8→7, 13→12, 14→12, 15→13, 21→18 (normal guest, same nightly price)',()=>{
 for(const [n,paid] of [[6,6],[7,6],[8,7],[13,12],[14,12],[15,13],[21,18]]){
  const x=q(n);assert.equal(x.accommodation,paid*63000,n+' nights');
  assert.equal(x.weeklyFree?.freeNights??0,Math.floor(n/7));
  assert.equal(x.tourismTax,2*n*550,'IFA for every night, the free ones too');
  assert.equal(x.total,x.accommodation+x.tourismTax);
 }
});

test('returning guest: 20% first, then the discounted week ÷ 7 (owner example 140 000 → 112 000 → −16 000 → 96 000)',()=>{
 // The owner's example as a synthetic quote (one full week of 140 000).
 const synthetic={accommodation:120000,tourismTax:0,total:120000,units:1,listAccommodation:140000,weeklyFree:{freeNights:1,amount:20000,weeks:[{from:'2027-10-04',to:'2027-10-10',weekSumHuf:140000,freeHuf:20000}]}};
 assert.equal(synthetic.listAccommodation-synthetic.weeklyFree.amount,120000,'normal guest 120 000');
 const r=applyReturningDiscount(synthetic,ELIGIBLE);
 assert.equal(r.returningDiscount.amount,28000);assert.equal(r.weeklyFree.amount,16000);assert.equal(r.accommodation,96000);
 // Real tariff: Deluxe 7 nights, 2 adults – 441 000 → 352 800 → −50 400 → 302 400; 14 nights → two weeks.
 const seven=applyReturningDiscount(q(7),ELIGIBLE);assert.deepEqual([seven.accommodationBeforeDiscount,seven.returningDiscount.amount,seven.weeklyFree.amount,seven.accommodation],[441000,88200,50400,302400]);
 const fourteen=applyReturningDiscount(q(14),ELIGIBLE);assert.equal(fourteen.weeklyFree.freeNights,2);assert.equal(fourteen.accommodation,604800);
 const eight=applyReturningDiscount(q(8),ELIGIBLE);assert.equal(eight.accommodation,504000-100800-50400,'partial week: no extra deduction');
 assert.equal(seven.tourismTax,7700);assert.equal(seven.total,302400+7700);
 // Without 7 nights the old rule is unchanged.
 assert.equal(applyReturningDiscount(q(3),ELIGIBLE).accommodation,151200);
});

test('varying night prices: the week average counts (high season ends inside the first week)',()=>{
 const x=q(14,{arrival:'2027-08-19'}); // 08-19..22 high (69 300), then 63 000
 assert.equal(x.weeklyFree.weeks[0].weekSumHuf,4*69300+3*63000);assert.equal(x.weeklyFree.weeks[0].freeHuf,66600);
 assert.equal(x.weeklyFree.weeks[1].freeHuf,63000);assert.equal(x.accommodation,907200-129600);
 const r=applyReturningDiscount(x,ELIGIBLE);
 assert.equal(r.accommodation,907200-181440-Math.round((466200-93240)/7)-Math.round((441000-88200)/7));
});

test('extra guests and children are inside the week amount; a stay crossing into 2028 stays manual',()=>{
 const x=q(7,{adults:4,children:[12,5]}); // 63 000 + 10 000 + 5 000 = 78 000 / night
 assert.equal(x.accommodation,6*78000);assert.equal(x.tourismTax,4*7*550);
 assert.throws(()=>fetchPublicPriceReference({arrival:'2027-12-28',departure:'2028-01-05',cabin:'deluxe',adults:2,children:[]}),/kézi/);
});

test('letter, Previo gross price and staff note show the free nights; no double deduction',()=>{
 const r=applyReturningDiscount(q(7),ELIGIBLE);
 const c=buildBookingConfirmation({values:{arrival:'2027-10-04',departure:'2027-10-11',adults:'2',children:'0',unit:'Deluxe',name:'Teszt Elek',language:'hu'},quote:r,previo:{reference:'V2-1',recordedAt:'2026-11-28T10:00:00Z'},language:'hu'});
 assert.match(c.text,/Szállásdíj: 441 000 Ft − törzsvendég-kedvezmény 20% \(88 200 Ft\) − 7=6 kedvezmény: 1 éjszaka ingyenes \(50 400 Ft\) = 302 400 Ft, idegenforgalmi adó: 7 700 Ft, összesen: 310 100 Ft\./);
 assert.match(c.text,/A foglaló a szállásdíj 50%-a: 151 200 Ft/);
 const n=buildBookingConfirmation({values:{arrival:'2027-10-04',departure:'2027-10-11',adults:'2',children:'0',unit:'Deluxe',language:'hu'},quote:q(7),previo:{reference:'V2-1',recordedAt:'2026-11-28T10:00:00Z'},language:'hu'});
 assert.match(n.text,/Szállásdíj: 441 000 Ft − 7=6 kedvezmény: 1 éjszaka ingyenes \(63 000 Ft\) = 378 000 Ft/);
 assert.equal(previoTotalHuf(r),310100);assert.equal(previoTotalHuf(q(7)),385700);
 assert.match(prefillNote(null,q(14)),/Hetedik éjszaka ingyen kedvezmény 2 éjszaka \(126000 Ft\) beszámítva\./);assert.doesNotMatch(prefillNote(null,q(14)),/=/,'Previo drops =');
 assert.doesNotMatch(prefillNote(null,q(6)),/Hetedik/);
});
