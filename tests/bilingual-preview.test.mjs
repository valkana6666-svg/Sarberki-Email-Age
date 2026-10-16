import test from 'node:test';
import assert from 'node:assert/strict';
import {detectForeignLanguage,protectedTokens,sameProtectedTokens,mountBilingualPanels} from '../bilingual-preview.mjs';
import {initBilingualClone} from '../bilingual-clone-preview.mjs';
test('detects clear German, English, Slovene and Hungarian samples',()=>{
 assert.equal(detectForeignLanguage('Guten Tag, wir möchten buchen'),'de');
 assert.equal(detectForeignLanguage('Hello, we would like a booking'),'en');
 assert.equal(detectForeignLanguage('Pozdravljeni, želeli bi rezervacijo'),'sl');
 assert.equal(detectForeignLanguage('Jó napot, szeretnénk foglalni'),'hu');
});
test('does not guess ambiguous language',()=>assert.equal(detectForeignLanguage('ABC'),'unknown'));
test('checks number and currency preservation before translation acceptance',()=>{
 assert.deepEqual(protectedTokens('120 000 Ft, 4 fő'),['120 000 Ft','4 fő']);
 assert.equal(sameProtectedTokens('120 000 Ft, 4 fő','120 000 Ft, 4 fő'),true);
 assert.equal(sameProtectedTokens('120 000 Ft, 4 fő','130 000 Ft, 4 fő'),false);
});
function dom(){
 const nodes=new Map();
 class Element{
  constructor(){this.value='';this.textContent='';this.className='';this.hidden=false;this.style={};this.dataset={};this.listeners=new Map();}
  set id(id){this.identifier=id;nodes.set(id,this);}get id(){return this.identifier;}
  append(...children){for(const child of children)child.parent=this;}
  insertAdjacentElement(_position,element){element.parent=this.parent;}
  setAttribute(){}
  closest(selector){for(let node=this;node;node=node.parent)if(selector==='.'+node.className)return node;return null;}
  addEventListener(name,callback){if(!this.listeners.has(name))this.listeners.set(name,[]);this.listeners.get(name).push(callback);}
  fire(name){for(const callback of this.listeners.get(name)||[])callback({});}
 }
 const doc={getElementById:id=>nodes.get(id)||null,createElement:()=>new Element(),addEventListener(){}};
 for(const id of ['message','draft','gmail_original','gmail_draft']){const node=new Element();node.id=id;node.value='Hello, booking inquiry.';}
 return {doc,nodes};
}
test('legacy incoming panels stay hidden with explicit replacements in either mount order and after source updates',()=>{
 for(const order of ['legacy-first','explicit-first']){
  const {doc,nodes}=dom();
  const explicit=()=>initBilingualClone({doc,globalRef:{}});
  if(order==='legacy-first'){mountBilingualPanels(doc);explicit();}
  else{explicit();mountBilingualPanels(doc);}
  for(const [source,legacy,replacement] of [['message','message_hu','foreign_incoming_hu'],['gmail_original','gmail_original_hu','gmail_foreign_incoming_hu']]){
   assert.ok(nodes.get(replacement),order);
   assert.equal(nodes.get(legacy).closest('.bilingual-panel').hidden,true,order+'/'+legacy);
   nodes.get(source).value='Guten Tag! Neue Buchung.';nodes.get(source).fire('input');
   assert.equal(nodes.get(legacy).closest('.bilingual-panel').hidden,true,'source update/'+legacy);
  }
  mountBilingualPanels(doc);
  assert.equal(nodes.get('message_hu').closest('.bilingual-panel').hidden,true,'repeat mount/manual');
  assert.equal(nodes.get('gmail_original_hu').closest('.bilingual-panel').hidden,true,'repeat mount/Gmail');
  assert.equal(nodes.get('draft_hu').closest('.bilingual-panel').hidden,false,'reply panel unchanged');
  assert.equal(nodes.get('gmail_draft_hu').closest('.bilingual-panel').hidden,false,'Gmail reply panel unchanged');
 }
});
test('legacy-only incoming fallback remains visible and follows source language changes',()=>{
 const {doc,nodes}=dom();mountBilingualPanels(doc);
 for(const [source,legacy] of [['message','message_hu'],['gmail_original','gmail_original_hu']]){
  const area=nodes.get(legacy),panel=area.closest('.bilingual-panel');
  assert.equal(panel.hidden,false);assert.match(area.placeholder,/fordítókapcsolat/);
  nodes.get(source).value='Jó napot, szeretnénk foglalni.';nodes.get(source).fire('input');assert.equal(panel.hidden,true);
  nodes.get(source).value='Hello, booking inquiry.';nodes.get(source).fire('input');assert.equal(panel.hidden,false);
 }
});
