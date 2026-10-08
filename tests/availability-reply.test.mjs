import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {availabilitySentence,splitReviewSentence,replaceCapacityPlaceholder,requestedSplitAvailabilitySentence} from '../availability-recommend.mjs';
import * as core from '../sarberki-core.mjs';
import * as splitUnits from '../split-units.mjs';
import {capacityInput,selectedCapacityOptions} from '../booking-filter.mjs';
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
 test(`core reply lists capacity-compatible options without silently selecting one in ${lang}`,()=>{
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
   assert.match(draft,/Deluxe/u);
   assert.match(draft,new RegExp(expected.family,'u'));
   assert.match(draft,/VIP/u);
   assert.match(draft,/A\+C|B\+C/u);
   assert.doesNotMatch(draft,/Requested cabin type|Gewünschter Haustyp|Želeni tip hiške/u);
   assert.doesNotMatch(draft,/Which cabin type|Welchen Haustyp|Kateri tip hiške/u);
 });
}

test('empty availability does not promise accommodation',()=>assert.match(availabilitySentence({available_options:[]},'en'),/not found/u));

test('full or unverified split pools are not mentioned as guest alternatives',()=>{
  const result={
    split_pool_checks:{splitAB:{verified:true,availableUnits:0},splitC:{verified:true,availableUnits:4}},
    manual_review_options:[{label:'Osztott A + Osztott C',pooled_availability_verified:false}]
  };
  assert.equal(splitReviewSentence(result,'hu'),'');
  assert.equal(splitReviewSentence(result,'en'),'');
});
test('verified split pool may be mentioned conditionally, with manual placement review',()=>{
  const result={
    split_pool_checks:{splitAB:{verified:true,availableUnits:2},splitC:{verified:true,availableUnits:1}},
    manual_review_options:[{label:'Osztott A + Osztott C',pooled_availability_verified:true}]
  };
  assert.match(splitReviewSentence(result,'hu'),/szóba jöhet.*ellenőrizzük/u);
});

function harness(){
 const source=fs.readFileSync(new URL('../availability-recommend.mjs',import.meta.url),'utf8').replaceAll('export function','function');
 const nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',classList:{contains:()=>true},dispatchEvent(){}});return nodes.get(id);};
 const pending=[];
 const context=vm.createContext({document:{getElementById:node,addEventListener(){},dispatchEvent(){}},window:{SarberkiNormalize:core,SarberkiSplitUnits:splitUnits},Event,console,Number,JSON,setTimeout(){},fetch:()=>new Promise(resolve=>pending.push(resolve))});
 node('f_arrival').value='2026-10-16';node('f_departure').value='2026-10-18';node('f_guests').value='6';node('f_language').value='HU';node('message').value='6 fő';node('draft').value='eredeti';
 vm.runInContext(source,context);
 return {node,pending,window:context.window,run:(data)=>{context.provided=data;return vm.runInContext('enrich(provided)',context);}};
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
  assert.match(h.node('draft').value,/emeleti apartman/u);
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
  assert.match(h.node('split_internal_note').textContent,/szomszédságot nem ígérünk/u);
  assert.match(h.node('draft').value,/2 × Osztott A\/B/u);
  assert.doesNotMatch(h.node('draft').value,/ugyanazon faház/u);
  assert.doesNotMatch(h.node('draft').value,/7A|7B|8A|8B/u);
});

