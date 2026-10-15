import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {normalizeInquiryInput} from '../intake-normalize.mjs';
import {buildChatInquiryReply,buildEmailInquiryDraft} from '../shared-core/inquiry-channel-adapters.mjs';
import {extractServerMessage} from '../shared-core/server-message-extraction.mjs';
import {evaluateCentralInquiry} from '../shared-core/central-inquiry-decision.mjs';

const now=new Date('2026-10-15T12:00:00Z');
const modules={};
for(const name of ['sarberki-core.mjs','business-config.mjs','split-units.mjs','fishing-rules.mjs','gmail-policy.mjs'])modules[name]=await import('../'+name);
const source=(await readFile(new URL('../gmail-readonly.js',import.meta.url),'utf8'))
 .replace(/await import\('\.\/([^']+)'\)/gu,(_,name)=>`modules[${JSON.stringify(name.split('?')[0])}]`);
const window={};
await vm.runInContext(source,vm.createContext({modules,window,Date,Number,TextDecoder,Uint8Array,atob,
 document:{getElementById:()=>({addEventListener(){}}),querySelector:()=>({content:'synthetic-client'})},
 fetch:()=>assert.fail('party normalization must not call a provider')}));
function gmail(text){
 return window.sarberkiGmailTransform({id:'abcdef1234567890',threadId:'abcdef1234567891',internalDate:String(now.getTime()),
  payload:{mimeType:'text/plain',headers:[{name:'From',value:'Synthetic <guest@synthetic.invalid>'}],body:{data:Buffer.from(text).toString('base64url')}}});
}
function party(n){return {guests:n.guests,adults:n.adults,children:n.children};}

test('actual Gmail transformer and canonical channels agree on an adult-only party in four languages',()=>{
 for(const [language,phrase] of [['hu','8 felnőtt'],['en','8 adults'],['de','8 Erwachsene'],['si','8 odraslih']]){
  const text=`${phrase}. Deluxe. 2026-11-13 to 2026-11-15.`;
  const record=gmail(text);
  assert.deepEqual(party(record.normalized),{guests:8,adults:8,children:null},language);
  for(const sourceChannel of ['gmail','web_form','manual','phone_ai']){
   const n=normalizeInquiryInput({sourceChannel,rawText:text,now}).normalized;
   const decision=evaluateCentralInquiry({message:text,language,now,facts:n});
   assert.deepEqual(party(decision.facts),{guests:8,adults:8,children:0},sourceChannel+'/'+language);
  }
  assert.equal(record.missing.includes('Vendégek száma'),false);
  assert.equal(record.missing.some(x=>x.includes('Érkezik-e gyermek')),false);
  assert.deepEqual(party(extractServerMessage({text,received_at:now.toISOString()})),{guests:undefined,adults:'8',children:'0'});
  const options={message:text,language,now};
  const email=buildEmailInquiryDraft(options),chat=buildChatInquiryReply(options);
  assert.equal(email.text,chat.text);
  assert.equal(email.decision.missing.includes('children_status'),false);
  assert.equal(email.decision.capacity.verified,false);
  assert.equal(email.decision.pricing.verified,false);
  assert.equal(email.decision.safety.approval,'pending');
 }
});

test('unresolved child mentions never become an adult-only total or zero children',()=>{
 for(const phrase of ['8 felnőtt és gyermekek','8 adults and children','8 Erwachsene und Kinder','8 odraslih in otroci']){
  const text=phrase+'. Deluxe. 2026-11-13 to 2026-11-15.';
  assert.deepEqual(party(gmail(text).normalized),{guests:null,adults:8,children:null},phrase);
  const decision=evaluateCentralInquiry({message:text,now});
  assert.ok(decision.missing.includes('children_status'));
  assert.equal(decision.readyForCapacityCheck,false);
  assert.equal(decision.capacity.verified,false);
 }
});

test('explicit contradictory total stays intact and blocks central capacity evaluation',()=>{
 const text='9 guests in total: 8 adults and 0 children. Deluxe. 2026-11-13 to 2026-11-15.';
 const record=gmail(text),decision=evaluateCentralInquiry({message:text,now});
 assert.deepEqual(party(record.normalized),{guests:9,adults:8,children:0});
 assert.ok(record.human_review.some(x=>x.includes('Ellentmondó létszámadat')));
 assert.ok(decision.contradictions.some(x=>x.code==='guest_total_mismatch'));
 assert.equal(decision.readyForCapacityCheck,false);
 assert.equal(decision.capacity.verified,false);
});

test('explicit children still require their missing ages and preserve the mixed-party total',()=>{
 const text='2 adults and 2 children. Deluxe. 2026-11-13 to 2026-11-15.';
 const record=gmail(text),decision=evaluateCentralInquiry({message:text,now});
 assert.deepEqual(party(record.normalized),{guests:4,adults:2,children:2});
 assert.ok(record.missing.includes('Gyermek életkora'));
 assert.ok(decision.missing.includes('child_ages'));
 assert.equal(decision.capacity.verified,false);
});

test('unknown adults and quoted adult counts never fabricate an adult-only party',()=>{
 for(const text of ['Deluxe cabin please.','Deluxe cabin please.\nOn 12 Oct 2026, Synthetic wrote:\n> 8 adults']){
  const record=gmail(text);
  assert.deepEqual(party(record.normalized),{guests:null,adults:null,children:null});
  assert.ok(record.missing.includes('Felnőttek száma'));
 }
});
