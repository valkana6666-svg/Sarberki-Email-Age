import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReservationXml,buildStatusXml,buildVoucherSearchXml,parseReservationResponse,reservationsWithVoucher,voucherFor,writePrevioReservation,STATUS,WRITE_SWITCH_VALUE} from '../shared-core/server-previo-reservation-write.mjs';
import {PREVIO_TEST_73521} from '../shared-core/previo-booking-intent.mjs';

// Synthetic only: no network, fictional contact, fictional key.
const base={tenantId:'t-synthetic',caseId:'tm-synthetic-1',values:{arrival:'2027-06-15',departure:'2027-06-17',adults:'2',children:'2',child_ages:'4,12'},
 cabin:'deluxe',unit:'12',contactName:'Teszt Vendég <A&B>',totalHuf:128200,optionExpiresUtc:'2026-11-16T10:00:00.000Z'};
const ENV={PREVIO_WRITE_ENABLED:WRITE_SWITCH_VALUE,PREVIO_API_KEY:'synthetic-previo-key-0123456789'};
const PERM='PERM-20261109-T9';
const ok=(resId=900,voucher)=>`<?xml version="1.0"?><reservations><reservation><comId>800</comId><resId>${resId}</resId><voucher>${voucher}</voucher><status><statusId>1</statusId></status></reservation></reservations>`;

test('XML: 73521, room kind + chosen unit, option status, e-mail source, rate plan, categories only, escaped name, HUF',()=>{
 const r=buildReservationXml(base);
 assert.equal(r.url,'https://api.previo.app/x1/hotel/reservation');assert.equal(r.hotelId,'73521');
 assert.match(r.voucher,/^SC-[0-9A-F]{16}$/);assert.equal(r.voucher,voucherFor(base));
 for(const part of ['<hotId>73521</hotId>','<numGuest>4</numGuest>','<obkId>1012899</obkId>','<objId>2392199</objId>',`<cosId>${STATUS.option}</cosId>`,'<cmsId>1</cmsId>','<prlId>385033</prlId>',
  '<optionExpiration>2026-11-16 10:00:00</optionExpiration>','<from>2027-06-15 14:00:00</from><to>2027-06-17 10:00:00</to>','<name>Teszt Vendég &lt;A&amp;B&gt;</name>','<total>128200</total><curId>9</curId>'])
  assert.ok(r.xml.includes(part),part);
 assert.equal((r.xml.match(/<guaId>472221<\/guaId>/g)||[]).length,2,'2 adults');
 assert.equal((r.xml.match(/<guaId>472223<\/guaId>/g)||[]).length,2,'children 4 and 12 (IFA-exempt child category)');
 assert.doesNotMatch(r.xml,/<email>|<phone>|<firstName>|<lastName>/,'no guest contact data');
});

test('refusals: live property, unknown kind/unit, missing price/name/expiry, bad dates',()=>{
 assert.throws(()=>buildReservationXml({...base,property:{...PREVIO_TEST_73521,hotelId:'753011'}}),/SANDBOX_ONLY/);
 assert.throws(()=>buildReservationXml({...base,cabin:'tent'}),/ROOM_KIND_UNKNOWN/);
 assert.throws(()=>buildReservationXml({...base,unit:'99'}),/UNIT_UNKNOWN/);
 assert.throws(()=>buildReservationXml({...base,totalHuf:0}),/PRICE_REQUIRED/);
 assert.throws(()=>buildReservationXml({...base,contactName:' '}),/CONTACT_NAME_REQUIRED/);
 assert.throws(()=>buildReservationXml({...base,contactName:'a\nb'}),/CONTACT_NAME_REQUIRED/);
 assert.throws(()=>buildReservationXml({...base,optionExpiresUtc:'soon'}),/OPTION_EXPIRY_REQUIRED/);
 assert.throws(()=>buildReservationXml({...base,values:{...base.values,departure:'2027-06-15'}}),/DATES_REQUIRED/);
});

test('status change: deposit -> confirmed (2), cancel -> storno (7); option and live refused',()=>{
 assert.match(buildStatusXml({resId:900,status:'confirmed'}).xml,/<resId>900<\/resId><gCosId>2<\/gCosId>/);
 assert.match(buildStatusXml({resId:900,status:'cancelled'}).xml,/<gCosId>7<\/gCosId>/);
 assert.throws(()=>buildStatusXml({resId:900,status:'option'}),/STATUS_NOT_ALLOWED/);
 assert.throws(()=>buildStatusXml({resId:900,status:'confirmed',property:{hotelId:'753011'}}),/SANDBOX_ONLY/);
 assert.throws(()=>buildStatusXml({resId:0,status:'confirmed'}),/RESERVATION_ID_REQUIRED/);
});

