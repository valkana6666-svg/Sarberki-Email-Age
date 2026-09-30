import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {validateQuote} from './price-quote.mjs';

const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
const pricing=fs.readFileSync(new URL('./price-check.js',import.meta.url),'utf8');
const recorded=JSON.parse(fs.readFileSync(new URL('./price-source/fixtures/recorded-previo-quotes.json',import.meta.url),'utf8')).cases;
const sample=(c,extra='')=>`Kedves Sárberki Horgásztó! 2026. október 16–18. között ${c.adults+c.children.length} fő részére, ${c.adults} felnőtt${c.children.length?` és ${c.children.length} gyermek, ${c.children.join(' és ')} évesek`:''} számára ${c.cabin==='family'?'Családi':'Deluxe'} házat szeretnénk. Van szabad hely, és mennyibe kerül összesen? ${extra} Üdvözlettel, Teszt Elek`;

function harness(message,reply){
 const nodes=new Map(),listeners=new Map();let calls=0;
 const element=id=>{
  if(!nodes.has(id)) nodes.set(id,{id,value:'',textContent:'',disabled:false,onclick:null,classList:{contains:()=>false},addEventListener(type,fn){this['on'+type]=fn},insertAdjacentElement(){for(const name of ['price_approval_panel','approved_price_manual','approve_price','price_approval_status']) element(name)}});
  return nodes.get(id);
 };
 const document={getElementById:id=>id==='price_approval_panel'&&!nodes.has(id)?null:element(id),createElement:()=>({id:'',className:'',innerHTML:''}),addEventListener:(type,fn)=>listeners.set(type,fn)};
 element('gmail_record').classList.contains=()=>true;
 const context=vm.createContext({document,window:{addEventListener(){}},console,Date,Intl,Number,JSON,setTimeout:fn=>fn(),fetch:async(_url,options)=>{
  calls++;
  assert.equal(options.method,'POST');
  const input=validateQuote(JSON.parse(options.body));
  return reply(input);
 }});
 vm.runInContext(html.slice(html.indexOf('const $='),html.indexOf('function addEvent(')),context);
 vm.runInContext(pricing,context);
 element('message').value=message;
 return {element,context,listeners,get calls(){return calls},async run(){element('prepare_price').onclick();await element('check_price').onclick();return {draft:element('draft').value,status:element('price_status').textContent,result:element('price_result').textContent}}};
}
function json(result,code=200){return {ok:code<400,headers:{get:()=> 'application/json'},json:async()=>result,status:code};}
function quote(input,record){return {...input,status:'review_required',availability:'available',source:'Sárberki hivatalos foglalási felület',checkedAt:'2026-09-28T17:00:00.000Z',currency:'HUF',...Object.fromEntries(['availableUnits','accommodation','tourismTax','total'].map(k=>[k,record[k]]))};}

