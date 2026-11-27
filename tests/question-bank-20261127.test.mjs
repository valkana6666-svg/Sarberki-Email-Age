// Owner 2026-11-27: the everyday guest question bank (scripts/question-bank.mjs) is a permanent test – every fact
// question gets its fact from the rule engine (no generic cabin list, no „cannot answer”), in HU/DE/EN/SI.
import test from 'node:test';
import assert from 'node:assert/strict';
import {questions,runEngine} from '../scripts/question-bank.mjs';
test('question bank: every fact question answered with its fact, all languages',()=>{
 const res=runEngine(questions()).filter(r=>r.kind==='fact');
 assert.ok(res.length>=90);
 const bad=res.filter(r=>r.status!=='PASS').map(r=>`${r.id} „${r.text}” → ${r.why}`);
 assert.deepEqual(bad,[]);
});
