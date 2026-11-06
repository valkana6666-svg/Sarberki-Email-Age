import test from 'node:test';
import assert from 'node:assert/strict';
import {discover,CALLS} from '../scripts/previo-readonly-discovery.mjs';

test('first Previo read: only three listing GETs on 73521, safe fields only, live property refused (no network)',async()=>{
 const seen=[];
 const fetchImpl=async(url,init)=>{seen.push({url,init});
  const path=new URL(url).pathname;
  const body=path==='/rest/rate-plan'?[{ratePlanId:1,name:'Alap',isBasePlan:true,secret:'x'}]:path==='/rest/premise/kind'?[{prkId:5,name:'Deluxe',capacity:4}]:[{roomId:9,name:'1',roomKindId:5,guestName:'nem kell'}];
  return new Response(JSON.stringify(body),{status:200});};
 const r=await discover({fetchImpl});
 assert.equal(seen.length,3);
 for(const s of seen){assert.equal(s.init.method,'GET');assert.equal(s.init.headers['X-Previo-Hotel-Id'],'73521');assert.match(s.url,/^https:\/\/api\.previo\.app\/rest\/(rate-plan|premise\/kind\?obtId=1|rooms)$/);
  assert.equal(s.init.headers.Authorization,'ApiKey PROXY_REPLACES_THIS');}
 assert.deepEqual(r.calls.map(c=>c.count),[1,1,1]);
 assert.equal(JSON.stringify(r).includes('secret'),false);assert.equal(JSON.stringify(r).includes('guestName'),false);
 assert.ok(!CALLS.some(c=>/calendar|availability|reservation|guest/i.test(c.path)));
 await assert.rejects(discover({fetchImpl,hotelId:'753011'}),/ONLY_TEST_PROPERTY_73521/);
 const failing=await discover({fetchImpl:async()=>new Response('no',{status:403})});
 assert.deepEqual(failing.calls.map(c=>c.error),['HTTP_403','HTTP_403','HTTP_403']);
});
