import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as core from '../sarberki-core.mjs';
import * as state from '../case-state.mjs';
import {BUSINESS} from '../business-config.mjs';
import {fishingQuestion} from '../fishing-rules.mjs';
import {normalizeBookingInput} from '../booking-input.mjs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const price=fs.readFileSync(new URL('../price-check.js',import.meta.url),'utf8');
const message=`Kedves Sárberki Horgásztó!
2026. október 16–18. között, két éjszakára szeretnénk Deluxe faházat foglalni 2 felnőtt és 2 gyermek részére. A gyermekek 7 és 11 évesek. Dézsát is szeretnénk kérni, és egy autóval érkeznénk. Kérjük, jelezzék, van-e szabad Deluxe faház, mennyi lenne a teljes ár, és milyen előleg- és lemondási feltételek érvényesek. Horgászni is szeretnénk: milyen jegyre és felszerelésre van szükség?
Üdvözlettel: Teszt Elek`;
function harness(){
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
 const errors=[];
 const context=vm.createContext({window,document,console,Date,Intl,Number,JSON,Math,Set,URL,Blob,navigator:{},alert:x=>errors.push(x),setTimeout:fn=>tasks.push(fn),CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail;}},Event:class{constructor(type){this.type=type;}},fetch:async()=>{throw Error('Unmocked network call');}});
 const inline=html.slice(html.indexOf('const $='),html.indexOf('</script>',html.indexOf('const $=')));
 vm.runInContext(inline,context);vm.runInContext(price,context);
 const flush=()=>{while(tasks.length)tasks.shift()();};
 const analyze=text=>{nodes.get('message').value=text;nodes.get('sender').value='valkana6666@gmail.com';nodes.get('analyze').click();flush();assert.deepEqual(errors,[]);};
 analyze(message);
 return {node:id=>nodes.get(id),window,context,flush,analyze};
}
function approve(h){h.node('approved_price_manual').value='122200';h.node('approved_price_manual').dispatchEvent({type:'input'});h.node('approve_price').click();}
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
 assert.match(h.node('draft').value,/122\s*200 Ft/u);assert.match(h.node('draft').value,/332,31 €/u);assert.doesNotMatch(h.node('draft').value,/szabad kapacitását megnézzük/u);assert.match(h.node('draft').value,/árlekéréskor/u);assert.match(h.node('draft').value,/telefonszám/u);assert.equal(h.node('draft').value,h.node('gmail_draft').value);
});
test('a delayed price response cannot overwrite an edited stay',async()=>{
 const h=harness();let resolve,input;h.context.fetch=async(url,options)=>{input=JSON.parse(options.body);return await new Promise(r=>{resolve=r;});};
 const pending=h.node('check_price').onclick();h.node('f_arrival').value='2026-11-16';h.node('f_arrival').dispatchEvent({type:'input'});resolve(quoteResponse(input));await pending;
 assert.equal(h.node('price_result').textContent,'');assert.equal(h.window.SarberkiCaseController.snapshot().quote,null);assert.doesNotMatch(h.node('draft').value,/122\s*200 Ft/u);
});
