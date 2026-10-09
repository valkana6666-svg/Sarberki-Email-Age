import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {handleManualFx} from '../netlify/functions/manual-fx.mjs';

const TEST='https://leafy-chimera-2403e5.netlify.app/api/manual-fx';
const quoteScript=fs.readFileSync(new URL('../price-check.js',import.meta.url),'utf8');

test('manual FX only accesses MNB on isolated test host and only by GET',async()=>{
  let calls=0;
  const source=async()=>{calls++;return {rate:389.15,date:'2026-10-09',source:'Magyar Nemzeti Bank'};};
  for(const [url,method,status] of [
    ['https://moonlit-torrone-88b39d.netlify.app/api/manual-fx','GET',403],
    [TEST,'POST',405],
    ['https://example.org/api/manual-fx','GET',403]
  ]){
    const r=await handleManualFx(new Request(url,{method}),source);
    assert.equal(r.status,status);
  }
  assert.equal(calls,0,'Blocked requests must not even fetch exchange rates.');
  const res=await handleManualFx(new Request(TEST),source);
  assert.equal(res.status,200);
  assert.equal(calls,1);
  assert.deepEqual(await res.json(),{status:'available',rateHufPerEur:389.15,rateDate:'2026-10-09',source:'Magyar Nemzeti Bank'});
});

test('missing or untrusted currency rates never create EUR quotes',async()=>{
  for(const source of [async()=>({rate:0,date:'2026-10-09',source:'Magyar Nemzeti Bank'}),async()=>({rate:380,date:'yesterday',source:'unknown'}),async()=>{throw Error('timeout');}]){
    const res=await handleManualFx(new Request(TEST),source);
    assert.equal(res.status,503);
    assert.equal((await res.json()).status,'unavailable');
  }
});

function setupManualQuote(){
  const nodes=new Map();
  const elem=id=>{
    if(!nodes.has(id))nodes.set(id,{id,value:'',checked:false,disabled:true,textContent:'',classList:{contains:()=>true},addEventListener(type,handler){this['on'+type]=handler;},insertAdjacentElement(){for(const name of ['price_approval_panel','approved_price_manual','manual_quote_confirmed','approve_price','price_approval_status'])elem(name);}});
    return nodes.get(id);
  };
  const document={getElementById:id=>id==='price_approval_panel'&&!nodes.has(id)?null:elem(id),createElement:()=>({id:'',className:'',innerHTML:''}),addEventListener:()=>{}};
  let fxCalls=0;
  const context=vm.createContext({document,window:{},console,Date,Intl,Number,JSON,fetch:async(url,options)=>{
    assert.equal(url,'/api/manual-fx');
    assert.equal(options.method,'GET');
    fxCalls++;
    return {ok:true,json:async()=>({status:'available',rateHufPerEur:400,rateDate:'2026-10-09',source:'Magyar Nemzeti Bank'})};
  }});
  vm.runInContext(quoteScript,context);
  for(const [id,value]of Object.entries({price_arrival:'2026-10-16',price_departure:'2026-10-18',price_cabin:'deluxe',price_adults:'2',price_children:'2',price_child_ages:'5, 8',approved_price_manual:'122200'}))elem(id).value=value;
  return {elem,get fxCalls(){return fxCalls;}};
}

test('manual price cannot be approved before operator confirms availability and exact guest facts',async()=>{
  const h=setupManualQuote();
  h.elem('approved_price_manual').oninput();
  assert.equal(h.elem('approve_price').disabled,true);
  assert.match(h.elem('price_approval_status').textContent,/pipálod/u);
  assert.equal(h.fxCalls,0);
  h.elem('manual_quote_confirmed').checked=true;
  await h.elem('manual_quote_confirmed').onchange();
  assert.equal(h.elem('approve_price').disabled,false);
  assert.equal(h.fxCalls,1);
  assert.match(h.elem('price_approval_status').textContent,/305,50|305.50|305,5/u);
  assert.equal(h.elem('draft').value,'','Approval click must be separate.');
  h.elem('price_child_ages').value='5, 9';
  h.elem('price_child_ages').onchange();
  assert.equal(h.elem('approve_price').disabled,true);
  assert.equal(h.elem('manual_quote_confirmed').checked,false);
});

test('missing child age, dates, or house blocks manual approval and no FX call occurs',async()=>{
  for(const [field,value]of [['price_child_ages','5'],['price_arrival',''],['price_cabin','']]){
    const h=setupManualQuote();
    h.elem(field).value=value;
    h.elem('manual_quote_confirmed').checked=true;
    await h.elem('manual_quote_confirmed').onchange();
    assert.equal(h.elem('manual_quote_confirmed').checked,false);
    assert.equal(h.elem('approve_price').disabled,true);
    assert.equal(h.fxCalls,0);
  }
});

test('price approval remains a distinct human action; no emails, booking, or Previo writes added',()=>{
  assert.match(quoteScript,/Ár jóváhagyása és beépítése a levélbe/u);
  assert.match(quoteScript,/Hivatalos Sárberki \/ Previo foglaló megnyitása/u);
  assert.match(quoteScript,/if\(!pendingQuote\|\|pendingQuote\.fingerprint!==quoteFingerprint\(\)/u);
  assert.match(quoteScript,/Még nincs a vendégválaszban/u);
  const fxFile=fs.readFileSync(new URL('../netlify/functions/manual-fx.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(fxFile,/booking\.previo\.cz|createReservation|get-occupancy-price|new booking/iu);
});
