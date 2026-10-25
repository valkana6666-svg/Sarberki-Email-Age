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
  const store=createBookingCaseStore({storage,clock:()=> '2026-10-25T17:00:00.000Z',id:()=> 'case-1'});
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
