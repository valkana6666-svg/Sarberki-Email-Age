import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePriceQuote,isLivePrevioEnabled} from './price-quote.mjs';

test('live Previo is enabled on the isolated test host',()=>{
  assert.equal(isLivePrevioEnabled(new Request('https://leafy-chimera-2403e5.netlify.app/api/price-quote'),{}),true);
});

test('live Previo stays disabled on production host by default',()=>{
  assert.equal(isLivePrevioEnabled(new Request('https://moonlit-torrone-88b39d.netlify.app/api/price-quote'),{}),false);
});

test('explicit confirmed env flag can enable another host',()=>{
  assert.equal(isLivePrevioEnabled(new Request('https://example.com/api/price-quote'),{SARBERKI_PREVIO_NO_HOLD_CONFIRMED:'true'}),true);
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
  }),true);
  assert.equal(res.status,200);
  const json=await res.json();
  assert.equal(json.total,92200);
  assert.equal(json.bookingCompleted,false);
});
