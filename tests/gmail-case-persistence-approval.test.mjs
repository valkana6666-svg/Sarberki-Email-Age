import test from 'node:test';
import assert from 'node:assert/strict';
import {createBookingCaseStore} from '../booking-cases.mjs';

function memoryStorage(){
  const content=new Map();
  return {
    getItem:key=>content.get(key)??null,
    setItem:(key,value)=>content.set(key,value),
  };
}
const arrival='2026-11-14',departure='2026-11-16';
const values={arrival,departure,guests:'2',adults:'2',children:'0'};
const mail=(id,thread,text)=>({
  provider:'gmail',
  message_id:id,
  thread_id:thread,
  sender:'alice@example.test',
  from_email:'alice@example.test',
  text,
  received_at:'2026-10-25T16:00:00.000Z'
});
const setup=()=>{
  const storage=memoryStorage();
  let nextId=0;
  const store=createBookingCaseStore({storage,clock:()=> '2026-10-25T17:00:00.000Z',id:()=> `case-${++nextId}`});
  return {store,storage};
};
test('new Gmail reply revokes approval and keeps the persisted case pending',()=>{
  const {store,storage}=setup();
  const first=store.ingest(mail('gmail-a','thread-1','Foglalás 2 főre.'),values);
  assert.equal(first.resolution.status,'new');
  const approved={...first.bookingCase.state,approval:'internally_approved'};
  store.save(first.bookingCase.id,approved,'Ellenőrzött választervezet',{requirePersistent:true,event:{type:'Belső jóváhagyás'}});
  assert.equal(store.get(first.bookingCase.id).state.approval,'internally_approved');
  const reply=store.ingest(mail('gmail-b','thread-1','Köszönöm, szeretnénk foglalni.'),values);
  assert.equal(reply.resolution.status,'linked');
  assert.equal(reply.bookingCase.id,first.bookingCase.id);
  assert.equal(reply.bookingCase.state.approval,'pending');
  assert.equal(reply.bookingCase.messages.length,2);
  const loaded=createBookingCaseStore({storage,clock:()=> '2026-10-25T18:00:00.000Z'});
  assert.equal(loaded.get(first.bookingCase.id).state.approval,'pending');
  assert.equal(loaded.get(first.bookingCase.id).messages.length,2);
});
test('repeated Gmail message ID is idempotent and cannot re-approve the case',()=>{
  const {store}=setup();
  const first=store.ingest(mail('gmail-a','thread-1','Foglalás 2 főre.'),values);
  const again=store.ingest(mail('gmail-a','thread-1','Foglalás 2 főre.'),values);
  assert.equal(again.resolution.status,'duplicate');
  assert.equal(again.bookingCase.id,first.bookingCase.id);
  assert.equal(store.get(first.bookingCase.id).messages.length,1);
  assert.equal(store.get(first.bookingCase.id).state.approval,'pending');
});
test('Gmail reply with conflicting thread and matching reference is not automatically linked',()=>{
  const {store}=setup();
  const first=store.ingest({...mail('gmail-a','thread-1','Foglalás 2 főre.'),rfc_message_id:'<first@example.test>'},values);
  const incoming={...mail('gmail-b','thread-2','Módosítanám a foglalást.'),in_reply_to:'<first@example.test>'};
  const second=store.ingest(incoming,values);
  assert.notEqual(second.resolution.status,'linked');
  assert.equal(second.resolution.status,'ambiguous');
  assert.notEqual(second.bookingCase.id,first.bookingCase.id);
  assert.equal(store.get(first.bookingCase.id).messages.length,1);
  assert.equal(store.get(first.bookingCase.id).state.approval,'pending');
});

test('late-imported historical Gmail reply revokes approval with auditable event',()=>{
  const {store,storage}=setup();
  const first=store.ingest(mail('gmail-latest','thread-1','Foglalás 2 főre.'),values);
  store.save(first.bookingCase.id,{...first.bookingCase.state,approval:'internally_approved'},'Jóváhagyott korábbi tervezet',{requirePersistent:true,event:{type:'Belső jóváhagyás'}});
  const earlier={...mail('gmail-earlier','thread-1','Korábbi kiegészítő kérdés.'),received_at:'2026-10-24T16:00:00.000Z'};
  const result=store.ingest(earlier,values);
  assert.equal(result.resolution.status,'historical');
  assert.equal(result.bookingCase.state.approval,'pending');
  assert.equal(result.bookingCase.messages.length,2);
  assert.equal(result.bookingCase.messages.at(-1).historical,true);
  assert.ok(result.bookingCase.events.some(e=>e.previousApproval==='internally_approved'&&e.approval==='pending'&&e.type.includes('érvénytelenítve')));
  const reloaded=createBookingCaseStore({storage,clock:()=> '2026-10-25T19:00:00.000Z'});
  const saved=reloaded.get(first.bookingCase.id);
  assert.equal(saved.state.approval,'pending');
  assert.ok(saved.events.some(e=>e.previousApproval==='internally_approved'&&e.approval==='pending'));
});

