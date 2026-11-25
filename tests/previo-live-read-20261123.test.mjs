// Owner 2026-11-23: Claude's read-only live Previo probe. Synthetic only: no network, fictional data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {run,shape,codeList,xmlShape,previoLiveReader} from '../scripts/previo-live-read.mjs';

const KEY='synthetic-live-readonly-key-9876543210';
const FAKE_GUEST='Kitalált Vendég',FAKE_MAIL='kitalalt@example.test',FAKE_PHONE='+36 30 123 4567';

test('reservation search: only counts, statuses and tag names – never a guest value',()=>{
 const xml=`<reservations><reservation><resId>1</resId><voucher>X1</voucher><status><statusId>2</statusId></status><guest><name>${FAKE_GUEST}</name><email>${FAKE_MAIL}</email><phone>${FAKE_PHONE}</phone></guest><price>99000</price><gNote>titkos megjegyzés</gNote></reservation><reservation><resId>2</resId><status><statusId>7</statusId></status></reservation></reservations>`;
 const s=xmlShape(xml),out=JSON.stringify(s);
 assert.equal(s.reservations,2);assert.deepEqual(s.statusCounts,{2:1,7:1});assert.ok(s.tags.includes('email'));
 for(const v of [FAKE_GUEST,FAKE_MAIL,FAKE_PHONE,'99000','titkos','X1'])assert.ok(!out.includes(v),v);
});

test('shape keeps keys and counts only; code lists keep id/name but drop personal-looking fields',()=>{
 const s=JSON.stringify(shape([{id:1,guest:{name:FAKE_GUEST,email:FAKE_MAIL}}]));
 assert.ok(!s.includes(FAKE_GUEST)&&!s.includes(FAKE_MAIL));assert.match(s,/"array":1/);
 const c=codeList([{guaId:472221,name:'Felnőtt',ageFrom:18,contactEmail:FAKE_MAIL,note:'x'}]);
 assert.deepEqual(c,[{guaId:472221,name:'Felnőtt',ageFrom:18}]);
});

test('only allowlisted calls: GET REST reads, the XML search and the suggester; key required; no write path exists',async()=>{
 assert.throws(()=>previoLiveReader({apiKey:'short'}),/missing/);
 const calls=[];
 const fetchImpl=async(url,o)=>{calls.push({url,method:o.method,auth:o.headers.Authorization,hotel:o.headers['X-Previo-Hotel-Id']});
  if(url.endsWith('/rest/guest-categories'))return new Response(JSON.stringify([{guaId:900,name:'Felnőtt'},{guaId:901,name:'Gyerek'}]));
  if(url.endsWith('/suggester'))return new Response(JSON.stringify({totalPrice:126000,currency:{currencyCode:'HUF'}}));
  if(url.includes('/x1/hotel/searchReservations'))return new Response('<reservations></reservations>');
  if(url.endsWith('/rest/rooms'))return new Response(JSON.stringify({code:403,error:"You don't have access to 'Hotel.rooms' module."}),{status:403});
  return new Response('[]');};
 const r=await run({probes:['rooms','guestCategories','price','reservations','get:/rest/x','get:https://evil.example/'],arrival:'2027-06-15',departure:'2027-06-17',cabin:'deluxe',adults:2,from:'2026-11-23',to:'2026-11-25'},{apiKey:KEY,fetchImpl});
 assert.equal(r.rooms.http,403);assert.match(r.rooms.error,/Hotel\.rooms/);
 assert.equal(r.price.totalPrice,126000,'adult category taken from the live list');
 assert.equal(r.reservations.reservations,0);
 assert.equal(r['get:https://evil.example/'].error,'PATH');
 assert.ok(calls.every(c=>c.url.startsWith('https://api.previo.app/')&&c.hotel==='753011'&&c.auth==='ApiKey '+KEY));
 assert.ok(calls.every(c=>c.method==='GET'||/\/suggester$|\/x1\/hotel\/searchReservations$|\/x1\/hotel\/getPayments$/.test(c.url)),'POST only for the calculation and the search');
 assert.ok(!calls.some(c=>/\/x1\/hotel\/reservation$|setReservation|cancel|status/i.test(c.url)));
});

test('payments probe: count and field names only, never an amount or a name',async()=>{
 const fetchImpl=async()=>new Response('<payments><payment><id>1</id><issued>2021-05-02 10:00:00</issued><amount>90750</amount><name>Kitalált Vendég</name></payment><payment><issued>2026-01-03</issued></payment></payments>');
 const r=await run({probes:['payments'],from:'2026-11-01',to:'2026-11-30'},{apiKey:KEY,fetchImpl});
 const out=JSON.stringify(r);assert.equal(r.payments.payments,2);assert.equal(r.payments.earliest,'2021-05-02');assert.deepEqual(r.payments.perYear,{2021:1,2026:1});assert.ok(r.payments.tags.includes('amount'));
 assert.ok(!out.includes('90750')&&!out.includes('Kitalált'));
});
