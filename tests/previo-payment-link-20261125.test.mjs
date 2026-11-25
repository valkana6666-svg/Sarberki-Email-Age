// Owner 2026-11-25 (#9 7163722661 / 7163781838): exact Previo payment → invoice → reservation link. Synthetic only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDocuments,linkReservationPayments,paymentLinkLine,previoDocumentReader,resetDocumentCache} from '../shared-core/server-previo-payment-link.mjs';
import {parsePayments} from '../shared-core/server-previo-payments.mjs';
import {paymentText} from '../napi-kezelo/penzugy-view.mjs';

const DOCS=parseDocuments('<documents><document><invId>11</invId><comId>9001</comId><type>Faktura</type><curId>2</curId><variableSymbol>555</variableSymbol><customer><name>Kitalált Vendég</name></customer><priceSum>181500</priceSum></document><document><invId>12</invId><comId>9001</comId><type>Faktura</type><curId>2</curId><variableSymbol>SC-B</variableSymbol></document></documents>');
const pay=(payId,invId,price,issued='2026-11-24',curId='2')=>({payId,invId,price,issued,type:3,curId});
const R={resId:555,voucher:'SC-A',comId:'9001',price:181500,deposit:90750};
const L=(o={})=>linkReservationPayments({reservation:{...R,...o.reservation},partnerReservations:o.partners??1,documents:o.documents??DOCS,payments:o.payments??[]});

test('documents: business fields only (no customer name)',()=>{
 assert.deepEqual(DOCS[0],{invId:'11',comId:'9001',type:'Faktura',curId:'2',variableSymbol:'555',priceSum:181500});
 assert.ok(!JSON.stringify(DOCS).includes('Kitalált'));
 assert.equal(parsePayments('<payments><payment><payId>1</payId><invId>11</invId><price>5</price><issued>2026-01-01</issued><curId>2</curId></payment></payments>')[0].curId,'2');
});
test('positive: deposit paid, paid in full, partial with what is still due; one payment counted once',()=>{
 assert.equal(L({payments:[pay(1,11,90750)]}).state,'deposit_paid');
 assert.deepEqual({...L({payments:[pay(1,11,90750),pay(2,12,90750),pay(2,12,90750)]})},{state:'paid_in_full',paid:181500,payments:2,documents:2,due:0,depositDue:0,reasons:[],lastPaymentOn:'2026-11-24'});
 const part=L({payments:[pay(1,11,50000)]});assert.equal(part.state,'partial');assert.equal(part.depositDue,40750);assert.equal(part.due,131500);
 assert.equal(L({payments:[pay(1,99,90750)]}).state,'none_recorded','a payment of another invoice is not ours');
});
test('negative / safe: several reservations of one partner, refund, currency, proforma, no document, unreadable',()=>{
 assert.equal(L({partners:2,payments:[pay(1,11,90750)]}).state,'deposit_paid','several reservations: linked only through the variable symbol (555)');
 assert.equal(L({partners:2,documents:DOCS.filter(d=>d.invId==='12'),payments:[pay(1,12,90750)]}).state,'ambiguous','symbol of another booking: never ours');
 assert.equal(L({payments:[pay(1,11,90750),pay(2,11,-90750)]}).state,'uncertain');assert.deepEqual(L({payments:[pay(1,11,-5)]}).reasons,['REFUND']);
 assert.deepEqual(L({payments:[pay(1,11,90750,'2026-11-24','3')]}).reasons,['MIXED_CURRENCY']);
 assert.deepEqual(L({documents:[{...DOCS[0],type:'Proforma'}],payments:[pay(1,11,90750)]}).reasons,['NON_INVOICE_DOCUMENT']);
 assert.deepEqual({...L({documents:[],payments:[pay(1,11,90750)]})},{state:'none_recorded',paid:0,payments:0,documents:0,reasons:['NO_DOCUMENT']});
 assert.equal(linkReservationPayments({reservation:R,documents:null,payments:[]}).state,'unknown');assert.equal(L({reservation:{comId:null}}).state,'unknown');
 assert.equal(L({payments:[pay(1,11,90750)],reservation:{deposit:null,price:null}}).state,'partial','no target known: never "paid"');
});
test('operator lines: exact wording, nothing recorded is not "missing"',()=>{
 assert.equal(paymentLinkLine(L({payments:[pay(1,11,90750)]})),'💰 Previo: foglaló befizetve – 90 750 Ft, utolsó: 2026. 11. 24. (pontos számla–foglalás kötés). Ha egyezik, nyomd meg: „Foglaló beérkezett”.');
 assert.equal(paymentLinkLine(L({payments:[pay(1,11,50000)]})),'💰 Previo: részfizetés – 50 000 Ft befizetve, a foglalóból még 40 750 Ft, összesen hátralék 131 500 Ft.');
 assert.equal(paymentLinkLine(L({documents:[]})),'💰 Previo: a Previóban nincs rögzített befizetés (nincs kiállított számla).');
 assert.match(paymentLinkLine(L({payments:[pay(1,11,-5)]})),/^⚠️ Previo: bizonytalan befizetés – -5 Ft \(visszatérítés\)/);
 assert.equal(paymentText({state:'none_recorded',paid:0}),'Befizetés: a Previóban nincs rögzítve (banki utalás még nem könyvelt lehet)');
 assert.equal(paymentText({state:'partial',paid:50000,due:49000}),'💰 Részfizetés – 50 000 Ft, hátralék: 49 000 Ft');
 assert.equal(paymentText({state:'ambiguous',paid:null}),'⚠️ Befizetés nem köthető egyértelműen – ellenőrizd a Previóban');
});
test('document reader: switch, TEST hotel only, read call, cache, error is unreadable',async()=>{
 resetDocumentCache();const key='synthetic-previo-test-key-0123456789';let n=0;
 const ok=async(url,o)=>{n++;assert.equal(url,'https://api.previo.app/x1/hotel/getDocuments');assert.equal(o.method,'POST');assert.match(o.body,/<hotId>73521<\/hotId><comId>9001<\/comId>/);return new Response('<documents></documents>');};
 assert.equal(previoDocumentReader({PREVIO_PAYMENT_HINT:'test-only',PREVIO_HOTEL_ID:'753011',PREVIO_API_KEY:key},ok),null);
 const r=previoDocumentReader({PREVIO_PAYMENT_HINT:'test-only',PREVIO_HOTEL_ID:'73521',PREVIO_API_KEY:key},ok);
 assert.deepEqual(await r('9001'),[]);await r('9001');assert.equal(n,1);
 await assert.rejects(r('x;1'),e=>e.code==='PREVIO_UNAVAILABLE');
 resetDocumentCache();
 const bad=previoDocumentReader({PREVIO_PAYMENT_HINT:'test-only',PREVIO_HOTEL_ID:'73521',PREVIO_API_KEY:key},async()=>new Response('<error><message>x</message></error>',{status:400}));
 await assert.rejects(bad('9001'),e=>e.code==='PREVIO_UNAVAILABLE');resetDocumentCache();
});