test('email extraction → exact anonymous quote input → recorded adult result → human approval → draft',async()=>{
 const record=recorded[0];const h=harness(sample(record),input=>{assert.deepEqual(input,structuredClone(Object.fromEntries(['arrival','departure','cabin','adults','children'].map(k=>[k,record[k]]))));return json(quote(input,record))});
 const r=await h.run();assert.equal(h.calls,1,JSON.stringify({r,arrival:h.element('price_arrival').value,departure:h.element('price_departure').value,cabin:h.element('price_cabin').value,adults:h.element('price_adults').value}));assert.match(r.result,/122.200|122 200/u);assert.doesNotMatch(r.draft,/122.200|122 200/u);
 assert.match(r.status,/jóváhagyás/u);h.element('approve_price').onclick();assert.match(h.element('draft').value,/122.200|122 200/u);assert.match(h.element('status').textContent,/emberi jóváhagyás/u);
});
test('children ages and family cabin survive real extraction and quote boundary',async()=>{
 for(const record of recorded.slice(1)){
  const h=harness(sample(record),input=>{assert.deepEqual(input,structuredClone(Object.fromEntries(['arrival','departure','cabin','adults','children'].map(k=>[k,record[k]]))));return json(quote(input,record))});
  const r=await h.run();assert.equal(h.calls,1);assert.match(r.result,/Teljes ár:/u);assert.match(r.result,/Ft/u);assert.doesNotMatch(r.draft,new RegExp(String(record.total)));
 }
});
test('zero capacity, malformed reply and unavailable service never enter a draft',async()=>{
 for(const response of [json({status:'unavailable',availableUnits:0}),json({status:'review_required',total:122200}),json({status:'unverified',error:'timeout'},503),{headers:{get:()=> 'application/json'},json:async()=>{throw Error('invalid JSON')}}]){
  const h=harness(sample(recorded[0]),async()=>response);const r=await h.run();assert.equal(h.calls,1);assert.equal(r.result,'');assert.match(r.draft,/^$/u);assert.match(r.status,/ellenőrzés|SZÜKSÉGES/u);assert.equal(h.element('approve_price').disabled,true);
 }
 const h=harness(sample(recorded[0]),async()=>{throw Error('network timeout')});const r=await h.run();assert.match(r.status,/network timeout/u);assert.equal(r.result,'');
});
test('unknown cabin, missing guest data and missing child age stop before fetch',async()=>{
 const cases=[sample(recorded[0]).replace('Deluxe','ismeretlen'),sample(recorded[0]).replace(/2 fő részére, 2 felnőtt/u,'ismeretlen létszámú vendég'),sample(recorded[1]).replace('7 és 11 évesek','életkor nélkül')];
 for(const message of cases){const h=harness(message,()=>{throw Error('unexpected fetch')});h.element('prepare_price').onclick();const status=h.element('price_status');assert.ok(status.textContent);if(h.element('price_arrival').value)await h.element('check_price').onclick();assert.equal(h.calls,0);}
});
test('forbidden input is rejected before any mock source call',()=>{
 let calls=0;const source=input=>{calls++;return input};
 for(const extra of [{name:'Teszt Elek'},{email:'test@example.invalid'},{phone:'+36 30 555 1234'},{payment:'card'},{reservationId:'123'},{unexpected:true}])assert.throws(()=>source(validateQuote({...recorded[0],...extra})),/személyes adat/u);
 assert.equal(calls,0);
});
test('loaded Gmail record uses normalized dates and carries its draft through mock quote',async()=>{
 const record=recorded[1],message=sample(record);const h=harness('',input=>json(quote(input,record)));
 h.element('gmail_record').classList.contains=()=>false;
 h.element('gmail_original').textContent=message;
 h.element('gmail_json').value=JSON.stringify({extracted:[{label:'Időszak',value:'2026-10-16 – 2026-10-18'}]});
 h.listeners.get('sarberki:record-loaded')();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.calls,1);
 assert.equal(h.element('price_child_ages').value,'7, 11');
 assert.match(h.element('gmail_draft').value,/7, 11 éves/u);
 assert.doesNotMatch(h.element('gmail_draft').value,/122.200|122 200/u);
 assert.match(h.element('price_result').textContent,/Teljes ár:/u);
});
test('contradictory Gmail booking facts never trigger a quote request',async()=>{
 const messages=[
  sample(recorded[1]).replace('4 fő részére','5 fő részére'),
  sample(recorded[0]).replace('2 fő részére','3 éjszakára, 2 fő részére'),
  sample(recorded[0]).replace('házat szeretnénk','házat szeretnénk az előző foglalás helyett')
 ];
 for(const message of messages){
  const h=harness('',()=>{throw Error('unexpected fetch')});
  h.element('gmail_record').classList.contains=()=>false;
  h.element('gmail_original').textContent=message;
  h.element('gmail_json').value=JSON.stringify({extracted:[{label:'Időszak',value:'2026-10-16 – 2026-10-18'}]});
  h.listeners.get('sarberki:record-loaded')();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.calls,0,message);
  assert.match(h.element('price_status').textContent,/kezelői ellenőrzés/u);
  assert.equal(h.element('price_result').textContent,'');
 }
});


test('over-capacity request automatically prices the minimum number of houses',async()=>{
  const message='Kedves Sárberki Horgásztó! 2027. október 1–3. között 7 fő mennénk: 5 felnőtt és 2 gyermek, 7 és 11 évesek. Deluxe házat szeretnénk. Mennyi a teljes ár?';
  const h=harness(message,input=>{
    assert.equal(input.units,2);
    return json(quote(input,{availableUnits:4,accommodation:240000,tourismTax:4400,total:244400}));
  });
  const r=await h.run();
  assert.equal(h.calls,1);
  assert.match(r.result,/Egységek: 2/u);
  assert.match(r.result,/244.400|244 400/u);
  assert.doesNotMatch(r.draft,/244.400|244 400/u);
});


test('split cabin is stopped in UI before live quote fetch',async()=>{
  const message='Kedves Sárberki Horgásztó! 2027. október 1–3. között 4 fő mennénk. Osztott házat szeretnénk. Mennyi a teljes ár?';
  const h=harness(message,()=>{throw Error('unexpected fetch')});
  h.element('prepare_price').onclick();
  await h.element('check_price').onclick();
  assert.equal(h.calls,0);
  assert.match(h.element('price_status').textContent,/OSZTOTT HÁZ|KÉZI ELLENŐRZÉS/u);
});


