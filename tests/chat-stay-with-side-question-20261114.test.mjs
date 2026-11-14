import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatInquirySession} from '../sarberki-chatbot-project/chat-session.mjs';

const clock=()=>new Date('2026-11-14T05:47:00Z');
test('owner iPhone test 2026-11-14: a stay request with a pet question opens the booking and answers the pet question',()=>{
 for(const m of ['Egy családi fahaz érdekelne.három felnőtt jönne.majus 22.-25. Hoznának egy kutyát.',
  'Egy családi faház érdekelne. Három felnőtt jönne. Május 22-25. Hozhatunk kutyát?']){
  const t=createChatInquirySession({clock}).reply(m).text;
  assert.match(t,/2027\.05\.22\. és 2027\.05\.25\. között 3 fő \(3 felnőtt\)/,m);
  assert.match(t,/A kért háztípus: Családi/,m);assert.match(t,/Háziállat hozható, díja 2 000 Ft\/nap\/állat/,m);
 }
});
test('informational questions alone stay short answers',()=>{
 for(const [m,re] of [['Lehet kutyát hozni?',/^Háziállat hozható/],['Lehet kutyát hozni júliusban?',/^Háziállat hozható/],['Van dézsa?',/^Dézsa külön bérelhető/],
  ['Hozhatunk kutyát? 3 felnőtt jönne.',/^Háziállat hozható/]])
  assert.match(createChatInquirySession({clock}).reply(m).text,re,m);
});
