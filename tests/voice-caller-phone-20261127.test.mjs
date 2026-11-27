// ChatGPT / owner 2026-11-27 (#9 7216063195): the caller's number from the phone line goes, as a contact detail only,
// to the request and the Previo TEST option's contact phone; asked only when missing / hidden / invalid or when the
// guest wants another number. Synthetic numbers only (+3630000xxxx style fictional), no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {voiceConfirm,voiceRequest,spokenPhone,contactPhone,callerPhone} from '../shared-core/voice-request.mjs';
import {prefillChatBooking,PREFILL_OPTION_HOURS} from '../shared-core/server-chat-prefill.mjs';
import {buildReservationXml,voucherFor} from '../shared-core/server-previo-reservation-write.mjs';

const C=()=>new Date('2026-11-27T10:00:00Z'),MAIL='kitalalt kukac example pont test';
const CALL=['Deluxe faház 2027. március 4-től 8-ig, két felnőtt.','Szeretném lefoglalni.'];
const OFFER={status:'AVAILABLE',total:192300};
const LINE='+36300000001',OTHER='+36300000002';

test('caller ID forms: valid E.164 used, hidden / missing / invalid give none; never an identity',()=>{
 assert.equal(callerPhone(LINE),LINE);
 for(const x of ['anonymous','restricted','',null,undefined,'123','{{system__caller_id}}','+36 30 abc'])assert.equal(callerPhone(x),null,String(x));
 assert.equal(spokenPhone('nulla hat harminc nulla nulla nulla nulla nulla nulla kettő'),'+36300000002');
 assert.equal(spokenPhone('plusz harminchat harminc nulla nulla nulla nulla nulla nulla kettő'),OTHER);
 assert.equal(spokenPhone('valami szám'),null);assert.equal(spokenPhone('nincs'),null);
});

test('read-back: a line number is not asked or read back; missing → asked once; a said number → digits read back; garbled → asked again',()=>{
 const line=voiceConfirm({email:MAIL,callerId:LINE,name:'Teszt Elek'});
 assert.equal(line.status,'CONFIRM');assert.equal(line.phoneSource,'line');assert.doesNotMatch(line.reply,/telefonszám|300000001|három nulla/);
 for(const hidden of [undefined,'anonymous','123']){const r=voiceConfirm({email:MAIL,callerId:hidden});assert.equal(r.status,'PHONE_NEEDED',String(hidden));assert.match(r.reply,/telefonszámot/);}
 const said=voiceConfirm({email:MAIL,phone:'plusz harminchat harminc nulla nulla nulla nulla nulla nulla kettő'});
 assert.equal(said.status,'CONFIRM');assert.match(said.reply,/a telefonszám: plusz három hat három nulla nulla nulla nulla nulla nulla nulla kettő/);
 assert.equal(voiceConfirm({email:MAIL,phone:'valami'}).status,'PHONE_INVALID');
 assert.equal(voiceConfirm({email:MAIL,phone:'nincs'}).status,'CONFIRM','declined: e-mail only');
 const other=voiceConfirm({email:MAIL,callerId:LINE,phone:'plusz harminchat harminc nulla nulla nulla nulla nulla nulla kettő'});
 assert.equal(other.phoneSource,'guest');assert.match(other.reply,/kettő\./,'another number is read back');
 assert.doesNotMatch(JSON.stringify([line,said,other]),/300000001/,'the line number never echoed');
});

test('request: the chosen number goes to the case and to the Previo option; calls stay separate',async()=>{
 const run=async({callerId,phone,conversationId})=>{const created=[],prefills=[];
  const r=await voiceRequest({utterances:[...CALL,MAIL],email:MAIL,name:'Teszt Elek',phone,consent:true,conversationId,callerId,clock:C,offerFn:async()=>OFFER,
   createFn:async a=>{created.push(a);return {caseId:'tm-'+conversationId};},prefillFn:async a=>{prefills.push(a);return {status:'created',unit:'11'};}});
  return {r,created:created[0],prefill:prefills[0]};};
 const a=await run({callerId:LINE,conversationId:'conv_a0000001'});
 assert.equal(a.created.facts.phone,LINE);assert.equal(a.prefill.phone,LINE);assert.match(a.created.summary,/A hívó száma a telefonvonalról: \+36300000001/);
 const b=await run({callerId:LINE,phone:'plusz harminchat harminc nulla nulla nulla nulla nulla nulla kettő',conversationId:'conv_b0000001'});
 assert.equal(b.created.facts.phone,OTHER);assert.equal(b.prefill.phone,OTHER,'the guest-given number wins');assert.match(b.created.summary,/megadott telefonszám[^\n]*\+36300000002[^\n]*\+36300000001 számról jött/);
 const c=await run({callerId:'anonymous',conversationId:'conv_c0000001'});
 assert.equal(c.created.facts.phone,undefined);assert.equal(c.prefill.phone,'');assert.match(c.created.summary,/hívószám nem érkezett meg/);
 const d=await run({callerId:OTHER,conversationId:'conv_d0000001'});
 assert.equal(d.prefill.phone,OTHER);assert.notEqual(a.created.externalId,d.created.externalId,'one request per call');
 for(const x of [a,b,c,d])assert.doesNotMatch(JSON.stringify(x.r),/3630000000[12]/,'the tool reply never contains a number');
});

