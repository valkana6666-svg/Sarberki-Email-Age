import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeInquiryInput} from '../intake-normalize.mjs';
import {evaluateCentralInquiry} from '../shared-core/central-inquiry-decision.mjs';
const now=new Date('2026-10-12T07:00:00+02:00');
const dates={arrival:'2026-11-26',departure:'2026-11-28',inferred_year:false};
for(const adults of [2,3,4,5,6,7])for(const channel of ['gmail','web_form']){
 test(`adult-only ${adults} ${channel}: zero children without follow-up`,()=>{
  const message=`${adults} felnőtt érkezne november 26-28 között.`;
  const facts=normalizeInquiryInput({sourceChannel:channel,rawText:message,now}).normalized;
  assert.equal(facts.adults,adults);
  assert.equal(facts.children,0);
  const decision=evaluateCentralInquiry({facts:{...facts,dates},now,message});
  assert.equal(decision.facts.children,0);
  assert.equal(decision.missing.includes('children_status'),false);
 });
}
for(const channel of ['gmail','web_form']){
 test(`children mentioned without age remain unresolved: ${channel}`,()=>{
  const facts=normalizeInquiryInput({sourceChannel:channel,rawText:'2 felnőtt és 2 gyermek érkezne.',now}).normalized;
  const decision=evaluateCentralInquiry({facts:{...facts,dates},now});
  assert.equal(facts.children,2);
  assert.equal(decision.missing.includes('child_ages'),true);
 });
 test(`unknown child count never defaults to zero: ${channel}`,()=>{
  const facts=normalizeInquiryInput({sourceChannel:channel,rawText:'2 felnőtt és gyerekek érkeznének.',now}).normalized;
  assert.equal(facts.children,null);
 });
}
