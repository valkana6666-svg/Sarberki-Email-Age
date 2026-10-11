import test from 'node:test';
import assert from 'node:assert/strict';
import {combineCaseFacts} from '../shared-core/case-facts-merge.mjs';

test('same case adds only missing facts',()=>{
 const result=combineCaseFacts({arrival:'2026-11-13',guests:4},{unit:'Deluxe',phone:'+36301234567'},true);
 assert.equal(result.status,'MERGED');
 assert.equal(result.values.arrival,'2026-11-13');
 assert.equal(result.values.unit,'Deluxe');
 assert.deepEqual(result.conflicts,[]);
});
test('different case never merges',()=>{
 const result=combineCaseFacts({arrival:'2026-11-13'},{unit:'Deluxe'},false);
 assert.equal(result.status,'UNMATCHED');
 assert.equal(result.values.unit,undefined);
});
test('conflicting dates and occupancy need review',()=>{
 const result=combineCaseFacts({arrival:'2026-11-13',guests:4},{arrival:'2026-11-14',guests:6},true);
 assert.equal(result.status,'REVIEW_REQUIRED');
 assert.equal(result.values.arrival,'2026-11-13');
 assert.equal(result.values.guests,4);
 assert.equal(result.conflicts.length,2);
});
test('blank reply cannot erase established facts',()=>{
 const result=combineCaseFacts({unit:'Deluxe'},{unit:'',phone:null},true);
 assert.equal(result.values.unit,'Deluxe');
 assert.deepEqual(result.updates,{});
});
