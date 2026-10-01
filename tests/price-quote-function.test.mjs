import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePriceQuote,isLivePrevioEnabled,fetchMnbEurRate} from '../netlify/functions/price-quote.mjs';

test('live Previo stays disabled on the isolated test host until no-hold is confirmed',()=>{
  assert.equal(isLivePrevioEnabled(new Request('https://leafy-chimera-2403e5.netlify.app/api/price-quote'),{}),false);
  assert.equal(isLivePrevioEnabled(
    new Request('https://leafy-chimera-2403e5.netlify.app/api/price-quote'),
    {SARBERKI_PREVIO_NO_HOLD_CONFIRMED:'true'}
  ),true);
});

test('live Previo stays disabled on production host by default',()=>{
  assert.equal(isLivePrevioEnabled(new Request('https://moonlit-torrone-88b39d.netlify.app/api/price-quote'),{}),false);
});

test('env flag cannot enable another host or production',()=>{
  const env={SARBERKI_PREVIO_NO_HOLD_CONFIRMED:'true'};
  assert.equal(isLivePrevioEnabled(new Request('https://example.com/api/price-quote'),env),false);
  assert.equal(isLivePrevioEnabled(new Request('https://moonlit-torrone-88b39d.netlify.app/api/price-quote'),env),false);
  assert.equal(isLivePrevioEnabled(new Request('http://localhost/api/price-quote'),env),false);
  assert.equal(isLivePrevioEnabled(new Request('http://127.0.0.1/api/price-quote'),env),false);
});

test('disabled handler does not call the source',async()=>{
  let called=false;
  const req=new Request('https://moonlit-torrone-88b39d.netlify.app/api/price-quote',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({arrival:'2026-10-16',departure:'2026-10-18',cabin:'deluxe',adults:2,children:[]})
  });
  const res=await handlePriceQuote(req,async()=>{called=true;return{};},false);
  assert.equal(res.status,503);
  assert.equal(called,false);
});

test('enabled handler accepts a validated mocked quote',async()=>{
  const req=new Request('https://leafy-chimera-2403e5.netlify.app/api/price-quote',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({arrival:'2026-10-16',departure:'2026-10-18',cabin:'deluxe',adults:2,children:[]})
  });
  const res=await handlePriceQuote(req,async input=>({
    status:'review_required',
    source:'test',
    checkedAt:'2026-09-28T20:00:00.000Z',
    ...input,
    availability:'available',
    availableUnits:1,
    accommodation:90000,
    tourismTax:2200,
    total:92200,
    currency:'HUF',
    bookingCompleted:false
  }),true,async()=>({rate:366.31,date:'2026-09-30',source:'Magyar Nemzeti Bank'}));
  assert.equal(res.status,200);
  const json=await res.json();
  assert.equal(json.total,92200);
  assert.equal(json.bookingCompleted,false);
  assert.equal(json.eurConversion.status,'available');
  assert.equal(json.eurConversion.rateHufPerEur,366.31);
  assert.equal(json.eurConversion.rateDate,'2026-09-30');
  assert.ok(json.eurConversion.totalEur>0);
});


test('MNB EUR lookup falls back to the official daily rates page when SOAP is unavailable',async()=>{
  const calls=[];
  const rate=await fetchMnbEurRate(async (url,options={})=>{
    calls.push({url,method:options.method||'GET'});
    if(String(url).includes('arfolyamok.asmx')) return new Response('service unavailable',{status:503});
    return new Response('<html><body><div>Napi árfolyamok: 30 September 2026</div><table><tr><td>EUR</td><td>Euro</td><td>1</td><td>366.31</td></tr></table></body></html>',{status:200,headers:{'content-type':'text/html'}});
  });
  assert.equal(calls.length,2);
  assert.equal(calls[0].method,'POST');
  assert.equal(calls[1].method,'GET');
  assert.equal(rate.rate,366.31);
  assert.equal(rate.date,'2026-09-30');
  assert.equal(rate.source,'Magyar Nemzeti Bank');
});
