import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {validateQuote} from './price-quote.mjs';
import * as sharedNormalize from './sarberki-core.mjs';

const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
const pricing=fs.readFileSync(new URL('./price-check.js',import.meta.url),'utf8');
const recorded=JSON.parse(fs.readFileSync(new URL('./price-source/fixtures/recorded-previo-quotes.json',import.meta.url),'utf8')).cases;
const cabinLabel=cabin=>({deluxe:'Deluxe',family:'Családi',vip:'VIP',small:'Különálló'})[cabin]||cabin;
const sample=(c,extra='')=>`Kedves Sárberki Horgásztó! 2026. október 16–18. között ${c.adults+c.children.length} fő részére, ${c.adults} felnőtt${c.children.length?` és ${c.children.length} gyermek, ${c.children.join(' és ')} évesek`:''} számára ${cabinLabel(c.cabin)} házat szeretnénk. Van szabad hely, és mennyibe kerül összesen? ${extra} Üdvözlettel, Teszt Elek`;

function harness(message,reply){
 const nodes=new Map(),listeners=new Map();let calls=0;
 const element=id=>{
  if(!nodes.has(id)) nodes.set(id,{id,value:'',textContent:'',disabled:false,onclick:null,classList:{contains:()=>false},addEventListener(type,fn){this['on'+type]=fn},insertAdjacentElement(){for(const name of ['price_approval_panel','approved_price_manual','approve_price','price_approval_status']) element(name)}});
  return nodes.get(id);
 };
 const document={getElementById:id=>id==='price_approval_panel'&&!nodes.has(id)?null:element(id),createElement:()=>({id:'',className:'',innerHTML:''}),addEventListener:(type,fn)=>listeners.set(type,fn)};
 element('gmail_record').classList.contains=()=>true;
 const context=vm.createContext({document,window:{SarberkiNormalize:sharedNormalize,addEventListener(){}},console,Date,Intl,Number,JSON,setTimeout:fn=>fn(),fetch:async(_url,options)=>{
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
  const message='Kedves Sárberki Horgásztó! 2027. október 1–3. között 4 felnőtt mennénk, gyermek nélkül. Osztott házat szeretnénk. Mennyi a teljes ár?';
  const h=harness(message,()=>{throw Error('unexpected fetch')});
  h.element('prepare_price').onclick();
  await h.element('check_price').onclick();
  assert.equal(h.calls,0);
  assert.match(h.element('price_status').textContent,/OSZTOTT HÁZ|KÉZI ELLENŐRZÉS/u);
});


test('explicit multiple-unit request gets a live internal price while modifications and cancellations stay blocked',async()=>{
  const multi='Kedves Sárberki Horgásztó! 2027. október 1–3. között 4 felnőtt mennénk, gyermek nélkül, két Deluxe házat szeretnénk. Mennyi a teljes ár?';
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


test('German and Slovenian explicit two-unit wording reaches the same quote boundary',async()=>{
  const cases=[
    ['Guten Tag! Wir möchten vom 16. bis 18. Oktober 2027 mit 4 Erwachsenen ohne Kinder kommen und zwei Deluxe-Häuser buchen. Wie hoch ist der Gesamtpreis?', 'de'],
    ['Pozdravljeni! Od 16. do 18. oktobra 2027 bi prišli 4 odrasli brez otrok in želeli dve Deluxe hiški. Kakšna je skupna cena?', 'si']
  ];
  for(const [message,label] of cases){
    const h=harness(message,input=>{
      assert.deepEqual(input,{arrival:'2027-10-16',departure:'2027-10-18',cabin:'deluxe',adults:4,children:[],units:2},label);
      return json({...quote(input,{availableUnits:4,accommodation:240000,tourismTax:4400,total:244400}),units:2});
    });
    const r=await h.run();
    assert.equal(h.calls,1,label+' '+r.status);
    assert.match(r.result,/Egységek: 2/u,label);
    assert.doesNotMatch(r.draft,/244.400|244 400/u,label);
  }
});

test('Gmail normalized record can rescue weaker extractor values at quote boundary',async()=>{
  const record=recorded[1];
  const message='Hello, Deluxe cabin, price please.';
  const h=harness('',input=>{
    assert.deepEqual(input,{arrival:'2026-10-16',departure:'2026-10-18',cabin:'deluxe',adults:2,children:[7,11]});
    return json(quote(input,record));
  });
  h.element('gmail_record').classList.contains=()=>false;
  h.element('gmail_original').textContent=message;
  h.element('gmail_json').value=JSON.stringify({
    extracted:[{label:'Időszak',value:'2026-10-16 – 2026-10-18'}],
    normalized:{dates:{arrival:'2026-10-16',departure:'2026-10-18'},cabin:'Deluxe',guests:4,adults:2,children:2,child_ages:[7,11]},
    human_review:['Szabad hely és ár nincs igazolva']
  });
  h.listeners.get('sarberki:record-loaded')();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.calls,1);
  assert.equal(h.element('price_adults').value,'2');
  assert.equal(h.element('price_children').value,'2');
  assert.equal(h.element('price_child_ages').value,'7, 11');
});

test('Gmail human-review guest contradiction blocks quote even if pricing fields look complete',async()=>{
  const h=harness('',()=>{throw Error('unexpected fetch')});
  h.element('gmail_record').classList.contains=()=>false;
  h.element('gmail_original').textContent='2026. október 16–18. Deluxe, 8 fő: 5 felnőtt és 2 gyermek, 7 és 11 évesek.';
  h.element('gmail_json').value=JSON.stringify({
    extracted:[{label:'Időszak',value:'2026-10-16 – 2026-10-18'}],
    normalized:{dates:{arrival:'2026-10-16',departure:'2026-10-18'},cabin:'Deluxe',guests:8,adults:5,children:2,child_ages:[7,11]},
    human_review:['Ellentmondó létszámadat: összesen 8 fő, de 5 felnőtt + 2 gyermek = 7 fő']
  });
  h.listeners.get('sarberki:record-loaded')();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.calls,0);
  assert.match(h.element('price_status').textContent,/kezelői ellenőrzés/u);
});


test('dense new Deluxe inquiry is not treated as modification and prices minimum two units',async()=>{
  const message=`Tisztelt Sárberki Horgásztó!

2026. október 23–26. között szeretnénk Önöknél megszállni, összesen 3 éjszakára.

Összesen 8 fő érkezne: 5 felnőtt és 3 gyermek. A gyermekek 4, 9 és 13 évesek.

Elsősorban Deluxe házat szeretnénk, lehetőleg dézsafürdővel és saját stéggel. Mivel nyolcan érkezünk, több szállásegység is megfelelő lehet számunkra, ezért szeretnénk megtudni, milyen elhelyezést tudnak ajánlani erre a létszámra.

Egy kistestű kutyát is vinnénk magunkkal.

Kérem, írják meg, hogy az adott időszakban milyen szabad szálláslehetőségek vannak, valamint mennyi lenne a teljes szállásdíj a 3 éjszakára.

Telefonszám: +36 30 555 1234

Köszönettel:
Teszt Elek`;
  const h=harness(message,input=>{
    assert.deepEqual(input,{arrival:'2026-10-23',departure:'2026-10-26',cabin:'deluxe',adults:5,children:[4,9,13],units:2});
    return json({...quote(input,{availableUnits:4,accommodation:300000,tourismTax:6600,total:306600}),units:2});
  });
  const r=await h.run();
  assert.equal(h.calls,1,r.status);
  assert.doesNotMatch(r.status,/Módosítás vagy lemondás/u);
  assert.match(r.result,/Egységek: 2/u);
});


test('dense Deluxe inquiry reports two required units when Previo has zero free units',async()=>{
  const message=`Tisztelt Sárberki Horgásztó!

2026. október 23–26. között szeretnénk Önöknél megszállni, összesen 3 éjszakára.

Összesen 8 fő érkezne: 5 felnőtt és 3 gyermek. A gyermekek 4, 9 és 13 évesek.

Elsősorban Deluxe házat szeretnénk, lehetőleg dézsafürdővel és saját stéggel. Mivel nyolcan érkezünk, több szállásegység is megfelelő lehet számunkra, ezért szeretnénk megtudni, milyen elhelyezést tudnak ajánlani erre a létszámra.

Kérem, írják meg, hogy az adott időszakban milyen szabad szálláslehetőségek vannak, valamint mennyi lenne a teljes szállásdíj a 3 éjszakára.

Köszönettel:
Teszt Elek`;
  const h=harness(message,input=>{
    assert.deepEqual(input,{arrival:'2026-10-23',departure:'2026-10-26',cabin:'deluxe',adults:5,children:[4,9,13],units:2});
    return json({status:'unavailable',availability:'unavailable',availableUnits:0,...input});
  });
  const r=await h.run();
  assert.equal(h.calls,1,r.status);
  assert.match(r.status,/2 egység szükséges/u);
  assert.match(r.status,/0 szabad egységet/u);
  assert.equal(r.result,'');
  assert.equal(h.element('approve_price').disabled,true);
});

for(const [language,message] of [
  ['hu','Kedves Sárberki! 2027. október 16–18. között 2 felnőtt és 2 gyermek, 7 és 11 évesek részére Deluxe házat szeretnénk dézsával és kutyával. Telefonszám: +36 30 555 1234. Külön kérés: saját stég.'],
  ['de','Guten Tag! Wir möchten vom 16.10.2027 bis 18.10.2027 ein Deluxe Haus für 2 Erwachsene und 2 Kinder, 7 und 11 Jahre alt, buchen. Wir wünschen einen Whirlpool und bringen einen Hund mit. Telefon: +43 660 123 4567. Bitte einen privaten Steg. Viele Grüße, Großmann.'],
  ['si','Pozdravljeni! Želimo nastanitev od 16.10.2027 do 18.10.2027 v hiški Deluxe za 2 odrasla in 2 otroka, stara 7 in 11 let. Želimo vročo kad in pripeljemo psa. Telefon: +386 41 234 567. Prosim za lasten pomol.'],
  ['en','Hello! We would like a Deluxe cabin from October 16 to October 18, 2027, for 2 adults and 2 children, aged 7 and 11. We would like a hot tub and will bring a dog. Phone: +44 7700 900123. Please provide a private fishing pier.']
]) test(`${language} complete inquiry reaches anonymous quote and requires child-price approval`,async()=>{
  const h=harness(message,input=>{
    assert.equal(input.arrival,'2027-10-16');assert.equal(input.departure,'2027-10-18');assert.equal(input.cabin,'deluxe');assert.equal(input.adults,2);assert.deepEqual(input.children,[7,11]);
    assert.deepEqual(Object.keys(input).sort(),['adults','arrival','cabin','children','departure']);
    return json({...quote(input,recorded[0]),eurConversion:{status:'available',rateHufPerEur:367.87,rateDate:'2026-10-02',totalEur:332.18}});
  });
  const result=await h.run();assert.equal(h.calls,1,JSON.stringify({result,arrival:h.element('price_arrival').value,departure:h.element('price_departure').value,cabin:h.element('price_cabin').value,adults:h.element('price_adults').value,ages:h.element('price_child_ages').value}));assert.match(result.result,/122.200|122 200/u);assert.match(result.result,/332[,.]18/u);assert.doesNotMatch(result.draft,/122.200|122 200/u);assert.match(result.status,/jóváhagyás|ellenőrzés/u);
});

test('adult-only inquiry does not copy total guests into child count',()=>{
  const h=harness('2027. október 16–18. között Deluxe házat szeretnénk 2 felnőtt részére.',()=>{});
  const analysis=vm.runInContext("extract(document.getElementById('message').value,'')",h.context);
  assert.equal(analysis.fields.children.value,'');
  assert.equal(analysis.fields.adults.value,'2');
});

test('explicit special requests survive all four languages in the canonical manual record',()=>{
  for(const [label,request] of [['Külön kérés','késői érkezés'],['Besonderer Wunsch','barrierefreier Zugang für Großmann'],['Special request','late arrival'],['Posebna želja','pozen prihod']]) {
    const h=harness(`2027. október 16–18. Deluxe, 2 felnőtt. ${label}: ${request}.`,()=>{});
    const analysis=vm.runInContext("extract(document.getElementById('message').value,'')",h.context);
    assert.ok(analysis.fields.request.value.includes(request),analysis.fields.request.value);
  }
});


test('total-only guest count never becomes adult count and blocks price lookup',async()=>{
  const message='Pozdravljeni, od 20. do 23. novembra 2026 bi želeli Deluxe nastanitev. Skupaj 5 oseb. Kakšna je cena?';
  const h=harness(message,()=>{throw Error('unexpected fetch')});
  h.element('prepare_price').onclick();
  assert.equal(h.element('price_adults').value,'');
  assert.equal(h.element('price_children').value,'');
  await h.element('check_price').onclick();
  assert.equal(h.calls,0);
  assert.match(h.element('price_status').textContent,/otrok|gyermek|tisztázni/u);
});
