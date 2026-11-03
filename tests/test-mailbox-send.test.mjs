import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {approvedTestMailboxReply,replyMime,sendApprovedTestMailboxReply} from '../shared-core/server-test-mailbox-send.mjs';

// Fictional data only. Owner permission 2026-11-03: sarberkiprojecttest@gmail.com -> sarberkito@gmail.com.
const sha=t=>createHash('sha256').update(t,'utf8').digest('hex');
const TEXT='Dear John,\n\nThank you for your enquiry. (kitalált)\n\nKind regards,\nSárberki Horgásztó';
function record(over={}){
 const data={state:{approval:'approved_internal'},drafts:[{text:'első'},{text:TEXT}],
  internalApproval:{scope:'test-mailbox-v1',draftHash:sha(TEXT)},
  sourceReceipt:{from_email:'sarberkito@gmail.com',to:'sarberkiprojecttest@gmail.com',thread_id:'1a1a32e75c490832',rfc_message_id:'<fictional@mail.gmail.com>',subject:'Sárberki élő teszt – 5. booking request'}};
 return {caseId:'tm-1a1a32e75c490832',revision:3,data:{...data,...over}};
}
function gmail({account='sarberkiprojecttest@gmail.com',marker=null,sendStatus=200}={}){
 const calls=[];
 const fetchImpl=async(url,options={})=>{
  calls.push({url,options});
  const json=(body,status=200)=>new Response(JSON.stringify(body),{status});
  if(url.endsWith('/profile'))return json({emailAddress:account});
  if(url.includes('/threads/'))return json({messages:[{payload:{headers:marker?[{name:'X-Sarberki-Reply',value:marker}]:[]}}]});
  if(url.endsWith('/messages/send'))return json({id:'sent-1'},sendStatus);
  return json({},404);
 };
 return {calls,fetchImpl};
}
const TOKEN='t'.repeat(40);

test('only an approved case whose approved hash is the latest draft, to the fixed test recipient',()=>{
 const ok=approvedTestMailboxReply(record());
 assert.equal(ok.recipient,'sarberkito@gmail.com');assert.equal(ok.text,TEXT);assert.equal(ok.marker,'tm-1a1a32e75c490832:'+sha(TEXT));
 assert.throws(()=>approvedTestMailboxReply(record({state:{approval:'pending'}})),/NOT_APPROVED/);
 assert.throws(()=>approvedTestMailboxReply(record({internalApproval:{scope:'test-mailbox-v1',draftHash:sha('első')}})),/NOT_APPROVED/,'approved hash must be the latest draft');
 const other=record();other.data.sourceReceipt={...other.data.sourceReceipt,from_email:'someone@example.com'};
 assert.throws(()=>approvedTestMailboxReply(other),/RECIPIENT_NOT_ALLOWED/);
 const wrongBox=record();wrongBox.data.sourceReceipt={...wrongBox.data.sourceReceipt,to:'info@sarberkito.hu'};
 assert.throws(()=>approvedTestMailboxReply(wrongBox),/RECIPIENT_NOT_ALLOWED/);
 const injected=record();injected.data.sourceReceipt={...injected.data.sourceReceipt,rfc_message_id:'<a@b>\r\nBcc: x@example.com'};
 assert.throws(()=>approvedTestMailboxReply(injected),/SOURCE_UNVERIFIED/,'no header injection');
});

test('MIME reply: fixed sender and recipient, same thread headers, marker, exact UTF-8 text',()=>{
 const mime=replyMime(approvedTestMailboxReply(record()));
 assert.match(mime,/^From: sarberkiprojecttest@gmail\.com\r\nTo: sarberkito@gmail\.com\r\n/);
 assert.match(mime,/\r\nIn-Reply-To: <fictional@mail\.gmail\.com>\r\nReferences: <fictional@mail\.gmail\.com>\r\n/);
 assert.doesNotMatch(mime,/\r\n(?:Cc|Bcc):/i);
 const subject=Buffer.from(/Subject: =\?UTF-8\?B\?([^?]+)\?=/.exec(mime)[1],'base64').toString('utf8');
 assert.equal(subject,'Re: Sárberki élő teszt – 5. booking request');
 const body=Buffer.from(mime.split('\r\n\r\n')[1].replace(/\r\n/g,''),'base64').toString('utf8');
 assert.equal(body.replace(/\r\n/g,'\n'),TEXT);
});

test('send: account check, duplicate check in the thread, then exactly one send in the same thread',async()=>{
 const g=gmail();
 assert.deepEqual(await sendApprovedTestMailboxReply({record:record(),token:TOKEN,fetchImpl:g.fetchImpl}),{status:'sent'});
 const send=g.calls.find(c=>c.url.endsWith('/messages/send'));
 assert.equal(JSON.parse(send.options.body).threadId,'1a1a32e75c490832');
 assert.equal(send.options.headers.Authorization,'Bearer '+TOKEN);
 const dup=gmail({marker:'tm-1a1a32e75c490832:'+sha(TEXT)});
 assert.deepEqual(await sendApprovedTestMailboxReply({record:record(),token:TOKEN,fetchImpl:dup.fetchImpl}),{status:'already_sent'});
 assert.equal(dup.calls.some(c=>c.url.endsWith('/messages/send')),false,'never sent twice');
 const wrong=gmail({account:'sarberkito@gmail.com'});
 await assert.rejects(sendApprovedTestMailboxReply({record:record(),token:TOKEN,fetchImpl:wrong.fetchImpl}),e=>e.code==='WRONG_GMAIL_ACCOUNT');
 assert.equal(wrong.calls.some(c=>c.url.endsWith('/messages/send')),false);
 await assert.rejects(sendApprovedTestMailboxReply({record:record({state:{approval:'pending'}}),token:TOKEN,fetchImpl:gmail().fetchImpl}),e=>e.code==='NOT_APPROVED');
 await assert.rejects(sendApprovedTestMailboxReply({record:record(),token:'x',fetchImpl:gmail().fetchImpl}),e=>e.code==='GMAIL_AUTH_REQUIRED');
 await assert.rejects(sendApprovedTestMailboxReply({record:record(),token:TOKEN,fetchImpl:gmail({sendStatus:500}).fetchImpl}),e=>e.code==='SEND_FAILED');
});