test('explicit multiple-unit request gets a live internal price while modifications and cancellations stay blocked',async()=>{
  const multi='Kedves Sárberki Horgásztó! 2027. október 1–3. között 4 fő mennénk, két Deluxe házat szeretnénk. Mennyi a teljes ár?';
  const h=harness(multi,input=>{
    assert.equal(input.units,2);
    return json({...quote(input,{availableUnits:4,accommodation:240000,tourismTax:4400,total:244400}),
      unitBreakdown:[
        {unit:1,adults:2,children:[],accommodation:120000,tourismTax:2200,total:122200},
        {unit:2,adults:2,children:[],accommodation:120000,tourismTax:2200,total:122200}
      ],
      eurConversion:{status:'available',rateHufPerEur:366.31,rateDate:'2026-09-30',source:'Magyar Nemzeti Bank',totalEur:667.20}
    });
  });
  const r=await h.run();
  assert.equal(h.calls,1);
  assert.match(r.result,/Egységek: 2/u);
  assert.match(r.result,/1\. egység:.*122.200|1\. egység:.*122 200/u);
  assert.match(r.result,/2\. egység:.*122.200|2\. egység:.*122 200/u);
  assert.match(r.result,/EUR:.*667,20|EUR:.*667\.20/u);
  assert.doesNotMatch(r.draft,/244.400|244 400/u);
  h.element('approve_price').onclick();
  assert.match(h.element('draft').value,/244.400|244 400/u);
  assert.match(h.element('draft').value,/Házanként:/u);
  for(const message of [
    'Kedves Sárberki Horgásztó! A korábbi foglalásunkat 2027. október 1–3. közötti Deluxe házra módosítanánk. Mennyi lenne az ár?',
    'Kedves Sárberki Horgásztó! A 2027. október 1–3. közötti Deluxe foglalásunkat lemondanánk.'
  ]){
    const blocked=harness(message,()=>{throw Error('unexpected fetch')});
    blocked.element('prepare_price').onclick();
    await blocked.element('check_price').onclick();
    assert.equal(blocked.calls,0,message);
    assert.match(blocked.element('price_status').textContent,/KÉZI ELLENŐRZÉS/u);
  }
});


test('informal Hungarian family request survives the full email-to-quote chain',async()=>{
  const message='Szia! 2026. október 16–18. között négyen mennénk: 2 felnőtt és két gyerekkel, 7 meg 11 évesek. Deluxe házat szeretnénk, lehetőleg dézsával. Telefonszámom: +36 30 555 1234. Van szabad hely, és mennyi lenne összesen?';
  const expected={arrival:'2026-10-16',departure:'2026-10-18',cabin:'deluxe',adults:2,children:[7,11]};
  const record=recorded.find(r=>r.cabin==='deluxe'&&r.adults===2&&Array.isArray(r.children)&&r.children.length===2);
  assert.ok(record,'missing recorded Deluxe family fixture');
  const h=harness(message,input=>{
    assert.deepEqual(input,expected);
    return json(quote(input,record));
  });
  const r=await h.run();
  assert.equal(h.calls,1);
  assert.equal(h.element('price_child_ages').value,'7, 11');
  assert.match(r.result,/Teljes ár:/u);
  assert.doesNotMatch(r.draft,/Ft/u);
});


test('English two Deluxe cabins reach quote boundary as two units',async()=>{
  const message=`Hello,

We would like to stay at Sárberki Fishing Lake from 16 October 2026 to 18 October 2026.

There will be 8 people in total: 6 adults and 2 children, aged 7 and 11. We would like to book two cabins, preferably Deluxe cabins with hot tubs.

We are also bringing one dog.

Could you please let us know the availability and the price for each cabin separately, as well as the total price?

Phone: +36 30 555 1234

Kind regards,
John Smith`;
  const h=harness(message,input=>{
    assert.deepEqual(input,{arrival:'2026-10-16',departure:'2026-10-18',cabin:'deluxe',adults:6,children:[7,11],units:2});
    return json({...quote(input,{availableUnits:4,accommodation:240000,tourismTax:4400,total:244400}),
      units:2,
      unitBreakdown:[
        {unit:1,adults:3,children:[7],accommodation:120000,tourismTax:2200,total:122200},
        {unit:2,adults:3,children:[11],accommodation:120000,tourismTax:2200,total:122200}
      ]
    });
  });
  const r=await h.run();
  assert.equal(h.calls,1);
  assert.match(r.result,/Egységek: 2/u);
  assert.match(r.result,/1\. egység/u);
  assert.match(r.result,/2\. egység/u);
  assert.doesNotMatch(r.draft,/244.400|244 400/u);
});
