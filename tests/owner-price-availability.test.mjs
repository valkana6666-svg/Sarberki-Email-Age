import test from 'node:test';
import assert from 'node:assert/strict';
import {createCaseState,updateCaseState,caseFingerprint,deriveCaseView} from '../case-state.mjs';

const values={
 arrival:'2026-11-20',departure:'2026-11-22',nights:'2',
 guests:'4',adults:'2',children:'2',child_ages:'5, 8',
 unit:'Deluxe',phone:'+36 30 000 0000',language:'HU'
};
const original='Van szabad Deluxe faház 2026. november 20–22. között 2 felnőtt és 2 gyermek számára? Mennyibe kerül?';
const state=()=>createCaseState({original,values,now:'2026-10-09T11:00:00.000Z'});

test('owner-approved manually checked price clears stay availability pending wording',()=>{
 const before=deriveCaseView(state());
 assert.ok(before.warnings.some(item=>item.code==='availability_unverified'));
 const approved=updateCaseState(state(),{
  type:'quote',fingerprint:caseFingerprint(values),
  quote:{total:122200,accommodation:120000,tourismTax:2200,
   source:'Sárberki publikus árlista',referenceOnly:true,operatorChecked:true,availabilityVerified:true}
 });
 const view=deriveCaseView(approved);
 assert.ok(!view.warnings.some(item=>item.code==='availability_unverified'));
 assert.match(view.draft,/A kért időszakra rendelkezésre áll megfelelő szálláslehetőség/u);
 assert.match(view.draft,/122\\s?200|122[.\\s]200/u);
 assert.doesNotMatch(view.draft,/A kért faház elérhetőségét külön visszaigazoljuk|A ténylegesen szabad lehetőségeket a kért időszakra ellenőrizzük/u);
});

test('public price reference without owner availability confirmation remains unverified',()=>{
 const approved=updateCaseState(state(),{
  type:'quote',fingerprint:caseFingerprint(values),
  quote:{total:122200,referenceOnly:true,availabilityVerified:false}
 });
 const view=deriveCaseView(approved);
 assert.ok(view.warnings.some(item=>item.code==='availability_unverified'));
 assert.doesNotMatch(view.draft,/A kért időszakra rendelkezésre áll megfelelő szálláslehetőség/u);
});

test('changed reservation dates invalidate owner-approved price and free status',()=>{
 const approved=updateCaseState(state(),{
  type:'quote',fingerprint:caseFingerprint(values),
  quote:{total:122200,referenceOnly:true,operatorChecked:true,availabilityVerified:true}
 });
 const changed=updateCaseState(approved,{type:'facts',values:{arrival:'2026-11-21'}});
 const view=deriveCaseView(changed);
 assert.equal(changed.quote,null);
 assert.ok(view.warnings.some(item=>item.code==='availability_unverified'));
});
