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
