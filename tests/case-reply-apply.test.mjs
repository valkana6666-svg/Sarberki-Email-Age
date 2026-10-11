import test from 'node:test';
import assert from 'node:assert/strict';
import {createCaseState,applyIncomingCaseReply,updateCaseState,caseFingerprint} from '../case-state.mjs';
const make=()=>createCaseState({original:'4 fő részére érdeklődöm.',values:{arrival:'2026-11-13',departure:'2026-11-15',guests:'4',adults:'4',children:'0',unit:'',language:'HU'}});
test('verified reply selects a cabin and keeps prior dates',()=>{
 const start=make();
 const x=applyIncomingCaseReply(start,{conversation:{threadId:'t1'},incoming:{threadId:'t1'},incomingFacts:{unit:'Deluxe'}});
 assert.equal(x.applied,true);assert.equal(x.state.values.unit,'Deluxe');
 assert.equal(x.state.values.arrival,'2026-11-13');
 assert.equal(x.state.revision,start.revision+1);
});
test('unverified reply cannot change existing booking case',()=>{
 const start=make();
 const x=applyIncomingCaseReply(start,{conversation:{threadId:'t1'},incoming:{threadId:'t2'},incomingFacts:{unit:'Deluxe'}});
 assert.equal(x.applied,false);assert.equal(x.state,start);
});
test('conflicting reply requires review without modifying state',()=>{
 const start=make();
 const x=applyIncomingCaseReply(start,{conversation:{threadId:'t1'},incoming:{threadId:'t1'},incomingFacts:{guests:'6'}});
 assert.equal(x.applied,false);assert.equal(x.state,start);
 assert.equal(x.result.status,'REVIEW_REQUIRED');
});
test('verified cabin selection invalidates prior price and availability',()=>{
 let start=make();
 start=updateCaseState(start,{type:'quote',quote:{total:100000},fingerprint:caseFingerprint(start.values)});
 start=updateCaseState(start,{type:'availability',fingerprint:caseFingerprint(start.values),verified:true,lines:['Previously checked']});
 const x=applyIncomingCaseReply(start,{conversation:{threadId:'t1'},incoming:{threadId:'t1'},incomingFacts:{unit:'Deluxe'}});
 assert.equal(x.applied,true);assert.equal(x.state.quote,null);assert.equal(x.state.availability,null);
});
