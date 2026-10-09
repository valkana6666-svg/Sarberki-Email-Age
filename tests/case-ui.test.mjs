import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as core from '../sarberki-core.mjs';
import * as state from '../case-state.mjs';
import {createBookingRuntime} from '../booking-runtime.mjs';
import {buildAvailabilityOptions} from '../netlify/functions/availability-options.mjs';
import {BUSINESS} from '../business-config.mjs';
import {fishingQuestion} from '../fishing-rules.mjs';
import {normalizeBookingInput} from '../booking-input.mjs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const price=fs.readFileSync(new URL('../price-check.js',import.meta.url),'utf8');
const message=`Kedves Sárberki Horgásztó!
2026. október 16–18. között, két éjszakára szeretnénk Deluxe faházat foglalni 2 felnőtt és 2 gyermek részére. A gyermekek 7 és 11 évesek. Dézsát is szeretnénk kérni, és egy autóval érkeznénk. Kérjük, jelezzék, van-e szabad Deluxe faház, mennyi lenne a teljes ár, és milyen előleg- és lemondási feltételek érvényesek. Horgászni is szeretnénk: milyen jegyre és felszerelésre van szükség?
Üdvözlettel: Teszt Elek`;
function harness(runtime=null){
 const nodes=new Map(),tasks=[],listeners=new Map();
 class Node {
  constructor(){this.value='';this.textContent='';this.children=[];this.style={};this.listeners={};this.disabled=false;this.checked=false;const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle:(x,on)=>on?classes.add(x):classes.delete(x)};}
  set value(v){this._value=String(v??'');}get value(){return this._value;}
  set id(v){this._id=v;nodes.set(v,this);}get id(){return this._id;}
  set innerHTML(v){this._html=v;for(const match of v.matchAll(/id="([^"]+)"/gu)){const n=new Node();n.id=match[1];}}get innerHTML(){return this._html||'';}
  addEventListener(event,fn){(this.listeners[event]??=[]).push(fn);}
  dispatchEvent(event){for(const fn of this.listeners[event.type]||[])fn(event);}
  click(){if(this.disabled)return;if(this.onclick)this.onclick({type:'click'});this.dispatchEvent({type:'click'});}
  append(...children){this.children.push(...children);}appendChild(child){this.append(child);}replaceChildren(...children){this.children=children;}
  setAttribute(){}scrollIntoView(){}insertAdjacentElement(){}remove(){}select(){}
 }
 for(const match of html.matchAll(/id="([^"]+)"/gu)){const n=new Node();n.id=match[1];}
 nodes.get('gmail_record').classList.add('hidden');nodes.get('results').classList.add('hidden');
 const document={getElementById:id=>nodes.get(id)||null,createElement:()=>new Node(),body:new Node(),addEventListener:(type,fn)=>{(listeners.get(type)||listeners.set(type,[]).get(type)).push(fn);},dispatchEvent:event=>{for(const fn of listeners.get(event.type)||[])fn(event);}};
 const window={addEventListener(){},SarberkiNormalize:core,SarberkiCaseState:state,SarberkiConfig:BUSINESS,SarberkiFishingQuestion:fishingQuestion,SarberkiRulesReady:true,SarberkiBookingInput:{normalizeBookingInput}};
 if(runtime)window.SarberkiBookingRuntime=runtime;
 const errors=[];
 const context=vm.createContext({window,document,console,Date,Intl,Number,JSON,Math,Set,URL,Blob,navigator:{},alert:x=>errors.push(x),setTimeout:fn=>tasks.push(fn),CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail;}},Event:class{constructor(type){this.type=type;}},fetch:async()=>{throw Error('Unmocked network call');}});
 const inline=html.slice(html.indexOf('const $='),html.indexOf('</script>',html.indexOf('const $=')));
 vm.runInContext(inline,context);vm.runInContext(price,context);
 const flush=()=>{while(tasks.length)tasks.shift()();};
 const analyze=text=>{nodes.get('message').value=text;nodes.get('sender').value='valkana6666@gmail.com';nodes.get('analyze').click();flush();assert.deepEqual(errors,[]);};
 analyze(message);
 return {node:id=>nodes.get(id),window,context,flush,analyze};
}
function approve(h){h.node('approved_price_manual').value='122200';h.node('approved_price_manual').dispatchEvent({type:'input'});h.node('manual_quote_confirmed').checked=true;h.node('manual_quote_confirmed').dispatchEvent({type:'change'});h.node('approve_price').click();}
test('unverified availability question uses guest-facing language without system jargon',()=>{
 const h=harness();
 assert.match(h.node('draft').value,/A kért faház elérhetőségét külön visszaigazoljuk/u);
 assert.doesNotMatch(h.node('draft').value,/szabad kapacitás|Previo|PMS|poolban|párosításellenőrzés/iu);
 assert.match(h.node('issues').textContent,/kapacitás- és szükség esetén párosításellenőrzés/u);
});
test('actual analyzer and price approval handlers render both drafts from current state',()=>{
 const h=harness();approve(h);
 assert.match(h.node('draft').value,/122\s*200 Ft/u);assert.match(h.node('draft').value,/telefonszám/u);assert.match(h.node('draft').value,/Egy autó/u);assert.match(h.node('issues').textContent,/KÖZELI ÉRKEZÉS/u);
 assert.doesNotMatch(h.node('draft').value,/50%|14\. napig|Ha több autó/u);
 assert.equal(h.node('draft').value,h.node('gmail_draft').value);
});
test('field edit regenerates the reply and revokes the old price without manual refresh',()=>{
 const h=harness();approve(h);h.node('f_arrival').value='2026-11-16';h.node('f_arrival').dispatchEvent({type:'input'});
 assert.doesNotMatch(h.node('draft').value,/122\s*200 Ft/u);assert.match(h.node('draft').value,/16\.11\.2026/u);assert.equal(h.node('price_arrival').value,'2026-11-16');
});
test('phone supplementation and refresh retain approval and remove the phone question',()=>{
 const h=harness();approve(h);h.node('f_phone').value='+36 30 555 1234';h.node('f_phone').dispatchEvent({type:'input'});h.node('refresh').click();
 assert.match(h.node('draft').value,/122\s*200 Ft/u);assert.doesNotMatch(h.node('draft').value,/Megírna egy telefonszámot/u);assert.doesNotMatch(h.node('issues').textContent,/Telefon hiányzik/u);
});
test('manual letter edits are not silently overwritten by the input handler',()=>{
 const h=harness();h.node('draft').value='Kézi javítás';h.node('draft').dispatchEvent({type:'input'});assert.equal(h.node('draft').value,'Kézi javítás');
});
test('operator checks flow through the same state and remove obsolete deposit warnings',()=>{
 const h=harness();approve(h);h.node('case_deposit_basis').value='Tulajdonos által ellenőrzött szállásdíj';h.node('case_deposit_amount').value='60000';h.node('case_deposit_deadline').value='2026-10-10';h.node('case_deposit_verified').checked=true;h.node('case_cancellation_deadline').value='Tulajdonossal külön egyeztetett feltétel';h.node('case_cancellation_verified').checked=true;h.node('case_save_checks').click();
 assert.match(h.node('draft').value,/60\s*000 Ft/u);assert.match(h.node('draft').value,/122\s*200 Ft/u);assert.doesNotMatch(h.node('issues').textContent,/KÖZELI ÉRKEZÉS|Előleg konkrét összege/u);
});
test('switching inquiries discards quote, phone and verification from the previous guest',()=>{
 const h=harness();approve(h);h.node('f_phone').value='+36 30 555 1234';h.node('f_phone').dispatchEvent({type:'input'});h.analyze('Jó napot! 2026. november 6–8. között 2 felnőtt, gyermek nélkül szeretne VIP házat. Üdvözlettel: Másik Vendég');
 assert.doesNotMatch(h.node('draft').value,/122\s*200 Ft|Teszt Elek/u);assert.equal(h.window.SarberkiCaseController.snapshot().quote,null);assert.equal(h.node('f_phone').value,'');assert.equal(h.window.SarberkiCaseController.snapshot().hotTub.requested,false);
});

