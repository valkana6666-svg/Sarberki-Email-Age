import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateQuote,parseHuf,fetchQuote} from './price-quote.mjs';
import netlifyQuote,{handlePriceQuote} from './netlify/functions/price-quote.mjs';

test('only exact future dates and explicit room and adult count are accepted', () => {
  assert.deepEqual(validateQuote({arrival:'2027-10-01',departure:'2027-10-02',cabin:'deluxe',adults:5}),{arrival:'2027-10-01',departure:'2027-10-02',cabin:'deluxe',adults:5,children:[]});
  for (const bad of [
    {arrival:'2026-02-30',departure:'2026-03-02',cabin:'deluxe',adults:5},
    {arrival:'2027-10-02',departure:'2027-10-01',cabin:'deluxe',adults:5},
    {arrival:'2027-10-01',departure:'2027-10-02',cabin:'',adults:5},
    {arrival:'2027-10-01',departure:'2027-10-02',cabin:'deluxe',adults:0},
    {arrival:'2027-10-01',departure:'2027-10-02',cabin:'deluxe',adults:2,children:[-1]},
    {arrival:'2027-10-01',departure:'2027-10-02',cabin:'deluxe',adults:5,children:[7,11]},
  ]) assert.throws(() => validateQuote(bad));
  assert.deepEqual(validateQuote({arrival:'2027-10-01',departure:'2027-10-02',cabin:'small',adults:2,children:[4]}),{arrival:'2027-10-01',departure:'2027-10-02',cabin:'small',adults:2,children:[4]});
});
test('personal and unrecognized fields are rejected before a Previo request',()=>{
 for(const extra of [{name:'Teszt Elek'},{email:'test@example.invalid'},{phone:'+36 30 555 1234'},{payment:'card'},{reservationId:'123'}])
  assert.throws(()=>validateQuote({arrival:'2027-10-01',departure:'2027-10-02',cabin:'deluxe',adults:2,children:[],...extra}),/személyes adat/u);
});
test('forbidden input fields make zero adapter calls even if live gate were enabled',async()=>{
 let calls=0;
 const source=async()=>{calls++;throw Error('should never run');};
 for(const field of ['name','email','phone','payment','reservationId','unknown']) {
  const body={arrival:'2027-10-01',departure:'2027-10-02',cabin:'deluxe',adults:2,children:[],[field]:'value'};
  const request=new Request('https://example.test/api/price-quote',{method:'POST',body:JSON.stringify(body)});
  const response=await handlePriceQuote(request,source,true);
  assert.equal(response.status,503);
  assert.equal((await response.json()).total,undefined);
 }
 assert.equal(calls,0);
});

test('price summary accepts only HUF and preserves the displayed total', () => {
  assert.equal(parseHuf('86\u00a0750 Ft'),86750);
  assert.equal(parseHuf('2 750 Ft'),2750);
  for (const invalid of ['86 750 EUR','86 750 Ft / éj','nincs ár']) assert.throws(() => parseHuf(invalid));
});

test('child price is blocked before a browser is opened', async () => {
  let launched=false;
  await assert.rejects(fetchQuote({arrival:'2027-10-01',departure:'2027-10-02',cabin:'deluxe',adults:4,children:[6]},()=>{launched=true;}),/gyermekkor/);
  assert.equal(launched,false);
});

test('deployed quote fails closed with JSON when live source fails', async () => {
  const request = new Request('https://example.test/api/price-quote', {
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({arrival:'2027-10-01',departure:'2027-10-02',cabin:'vip',adults:2,children:[]})
  });
  const response = await handlePriceQuote(request,async()=>{throw Error('Previo elérhetetlen');},true);
  assert.equal(response.status,503);
  assert.match(response.headers.get('content-type'),/application\/json/u);
  const body = await response.json();
  assert.equal(body.status,'unverified');
  assert.match(body.error,/HITELES ÁRLEKÉRÉS SZÜKSÉGES.*Previo elérhetetlen/u);
});

test('Netlify endpoint returns only checked adapter data and omits price when unavailable',async()=>{
 const make=()=>new Request('https://example.test/api/price-quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({arrival:'2027-10-01',departure:'2027-10-02',cabin:'deluxe',adults:2,children:[]})});
 const good=await handlePriceQuote(make(),async()=>({status:'review_required',total:122200,source:'Sárberki hivatalos foglalási felület'}),true);
 assert.equal(good.status,200);assert.equal((await good.json()).total,122200);
 const empty=await handlePriceQuote(make(),async()=>({status:'unavailable',availability:'unavailable'}),true);
 assert.equal(empty.status,200);assert.equal((await empty.json()).total,undefined);
 const invalid=await handlePriceQuote(make(),async()=>({status:'review_required',total:0}),true);
 assert.equal(invalid.status,503);
});

test('Netlify runtime context is not mistaken for the price adapter',async()=>{
 const request=new Request('https://example.test/api/price-quote',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
 const response=await netlifyQuote(request,{site:{id:'netlify-context'}});
 assert.equal(response.status,503);
 assert.doesNotMatch((await response.json()).error,/source is not a function/u);
});
test('without PMS no-hold verification no live request is made',async()=>{
 const request=new Request('https://example.test/api/price-quote',{method:'POST',body:'{}'});
 let called=false;
 const response=await handlePriceQuote(request,async()=>{called=true;},false);
 assert.equal(response.status,503);
 assert.equal(called,false);
 assert.match((await response.json()).error,/foglalásmentessége/u);
});


test('multi-house capacity is accepted only with an explicit sufficient unit count',()=>{
  assert.throws(()=>validateQuote({arrival:'2027-10-01',departure:'2027-10-03',cabin:'family',adults:8,children:[7]}),/kapacitását/u);
  assert.deepEqual(validateQuote({arrival:'2027-10-01',departure:'2027-10-03',cabin:'family',adults:8,children:[7],units:2}),{arrival:'2027-10-01',departure:'2027-10-03',cabin:'family',adults:8,children:[7],units:2});
  assert.deepEqual(validateQuote({arrival:'2027-10-01',departure:'2027-10-03',cabin:'deluxe',adults:6,children:[3],units:2}),{arrival:'2027-10-01',departure:'2027-10-03',cabin:'deluxe',adults:6,children:[3],units:2});
});
