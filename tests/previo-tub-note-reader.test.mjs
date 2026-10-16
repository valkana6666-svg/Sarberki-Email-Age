import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrevioTubNoteReader} from '../shared-core/previo-tub-note-reader.mjs';
const q={tenantId:'sarberki-test',resourceId:'tub-house-12',start:'2026-10-24T16:00:00Z',end:'2026-10-25T16:00:00Z'};
test('missing source fails closed',async()=>{const r=await createPrevioTubNoteReader().read(q);assert.equal(r.status,'UNKNOWN');assert.equal(r.complete,false)});
test('source cannot self-assert completeness',async()=>{const r=await createPrevioTubNoteReader({fetchNotes:async()=>({notes:[{id:'synthetic-1',text:'12-es ház dézsa 2026-10-24 18:00 24 órára'}],complete:true})}).read(q);assert.equal(r.status,'CANDIDATES_ONLY');assert.equal(r.complete,false)});
test('empty notes do not mean available',async()=>{const r=await createPrevioTubNoteReader({fetchNotes:async()=>({notes:[]})}).read(q);assert.equal(r.complete,false)});
test('read failure fails closed',async()=>{const r=await createPrevioTubNoteReader({fetchNotes:async()=>{throw Error('offline')}}).read(q);assert.equal(r.status,'UNKNOWN')});
test('invalid note fails closed',async()=>{const r=await createPrevioTubNoteReader({fetchNotes:async()=>({notes:[{id:'synthetic',text:42}]})}).read(q);assert.equal(r.status,'UNKNOWN')});

test('duplicate source note ids fail closed',async()=>{const r=await createPrevioTubNoteReader({fetchNotes:async()=>({notes:[{id:'a',text:'dézsa'},{id:'a',text:'dézsa'}]})}).read(q);assert.equal(r.status,'UNKNOWN');assert.equal(r.complete,false)});
test('invalid date interval fails closed without calling provider',async()=>{let calls=0;const reader=createPrevioTubNoteReader({fetchNotes:async()=>{calls++;return {notes:[]}}});const r=await reader.read({...q,end:q.start});assert.equal(r.status,'UNKNOWN');assert.equal(calls,0)});
test('oversized note batch fails closed',async()=>{const notes=Array.from({length:1001},(_,i)=>({id:'n'+i,text:'dézsa'}));const r=await createPrevioTubNoteReader({fetchNotes:async()=>({notes})}).read(q);assert.equal(r.status,'UNKNOWN')});

test('nonexistent dates, midnight rollover and invalid offsets never reach the source',async()=>{
 let calls=0;
 const reader=createPrevioTubNoteReader({fetchNotes:async()=>{calls++;return {notes:[]}}});
 for(const instant of ['2026-02-30T18:00:00Z','2026-02-29T18:00:00Z','2026-04-31T18:00:00Z','2026-10-24T24:00:00Z','2026-10-24T18:00:00+14:01','2026-10-24T18:00:00+15:00']){
  for(const field of ['start','end']){
   const result=await reader.read({...q,[field]:instant});
   assert.equal(result.status,'UNKNOWN',`${field}: ${instant}`);
   assert.equal(result.reason,'INVALID_QUERY');
   assert.equal(result.complete,false);
   assert.deepEqual(result.notes,[]);
  }
 }
 assert.equal(calls,0);
});

test('valid leap day and offset intervals still return candidates, never complete calendars',async()=>{
 const seen=[];
 const reader=createPrevioTubNoteReader({fetchNotes:async query=>{seen.push(query);return {notes:[]}}});
 for(const interval of [
  {start:'2028-02-29T18:00:00Z',end:'2028-03-01T18:00:00Z'},
  {start:'2026-10-25T02:30:00+02:00',end:'2026-10-25T02:30:00+01:00'}
 ]){
  const result=await reader.read({...q,...interval});
  assert.equal(result.status,'CANDIDATES_ONLY');
  assert.equal(result.complete,false);
  assert.deepEqual(seen.at(-1),{...q,...interval});
 }
 assert.equal(seen.length,2);
});
