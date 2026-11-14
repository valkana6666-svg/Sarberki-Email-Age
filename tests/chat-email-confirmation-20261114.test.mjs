// Owner 2026-11-14: the chat request carries an e-mail address; the approved letter (with the voucher) can go out to
// it as a NEW e-mail - TEST: test pair only, DB send ledger required (the only duplicate guard without a thread).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createChatIntakeHandler} from '../netlify/functions/chat-intake.mjs';
import {intakeValues} from '../shared-core/server-intake.mjs';
import {approvedTestMailboxReply,sendApprovedTestMailboxReply} from '../shared-core/server-test-mailbox-send.mjs';

const env={INTAKE_ENABLED:'test-only',INTAKE_CHAT_ENABLED:'test-only',SUPABASE_URL:'https://mojnqizbcaczstguikpv.supabase.co',INTAKE_HMAC_KEY:'ab'.repeat(32),
 SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',INTAKE_ACCOUNT_EMAIL:'intake@example.test',INTAKE_ACCOUNT_PASSWORD:'not-a-real-secret',ISOLATED_APPROVAL_ATTESTATION_KEY:'e5'.repeat(32)};
const body={consent:true,facts:{arrival:'2027-07-12',departure:'2027-07-15',adults:2,children:0,cabin:'deluxe'},language:'hu',phone:'+36 30 000 0000',transcript:['Deluxe faházat kérnénk július 12–15.']};
const req=b=>new Request('https://leafy-chimera-2403e5.netlify.app/.netlify/functions/chat-intake',{method:'POST',body:JSON.stringify(b),
 headers:{origin:'https://leafy-chimera-2403e5.netlify.app','sec-fetch-site':'same-origin','content-type':'application/json'}});
const sha=t=>createHash('sha256').update(t,'utf8').digest('hex');

test('chat request: e-mail accepted (with or without phone), invalid e-mail refused, at least one contact required',async()=>{
 let rpc=null;
 const fetchImpl=async(url,o={})=>{if(String(url).includes('/auth/v1/token'))return new Response(JSON.stringify({access_token:'jwt'}));rpc=JSON.parse(o.body);return new Response(JSON.stringify({caseId:'tm-x',revision:1}));};
 const h=createChatIntakeHandler({env,fetchImpl,random:()=>'0123456789abcdef'});
 assert.equal((await h(req({...body,email:'Valkana6666@gmail.com'}))).status,200);
 assert.equal(rpc.p_data.state.values.email,'valkana6666@gmail.com');assert.match(rpc.p_data.messages[0].text,/E-mail: valkana6666@gmail\.com/);
 assert.equal((await h(req({...body,phone:'',email:'vendeg@example.test'}))).status,200,'e-mail only');
 assert.deepEqual(await (await h(req({...body,email:'nem-email'}))).json(),{error:'EMAIL_INVALID'});
 assert.deepEqual(await (await h(req({...body,phone:''}))).json(),{error:'PHONE_REQUIRED'});
 assert.equal(intakeValues({email:' A@B.HU '}).email,'a@b.hu');assert.equal(intakeValues({email:'x'}).email,undefined);
});

const chatRecord=(email)=>{const text='Kedves Vendégünk!\n\nVOUCHER …';return {caseId:'tm-aaaaaaaaaaaaaaaa',revision:3,data:{sourceReceipt:{provider:'chat',external_id:'chat_x'},
 state:{approval:'approved_internal',values:{language:'hu',...(email?{email}:{})}},internalApproval:{scope:'test-mailbox-v1',draftHash:sha(text)},drafts:[{text}]}};};
test('chat case: new e-mail only to the test pair; no e-mail -> NO_EMAIL; already sent -> not again',async()=>{
 assert.equal(approvedTestMailboxReply(chatRecord('valkana6666@gmail.com')).mode,'new');
 assert.throws(()=>approvedTestMailboxReply(chatRecord('vendeg@example.test')),/RECIPIENT_NOT_ALLOWED/);
 assert.throws(()=>approvedTestMailboxReply(chatRecord(null)),/NO_EMAIL/);
 const calls=[];const fetchImpl=async(url,o={})=>{calls.push({url:String(url),body:o.body});return new Response(JSON.stringify(String(url).endsWith('/profile')?{emailAddress:'sarberkiprojecttest@gmail.com'}:{id:'m1'}));};
 // Already sent (marker found among the sent messages to that address): nothing is sent again.
 const rec=chatRecord('valkana6666@gmail.com'),marker=rec.caseId+':'+sha(rec.data.drafts[0].text);
 const dupFetch=async(url)=>{const u=String(url);calls.push({url:u});
  if(u.endsWith('/profile'))return new Response(JSON.stringify({emailAddress:'sarberkiprojecttest@gmail.com'}));
  if(u.includes('/messages?q='))return new Response(JSON.stringify({messages:[{id:'old1'}]}));
  return new Response(JSON.stringify({payload:{headers:[{name:'X-Sarberki-Reply',value:marker}]}}));};
 assert.equal((await sendApprovedTestMailboxReply({record:rec,token:'t'.repeat(40),fetchImpl:dupFetch})).status,'already_sent');
 assert.ok(!calls.some(c=>c.url.includes('/messages/send')),'not sent twice');
 const ledger={claim:async()=>({status:'claimed',claimId:'c1'}),finish:async()=>true};
 const r=await sendApprovedTestMailboxReply({record:chatRecord('valkana6666@gmail.com'),token:'t'.repeat(40),fetchImpl,ledger});
 assert.equal(r.status,'sent');
 const sent=JSON.parse(calls.find(c=>c.url.includes('/messages/send')).body);
 assert.equal(sent.threadId,undefined,'a new e-mail, not a reply');
 const mime=Buffer.from(sent.raw,'base64url').toString('utf8');
 assert.match(mime,/^To: valkana6666@gmail\.com$/m);assert.doesNotMatch(mime,/In-Reply-To/);assert.match(mime,/^X-Sarberki-Reply: tm-a+:[a-f0-9]{64}$/m);
});
