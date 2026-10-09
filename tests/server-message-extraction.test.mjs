import test from 'node:test';
import assert from 'node:assert/strict';
import {extractServerMessage} from '../shared-core/server-message-extraction.mjs';
const parse=text=>extractServerMessage({text,received_at:'2026-10-09T08:00:00Z'});
test('server extracts confirmed dates and counts with existing English parser',()=>{
 const v=parse('Please book one Deluxe cabin from 2026-11-01 to 2026-11-03 for 2 adults and no children.');
 assert.deepEqual(v,{arrival:'2026-11-01',departure:'2026-11-03',guests:'2',adults:'2',children:'0',unit:'Deluxe',units_requested:'1',language:'en'});
});
test('unrecognized follow-up adds no default or clearing values',()=>assert.deepEqual(parse('OK.'),{}));
test('alternative dates require clarification instead of selecting a stay',()=>{
 const v=parse('2026-11-01 to 2026-11-03 or 2026-11-08 to 2026-11-10');
 assert.equal(v.arrival,undefined);assert.equal(v.departure,undefined);
});
test('inferred year is not silently promoted to confirmed server dates',()=>{
 const v=parse('November 1-3 for 2 adults');assert.equal(v.arrival,undefined);assert.equal(v.departure,undefined);
});
