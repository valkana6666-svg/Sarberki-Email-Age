import test from 'node:test';
import assert from 'node:assert/strict';
import {createBookingCaseStore} from '../booking-cases.mjs';

function fixture(){
 const disk=new Map();
 const storage={getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,v)};
 let next=0;
 const store=createBookingCaseStore({storage,tenantId:'sarberki-test',id:()=> 'case-'+(++next),clock:()=> '2026-10-26T10:00:00Z'});
 const envelope={sender:'guest@synthetic.invalid',mailbox_id:'test-box',message_id:'message-1',thread_id:'thread-1',text:'Synthetic inquiry',received_at:'2026-10-26T09:00:00Z'};
 store.ingest(envelope,{});
 return {store,envelope,disk};
}
test('same Gmail identifier with changed body is rejected without memory or storage mutation',()=>{
 const {store,envelope,disk}=fixture();
 const before=store.list(),saved=[...disk];
 assert.throws(()=>store.ingest({...envelope,text:'Changed synthetic inquiry'},{}),/eltérő levéltartalom/);
 assert.deepEqual(store.list(),before);
 assert.deepEqual([...disk],saved);
});
test('identical Gmail retry remains idempotent and does not overwrite extracted facts',()=>{
 const {store,envelope,disk}=fixture();const saved=[...disk];
 assert.equal(store.ingest({...envelope,sender:'GUEST@SYNTHETIC.INVALID'},{adults:'99'}).resolution.status,'duplicate');
 assert.equal(store.list()[0].messages.length,1);
 assert.deepEqual([...disk],saved);
});
test('same provider identifier in another mailbox remains a distinct message',()=>{
 const {store,envelope}=fixture();
 assert.notEqual(store.ingest({...envelope,mailbox_id:'another-box',text:'Different synthetic inquiry'},{}).resolution.status,'duplicate');
 assert.equal(store.list().reduce((n,c)=>n+c.messages.length,0),2);
});
