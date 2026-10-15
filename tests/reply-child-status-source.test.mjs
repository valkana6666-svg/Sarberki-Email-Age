import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const core=readFileSync(new URL('../sarberki-core.mjs',import.meta.url),'utf8');
test('shared reply builder does not request child status when adult count is known',()=>{
 assert.match(core,/const needChildStatus=!childStatusKnown && needAdults;/u);
 assert.match(core,/const needChildAge=childStatusKnown&&Number\(children\)>0&&childAges\.length<Number\(children\);/u);
});

test('adult-only reply draft omits child clarification in all four languages',async()=>{
 const {buildReplyDraft}=await import('../sarberki-core.mjs');
 for(const [language,question] of [
  ['hu','érkezik-e gyermek is'],
  ['de','Reisen auch Kinder mit?'],
  ['en','Will any children be staying with you?'],
  ['si','ali bodo z vami tudi otroci']
 ]){
  const draft=buildReplyDraft({language,original:'Synthetic booking inquiry',adults:4,children:null,guests:4,phone:'000-TEST',cabin:'Deluxe',arrival:'2026-10-25',departure:'2026-10-27'});
  assert.equal(draft.includes(question),false,language);
  const withoutAdults=buildReplyDraft({language,original:'Synthetic booking inquiry',adults:null,children:null,guests:null,phone:'000-TEST',cabin:'Deluxe',arrival:'2026-10-25',departure:'2026-10-27'});
  assert.equal(withoutAdults.includes(question),true,language+' positive control');
 }
});
