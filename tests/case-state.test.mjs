import test from 'node:test';
import assert from 'node:assert/strict';
import {createCaseState, updateCaseState, deriveCaseView, caseFingerprint, carsFromText} from '../case-state.mjs';
const original=`Kedves Sárberki Horgásztó!
2026. október 16–18. között, két éjszakára szeretnénk Deluxe faházat foglalni 2 felnőtt és 2 gyermek részére. A gyermekek 7 és 11 évesek. Dézsát is szeretnénk kérni, és egy autóval érkeznénk.
Kérjük, jelezzék, van-e szabad Deluxe faház, mennyi lenne a teljes ár, és milyen előleg- és lemondási feltételek érvényesek. Horgászni is szeretnénk: milyen jegyre és felszerelésre van szükség?
Üdvözlettel: Teszt Elek`;
const values={name:'Teszt Elek',arrival:'2026-10-16',departure:'2026-10-18',nights:'2',guests:'4',adults:'2',children:'2',child_ages:'7, 11',unit:'Deluxe',language:'HU',request:'dézsa'};
const make=()=>createCaseState({original,values,now:'2026-10-05T18:13:41Z'});
const quote={total:122200,accommodation:120000,tourismTax:2200,eurTotal:332.31,eurRate:367.73,eurRateDate:'2026-10-05'};
const approve=state=>updateCaseState(state,{type:'quote',quote,fingerprint:caseFingerprint(state.values)});
test('video Teszt Elek: approved price, missing phone, one car, close arrival and clear hot-tub scope agree',()=>{
 const state=approve(make()), view=deriveCaseView(state);
 assert.match(view.draft,/122\s*200 Ft/u);assert.match(view.draft,/332,31 €/u);
 assert.match(view.draft,/telefonszám/u);assert.match(view.draft,/Egy autó/u);
 assert.doesNotMatch(view.draft,/Ha több autó|50%|10 napon|14\. napig|teljes árat.*adjuk meg/u);
 assert.match(view.draft,/dézsahasználat díja nem állapítható meg/u);
 assert.equal(view.untilArrival,11);assert.equal(view.closeArrival,true);
 assert.ok(view.warnings.some(x=>x.code==='close_arrival'));
 assert.ok(view.warnings.some(x=>x.code==='deposit_amount'&&/konkrét összege/.test(x.text)));
 assert.ok(view.missing.includes('Telefonszám'));assert.match(view.summary,/1 autó/);
 assert.match(view.draft,/állami horgászjegy/u);assert.match(view.draft,/pontybölcső/u);
});
test('a phone supplied after import updates both reply and missing list, preserving approved stay price',()=>{
 const state=updateCaseState(approve(make()),{type:'facts',values:{phone:'+36 30 555 1234'}}), view=deriveCaseView(state);
 assert.ok(state.quote);assert.doesNotMatch(view.draft,/Megírna egy telefonszámot/u);assert.ok(!view.missing.includes('Telefonszám'));
});
test('changed stay or guest ages invalidate quote and all dependent checks',()=>{
 for(const values of [{arrival:'2026-10-17'},{child_ages:'8, 12'},{unit:'VIP'},{units_requested:'2'}]) {
  const state=updateCaseState(approve(make()),{type:'facts',values}),view=deriveCaseView(state);
  assert.equal(state.quote,null);assert.doesNotMatch(view.draft,/122\s*200 Ft/u);
 }
});
test('a stale async quote cannot be approved against changed facts',()=>{
 const state=make(), changed=updateCaseState(state,{type:'facts',values:{arrival:'2026-11-01'}});
 assert.throws(()=>updateCaseState(changed,{type:'quote',quote,fingerprint:caseFingerprint(state.values)}),/más vendégadatok/u);
});
test('availability enrichment preserves the approved quote and sits before signature',()=>{
 const state=approve(make());const next=updateCaseState(state,{type:'availability',fingerprint:caseFingerprint(state.values),lines:['Ellenőrzött szabad lehetőség: Deluxe.']});
 const view=deriveCaseView(next);assert.match(view.draft,/122\s*200 Ft/u);assert.ok(view.draft.indexOf('Ellenőrzött szabad')<view.draft.indexOf('Üdvözlettel:'));
});
test('hot-tub verification has independent dimensions and is not implied by a Deluxe price',()=>{
 let state=make();assert.equal(state.hotTub.atHouse,true);assert.equal(state.hotTub.included,null);
 state=updateCaseState(approve(state),{type:'checks',hotTub:{atHouse:true,available:true,fee:10000,included:false}});
 assert.equal(state.quote,null);const view=deriveCaseView(approve(state));
 assert.match(view.draft,/10\s*000 Ft/u);assert.match(view.draft,/felül fizetendő/u);assert.ok(!view.warnings.some(x=>x.code==='hot_tub_fee'));
});
test('zero verified hot-tub fee is retained and explicit unavailable hot tub is never promised',()=>{
 let state=updateCaseState(make(),{type:'checks',hotTub:{atHouse:true,available:true,fee:0,included:true}});
 assert.match(deriveCaseView(approve(state)).draft,/Díja: 0 Ft/u);
 state=updateCaseState(state,{type:'checks',hotTub:{available:false}});assert.match(deriveCaseView(state).draft,/nem biztosítható/u);
});
test('operator-verified terms replace the pending policy and specific amount warning',()=>{
 const state=updateCaseState(approve(make()),{type:'checks',terms:{depositBasis:'tulajdonos által ellenőrzött szállásdíj',depositAmount:60000,depositDeadline:'2026-10-10',depositVerified:true,cancellationDeadline:'Tulajdonossal külön egyeztetett feltétel',cancellationVerified:true}});
 const view=deriveCaseView(state);assert.match(view.draft,/60\s*000 Ft/u);assert.match(view.draft,/2026-10-10/u);
 assert.doesNotMatch(view.draft,/előleg összegét.*külön visszaigazoljuk/u);
 assert.ok(!view.warnings.some(x=>['deposit_amount','close_arrival','deposit_review'].includes(x.code)));
});
test('checking a policy box without concrete verified data cannot hide missing business decisions',()=>{
 assert.throws(()=>updateCaseState(make(),{type:'checks',terms:{depositVerified:true}}),/számítási alap/u);
 assert.throws(()=>updateCaseState(make(),{type:'checks',terms:{cancellationVerified:true}}),/ellenőrzött feltétel/u);
});
test('normal advance arrival has no close-arrival warning; 15-person group uses configured 30-day threshold',()=>{
 let state=updateCaseState(make(),{type:'facts',values:{arrival:'2026-11-16',departure:'2026-11-18'}});assert.equal(deriveCaseView(state).closeArrival,false);
 state=updateCaseState(state,{type:'facts',values:{guests:'15',arrival:'2026-10-25'}});assert.equal(deriveCaseView(state).closeArrival,true);
});
test('the calendar threshold uses Budapest date instead of UTC midnight',()=>{
 const state=createCaseState({original,values,now:'2026-10-04T22:30:00Z'});assert.equal(deriveCaseView(state).untilArrival,11);
});
for(const [language,phone,parking] of [['HU',/telefonszám/u,/Egy autó/u],['DE',/Telefonnummer/u,/ein Auto/u],['EN',/phone number/u,/one car/u],['SL',/telefonsko/u,/en avtomobil/u]])test(`current-state reply in ${language} contains price, phone and known parking without invented terms`,()=>{
 const state=updateCaseState(make(),{type:'facts',values:{language}}),view=deriveCaseView(approve(state));
 assert.match(view.draft,/122\s*200 Ft/u);assert.match(view.draft,phone);assert.match(view.draft,parking);assert.doesNotMatch(view.draft,/50%|50 %|14 days|14 Tage|14 dni/u);
});
test('one-car normalization accepts each supported guest language',()=>{
 for(const text of ['egy autóval','1 autóval','one car','einem Auto','enim avtomobilom'])assert.equal(carsFromText(text),1,text);
});