function quoteResponse(input){return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({...input,status:'review_required',availability:'available',availableUnits:1,total:122200,accommodation:120000,tourismTax:2200,currency:'HUF',source:'Offline recorded test quote',checkedAt:'2026-10-05T18:13:41Z',eurConversion:{status:'available',totalEur:332.31,rateHufPerEur:367.73,rateDate:'2026-10-05'}})};}
test('actual price request and approval carry the recorded HUF and EUR quote into both full replies',async()=>{
 const h=harness();h.context.fetch=async(url,options)=>{assert.equal(url,'/api/price-quote');return quoteResponse(JSON.parse(options.body));};
 await h.node('check_price').onclick();assert.match(h.node('price_result').textContent,/332,31/u);h.node('approve_price').click();
 assert.match(h.node('draft').value,/122\s*200 Ft/u);assert.match(h.node('draft').value,/332,31 €/u);assert.doesNotMatch(h.node('draft').value,/szabad kapacitását megnézzük/u);assert.match(h.node('draft').value,/A kért időszakra rendelkezésre áll megfelelő szálláslehetőség/u);assert.match(h.node('draft').value,/telefonszám/u);assert.equal(h.node('draft').value,h.node('gmail_draft').value);
});
test('a delayed price response cannot overwrite an edited stay',async()=>{
 const h=harness();let resolve,input;h.context.fetch=async(url,options)=>{input=JSON.parse(options.body);return await new Promise(r=>{resolve=r;});};
 const pending=h.node('check_price').onclick();h.node('f_arrival').value='2026-11-16';h.node('f_arrival').dispatchEvent({type:'input'});resolve(quoteResponse(input));await pending;
 assert.equal(h.node('price_result').textContent,'');assert.equal(h.window.SarberkiCaseController.snapshot().quote,null);assert.doesNotMatch(h.node('draft').value,/122\s*200 Ft/u);
});

