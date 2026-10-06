import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {availabilitySentence,splitReviewSentence,replaceCapacityPlaceholder} from '../availability-recommend.mjs';
import * as core from '../sarberki-core.mjs';
import * as splitUnits from '../split-units.mjs';
const available={available_options:[{label:'Deluxe',units:1},{label:'Családi',units:2}],manual_review_options:[{label:'Osztott A + C'}]};
for(const [lang,word] of [['hu','szabad'],['de','verfügbare'],['en','available'],['si','proste']]){
 test(`availability reply ${lang} uses the guest language`,()=>assert.ok(availabilitySentence(available,lang).includes(word)));
 test(`availability reply ${lang} does not expose internal PMS mapping`,()=>assert.doesNotMatch(splitReviewSentence(available,lang),/Previo|megfeleltetés|7A|10C|pool|mapping/iu));
}
const labelCases={
 de:{family:'Familienhaus',split:'Geteilte Einheit'},
 en:{family:'Family cabin',split:'Split unit'},
 si:{family:'Družinska hiška',split:'Deljena enota'}
};
for(const [lang,expected] of Object.entries(labelCases)){
 test(`availability option labels are localized for ${lang}`,()=>{
   const sentence=availabilitySentence({available_options:[{label:'Családi',units:1}]},lang);
   const manual=splitReviewSentence({manual_review_options:[{label:'Osztott A + Osztott C'}]},lang);
   assert.match(sentence,new RegExp(expected.family,'u'));
   assert.match(manual,new RegExp(expected.split,'u'));
   assert.doesNotMatch(sentence,/Családi|Osztott/u);
   assert.doesNotMatch(manual,/Családi|Osztott/u);
 });
 test(`core reply does not invent a cabin choice in ${lang}`,()=>{
   const draft=core.buildReplyDraft({
     language:lang,
     original:'test',
     arrival:'2026-11-13',
     departure:'2026-11-15',
     guests:6,
     adults:6,
     children:0,
     phone:'+36 30 555 1234',
     cabin:'? – emberi döntésre vár'
   });
   assert.doesNotMatch(draft,/Családi|Osztott|Familienhaus|Family cabin|Družinska hiška/u);
   assert.doesNotMatch(draft,/Which cabin type|Welchen Haustyp|Kateri tip hiške/u);
 });
}

test('empty availability does not promise accommodation',()=>assert.match(availabilitySentence({available_options:[]},'en'),/not found/u));
function harness(){
 const source=fs.readFileSync(new URL('../availability-recommend.mjs',import.meta.url),'utf8').replaceAll('export function','function');
 const nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',classList:{contains:()=>true},dispatchEvent(){}});return nodes.get(id);};
 const pending=[];
 const context=vm.createContext({document:{getElementById:node,addEventListener(){},dispatchEvent(){}},window:{SarberkiNormalize:core,SarberkiSplitUnits:splitUnits},Event,console,Number,JSON,setTimeout(){},fetch:()=>new Promise(resolve=>pending.push(resolve))});
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


test('verified availability replaces the generic capacity placeholder inside the accommodation block',()=>{
  const base=core.buildReplyDraft({
    language:'hu',
    original:'2026. október 9-13. 6 felnőtt, gyermek nélkül. Van szabad hely? Horgászni is szeretnénk.',
    arrival:'2026-10-09',departure:'2026-10-13',guests:6,adults:6,children:0,phone:'+36 30 555 1234',
    cabin:'? – emberi döntésre vár',knowledgeLines:['Horgászati feltételek.']
  });
  const result=replaceCapacityPlaceholder(base,availabilitySentence(available,'hu'),splitReviewSentence(available,'hu'));
  assert.doesNotMatch(result,/megkeressük a megfelelő szabad szállástípusokat/u);
  assert.match(result,/ellenőrzött, szabad lehetőségek/u);
  assert.ok(result.indexOf('ellenőrzött, szabad lehetőségek')<result.indexOf('Horgászat\n'));
});


test('exact physical split ids remain internal and are not echoed to the guest',()=>{
  const sentence=splitReviewSentence({manual_review_options:[{request_mode:'exact',label:'7A + 7C'}]},'hu');
  assert.doesNotMatch(sentence,/7A|7C|8A|10C/u);
  assert.match(sentence,/megjelölt osztott egységek/u);
});


test('ambiguous four-person apartment request waits for cabin type instead of calling availability',async()=>{
  const h=harness();
  h.node('f_guests').value='4';
  h.node('f_unit').value='';
  h.node('message').value='Négyen jönnénk, egy négyfős apartmant szeretnénk.';
  await h.run();
  assert.equal(h.pending.length,0);
});

test('explicit four-person split request uses C logic internally without exposing physical house ids',async()=>{
  const h=harness();
  h.node('f_guests').value='4';
  h.node('f_unit').value='Osztott';
  h.node('message').value='Egy 4 fős osztott apartmant szeretnénk.';
  const p=h.run();
  assert.equal(h.pending.length,1);
  h.pending[0]({ok:true,json:async()=>({
    available_options:[],
    manual_review_options:[],
    split_pool_checks:{splitAB:{verified:true,availableUnits:8},splitC:{verified:true,availableUnits:4}}
  })});
  await p;
  assert.match(h.node('split_internal_note').textContent,/7C, 8C, 9C, 10C/u);
  assert.match(h.node('draft').value,/emeleti egysége/u);
  assert.doesNotMatch(h.node('draft').value,/7C|8C|9C|10C/u);
});

test('two two-person split apartments show same-house A+B priority internally',async()=>{
  const h=harness();
  h.node('f_guests').value='4';
  h.node('f_unit').value='Osztott';
  h.node('message').value='Kettő darab kétfős osztott apartmant szeretnénk.';
  const p=h.run();
  assert.equal(h.pending.length,1);
  h.pending[0]({ok:true,json:async()=>({
    available_options:[],
    manual_review_options:[],
    split_pool_checks:{splitAB:{verified:true,availableUnits:8},splitC:{verified:true,availableUnits:4}}
  })});
  await p;
  assert.match(h.node('split_internal_note').textContent,/7A\+7B/u);
  assert.match(h.node('split_internal_note').textContent,/emberi jóváhagyással/u);
  assert.match(h.node('draft').value,/ugyanazon faház.*A\+B/u);
  assert.doesNotMatch(h.node('draft').value,/7A|7B|8A|8B/u);
});