test('recorded rental rules distinguish physical tubs from availability and a quoted duration',()=>{
 const view=deriveCaseView(make());assert.match(view.draft,/30\s*000 Ft\/24 óra/u);assert.match(view.draft,/4\s*000 Ft\/fő/u);assert.match(view.draft,/nem jár automatikusan/u);assert.ok(!view.warnings.some(x=>x.code==='hot_tub_assignment'));assert.ok(view.warnings.some(x=>x.code==='hot_tub_fee'));
 assert.equal(updateCaseState(make(),{type:'facts',values:{unit:'Osztott A'}}).hotTub.atHouse,false);
});
test('unrelated unresolved guest questions survive central-state regeneration',()=>{
 const state=createCaseState({original,values,unresolvedQuestions:[{topic:'pet_fee',question:'Kutyadíj ellenőrzendő'},{topic:'deposit_amount',question:'Elavult előlegszöveg'}]});
 const view=deriveCaseView(state);assert.ok(view.warnings.some(x=>x.code==='pet_fee'&&x.text==='Kutyadíj ellenőrzendő'));assert.equal(view.warnings.filter(x=>x.code==='deposit_amount').length,1);
});

test('changing an approved price revokes the old concrete deposit calculation',()=>{
 const state=updateCaseState(approve(make()),{type:'checks',terms:{depositBasis:'szállásdíj',depositAmount:60000,depositDeadline:'2026-10-10',depositVerified:true}});
 const changed=updateCaseState(state,{type:'quote',quote:{...quote,total:130000},fingerprint:caseFingerprint(state.values)});
 assert.equal(changed.terms.depositVerified,false);assert.equal(changed.terms.depositAmount,null);assert.doesNotMatch(deriveCaseView(changed).draft,/ellenőrzött előleg összege 60/u);
});


