// Owner 2026-11-25 (#9 7163469686): read-only probe of the new Previo finance methods. Synthetic, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {probe,tagPaths,enums} from '../scripts/previo-finance-probe.mjs';
const NAME='Kitalált Vendég';
test('finance probe: reads only, prints shapes and link counts – never an amount, name or id',async()=>{
 const calls=[];
 const fetchImpl=async(url,o)=>{calls.push([url.split('/').pop(),o.method,o.body]);const m=url.split('/').pop();
  if(m==='searchReservations')return new Response('<reservations><reservation><resId>555001</resId><price>181500</price><guest><name>'+NAME+'</name></guest></reservation></reservations>');
  if(m==='getPayments')return new Response('<payments><payment><payId>9</payId><invId>777</invId><price>90750</price><description>'+NAME+'</description></payment><payment><payId>10</payId><price>5</price></payment></payments>');
  if(m==='getAccountItems')return new Response('<reservations><accounts><resId>555001</resId><comId>42</comId><groupAccount><item><itemType>1</itemType><price>90750</price><count>2</count><name>'+NAME+'</name></item><item><itemType>9</itemType><price>-90750</price></item></groupAccount></accounts></reservations>');
  if(m==='getDocuments')return new Response('<documents><document><docId>777</docId><resId>555001</resId><type>proforma</type><number>2026-0042</number><total>181500</total><companyName>'+NAME+'</companyName></document></documents>');
  return new Response('<error><message>x</message></error>',{status:404});};
 const r=await probe({key:'k',hotel:'73521',from:'2026-01-01',to:'2026-12-31',fetchImpl}),out=JSON.stringify(r);
 assert.ok(calls.every(([,m])=>m==='POST'));assert.deepEqual([...new Set(calls.map(c=>c[0]))],['searchReservations','getPayments','getAccountItems','getDocuments','getAccountItemTypes','getItemTypes']);
 assert.equal(r.getPayments.payments,2);assert.equal(r.getPayments.withInvoiceId,1);
 assert.equal(r.getAccountItems.request,'resId');assert.equal(r.getAccountItems.items,2);assert.equal(r.getAccountItems.reservationsAnsweredWithOwnResId,1);
 assert.deepEqual(r.getAccountItems.itemTypes,{1:{items:1,negative:0,positive:1,zero:0},9:{items:1,negative:1,positive:0,zero:0}});assert.deepEqual(r.getAccountItems.accountBalanceSign,{withItems:1,sumNegative:0,sumZero:0,sumPositive:1});
 assert.equal(r.getDocuments.documents,1);assert.equal(r.getDocuments.resIdInWindow,1);assert.deepEqual(r.getDocuments.enums.type,['proforma']);
 assert.deepEqual(r.link,{paymentsWhoseInvoiceIsADocument:1,paymentsReachingAReservation:1});
 for(const v of [NAME,'90750','181500','555001','2026-0042','777','42'])assert.ok(!out.includes(v),v);
});
test('denied method: error text and status only',async()=>{
 const fetchImpl=async url=>url.endsWith('searchReservations')?new Response('<reservations></reservations>'):new Response('<error><message>Unauthorized access to method</message></error>');
 const r=await probe({key:'k',hotel:'753011',from:'2026-01-01',to:'2026-01-02',fetchImpl});
 assert.equal(r.getAccountItems.request,null);assert.match(r.getAccountItems.calls,/Unauthorized/);assert.match(r.getDocuments.error,/Unauthorized/);
});
