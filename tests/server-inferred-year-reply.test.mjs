import test from 'node:test';
import assert from 'node:assert/strict';
import {createBookingCaseStore} from '../booking-cases.mjs';
import {extractServerMessage} from '../shared-core/server-message-extraction.mjs';
import {serverInquiryOptions} from '../shared-core/server-inquiry-options.mjs';
import {buildEmailInquiryDraft} from '../shared-core/inquiry-channel-adapters.mjs';
import {quoteInputFromCase} from '../shared-core/server-test-mailbox-price.mjs';

// Server (saved-case) path, fictional mails. Owner test 2026-11-06: a year-less date range was dropped from
// the reply and the guest was asked for the dates again; the reply must repeat them and ask for the year.
function serverDraft(text,n=1){
 const id='18f2a0b1c2d3e6'+String(n).padStart(2,'0'),caseId='tm-'+id,clock=()=>'2026-11-06T12:00:00.000Z';
 const env={sender:'sarberkito@gmail.com',text,mailbox_id:'m',message_id:'m:'+id,thread_id:'m:'+id,rfc_message_id:'<m:'+id+'@x>',references:[],received_at:clock()};
 let saved;const store=createBookingCaseStore({storage:{getItem:()=>'[]',setItem:(_,v)=>{saved=JSON.parse(v);}},tenantId:'sarberki-test',clock,id:()=>caseId});
 store.ingest(env,extractServerMessage(env),{approvedCaseId:null});
 const data=saved.find(c=>c.id===caseId);
 return {data,text:buildEmailInquiryDraft(serverInquiryOptions({tenantId:'sarberki-test',caseId,data},new Date(clock()))).text};
}

test('year-less range: the reply repeats dates and party and asks to confirm the year, not for the dates',()=>{
 for(const [mail,dates,party] of [['Jó napot! Május 20-23 között jönnénk 4-en egy kutyával. Tóth Éva','2027.05.20. és 2027.05.23.','4 fő'],
  ['Szia! Augusztus 1-4 között lenne szabad családi ház 6 főre? Nagy Péter','2027.08.01. és 2027.08.04.','6 fő']]){
  const {text}=serverDraft(mail);
  assert.ok(text.includes(dates),text);assert.ok(text.includes(party),text);
  assert.match(text,/erősítse meg az érkezés és távozás évét/);
  assert.doesNotMatch(text,/írja meg a pontos érkezési és távozási dátumot/);
 }
});
test('the guessed year never becomes a case fact: price still refuses until the year is confirmed',()=>{
 const {data}=serverDraft('Jó napot! Május 20-23 között jönnénk 4-en. Tóth Éva',2);
 assert.equal(data.state.values.arrival,undefined);
 assert.throws(()=>quoteInputFromCase({...data.state.values,adults:'4'},'deluxe'),/PRICE_FACTS_MISSING/);
});
test('a full date with year is unchanged (stored fact, no year question)',()=>{
 const {text,data}=serverDraft('Jó napot! 2027. június 10-től 13-ig jönnénk ketten, Deluxe faházba. Kiss Anna',3);
 assert.equal(data.state.values.arrival,'2027-06-10');assert.doesNotMatch(text,/évét/);
});
