import test from 'node:test';
import assert from 'node:assert/strict';
import {createBookingCaseStore} from '../booking-cases.mjs';

// Synthetic-only regression: service request is a follow-up, not a new stay.
const message=(id, text, sender='synthetic-guest@example.test')=>({message_id:id,thread_id:'synthetic-thread-tub',sender,text,received_at:id==='m1'?'2026-10-16T08:00:00Z':'2026-10-16T08:10:00Z'});

test('synthetic tub request preserves existing booking and requires fresh review',()=>{
 let n=0;
 const store=createBookingCaseStore({storage:null,id:()=> 'synthetic-case-'+(++n),clock:()=> '2026-10-16T09:00:00Z'});
 const first=store.ingest(message('m1','Foglalás 2026. október 23-ra'),{arrival:'2026-10-23',departure:'2026-10-25',unit:'VIP'},{intent:'booking_request'});
 const followup=store.ingest(message('m2','Október 23-án 18:00-tól 24 órára szeretnénk dézsafürdőt.'),{},{intent:'other'});
 assert.equal(followup.bookingCase.id,first.bookingCase.id);
 assert.equal(store.list().length,1);
 assert.equal(followup.bookingCase.state.values.arrival,'2026-10-23');
 assert.equal(followup.bookingCase.state.values.unit,'VIP');
 assert.equal(followup.bookingCase.state.approval,'pending');
});

test('synthetic tub request from different sender cannot hijack booking',()=>{
 const store=createBookingCaseStore({storage:null,id:(()=>{let n=0;return ()=> 'synthetic-case-'+(++n);})(),clock:()=> '2026-10-16T09:00:00Z'});
 const first=store.ingest(message('m1','Foglalás'),{arrival:'2026-10-23'},{intent:'booking_request'});
 const second=store.ingest(message('m2','Dézsát kérnék','another-synthetic@example.test'),{},{intent:'other'});
 assert.notEqual(first.bookingCase.id,second.bookingCase.id);
});
