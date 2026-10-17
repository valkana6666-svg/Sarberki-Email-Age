import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReplyDraft} from '../sarberki-core.mjs';
import {availabilitySentence} from '../availability-recommend.mjs';

const languages=['hu','de','en','si'];
const request={original:'Synthetic booking inquiry',arrival:'2026-11-05',departure:'2026-11-07',adults:4,guests:4,children:0,phone:'000-TEST',cabin:'Deluxe'};

for(const language of languages){
  test(`V1 language ${language}: confirmed capacity never exposes PMS internals`,()=>{
    const result=availabilitySentence({available_options:[{label:'Deluxe',units:1,availability:'available',availability_verified:true}]},language);
    assert.match(result,/Deluxe/u);
    assert.doesNotMatch(result,/Previo|mapping|pool|7A|10C/iu);
  });
  test(`V1 language ${language}: unknown capacity is not presented as available`,()=>{
    const result=availabilitySentence({available_options:[]},language);
    assert.doesNotMatch(result,/Deluxe/u);
    assert.ok(result.length>10);
  });
  test(`V1 language ${language}: draft retains requested stay and cabin`,()=>{
    const draft=buildReplyDraft({...request,language});
    assert.match(draft,/Deluxe/u);
    assert.ok(draft.length>20);
  });
}
