// Owner 2026-11-25: Previo payment → "probably the deposit" suggestion. Synthetic only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePayments,depositPaymentHint,paymentHintLine,previoPaymentReader} from '../shared-core/server-previo-payments.mjs';

const xml='<payments><foundRows>3</foundRows>'+
 '<payment><payId>1</payId><invId>11</invId><price>90750.00</price><issued>2026-11-24 10:00:00</issued><cptId>3</cptId><description>Kitalált Vendég</description></payment>'+
 '<payment><payId>2</payId><invId>12</invId><price>90750</price><issued>2026-11-20</issued><cptId>1</cptId></payment>'+
 '<payment><payId>3</payId><price>45000</price><issued>2026-11-25</issued><cptId>1</cptId></payment></payments>';
const booking={status:'finalized',deposit:{amount:90750},previo:{recordedAt:'2026-11-23T21:13:21Z'}};

test('parse keeps id, invoice, amount, date and type – never the description',()=>{
 const p=parsePayments(xml);assert.equal(p.length,3);assert.deepEqual({...p[0],curId:undefined},{payId:1,invId:11,price:90750,issued:'2026-11-24',type:3,curId:undefined});
 assert.ok(!JSON.stringify(p).includes('Kitalált'));
});
test('suggestion: same amount, issued on/after the confirmation; never for other states',()=>{
 const c=depositPaymentHint(booking,parsePayments(xml));
 assert.deepEqual(c.map(x=>x.payId),[1],'the 11-20 payment is before the confirmation');
 assert.match(paymentHintLine(c),/^💰 Valószínűleg megjött a foglaló: 90 750 Ft, 2026\. 11\. 24\., számla #11\. Ha egyezik, nyomd meg: „Foglaló beérkezett”\.$/);
 assert.match(paymentHintLine([]),/még nincs a foglalóval egyező befizetés/);
 assert.deepEqual(depositPaymentHint({...booking,status:'deposit_received'},parsePayments(xml)),[]);
 const two=depositPaymentHint(booking,[...parsePayments(xml),{payId:9,invId:19,price:90750,issued:'2026-11-25',type:3}]);
 assert.match(paymentHintLine(two),/további 1 hasonló tétel/);
});
test('reader: off without its switch or outside TEST 73521; one POST, cached 10 minutes',async()=>{
 const env={PREVIO_PAYMENT_HINT:'test-only',PREVIO_HOTEL_ID:'73521',PREVIO_API_KEY:'k'.repeat(20)};
 assert.equal(previoPaymentReader({...env,PREVIO_PAYMENT_HINT:''}),null);assert.equal(previoPaymentReader({...env,PREVIO_HOTEL_ID:'753011'}),null);
 let calls=0,t=1e12;const read=previoPaymentReader(env,async(u,o)=>{calls++;assert.match(u,/\/x1\/hotel\/getPayments$/);assert.match(o.body,/<hotId>73521<\/hotId>/);return new Response(xml);},{now:()=>t});
 assert.equal((await read()).length,3);t+=5*60000;await read();assert.equal(calls,1);t+=6*60000;await read();assert.equal(calls,2);
});
