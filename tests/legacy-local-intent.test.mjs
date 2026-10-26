import test from 'node:test';
import assert from 'node:assert/strict';
import {createBookingCaseStore} from '../booking-cases.mjs';
const envelope={sender:'fixture@synthetic.invalid',text:'Deluxe 2026-11-13 to 2026-11-15, 2 adults. Telefon.',message_id:'legacy-one',received_at:'2026-10-26T10:00:00Z'};
const values={arrival:'2026-11-13',departure:'2026-11-15',guests:'2',adults:'2',children:'0',unit:'Deluxe'};
test('legacy exact duplicate becomes pending booking and persists without duplicating messages',()=>{
 let data;const storage={getItem:()=>data||null,setItem:(k,v)=>{data=v;}};
 const store=createBookingCaseStore({storage,id:()=> 'legacy-case'});
 const first=store.ingest(envelope,values,{intent:'general_question'}).bookingCase;
 const next=store.ingest(envelope,values,{intent:'booking_request'}).bookingCase;
 assert.equal(next.id,first.id);assert.equal(next.messages.length,1);assert.equal(next.state.intent,'booking_request');assert.equal(next.state.approval,'pending');assert.equal(next.state.quote,null);assert.equal(next.state.availability,null);assert.ok(next.state.revision>first.state.revision);
 assert.equal(createBookingCaseStore({storage}).get(next.id).state.intent,'booking_request');
 assert.equal(store.ingest(envelope,values,{intent:'booking_request'}).bookingCase.state.revision,next.state.revision);
});
test('changed body cannot use reclassification to bypass duplicate collision',()=>{
 const store=createBookingCaseStore({id:()=> 'legacy-case'});store.ingest(envelope,values,{intent:'general_question'});
 assert.throws(()=>store.ingest({...envelope,text:'different'},values,{intent:'booking_request'}));assert.equal(store.get('legacy-case').state.intent,'general_question');
});
test('legacy approval is invalidated, while failed persistence leaves original state intact',()=>{
 let data,fail=false;const storage={getItem:()=>data||null,setItem:(k,v)=>{if(fail)throw Error('disk full');data=v;}};
 let store=createBookingCaseStore({storage,id:()=> 'legacy-case'});store.ingest(envelope,values,{intent:'general_question'});
 const saved=JSON.parse(data);saved[0].state.approval='internally_approved';saved[0].serverApproval={synthetic:true};saved[0].state.quote={total:123,approved:true};data=JSON.stringify(saved);
 store=createBookingCaseStore({storage});fail=true;assert.throws(()=>store.ingest(envelope,values,{intent:'booking_request'}));assert.equal(store.get('legacy-case').state.approval,'internally_approved');
 fail=false;const next=store.ingest(envelope,values,{intent:'booking_request'}).bookingCase;assert.equal(next.state.approval,'pending');assert.equal(next.serverApproval,undefined);assert.equal(next.state.quote,null);
});