test('Previo option: contact phone in the payload (test-pair address), 48-hour option and everything else unchanged',async()=>{
 const calls=[];const writer={createOption:async a=>{calls.push(a);return {resId:1,voucher:voucherFor(a),created:true};}};
 const NOW=Date.parse('2026-11-27T10:00:00Z');
 const base={tenantId:'sarberki-test',caseId:'tm-cccccccccccccccccccccccc',facts:{arrival:'2027-03-04',departure:'2027-03-08',adults:2,children:0,cabin:'deluxe'},
  name:'Teszt Elek',email:'sarberkito@gmail.com',channel:'phone',writer,unitCheckFn:async()=>({status:'free'}),quoteFn:async()=>({status:'public_reference',accommodation:252000,cabin:'deluxe'}),now:()=>NOW,env:{VOICE_INTAKE:'test-only'}};
 await prefillChatBooking({...base,phone:LINE});await prefillChatBooking({...base,phone:''});await prefillChatBooking({...base,phone:LINE,email:'vendeg@example.test'});
 assert.deepEqual(calls[0].contact,{email:'sarberkito@gmail.com',phone:LINE});
 assert.deepEqual(calls[1].contact,{email:'sarberkito@gmail.com',phone:null},'no number: e-mail only');
 assert.equal(calls[2].contact,null,'not a test-pair address: no contact data to Previo TEST (AGENTS)');
 for(const c of calls){assert.equal(c.optionExpiresUtc,new Date(NOW+PREFILL_OPTION_HOURS*3600000).toISOString());assert.equal(c.channel,'phone');assert.equal(c.totalHuf,252000);}
 const xml=buildReservationXml({tenantId:'sarberki-test',caseId:base.caseId,values:{arrival:'2027-03-04',departure:'2027-03-08',adults:'2',children:'0',child_ages:''},cabin:'deluxe',unit:'11',
  contactName:'Teszt Elek',contact:calls[0].contact,totalHuf:252000,optionExpiresUtc:calls[0].optionExpiresUtc,channel:'phone'}).xml;
 assert.match(xml,new RegExp('<phone>\\'+LINE+'</phone>'));assert.match(xml,/<email>sarberkito@gmail\.com<\/email>/);
});

test('owner call 2026-11-27: an accented spoken address („sárberkitó kukac gmail.com”) becomes the plain address; the Previo contact follows',async()=>{
 const {normalizeSpokenEmail}=await import('../shared-core/voice-request.mjs');
 assert.equal(normalizeSpokenEmail('sárberkitó kukac gmail.com'),'sarberkito@gmail.com');
 assert.equal(normalizeSpokenEmail('Kovács Ödön kukac example pont hu'),'kovacsodon@example.hu');
 assert.equal(normalizeSpokenEmail('łukasz kukac example pont pl'),null,'not plain after removing accents: not guessed');
 const c=voiceConfirm({email:'sárberkitó kukac gmail.com',name:'Nagy Ádám',callerId:LINE});
 assert.equal(c.email,'sarberkito@gmail.com');assert.match(c.reply,/sarberkito kukac gmail pont com/);
 const prefills=[];await voiceRequest({utterances:[...CALL,'sárberkitó kukac gmail.com'],email:'sárberkitó kukac gmail.com',name:'Nagy Ádám',consent:true,conversationId:'conv_e0000001',callerId:LINE,clock:C,offerFn:async()=>OFFER,
  createFn:async()=>({caseId:'tm-e'}),prefillFn:async a=>{prefills.push(a);return {status:'created',unit:'11'};}});
 assert.equal(prefills[0].email,'sarberkito@gmail.com');assert.equal(prefills[0].phone,LINE);
});