test('integrated analyzer preserves known facts on explicitly linked second and third letters',()=>{
 const runtime=createBookingRuntime({request:()=>{throw Error('network unused');}}),h=harness(runtime);
 const first=runtime.cases.list()[0].id;
 h.node('booking_case_link').value=first;
 h.analyze('A telefonszámom: +36 30 555 1234.');
 assert.equal(h.node('f_arrival').value,'2026-10-16');assert.equal(h.node('f_adults').value,'2');assert.equal(h.node('f_child_ages').value,'7, 11');assert.equal(runtime.cases.list().length,1);
});
test('integrated price handler never invokes price endpoint after zero capacity',async()=>{
 const runtime=createBookingRuntime({request:i=>buildAvailabilityOptions(i,async()=>({availability:'unavailable',availableUnits:0,source:'MOCK',checkedAt:new Date().toISOString()}))}),h=harness(runtime);
 let prices=0;h.context.fetch=async()=>{prices++;throw Error('price must not run');};await h.node('check_price').onclick();assert.equal(prices,0);assert.match(h.node('price_status').textContent,/nem igazoltan/u);
});
test('integrated approval cannot override failed fresh capacity',async()=>{
 const runtime=createBookingRuntime({request:i=>buildAvailabilityOptions(i,async()=>({availability:'unavailable',availableUnits:0,source:'MOCK',checkedAt:new Date().toISOString()}))}),h=harness(runtime);
 approve(h);h.node('override').checked=true;await h.node('approve').onclick();assert.equal(h.window.SarberkiCaseController.snapshot().quote,null);assert.match(h.node('status').textContent,/Jóváhagyás tiltva/u);
});
test('linked phone-only letter does not revoke the central approved price',()=>{
 const runtime=createBookingRuntime({request:()=>{throw Error('network unused');}}),h=harness(runtime);approve(h);const first=runtime.cases.list()[0].id;h.node('booking_case_link').value=first;h.analyze('Telefonszámom +36 30 555 1234.');assert.equal(h.window.SarberkiCaseController.snapshot().quote.total,122200);assert.match(h.node('draft').value,/122\s*200 Ft/u);assert.equal(h.node('f_phone').value,'+36 30 555 1234');
});

test('central case render never labels an empty phone as confirmed',()=>{
 const h=harness(createBookingRuntime({request:()=>{throw Error('network unused');}}));
 assert.equal(h.node('f_phone').value,'');
 const phone=h.node('fields').children.find(w=>w.children.some(n=>n.id==='f_phone'));
 assert.equal(phone.children.at(-1).textContent,'Hiányzik · forrás: nincs');
});

test('linked Hungarian phone followup does not retain an unrelated foreign-language warning',()=>{
 const h=harness(createBookingRuntime({request:()=>{throw Error('network unused');}}));const id=h.window.SarberkiBookingRuntime.cases.list()[0].id;
 h.node('booking_case_link').value=id;h.analyze('A telefonszámunk: +36 30 555 1234. Köszönjük!');
 assert.equal(h.node('f_language').value,'HU');assert.doesNotMatch(h.node('issues').textContent,/Idegen nyelvű/u);
});