test('ambiguous four-person apartment stays require a cabin type in central state',()=>{
 const state=createCaseState({
   original:'2026. november 6-8. között négyen jönnénk, egy négyfős apartmant szeretnénk.',
   values:{arrival:'2026-11-06',departure:'2026-11-08',nights:'2',guests:'4',adults:'4',children:'0',child_ages:'',phone:'+36 30 555 1234',unit:'',language:'HU'}
 });
 const view=deriveCaseView(state);
 assert.ok(view.missing.includes('Háztípus'));
 assert.ok(view.warnings.some(x=>x.code==='cabin_type_required'));
 assert.equal(view.critical,true);
 assert.match(view.draft,/Melyik háztípust szeretné/u);
});

test('manual cabin choice resolves the ambiguous two-person cabin requirement',()=>{
 let state=createCaseState({
   original:'2026. november 6-8. között ketten jönnénk, egy kétfős apartmant szeretnénk.',
   values:{arrival:'2026-11-06',departure:'2026-11-08',nights:'2',guests:'2',adults:'2',children:'0',child_ages:'',phone:'+36 30 555 1234',unit:'',language:'HU'}
 });
 assert.ok(deriveCaseView(state).warnings.some(x=>x.code==='cabin_type_required'));
 state=updateCaseState(state,{type:'facts',values:{unit:'Különálló 2 fős'}});
 const view=deriveCaseView(state);
 assert.ok(!view.missing.includes('Háztípus'));
 assert.ok(!view.warnings.some(x=>x.code==='cabin_type_required'));
 assert.match(view.draft,/Különálló 2 fős/u);
});

test('physical split unit ids never imply a hot tub',()=>{
 let state=createCaseState({
   original:'A 7A osztott apartmant szeretnénk dézsával.',
   values:{unit:'7A',guests:'2',adults:'2',children:'0',phone:'+36 30 555 1234',language:'HU'}
 });
 assert.equal(state.hotTub.atHouse,false);
 state=updateCaseState(state,{type:'facts',values:{unit:'10C'}});
 assert.equal(state.hotTub.atHouse,false);
});


test('six-person inquiry answers accommodation, parking and fishing before asking only for missing guest details',()=>{
 const inquiry='Jó napot! 2026. október 9-13. között 6 fővel mennénk. Milyen szálláslehetőségek vannak? Lehet a háznál parkolni? Horgászni is szeretnénk, mik a feltételek?';
 const state=createCaseState({
   original:inquiry,
   values:{arrival:'2026-10-09',departure:'2026-10-13',nights:'4',guests:'6',adults:'',children:'',child_ages:'',phone:'',unit:'',language:'HU'}
 });
 const view=deriveCaseView(state);
 assert.match(view.draft,/Deluxe/u);
 assert.match(view.draft,/Családi/u);
 assert.match(view.draft,/VIP/u);
 assert.match(view.draft,/A\+C vagy B\+C/u);
 assert.match(view.draft,/Parkolási lehetőség biztosított a házaknál/u);
 assert.match(view.draft,/állami horgászjegy/u);
 assert.match(view.draft,/pontybölcső/u);
 assert.match(view.draft,/felnőttek/u);
 assert.match(view.draft,/gyermek/u);
 assert.match(view.draft,/telefonszám/u);
 assert.doesNotMatch(view.draft,/7C|8C|9C|10C|emberi döntésre vár/u);
 assert.doesNotMatch(view.draft,/előleg összegét és fizetési határidejét|lemondási feltételt külön/u);
});
