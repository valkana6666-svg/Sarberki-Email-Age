import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {buildReplyDraft} from '../sarberki-core.mjs';
import {UNAVAILABLE_SCOPE,UNAVAILABLE_TEXT,unavailableDraft,attestUnavailable,markTestMailboxUnavailable} from '../shared-core/server-test-mailbox-unavailable.mjs';

// Fictional data only. The "no free cabin" reply keeps the engine's greeting and signature, carries no price
// and is attested by the server; the browser never sends text.
const KEY='a1'.repeat(32),sha=t=>createHash('sha256').update(t,'utf8').digest('hex');
const engine=(language,name)=>buildReplyDraft({language,name,original:'Kitalált érdeklődés',arrival:'2027-05-14',departure:'2027-05-16',guests:2,adults:2,children:0});

test('every language: greeting and signature kept, body replaced, no price; operator gets the Hungarian meaning',()=>{
 for(const [lang,name,greeting] of [['hu','Kovács Anna','Kedves Anna!'],['de','Anna Müller','Guten Tag, Anna!'],['en','John Smith','Dear John,'],['si','Ana Novak','Pozdravljeni, Ana!']]){
  const before=engine(lang,name),{text,operatorReviewText}=unavailableDraft({latest:{text:before},language:lang});
  assert.ok(text.startsWith(greeting+'\n\n'+UNAVAILABLE_TEXT[lang]+'\n\n'),lang);
  assert.ok(text.endsWith('\nSárberki Horgásztó'),lang);
  assert.doesNotMatch(text,/\d|Ft|EUR|€/u,lang+': no date, number or price');
  assert.match(operatorReviewText,/^Nincs szabad hely – a kezelő a Previóban ellenőrizte/);
  if(lang!=='hu')assert.ok(operatorReviewText.endsWith(UNAVAILABLE_TEXT.hu));
 }
});

test('refusals: unknown draft shape, already replaced, no confirmation, no key, no transport',async()=>{
 const code=c=>e=>e.code===c;
 assert.throws(()=>unavailableDraft({latest:{text:'Kézzel írt válasz aláírás nélkül.'},language:'hu'}),code('DRAFT_SHAPE_UNKNOWN'));
 assert.throws(()=>unavailableDraft({latest:{text:42},language:'hu'}),code('DRAFT_SHAPE_UNKNOWN'));
 const once=unavailableDraft({latest:{text:engine('hu','Kovács Anna')},language:'hu'});
 assert.throws(()=>unavailableDraft({latest:{text:once.text},language:'hu'}),code('ALREADY_UNAVAILABLE'));
 const record={tenantId:'sarberki-test',caseId:'tm-'+'ab'.repeat(8),revision:3,data:{state:{values:{language:'hu'}},drafts:[{text:engine('hu','Kovács Anna')}]}};
 await assert.rejects(markTestMailboxUnavailable({record,unavailableConfirmed:'yes',attestationKey:KEY,transport:async()=>({})}),code('UNAVAILABILITY_NOT_CONFIRMED'));
 await assert.rejects(markTestMailboxUnavailable({record,unavailableConfirmed:true,attestationKey:'short',transport:async()=>({})}),code('SETUP_REQUIRED'));
 await assert.rejects(markTestMailboxUnavailable({record,unavailableConfirmed:true,attestationKey:KEY}),code('SETUP_REQUIRED'));
});

test('the server posts the exact attested draft to sc_tm_unavailable_redraft (byte-identical HMAC)',async()=>{
 const record={tenantId:'sarberki-test',caseId:'tm-'+'cd'.repeat(8),revision:2,data:{state:{values:{language:'en'}},drafts:[{text:engine('en','John Smith')}]}};
 const calls=[],checkedAt='2026-11-04T10:00:00.000Z';
 await markTestMailboxUnavailable({record,unavailableConfirmed:true,attestationKey:KEY,clock:()=>checkedAt,transport:async(path,options)=>{calls.push([path,options]);return {case_id:record.caseId};}});
 assert.equal(calls.length,1);const [path,{method,body}]=calls[0];
 assert.equal(path,'/rest/v1/rpc/sc_tm_unavailable_redraft');assert.equal(method,'POST');
 assert.deepEqual(Object.keys(body.p_draft).sort(),['operatorReviewText','text']);
 const fields=[UNAVAILABLE_SCOPE,record.tenantId,record.caseId,'2',sha(body.p_draft.text),sha(body.p_draft.operatorReviewText),checkedAt];
 assert.deepEqual(body.p_proof,{scope:UNAVAILABLE_SCOPE,checkedAt,attestation:createHmac('sha256',Buffer.from(KEY,'hex')).update(fields.join('\n')).digest('hex')});
 assert.deepEqual(attestUnavailable({key:KEY,tenantId:record.tenantId,caseId:record.caseId,expectedRevision:2,draft:body.p_draft,checkedAt}),body.p_proof);
});
