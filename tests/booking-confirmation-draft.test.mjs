import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBookingConfirmation,localDeadline} from '../shared-core/booking-confirmation-draft.mjs';
import {fetchPublicPriceReference} from '../price-source/public-price-fallback.mjs';

const values={arrival:'2027-06-10',departure:'2027-06-13',adults:'2',children:'0',unit:'Deluxe',name:'Kis Anna',language:'hu'};
const quote=fetchPublicPriceReference({arrival:'2027-06-10',departure:'2027-06-13',cabin:'deluxe',adults:2,children:[]});
const previo={reference:'TEST-123',recordedAt:'2027-05-20T10:00:00+02:00'};

test('owner example: Deluxe 2027-06-10..13, 2 adults -> 189 000 + 3 300 = 192 300 Ft, 50% deposit 94 500 Ft, 7 days',()=>{
 assert.equal(quote.accommodation,189000);assert.equal(quote.tourismTax,3300);assert.equal(quote.total,192300);
 const out=buildBookingConfirmation({values,quote,previo,language:'hu',paymentInstructions:null});
 assert.equal(out.deposit.pct,50);assert.equal(out.deposit.amount,94500);assert.equal(out.deposit.windowHours,168);
 assert.match(out.text,/^Kedves Kis Anna!/);
 assert.match(out.text,/2027\.06\.10\. – 2027\.06\.13\., Deluxe, 2 fő \(2 felnőtt\)/);
 assert.match(out.text,/Szállásdíj: 189 000 Ft, idegenforgalmi adó: 3 300 Ft, összesen: 192 300 Ft\./);
 assert.match(out.text,/szállásdíj 50%-a: 94 500 Ft\. Kérjük, hogy 2027\.05\.27\. 10:00-ig/);
 assert.match(out.text,/A foglalás a foglaló beérkezése után válik véglegessé\./);
 assert.match(out.text,/legalább 14 nappal/);
 assert.doesNotMatch(out.text,/TEST-123|Previo/);
 assert.match(out.operatorReviewText,/Previo-hivatkozás: TEST-123/);
 assert.match(out.operatorReviewText,/bankszámlaszámot és a fizetés módját külön üzenetben/);
 assert.match(out.operatorReviewText,/nem fizetés/);
});

test('deadline: more than 14 days -> 7 days; exactly 14 days or fewer -> 24 hours',()=>{
 const at=d=>buildBookingConfirmation({values,quote,previo:{reference:'X1',recordedAt:d},language:'hu'}).deposit.windowHours;
 assert.equal(at('2027-05-26T09:00:00+02:00'),168); // 15 days
 assert.equal(at('2027-05-27T09:00:00+02:00'),24);  // exactly 14 days
 assert.equal(at('2027-06-01T09:00:00+02:00'),24);
});

test('80% only from 16 guests',()=>{
 const big=(n)=>{const q=fetchPublicPriceReference({arrival:'2027-06-10',departure:'2027-06-13',cabin:'deluxe',adults:2,children:[]});
  return buildBookingConfirmation({values:{...values,adults:String(n)},quote:q,previo,language:'hu'}).deposit.pct;};
 assert.equal(big(15),50);assert.equal(big(16),80);
});

test('refuses without Previo recording, facts or price; four languages render',()=>{
 assert.throws(()=>buildBookingConfirmation({values,quote,previo:null,language:'hu'}),/PREVIO_RECORDING_REQUIRED/);
 assert.throws(()=>buildBookingConfirmation({values,quote,previo:{reference:'a b',recordedAt:previo.recordedAt},language:'hu'}),/PREVIO_RECORDING_REQUIRED/);
 assert.throws(()=>buildBookingConfirmation({values:{...values,arrival:''},quote,previo,language:'hu'}),/CONFIRMATION_FACTS_MISSING/);
 assert.throws(()=>buildBookingConfirmation({values,quote:{status:'manual'},previo,language:'hu'}),/CONFIRMATION_PRICE_MISSING/);
 assert.throws(()=>buildBookingConfirmation({values,quote,previo:{reference:'X',recordedAt:'2027-05-20T10:00:00'},language:'hu'}),/DEPOSIT_POLICY_UNVERIFIED/);
 for(const [lang,re] of [['de',/94 500 HUF/],['en',/94 500 HUF/],['si',/94 500 HUF/]])assert.match(buildBookingConfirmation({values,quote,previo,language:lang}).text,re);
 assert.deepEqual(localDeadline('2027-01-10T23:30:00Z'),{date:'2027.01.11.',time:'00:30'});
});

test('multi-unit booking: the guest letter states the number of houses (live L2 rehearsal 2026-11-11), no house numbers',()=>{
 const v={arrival:'2027-07-20',departure:'2027-07-22',adults:'8',children:'0',name:'Nagy Péter',language:'hu'};
 const q=fetchPublicPriceReference({arrival:v.arrival,departure:v.departure,cabin:'family',adults:8,children:[],units:2});
 assert.equal(q.units,2);assert.equal(q.total,250800);
 const hu=buildBookingConfirmation({values:v,quote:q,previo,language:'hu'}).text;
 assert.match(hu,/2027\.07\.20\. – 2027\.07\.22\., 2 × Családi, 8 fő \(8 felnőtt\)/);
 assert.doesNotMatch(hu,/\b[23], [23]\b|Egység/);
 assert.match(buildBookingConfirmation({values:v,quote:q,previo,language:'de'}).text,/, 2 × \S+, 8 Personen/);
 assert.match(buildBookingConfirmation({values,quote,previo,language:'hu'}).text,/, Deluxe, 2 fő/); // single unit unchanged
});