for(const cabin of ['VIP','Családi','Deluxe']){
 test(`October 23–25: explicit ${cabin} invokes occupancy and excludes a full type`,async()=>{
  const h=harness();
  h.node('f_arrival').value='2026-10-23';h.node('f_departure').value='2026-10-25';
  h.node('f_guests').value='4';h.node('f_adults').value='4';h.node('f_children').value='0';h.node('f_unit').value=cabin;
  h.node('message').value=`2026. október 23–25. között egy ${cabin} faház négy felnőtt részére, gyermek nélkül.`;
  const p=h.run();assert.equal(h.pending.length,1);
  const key={VIP:'vip',Családi:'family',Deluxe:'deluxe'}[cabin];
  h.pending[0]({ok:true,json:async()=>({available_options:[{key:'splitC',label:'Osztott C (emeleti apartman)',units:1,availability:'available',availability_verified:true}],unavailable_options:[{key,label:cabin,availability:'unavailable',availability_verified:true}],split_pool_checks:{splitAB:{verified:true,availableUnits:0},splitC:{verified:true,availableUnits:2}}})});
  await p;
  assert.match(h.node('draft').value,new RegExp(`A kért ${cabin}.*nem elérhető`,'u'));
  assert.match(h.node('draft').value,/Osztott C/u);
 });
}
test('generic four adults without a cabin preference invokes occupancy',async()=>{
 const h=harness();h.node('f_guests').value='4';h.node('message').value='Négy felnőttnek keresünk szállást, gyermek nélkül.';
 const p=h.run();assert.equal(h.pending.length,1);h.pending[0]({ok:false,json:async()=>({error:'offline'})});await p;
 assert.doesNotMatch(h.node('draft').value,/ellenőrzött, szabad/u);
});
test('explicit A+B and C letters preserve split request meaning',()=>{
 assert.equal(splitUnits.splitRequestFromText('Osztott faház A+B, két kétszemélyes apartman').requestedAB,2);
 assert.equal(splitUnits.splitRequestFromText('Osztott faház C, emeleti, négyszemélyes apartman').requestedC,1);
});
test('pool counts never confirm an exact C unit or an A+B pair',()=>{
 const result={split_pool_checks:{splitAB:{verified:true,availableUnits:2},splitC:{verified:true,availableUnits:2}}};
 assert.match(requestedSplitAvailabilitySentence(result,splitUnits.splitRequestFromText('Osztott A+B'),'hu'),/ellenőrzött, szabad/u);
 assert.doesNotMatch(requestedSplitAvailabilitySentence(result,splitUnits.splitRequestFromText('Osztott A+B'),'hu'),/egymás mellett/u);
 assert.match(requestedSplitAvailabilitySentence(result,splitUnits.splitRequestFromText('Osztott 7C'),'hu'),/emberi ellenőrzés/u);
 assert.match(requestedSplitAvailabilitySentence(result,splitUnits.splitRequestFromText('Osztott faház C'),'hu'),/ellenőrzött, szabad/u);
 result.split_pool_checks.splitAB.availableUnits=0;
 assert.match(requestedSplitAvailabilitySentence(result,splitUnits.splitRequestFromText('Osztott A+B'),'hu'),/nincs elegendő/u);
});

// The deployed central runtime must consume the server decision, not reconstruct pools.
test('central reply preserves three requested AB apartments without recalculating a pair',async()=>{
 const h=harness(),values={arrival:'2026-10-16',departure:'2026-10-18',guests:6,adults:6,unit:'Osztott',units_requested:3,split_request_text:'Osztott A+B'};
 h.node('f_unit').value='Osztott';h.node('message').value='Osztott A+B';let applied;
 h.window.SarberkiBookingRuntime={input:capacityInput,selected:selectedCapacityOptions};
 h.window.SarberkiCaseState={caseFingerprint:()=> 'key'};
 h.window.SarberkiCaseController={snapshot:()=>({values,original:'Osztott A+B'}),apply:a=>{applied=a;}};
 h.window.SarberkiSplitUnits={...splitUnits,splitCapacityOptions:()=>{throw Error('Browser must not decide placement');}};
 await h.run({checkedAt:'2026-10-08T19:00:00Z',available_options:[{key:'splitAB',label:'Osztott A/B',units:3,availability:'available',availability_verified:true,components:[{label:'Osztott A/B',units:3}]}],unverified_options:[],manual_review_options:[],split_pool_checks:{splitAB:{verified:true,availableUnits:3}}});
 assert.equal(applied.verified,true);assert.match(applied.lines.join(' '),/3 × Osztott A\/B/u);assert.doesNotMatch(applied.lines.join(' '),/Két 2 fős/u);
});
test('central reply distinguishes failed capacity evidence from insufficient inventory',async()=>{
 const h=harness(),values={arrival:'2026-10-16',departure:'2026-10-18',guests:6,unit:'Osztott',split_request_text:'Osztott A+B'};h.node('f_unit').value='Osztott';let applied;
 h.window.SarberkiBookingRuntime={input:capacityInput,selected:selectedCapacityOptions};h.window.SarberkiCaseState={caseFingerprint:()=> 'key'};h.window.SarberkiCaseController={snapshot:()=>({values}),apply:a=>{applied=a;}};
 await h.run({available_options:[],unverified_options:[{key:'splitAB',availability:'unverified'}],manual_review_options:[],split_pool_checks:{}});
 assert.equal(applied.verified,false);assert.match(applied.lines.join(' '),/nem sikerült.*igazolni/u);assert.doesNotMatch(applied.lines.join(' '),/nincs elegendő/u);
});
test('mixed repeated inventory displays component counts independently',()=>{
 const text=availabilitySentence({available_options:[{units:4,components:[{label:'Osztott A/B',units:2},{label:'Osztott C',units:2}]}]},'hu');assert.match(text,/2 × Osztott A\/B \+ 2 × Osztott C/u);
});