test('responses: ids, Previo errors mapped (1001 = unit taken), voucher filter is exact',()=>{
 assert.deepEqual({...parseReservationResponse(ok(901,'SC-X'))},{ok:true,resId:901,comId:800,statusId:1,voucher:'SC-X'});
 assert.equal(parseReservationResponse('<error><code>1001</code><message>Insufficient capacity</message></error>').code,'UNIT_TAKEN');
 assert.equal(parseReservationResponse('<error><code>1007</code><message>x</message></error>').code,'PREVIO_REJECTED');
 assert.equal(parseReservationResponse('<html>').code,'PREVIO_RESPONSE_UNREADABLE');
 const two=ok(1,'SC-AAAA').replace('</reservations>','')+'<reservation><resId>2</resId><voucher>SC-BBBB</voucher></reservation></reservations>';
 assert.deepEqual(reservationsWithVoucher(two,'SC-BBBB').map(r=>r.resId),[2]);
 assert.match(buildVoucherSearchXml(buildReservationXml(base)),/<term><from>2027-06-15<\/from><to>2027-06-17<\/to><\/term><fulltext>SC-[0-9A-F]{16}<\/fulltext>/);
});

test('locks: switch off, no permission, wrong host/property or no key -> no request at all',async()=>{
 const req=buildReservationXml(base);let calls=0;const fetchImpl=async()=>{calls++;return new Response('');};
 await assert.rejects(writePrevioReservation({env:{},permissionId:PERM,request:req,fetchImpl}),/WRITE_DISABLED/);
 await assert.rejects(writePrevioReservation({env:{...ENV,PREVIO_WRITE_ENABLED:'true'},permissionId:PERM,request:req,fetchImpl}),/WRITE_DISABLED/);
 await assert.rejects(writePrevioReservation({env:ENV,permissionId:'ok',request:req,fetchImpl}),/OWNER_PERMISSION_REQUIRED/);
 await assert.rejects(writePrevioReservation({env:ENV,permissionId:PERM,request:{...req,hotelId:'753011'},fetchImpl}),/SANDBOX_ONLY/);
 await assert.rejects(writePrevioReservation({env:ENV,permissionId:PERM,request:{...req,url:'https://evil.example/x1/hotel/reservation'},fetchImpl}),/SANDBOX_ONLY/);
 await assert.rejects(writePrevioReservation({env:{PREVIO_WRITE_ENABLED:WRITE_SWITCH_VALUE},permissionId:PERM,request:req,fetchImpl}),/PREVIO_KEY_MISSING/);
 assert.equal(calls,0);
});

test('idempotent: search first; an existing voucher is returned, never created twice; failed search never creates',async()=>{
 const req=buildReservationXml(base);
 const run=async(searchBody)=>{const calls=[];const fetchImpl=async(url,o)=>{calls.push({url,o});
  return new Response(url.endsWith('/searchReservations')?searchBody:ok(950,req.voucher),{status:200});};
  try{return {r:await writePrevioReservation({env:ENV,permissionId:PERM,request:req,fetchImpl}),calls};}catch(e){return {e,calls};}};
 const fresh=await run('<reservations></reservations>');
 assert.deepEqual(fresh.calls.map(c=>c.url.split('/x1/')[1]),['hotel/searchReservations','hotel/reservation']);
 assert.equal(fresh.r.created,true);assert.equal(fresh.r.resId,950);assert.equal(fresh.r.permissionId,PERM);
 assert.equal(fresh.calls[1].o.method,'POST');assert.equal(fresh.calls[1].o.redirect,'error');
 assert.equal(fresh.calls[1].o.headers.Authorization,'ApiKey '+ENV.PREVIO_API_KEY);
 const again=await run(ok(777,req.voucher));
 assert.equal(again.calls.length,1);assert.equal(again.r.created,false);assert.equal(again.r.resId,777);
 const broken=await run('<error><code>1000</code><message>x</message></error>');
 assert.equal(broken.e.code,'PREVIO_SEARCH_FAILED');assert.equal(broken.calls.length,1);
});

test('Previo refusal and auth errors surface as codes',async()=>{
 const req=buildReservationXml(base);
 const f=(body,status=200)=>async(url)=>new Response(url.endsWith('/searchReservations')?'<reservations></reservations>':body,{status});
 await assert.rejects(writePrevioReservation({env:ENV,permissionId:PERM,request:req,fetchImpl:f('<error><code>1001</code><message>full</message></error>')}),/UNIT_TAKEN/);
 await assert.rejects(writePrevioReservation({env:ENV,permissionId:PERM,request:req,fetchImpl:async()=>new Response('',{status:403})}),/PREVIO_AUTH_REFUSED/);
});
