import test from 'node:test';import assert from 'node:assert/strict';
import {sameBookingConversation as same} from '../shared-core/case-thread-identity.mjs';
import {reconcileIncomingReply as reconcile} from '../shared-core/case-reply-reconcile.mjs';
const base={from_email:'guest@synthetic.invalid',thread_id:'same',rfc_message_id:'<old@synthetic.invalid>',in_reply_to:'<old@synthetic.invalid>'};
for(const [kind,camel,snake]of [['TENANT','tenantId','tenant_id'],['MAILBOX','mailboxId','mailbox_id']]){
 for(const [label,left,right] of [['different','scope-a','scope-b'],['existing-only','scope-a',undefined],['incoming-only',undefined,'scope-a']])test(kind+' scope never crosses '+label,()=>{
  const previousFacts={guests:2};const r=reconcile({conversation:{...base,[snake]:left},incoming:{...base,[camel]:right},previousFacts,incomingFacts:{unit:'Deluxe'}});
  assert.equal(r.identity.matched,false);assert.equal(r.requiresHumanReview,true);assert.deepEqual(r.updates,{});assert.deepEqual(r.values,previousFacts);
  // RFC reference fallback cannot bypass the scope check either.
  assert.equal(same({...base,thread_id:undefined,[snake]:left},{...base,thread_id:undefined,[camel]:right}).matched,false);
 });
 test(kind+' same normalized scope across naming conventions still matches',()=>{
  assert.equal(same({...base,[snake]:' scope-a '},{...base,[camel]:'scope-a'}).matched,true);
 });
 for(const invalid of [42,true,{},['scope-a']])test(kind+' malformed scope fails closed: '+JSON.stringify(invalid),()=>{
  assert.equal(same({...base,[snake]:invalid},base).matched,false);assert.equal(same(base,{...base,[camel]:invalid}).matched,false);
 });
 test(kind+' conflicting aliases cannot be hidden by preferred field',()=>{
  const conflict={...base,[snake]:'scope-a',[camel]:'scope-b'};
  assert.equal(same(conflict,{...base,[snake]:'scope-a'}).matched,false);assert.equal(same({...base,[snake]:'scope-a'},conflict).matched,false);
 });
 test(kind+' identical aliases preserve known scope',()=>{
  assert.equal(same({...base,[snake]:'scope-a',[camel]:'scope-a'},{...base,[camel]:'scope-a'}).matched,true);
 });
}
test('scope-less legacy data remains subject to existing sender and thread checks',()=>{
 assert.equal(same(base,base).matched,true);
 assert.equal(same(base,{...base,from_email:'other@synthetic.invalid'}).matched,false);
 assert.equal(same(base,{...base,thread_id:'other'}).matched,false);
});
