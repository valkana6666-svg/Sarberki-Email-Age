import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePriceReference,isPublicReferenceHost} from '../netlify/functions/price-reference.mjs';
import {handlePriceQuote} from '../netlify/functions/price-quote.mjs';

const url='https://leafy-chimera-2403e5.netlify.app/api/price-reference';
const quote={arrival:'2027-10-01',departure:'2027-10-03',cabin:'deluxe',adults:2,children:[5,8]};
const request=(payload=quote,endpoint=url)=>new Request(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});

test('public reference is restricted to test host and never enables Previo',async()=>{
  assert.equal(isPublicReferenceHost(request()),true);
  assert.equal(isPublicReferenceHost(request(quote,'https://moonlit-torrone-88b39d.netlify.app/api/price-reference')),false);
  let called=0;
  const deny=await handlePriceReference(request(),()=>{called++;},async()=>({rate:400,date:'2026-10-09'}),false);
  assert.equal(deny.status,403);assert.equal(called,0);
  const blocked=await handlePriceQuote(request(quote,url.replace('price-reference','price-quote')),()=>{throw Error('Previo must remain closed');},false);
  assert.equal(blocked.status,503);
  assert.equal((await blocked.json()).code,'PREVIO_SAFETY_GATE_CLOSED');
});

test('fixed guest count prices return HUF, MNB EUR and no claimed availability',async()=>{
  const result=await handlePriceReference(request(),undefined,async()=>({rate:400,date:'2026-10-09',source:'Magyar Nemzeti Bank'}),true);
  assert.equal(result.status,200);
  const body=await result.json();
  assert.equal(body.accommodation,120000);assert.equal(body.tourismTax,2200);assert.equal(body.total,122200);
  assert.equal(body.eurConversion.totalEur,305.5);
  assert.equal(body.status,'public_reference');assert.equal(body.availability,'not_checked');assert.equal(body.bookingCompleted,false);
  assert.equal(body.referenceOnly,true);
});

test('missing EUR is not guessed; checked HUF reference still returns',async()=>{
  const result=await handlePriceReference(request(),undefined,async()=>{throw Error('FX unavailable');},true);
  assert.equal(result.status,200);
  const body=await result.json();
  assert.equal(body.total,122200);assert.equal(body.eurConversion.status,'unavailable');
});

test('extra guest fee not verified => no reference total',async()=>{
  const result=await handlePriceReference(request({...quote,adults:5,children:[]}),undefined,async()=>({rate:400,date:'2026-10-09'}),true);
  assert.equal(result.status,422);assert.equal((await result.json()).status,'unverified');
});

test('rejects identity fields and allows no PMS or book actions',async()=>{
  const result=await handlePriceReference(request({...quote,email:'private@example.com'}),undefined,async()=>({rate:400,date:'2026-10-09'}),true);
  assert.equal(result.status,422);assert.match((await result.json()).error,/személyes adat/u);
});
