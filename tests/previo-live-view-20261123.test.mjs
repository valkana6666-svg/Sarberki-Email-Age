// Owner 2026-11-23: the live Previo (753011) availability is only shown in the daily view. Synthetic only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {liveAvailabilityReader,liveAvailabilityLine} from '../shared-core/server-previo-live-view.mjs';

const TEST_KEY='synthetic-previo-key-0123456789',LIVE_KEY='synthetic-live-readonly-key-9876543210';
const ON={PREVIO_LIVE_SHOW:'availability-only',PREVIO_API_KEY:TEST_KEY,PREVIO_LIVE_API_KEY:LIVE_KEY};
const answer=n=>JSON.stringify([{ratePlanId:146385,availability:[{date:'2027-06-15',roomKinds:[{id:766439,availability:n}]},{date:'2027-06-16',roomKinds:[{id:766439,availability:n}]}]}]);

test('off without its own switch or its own key; never the TEST key',()=>{
 assert.equal(liveAvailabilityReader({...ON,PREVIO_LIVE_SHOW:''}),null);
 assert.equal(liveAvailabilityReader({...ON,PREVIO_LIVE_API_KEY:undefined}),null);
 assert.equal(liveAvailabilityReader({...ON,PREVIO_LIVE_API_KEY:TEST_KEY}),null);
 assert.equal(liveAvailabilityReader({...ON,PREVIO_LIVE_READ:'availability-only',PREVIO_LIVE_SHOW:undefined}),null,'the price-step switch does not turn the view on');
});

test('one live calendar GET with the live key, type id and base plan; cached for 5 minutes; nothing written',async()=>{
 const calls=[];let t=0;
 const read=liveAvailabilityReader(ON,async(url,o)=>{calls.push({url,o});return new Response(answer(1),{status:200});},{now:()=>t});
 const q={cabin:'deluxe',arrival:'2027-06-15',departure:'2027-06-17'};
 assert.deepEqual(await read(q),{status:'read',free:1});
 assert.equal(calls.length,1);assert.equal(calls[0].o.method,'GET');assert.equal(calls[0].o.headers.Authorization,'ApiKey '+LIVE_KEY);
 assert.equal(calls[0].o.headers['X-Previo-Hotel-Id'],'753011');assert.match(calls[0].url,/\/rest\/calendar\/availability\?/);
 assert.match(calls[0].url,/146385/);assert.match(calls[0].url,/766439/);
 t=4*60000;await read(q);assert.equal(calls.length,1,'cached');
 t=6*60000;await read(q);assert.equal(calls.length,2,'cache expired');
});

test('a failed or refused read is "unknown", never free or full; the line says so',async()=>{
 const q={cabin:'vip',arrival:'2027-10-01',departure:'2027-10-03'};
 const r403=await liveAvailabilityReader(ON,async()=>new Response('{}',{status:403}))(q);
 assert.deepEqual(r403,{status:'unknown'});
 assert.match(liveAvailabilityLine(q,r403),/VIP 2027-10-01 → 2027-10-03: most nem olvasható\.$/);
 assert.deepEqual(await liveAvailabilityReader(ON,async()=>{throw Error('x');})({cabin:'nope',arrival:'2027-10-01',departure:'2027-10-03'}),{status:'unknown'});
 assert.match(liveAvailabilityLine({cabin:'deluxe',arrival:'2027-06-15',departure:'2027-06-17'},{status:'read',free:2}),/^🔎 Éles Previo \(csak olvasva, tájékoztató\): Deluxe .*: 2 szabad\. A foglalás most a teszt Previóba kerül\.$/);
 assert.match(liveAvailabilityLine({cabin:'splitA',arrival:'2027-06-15',departure:'2027-06-17'},{status:'read',free:3}),/3 szabad \(az A\/B közös készletben\)/);
 assert.match(liveAvailabilityLine({cabin:'family',arrival:'2027-06-15',departure:'2027-06-17'},{status:'read',free:0}),/nincs szabad\./);
});
