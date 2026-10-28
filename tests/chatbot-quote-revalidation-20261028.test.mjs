import test from 'node:test';
import assert from 'node:assert/strict';
import {createCaseState, updateCaseState, caseFingerprint, deriveCaseView} from '../case-state.mjs';

// Regression: an operator-approved price/capacity must never silently carry
// over after a material change to the requested stay or guest composition.
const values={
 arrival:'2026-11-20', departure:'2026-11-22', nights:'2',
 guests:'4', adults:'2', children:'2', child_ages:'5, 8',
 unit:'Deluxe', units_requested:'1', phone:'+36 30 000 0000', language:'HU'
};
function approvedCase(){
 const base=createCaseState({
  original:'Van szabad Deluxe faház 2026. november 20–22. között 2 felnőtt és 2 gyermek részére?',
  values, now:'2026-10-28T10:00:00.000Z'
 });
 return updateCaseState(base,{
  type:'quote',fingerprint:caseFingerprint(base.values),
  quote:{total:122200,accommodation:120000,tourismTax:2200,
   source:'SYNTHETIC_OPERATOR_CHECK',operatorChecked:true,availabilityVerified:true}
 });
}
for(const [label,change] of Object.entries({
 'adults':{adults:'3',guests:'5'},
 'child ages':{child_ages:'5, 9'},
 'cabin':{unit:'Családi'},
 'number of units':{units_requested:'2'},
 'departure':{departure:'2026-11-23'}
})){
 test('changing '+label+' revokes the prior approved quote and availability',()=>{
  const before=approvedCase();
  const changed=updateCaseState(before,{type:'facts',values:change});
  assert.equal(changed.quote,null);
  assert.equal(changed.availability,null);
  assert.equal(changed.approval,'pending');
  const view=deriveCaseView(changed);
  assert.ok(view.warnings.some(x=>x.code==='price_unverified'));
  assert.ok(view.warnings.some(x=>x.code==='availability_unverified'));
  assert.doesNotMatch(view.draft,/122\\s?200\\s?Ft/u);
 });
}
test('a changed-request fingerprint cannot approve the former quote',()=>{
 const original=approvedCase();
 const updated=updateCaseState(original,{type:'facts',values:{adults:'3',guests:'5'}});
 assert.throws(()=>updateCaseState(updated,{type:'quote',fingerprint:caseFingerprint(original.values),quote:{total:122200}}),/más vendégadatokhoz/);
});
