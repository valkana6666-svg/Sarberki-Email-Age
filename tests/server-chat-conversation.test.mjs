import test from 'node:test';
import assert from 'node:assert/strict';
import {replayServerChat} from '../shared-core/server-chat-conversation.mjs';
import {createChatInquirySession} from '../sarberki-chatbot-project/chat-session.mjs';
const now=new Date('2026-10-11T12:00:00Z'),clock=()=>now;
const turns=['Van szabad Deluxe faház 2026.11.13-15 között?','2 felnőtt, gyermek nélkül.'];
test('server replay uses the existing multi-turn engine and returns guest text only',()=>{
 const original=createChatInquirySession({language:'hu',clock});let last;for(const turn of turns)last=original.reply(turn);
 const result=replayServerChat({messages:turns,language:'hu'},{clock});
 assert.equal(result.text,last.text);assert.equal(result.language,'hu');assert.deepEqual(Object.keys(result).sort(),['language','text']);
 assert.doesNotMatch(result.text,/2026-11-13.*AVAILABLE|operatorReviewText/);
});
test('independent conversations do not reuse facts or stale availability',()=>{
 const one=replayServerChat({messages:turns},{clock});
 const two=replayServerChat({messages:['2 felnőtt, gyermek nélkül.']},{clock});
 assert.notEqual(one.text,two.text);
 assert.deepEqual(replayServerChat({messages:turns},{clock}),one);
});
test('invalid or oversized inputs and invalid clock fail closed',()=>{
 for(const input of [{messages:[]},{messages:['x'],language:'xx'},{messages:['x'.repeat(1001)]},{messages:Array(31).fill('x')},{messages:[null]}]){
  assert.throws(()=>replayServerChat(input,{clock}),/INVALID_CHAT_INPUT/);
 }
 assert.throws(()=>replayServerChat({messages:['x']},{clock:()=>new Date('invalid')}),/INVALID_CLOCK/);
});
test('untrusted claimed facts cannot affect server-derived answer',()=>{
 const a=replayServerChat({messages:turns},{clock});
 const b=replayServerChat({messages:turns,facts:{capacity:'AVAILABLE'},tenant:'other',approved:true},{clock});
 assert.deepEqual(a,b);
});