function gmailFixture(id,text,{thread='gmail-thread',received='2026-10-08T19:40:30.500Z',reply=null,refs=[]}={}){
 return {source:{provider:'gmail',message_id:id,thread_id:thread,rfc_message_id:`<${id}@example.invalid>`,in_reply_to:reply,references:refs,from_email:'gmail-flow@example.invalid',received_at:received,subject:'Szállás érdeklődés'},original_message:text,extracted:[],inferred:[],missing:[],human_review:[],reply_draft:'IMPORTÁLT, NEM ELLENŐRZÖTT POZITÍV VÁLASZ',normalized:{}};
}
async function importGmail(h,data){h.node('gmail_json').value=JSON.stringify(data);return await h.node('load_gmail_record').onclick();}
const gmailFirst='2026. október 23–25. között Deluxe faházat szeretnénk 2 felnőtt és 2 gyermek részére. Az egyik gyermek 7 éves.';
test('manual Gmail JSON import runs the central analyzer and clears stale manual case linking',async()=>{
 const runtime=createBookingRuntime({request:()=>{throw Error('network unused');}}),h=harness(runtime);h.node('booking_case_link').value=runtime.cases.list()[0].id;
 assert.equal(await importGmail(h,gmailFixture('gmail-one',gmailFirst)),true);
 const c=runtime.cases.list().find(c=>c.sender==='gmail-flow@example.invalid');assert.ok(c);assert.equal(c.state.values.arrival,'2026-10-23');assert.equal(c.state.values.adults,'2');assert.equal(c.state.values.child_ages,'7');assert.equal(h.node('booking_case_link').value,'');assert.doesNotMatch(h.node('draft').value,/IMPORTÁLT/u);assert.equal(h.node('draft').value,h.node('gmail_draft').value);
});
test('Gmail RFC reply in a new thread fills the remaining child age in the same case',async()=>{
 const runtime=createBookingRuntime({request:()=>{throw Error('network unused');}}),h=harness(runtime);await importGmail(h,gmailFixture('gmail-one',gmailFirst));
 await importGmail(h,gmailFixture('gmail-two','A másik gyermek 11 éves.',{thread:'another-thread',reply:'<gmail-one@example.invalid>',received:'2026-10-08T19:40:31.100Z'}));
 const cases=runtime.cases.list().filter(c=>c.sender==='gmail-flow@example.invalid');assert.equal(cases.length,1);assert.equal(cases[0].messages.length,2);assert.equal(cases[0].state.values.child_ages,'7, 11');assert.equal(cases[0].state.values.arrival,'2026-10-23');assert.doesNotMatch(h.node('draft').value,/gyermekek pontos életkorát/u);
});
test('Gmail source timestamps keep seconds and protect newer dates inside the same minute',async()=>{
 const runtime=createBookingRuntime({request:()=>{throw Error('network unused');}}),h=harness(runtime);
 await importGmail(h,gmailFixture('gmail-new','2026. november 6–8. között VIP faházat szeretnénk 4 felnőtt részére, gyermek nélkül.',{received:'2026-10-08T19:40:30.500Z'}));
 await importGmail(h,gmailFixture('gmail-old','2026. október 23–25. között Deluxe faházat szeretnénk 4 felnőtt részére, gyermek nélkül.',{received:'2026-10-08T19:40:30.100Z'}));
 const c=runtime.cases.list().find(c=>c.sender==='gmail-flow@example.invalid');assert.equal(c.messages[0].received_at,'2026-10-08T19:40:30.500Z');assert.equal(c.state.values.arrival,'2026-11-06');assert.equal(c.state.values.unit,'VIP');assert.equal(c.messages[1].historical,true);
});
test('invalid Gmail import cannot replace the active central inquiry',async()=>{
 const runtime=createBookingRuntime({request:()=>{throw Error('network unused');}}),h=harness(runtime);const before=JSON.stringify(h.window.SarberkiCaseController.snapshot());
 assert.equal(await importGmail(h,{source:{provider:'gmail',message_id:'bad'},original_message:'Új levél'}),false);assert.equal(JSON.stringify(h.window.SarberkiCaseController.snapshot()),before);assert.match(h.node('gmail_error').textContent,/Hiányos/u);
});
test('same sender new Gmail thread without a reply reference does not merge cases',async()=>{
 const runtime=createBookingRuntime({request:()=>{throw Error('network unused');}}),h=harness(runtime);await importGmail(h,gmailFixture('gmail-one',gmailFirst));await importGmail(h,gmailFixture('gmail-two','2026. november 6–8. között VIP házat szeretnénk 4 felnőtt részére.',{thread:'different-thread',received:'2026-10-08T19:40:31.100Z'}));assert.equal(runtime.cases.list().filter(c=>c.sender==='gmail-flow@example.invalid').length,2);
});