function quotaStorage(){
 const data=new Map();
 let fail=false;
 return {
   getItem:key=>data.get(key)??null,
   setItem:(key,value)=>{if(fail)throw Error('QUOTA_EXCEEDED');data.set(key,value);},
   failNext:()=>{fail=true;},
   allow:()=>{fail=false;},
 };
}
test('failed first Gmail import leaves no ghost case and can be retried',()=>{
 const storage=quotaStorage();
 let n=0;
 const store=createBookingCaseStore({storage,id:()=>`case-${++n}`,clock:()=> '2026-10-25T18:00:00Z'});
 storage.failNext();
 assert.throws(()=>store.ingest(mail('new-message','thread-a','Foglalás 2 főre.'),values),/QUOTA_EXCEEDED/);
 assert.equal(store.list().length,0);
 assert.equal(createBookingCaseStore({storage}).list().length,0);
 storage.allow();
 assert.equal(store.ingest(mail('new-message','thread-a','Foglalás 2 főre.'),values).resolution.status,'new');
 assert.equal(store.list().length,1);
});
test('failed linked Gmail reply preserves approved memory and disk state',()=>{
 const storage=quotaStorage(),store=createBookingCaseStore({storage,id:()=> 'case-1',clock:()=> '2026-10-25T18:00:00Z'});
 const first=store.ingest(mail('first','thread-a','Foglalás 2 főre.'),values);
 store.save(first.bookingCase.id,{...first.bookingCase.state,approval:'internally_approved'},'Jóváhagyott tervezet');
 const before=store.get(first.bookingCase.id);
 storage.failNext();
 assert.throws(()=>store.ingest(mail('second','thread-a','Kérdésem van.'),{unit:'Deluxe'}),/QUOTA_EXCEEDED/);
 assert.deepEqual(store.get(first.bookingCase.id),before);
 assert.deepEqual(createBookingCaseStore({storage}).get(first.bookingCase.id),before);
 storage.allow();
 const result=store.ingest(mail('second','thread-a','Kérdésem van.'),{unit:'Deluxe'});
 assert.equal(result.bookingCase.state.approval,'pending');
 assert.equal(result.bookingCase.messages.length,2);
});
test('failed historical Gmail reply does not revoke approval or add audit event',()=>{
 const storage=quotaStorage(),store=createBookingCaseStore({storage,id:()=> 'case-1',clock:()=> '2026-10-25T18:00:00Z'});
 const first=store.ingest(mail('latest','thread-a','Foglalás 2 főre.'),values);
 store.save(first.bookingCase.id,{...first.bookingCase.state,approval:'internally_approved'},'Jóváhagyott tervezet');
 const before=store.get(first.bookingCase.id);
 const old={...mail('historical','thread-a','Régebbi kérdés.'),received_at:'2026-10-24T16:00:00Z'};
 storage.failNext();
 assert.throws(()=>store.ingest(old,values),/QUOTA_EXCEEDED/);
 assert.deepEqual(store.get(first.bookingCase.id),before);
 assert.deepEqual(createBookingCaseStore({storage}).get(first.bookingCase.id),before);
 storage.allow();
 const result=store.ingest(old,values);
 assert.equal(result.resolution.status,'historical');
 assert.equal(result.bookingCase.state.approval,'pending');
 assert.equal(result.bookingCase.messages.length,2);
});

test('same provider message ID in separate mailboxes is not treated as a duplicate',()=>{
 const {store}=setup();
 const a=store.ingest({...mail('provider-id','thread-a','Foglalás 2 főre.'),mailbox_id:'inbox-a'},values);
 const b=store.ingest({...mail('provider-id','thread-a','Második postafiók üzenete.'),mailbox_id:'inbox-b'},values);
 assert.notEqual(b.resolution.status,'duplicate');
 assert.notEqual(a.bookingCase.id,b.bookingCase.id);
 assert.equal(store.list().length,2);
});
test('same sender and Gmail thread string in distinct mailboxes cannot auto-link',()=>{
 const {store}=setup();
 const a=store.ingest({...mail('id-a','same-thread','Első levél.'),mailbox_id:'inbox-a'},values);
 const b=store.ingest({...mail('id-b','same-thread','Második postafiók.'),mailbox_id:'inbox-b'},values);
 assert.notEqual(b.resolution.status,'linked');
 assert.notEqual(a.bookingCase.id,b.bookingCase.id);
 assert.equal(store.get(a.bookingCase.id).messages.length,1);
});
test('same mailbox thread and sender still link normally',()=>{
 const {store}=setup();
 const a=store.ingest({...mail('id-a','same-thread','Első levél.'),mailbox_id:'inbox-a'},values);
 const b=store.ingest({...mail('id-b','same-thread','Második levél.'),mailbox_id:'inbox-a'},values);
 assert.equal(b.resolution.status,'linked');
 assert.equal(a.bookingCase.id,b.bookingCase.id);
});


test('known mailbox cannot treat legacy missing-mailbox message ID as duplicate',()=>{
 const {store}=setup();
 const first=store.ingest(mail('same-id','legacy-thread','Régi üzenet.'),values);
 const second=store.ingest({...mail('same-id','legacy-thread','Másik postafiók.'),mailbox_id:'known-inbox'},values);
 assert.notEqual(second.resolution.status,'duplicate');
 assert.notEqual(second.bookingCase.id,first.bookingCase.id);
 assert.equal(store.list().length,2);
});
test('legacy missing mailbox does not auto-link to known mailbox thread',()=>{
 const {store}=setup();
 const a=store.ingest({...mail('known-a','thread-x','Első üzenet.'),mailbox_id:'known-inbox'},values);
 const b=store.ingest(mail('legacy-b','thread-x','Régi levél.'),values);
 assert.notEqual(b.resolution.status,'linked');
 assert.notEqual(a.bookingCase.id,b.bookingCase.id);
});
test('two legacy missing-mailbox messages preserve local same-thread behavior',()=>{
 const {store}=setup();
 const a=store.ingest(mail('legacy-1','thread-old','Első levél.'),values);
 const b=store.ingest(mail('legacy-2','thread-old','Második levél.'),values);
 assert.equal(b.resolution.status,'linked');
 assert.equal(a.bookingCase.id,b.bookingCase.id);
});
