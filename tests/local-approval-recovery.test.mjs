import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as core from '../sarberki-core.mjs';
import * as state from '../case-state.mjs';
import {createBookingRuntime} from '../booking-runtime.mjs';
import {BUSINESS} from '../business-config.mjs';
import {verifyLocalExport,decryptLocalState,restoreIntoEmptyStore} from '../local-recovery.mjs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const storeKey='sarberki-booking-cases-v2';
function storage(){const data=new Map();return {get length(){return data.size;},key:i=>[...data.keys()][i],removeItem:k=>data.delete(k),getItem:k=>data.get(k)??null,setItem(k,v){data.set(k,v);}};}
function harness(store){
 const nodes=new Map();
 class Node{
  constructor(){this.value='';this.textContent='';this.children=[];this.style={};this.listeners={};this.disabled=false;this.checked=false;const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle:(x,on)=>on?classes.add(x):classes.delete(x)};}
  set value(v){this._value=String(v??'');}get value(){return this._value;}
  set id(v){this._id=v;nodes.set(v,this);}get id(){return this._id;}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  dispatchEvent(event){for(const fn of this.listeners[event.type]||[])fn(event);}
  append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}
  setAttribute(){}scrollIntoView(){}
 }
 for(const m of html.matchAll(/id="([^"]+)"/gu)){const n=new Node();n.id=m[1];}
 nodes.get('gmail_record').classList.add('hidden');
 const runtime=createBookingRuntime({storage:store,request:async()=>{throw Error('Network forbidden');}});
 // Only persistence is under test; capacity is a synthetic prerequisite, never live.
 runtime.beforeApproval=async()=>({allowed:true,data:{synthetic:true}});
 const document={getElementById:id=>nodes.get(id)||null,createElement:()=>new Node(),addEventListener(){},dispatchEvent(){}};
 const window={addEventListener(){},SarberkiNormalize:core,SarberkiCaseState:state,SarberkiConfig:BUSINESS,SarberkiRulesReady:true,SarberkiBookingRuntime:runtime,SarberkiRefreshCapacity:async()=>{}};
 const context=vm.createContext({window,document,console,Date,Intl,Number,JSON,Math,Set,URL,Blob,navigator:{},alert:message=>{throw Error(message);},setTimeout(){},CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail;}}});
 const start=html.indexOf('const $=');vm.runInContext(html.slice(start,html.indexOf('</script>',start)),context);
 nodes.get('message').value='2026. október 23–25. között Deluxe faházat szeretnénk foglalni 4 felnőtt részére, gyermek nélkül. Telefon: +36 30 555 0123. Üdvözlettel: Teszt Vendég';nodes.get('sender').value='fixture@synthetic.invalid';nodes.get('analyze').onclick();
 assert.equal(window.SarberkiCaseController.snapshot().intent,'booking_request');
 const approve=async()=>{for(let i=0;i<2;i++){nodes.get('override').checked=true;await nodes.get('approve').onclick();}};
 return {nodes,runtime,approve};
}
test('local approval and audit survive a new runtime instance',async()=>{
 const s=storage(),h=harness(s);await h.approve();
 assert.match(h.nodes.get('status').textContent,/Belső jóváhagyás rögzítve/);
 const restored=createBookingRuntime({storage:s}).cases.list()[0];
 assert.equal(restored.state.approval,'internally_approved');
 assert.ok(restored.events.some(e=>e.type.includes('Belső jóváhagyás')));
 assert.equal(restored.events.at(-1).approval,'internally_approved');
 assert.equal(restored.events.at(-1).scope,'local_unverified_operator');
 assert.equal(restored.drafts.at(-1).text,h.nodes.get('draft').value);
});
test('storage failure never reports approval or changes the in-memory persisted case',async()=>{
 const s=storage(),h=harness(s);const before=s.getItem(storeKey),caseBefore=h.runtime.cases.list()[0];
 s.setItem=()=>{throw Error('synthetic quota failure');};await h.approve();
 assert.match(h.nodes.get('status').textContent,/Jóváhagyás nem menthető/);
 assert.equal(s.getItem(storeKey),before);assert.deepEqual(h.runtime.cases.list()[0],caseBefore);
 assert.equal(h.runtime.cases.list()[0].state.approval,'pending');
});
test('without a persistent store local approval is blocked',async()=>{
 const h=harness(null);await h.approve();assert.match(h.nodes.get('status').textContent,/Jóváhagyás nem menthető/);assert.equal(h.runtime.cases.list()[0].state.approval,'pending');
});
test('editing the approved draft invalidates approval and preserves audit history',async()=>{
 const s=storage(),h=harness(s);await h.approve();h.nodes.get('draft').value+='\nSzintetikus javítás';h.nodes.get('draft').dispatchEvent({type:'input'});
 const saved=createBookingRuntime({storage:s}).cases.list()[0];assert.equal(saved.state.approval,'pending');assert.ok(saved.events.some(e=>e.approval==='internally_approved'));assert.equal(saved.events.at(-1).approval,'pending');
});
test('unknown capacity cannot reach the local approval persistence path',async()=>{
 const s=storage(),h=harness(s);h.runtime.beforeApproval=async()=>({allowed:false,data:{synthetic:true}});await h.approve();assert.match(h.nodes.get('status').textContent,/Jóváhagyás tiltva/);const saved=createBookingRuntime({storage:s}).cases.list()[0];assert.equal(saved.state.approval,'pending');assert.equal(saved.events?.some(e=>e.approval==='internally_approved')||false,false);
});
test('encrypted export restores approved state and local audit into an empty new origin',async()=>{
 const s=storage(),h=harness(s);await h.approve();const phrase='synthetic-only-recovery-fixture-password';
 const result=await verifyLocalExport(s,'https://old.synthetic.invalid',phrase);
 assert.equal(result.encrypted.includes('fixture@synthetic.invalid'),false);
 const payload=await decryptLocalState(result.encrypted,phrase),target=storage();
 restoreIntoEmptyStore(payload,target,{targetOrigin:'https://new.synthetic.invalid',confirmedEmptyTarget:true});
 const restored=createBookingRuntime({storage:target}).cases.list()[0];
 assert.equal(restored.state.approval,'internally_approved');assert.equal(restored.events.at(-1).scope,'local_unverified_operator');assert.deepEqual(restored,h.runtime.cases.list()[0]);
});