test('Gmail old/new/check-out correction changes the current UI stay, not the old stay',async()=>{
 const runtime=createBookingRuntime({request:()=>{throw Error('network unused');}}),h=harness(runtime);await importGmail(h,gmailFixture('gmail-one',gmailFirst));
 await importGmail(h,gmailFixture('gmail-two','Az időpontot módosítanánk: 2026.10.23 helyett 2026.10.30; távozás: 2026.11.01.',{received:'2026-10-08T19:40:31.100Z'}));assert.equal(h.node('f_arrival').value,'2026-10-30');assert.equal(h.node('f_departure').value,'2026-11-01');assert.equal(h.node('price_arrival').value,'2026-10-30');assert.equal(h.window.SarberkiCaseController.snapshot().quote,null);
});
test('unresolved Gmail date modification cannot bypass the fresh approval gate',async()=>{
 let calls=0;const runtime=createBookingRuntime({request:async()=>{calls++;throw Error('unexpected source');}}),h=harness(runtime);await importGmail(h,gmailFixture('gmail-one',gmailFirst));await importGmail(h,gmailFixture('gmail-two','Új időpont: 2026.10.30 vagy 2026.11.06; távozás 2026.11.08.',{received:'2026-10-08T19:40:31.100Z'}));
 assert.equal(h.node('f_arrival').value,'');assert.equal(h.node('f_departure').value,'');h.node('override').checked=true;await h.node('approve').onclick();assert.match(h.node('status').textContent,/Jóváhagyás tiltva/u);assert.equal(calls,0);
});

test('central runtime uses public reference only when live availability safety gate is closed',async()=>{
 const runtime=createBookingRuntime({request:async()=>{throw Error('Élő kapacitás-ellenőrzés csak a külön Sárberki tesztoldalon engedélyezett.');}});
 const h=harness(runtime);
 let calls=0;
 h.context.fetch=async(url,options)=>{
  calls++;assert.equal(url,'/api/price-reference');
  const input=JSON.parse(options.body);
  return {ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>({...input,status:'public_reference',referenceOnly:true,availability:'not_checked',availableUnits:null,bookingCompleted:false,source:'Sárberki publikus árlista – tájékoztató kalkuláció',checkedAt:'2026-10-09T00:00:00Z',accommodation:120000,tourismTax:2200,total:122200,currency:'HUF',eurConversion:{status:'available',rateHufPerEur:400,rateDate:'2026-10-09',totalEur:305.5}})};
 };
 await h.node('check_price').onclick();
 assert.equal(calls,1);
 assert.match(h.node('price_result').textContent,/TÁJÉKOZTATÓ ÁRLISTAÁR/u);
 assert.match(h.node('price_result').textContent,/122.200|122 200/u);
 assert.match(h.node('price_result').textContent,/305,50 €/u);
 assert.equal(h.node('approve_price').disabled,true);
 h.node('approve_price').click();
 assert.doesNotMatch(h.node('draft').value,/122\s*200 Ft/u);
 h.node('manual_quote_confirmed').checked=true;
 h.node('manual_quote_confirmed').dispatchEvent({type:'change'});
 assert.equal(h.node('approve_price').disabled,false);
 h.node('approve_price').click();
 assert.match(h.node('draft').value,/122\s*200 Ft/u);
});

test('central runtime does not offer a reference when capacity is positively unavailable',async()=>{
 const runtime=createBookingRuntime({request:async i=>buildAvailabilityOptions(i,async()=>({availability:'unavailable',availableUnits:0,checkedAt:new Date().toISOString(),source:'mock closed'}))});
 const h=harness(runtime);let calls=0;h.context.fetch=async()=>{calls++;throw Error('must not call quote/reference');};
 await h.node('check_price').onclick();
 assert.equal(calls,0);assert.equal(h.node('price_result').textContent,'');
});


test('UI extracts one requested Családi cabin and full signed guest name, retaining both on refresh',()=>{
 const h=harness();
 h.analyze('2026. október 23–25. között Családi faházat szeretnénk 2 felnőtt és 2 gyermek (5 és 8 évesek) részére.\nÜdvözlettel:\nTeszt Vendég');
 assert.equal(h.node('f_units_requested').value,'1');
 assert.equal(h.window.SarberkiCaseController.snapshot().values.units_requested,'1');
 assert.equal(h.node('f_name').value,'Teszt Vendég');
 assert.match(h.node('draft').value,/^Kedves Teszt Vendég!/u);
 h.node('refresh').click();
 assert.equal(h.node('f_units_requested').value,'1');
 assert.match(h.node('draft').value,/^Kedves Teszt Vendég!/u);
});
test('UI never fabricates a single unit from generic availability and preserves explicit two-unit requests',()=>{
 const h=harness();
 h.analyze('2026. október 23–25. között 4 főre milyen szálláslehetőségek vannak?');
 assert.equal(h.node('f_units_requested').value,'');
 h.analyze('2026. október 23–25. között két Családi faházat szeretnénk 8 felnőtt részére.');
 assert.equal(h.node('f_units_requested').value,'2');
});
