// Owner 2026-11-22 (PERM-20261122-OPTION-EXPIRY-CANCEL): expired options the system created are cancelled in Previo
// TEST. Synthetic only: no network, fictional data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {expiredOwnOptions,cancelExpiredOptions,hotelLocalNow,EXPIRY_MAX_PER_RUN} from '../shared-core/server-previo-option-expiry.mjs';

const NOW=Date.parse('2026-11-22T12:30:00Z'); // 13:30 in Budapest
const res=(resId,voucher,status,exp)=>`<reservation><resId>${resId}</resId><voucher>${voucher}</voucher><status><statusId>${status}</statusId></status>${exp?`<optionExpiration>${exp}</optionExpiration>`:''}</reservation>`;
const xml=rows=>'<?xml version="1.0"?><reservations>'+rows.join('')+'</reservations>';
const OWN='SC-0123456789ABCDEF';

test('hotel-local clock (Budapest, winter +1 h, summer +2 h)',()=>{
 assert.equal(hotelLocalNow(NOW),'2026-11-22 13:30:00');
 assert.equal(hotelLocalNow(Date.parse('2027-07-01T10:00:00Z')),'2027-07-01 12:00:00');
});

test('only the system\'s own, still-option, expired (+15 min grace) bookings are due',()=>{
 const t=xml([
  res(1,OWN,1,'2026-11-21T10:06:23'),          // expired yesterday → due
  res(2,OWN,1,'2026-11-22 13:10:00'),          // expired 20 min ago → due
  res(3,OWN,1,'2026-11-22 13:20:00'),          // 10 min ago: inside the grace → not yet
  res(4,OWN,1,'2026-11-22 14:10:31'),          // not expired
  res(5,OWN,2,'2026-11-20 10:00:00'),          // confirmed → never
  res(6,'20260010',1,'2026-11-20 10:00:00'),   // made by hand in Previo → never
  res(7,OWN,7,'2026-11-20 10:00:00'),          // already cancelled
  res(8,OWN,1,null),                           // no expiry → never
  res(9,OWN,1,'garbage')]);
 assert.deepEqual(expiredOwnOptions(t,NOW).map(r=>r.resId),[1,2]);
});

test('off without its own switch or on another property; cancels, reads back, caps the run',async()=>{
 const env={OPTION_EXPIRY_CANCEL:'test-only',PREVIO_HOTEL_ID:'73521',PREVIO_API_KEY:'k'.repeat(20)};
 const calls=[];const writer={setStatus:async a=>{calls.push(a);return {ok:true};}};
 assert.equal((await cancelExpiredOptions({env:{...env,OPTION_EXPIRY_CANCEL:''},writer,now:()=>NOW})).status,'off');
 assert.equal((await cancelExpiredOptions({env:{...env,PREVIO_HOTEL_ID:'753011'},writer,now:()=>NOW})).status,'off');
 assert.equal((await cancelExpiredOptions({env,writer:null,now:()=>NOW})).status,'off');
 let cancelled=new Set();
 const rows=()=>xml([...Array(8)].map((_,i)=>res(100+i,OWN,cancelled.has(100+i)?7:1,'2026-11-21 10:00:00')).concat(res(200,OWN,2,'2026-11-21 10:00:00')));
 const fetchImpl=async()=>new Response(rows());
 const w={setStatus:async a=>{calls.push(a);if(a.resId!==101)cancelled.add(a.resId);return {ok:true};}};
 const r=await cancelExpiredOptions({env,writer:w,fetchImpl,now:()=>NOW});
 assert.equal(r.status,'ran');assert.equal(r.checked,EXPIRY_MAX_PER_RUN);
 assert.deepEqual(calls.map(c=>[c.resId,c.status]),[100,101,102,103,104].map(i=>[i,'cancelled']));
 assert.deepEqual(r.results.map(x=>[x.resId,x.cancelled]),[[100,true],[101,false],[102,true],[103,true],[104,true]],'101: Previo did not show 7 → not counted');
 // An unreadable Previo → nothing is written.
 calls.length=0;
 assert.equal((await cancelExpiredOptions({env,writer:w,fetchImpl:async()=>new Response('<error>x</error>'),now:()=>NOW})).status,'unknown');
 assert.equal(calls.length,0);
 // A failed write is reported, not retried in the same run.
 const bad={setStatus:async()=>{throw Object.assign(Error('x'),{code:'PREVIO_WRITE_FAILED'});}};
 const r2=await cancelExpiredOptions({env,writer:bad,fetchImpl:async()=>new Response(xml([res(1,OWN,1,'2026-11-21 10:00:00')])),now:()=>NOW});
 assert.deepEqual(r2.results,[{resId:1,voucher:OWN,write:'failed',code:'PREVIO_WRITE_FAILED'}]);
});
