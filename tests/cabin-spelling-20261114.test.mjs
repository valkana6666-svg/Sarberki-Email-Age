import test from 'node:test';
import assert from 'node:assert/strict';
import {cabinFromText} from '../sarberki-core.mjs';
import {createChatInquirySession} from '../sarberki-chatbot-project/chat-session.mjs';

test('owner iPhone test 2026-11-14: everyday Deluxe spellings are recognised; ambiguity still is not resolved',()=>{
 for(const t of ['Delux faházat szeretnénk','Deluxe faházat','A deluxe-ot választom','deluxot kérnénk','delüx ház','Deluksz faház','delux-ba jönnénk'])
  assert.equal(cabinFromText(t),'Deluxe',t);
 for(const t of ['Családi vagy deluxe?','deluxebb lenne a hangulat?'])assert.match(cabinFromText(t),/^\?/,t);
});
test('the chatbot does not ask the cabin type again for "Delux"',()=>{
 const t=createChatInquirySession({clock:()=>new Date('2026-11-14T09:06:00Z')}).reply('Delux faházat szeretnénk 3 felnőtt részére .Május 22.-27.ig .Mennyibe kerülne?').text;
 assert.match(t,/A kért háztípus: Deluxe/);assert.doesNotMatch(t,/melyik háztípust/);
});
