import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {availabilitySentence,splitReviewSentence} from '../availability-recommend.mjs';
import * as core from '../sarberki-core.mjs';
const available={available_options:[{label:'Deluxe',units:1},{label:'Családi',units:2}],manual_review_options:[{label:'Osztott A + C'}]};
for(const [lang,word] of [['hu','szabad'],['de','verfügbare'],['en','available'],['si','proste']]){
 test(`availability reply ${lang} uses the guest language`,()=>assert.ok(availabilitySentence(available,lang).includes(word)));
 test(`availability reply ${lang} does not expose internal PMS mapping`,()=>assert.doesNotMatch(splitReviewSentence(available,lang),/Previo|megfeleltetés|7A|10C|pool|mapping/iu));
}
test('empty availability does not promise accommodation',()=>assert.match(availabilitySentence({available_options:[]},'en'),/not found/u));
function harness(){
 const source=fs.readFileSync(new URL('../availability-recommend.mjs',import.meta.url),'utf8').replaceAll('export function','function');
 const nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',classList:{contains:()=>true},dispatchEvent(){}});return nodes.get(id);};
 const pending=[];
 const context=vm.createContext({document:{getElementById:node,addEventListener(){},dispatchEvent(){}},window:{SarberkiNormalize:core},Event,console,Number,JSON,setTimeout(){},fetch:()=>new Promise(resolve=>pending.push(resolve))});
 node('f_arrival').value='2026-10-16';node('f_departure').value='2026-10-18';node('f_guests').value='6';node('f_language').value='HU';node('message').value='6 fő';node('draft').value='eredeti';
 vm.runInContext(source,context);
 return {node,pending,run:()=>vm.runInContext('enrich()',context)};
}
test('late availability response cannot overwrite a changed inquiry',async()=>{
 const h=harness(),p=h.run();h.node('f_arrival').value='2026-11-20';h.node('draft').value='új érdeklődés';
 h.pending[0]({ok:true,json:async()=>available});await p;assert.equal(h.node('draft').value,'új érdeklődés');
});
test('blank child ages never become age zero during capacity enrichment',async()=>{
 const h=harness();h.node('f_children').value='1';h.node('f_adults').value='5';const p=h.run();
 h.pending[0]({ok:true,json:async()=>available});await p;
 assert.match(h.node('draft').value,/életkor/u);assert.doesNotMatch(h.node('draft').value,/0 éves/u);
 assert.ok(h.node('draft').value.indexOf('szabad lehetőségek')<h.node('draft').value.indexOf('Üdvözlettel:'));
});
