import test from 'node:test';
import assert from 'node:assert/strict';
import {createBookingCaseStore} from '../booking-cases.mjs';
const make=()=>{
 let n=0;
 return createBookingCaseStore({tenantId:'sarberki',storage:null,id:()=>`synthetic-${++n}`,clock:()=> '2026-10-11T12:00:00Z'});
};
const msg=(id,thread,text,extra={})=>({message_id:id,thread_id:thread,sender:'guest@example.test',text,received_at:'2026-10-11T10:00:00Z',...extra});
test('actual case store keeps original dates when guest selects cabin in Gmail reply',()=>{
 const store=make();
 const first=store.ingest(msg('m1','thread-1','4 főre szeretnénk szállást'),{arrival:'2026-11-13',departure:'2026-11-15',guests:'4',adults:'4',children:'0'},{intent:'booking_request'});
 const second=store.ingest(msg('m2','thread-1','A Deluxe faházat választjuk',{received_at:'2026-10-11T11:00:00Z'}),{unit:'Deluxe'},{intent:'booking_request'});
 assert.equal(second.bookingCase.id,first.bookingCase.id);
 assert.equal(second.bookingCase.state.values.arrival,'2026-11-13');
 assert.equal(second.bookingCase.state.values.unit,'Deluxe');
});
test('actual case store does not merge same sender with different Gmail thread',()=>{
 const store=make();
 const a=store.ingest(msg('m1','thread-1','Első érdeklődés'),{arrival:'2026-11-13',departure:'2026-11-15'},{intent:'booking_request'});
 const b=store.ingest(msg('m2','thread-2','Másik érdeklődés'),{arrival:'2026-12-01',departure:'2026-12-03'},{intent:'booking_request'});
 assert.notEqual(a.bookingCase.id,b.bookingCase.id);
});

test('actual case store refuses same Gmail thread from a different sender',()=>{
 const store=make();
 const a=store.ingest(msg('m1','thread-1','Első vendég'),{arrival:'2026-11-13',departure:'2026-11-15'},{intent:'booking_request'});
 const b=store.ingest(msg('m2','thread-1','Másik feladó',{sender:'another@example.test',received_at:'2026-10-11T11:00:00Z'}),{unit:'Deluxe'},{intent:'booking_request'});
 assert.notEqual(a.bookingCase.id,b.bookingCase.id);
 assert.equal(store.get(a.bookingCase.id).state.values.unit,undefined);
});

test('duplicate Gmail message is idempotent',()=>{
 const store=make();
 const envelope=msg('m1','thread-1','Első érdeklődés');
 const first=store.ingest(envelope,{arrival:'2026-11-13'},{intent:'booking_request'});
 const duplicate=store.ingest(envelope,{arrival:'2026-12-01'},{intent:'booking_request'});
 assert.equal(duplicate.resolution.status,'duplicate');
 assert.equal(duplicate.bookingCase.id,first.bookingCase.id);
 assert.equal(store.get(first.bookingCase.id).state.values.arrival,'2026-11-13');
 assert.equal(store.list().length,1);
});
test('older Gmail reply cannot overwrite a later confirmed cabin choice',()=>{
 const store=make();
 const first=store.ingest(msg('m1','thread-1','Kezdeti érdeklődés'),{arrival:'2026-11-13',departure:'2026-11-15'},{intent:'booking_request'});
 store.ingest(msg('m3','thread-1','Deluxe választás',{received_at:'2026-10-11T11:00:00Z'}),{unit:'Deluxe'},{intent:'booking_request'});
 const older=store.ingest(msg('m2','thread-1','Régebbi VIP kérés',{received_at:'2026-10-11T10:30:00Z'}),{unit:'VIP'},{intent:'booking_request'});
 assert.equal(older.resolution.status,'historical');
 assert.equal(store.get(first.bookingCase.id).state.values.unit,'Deluxe');
});

test('new linked guest reply revokes earlier internal approval even without changed facts',()=>{
 const store=make();
 const first=store.ingest(msg('m1','thread-1','Első érdeklődés'),{arrival:'2026-11-13',departure:'2026-11-15'},{intent:'booking_request'});
 const approved={...first.bookingCase.state,approval:'internally_approved'};
 store.save(first.bookingCase.id,approved,'Korábbi jóváhagyott tervezet');
 assert.equal(store.get(first.bookingCase.id).state.approval,'internally_approved');
 const reply=store.ingest(msg('m2','thread-1','Köszönöm, rendben.',{received_at:'2026-10-11T11:00:00Z'}),{},{intent:'other'});
 assert.equal(reply.bookingCase.id,first.bookingCase.id);
 assert.equal(reply.bookingCase.state.approval,'pending');
 assert.ok(reply.bookingCase.events.some(event=>event.type==='Jóváhagyás érvénytelenítve; új vendégválasz érkezett'));
});

test('same message ID from another sender is rejected without leaking the first case',()=>{
 const store=make();
 store.ingest(msg('collision','thread-1','Első vendég'),{arrival:'2026-11-13'},{intent:'booking_request'});
 assert.throws(()=>store.ingest(msg('collision','thread-2','Második vendég',{sender:'other@example.test'}),{unit:'VIP'},{intent:'booking_request'}),/eltérő feladó/);
 assert.equal(store.list().length,1);
 assert.equal(store.list()[0].state.values.unit,undefined);
});
