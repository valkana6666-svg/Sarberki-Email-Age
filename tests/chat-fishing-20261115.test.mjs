import test from 'node:test';
import assert from 'node:assert/strict';
import {chatbotReply} from '../chatbot-v1.mjs';

// Owner iPhone chat test 2026-11-15: fishing questions get the specific approved answer.
test('rules question: general conditions + minimum sizes + rules link',()=>{
 const r=chatbotReply({message:'Mik a horgászati szabályok?',language:'hu'});
 assert.equal(r.intent,'fishing');assert.match(r.reply,/szakáll nélküli/);assert.match(r.reply,/Minimum méretek: süllő 30 cm/);
 assert.match(r.reply,/sarberkito\.hu\/sarberki-horgaszto-horgaszati-szabalyai\//);
});
test('ticket and hook questions get their own answers',()=>{
 assert.match(chatbotReply({message:'Mennyibe kerül a horgászjegy?',language:'hu'}).reply,/Normál tó: 24 órás 7 500 \/ 3 750 Ft/);
 assert.match(chatbotReply({message:'Szakállas horgot lehet használni a horgászatnál?',language:'hu'}).reply,/^Szakállas horog nem használható/);
 assert.match(chatbotReply({message:'Was sind die Regeln zum Angeln?',language:'de'}).reply,/Mindestmaße/);
});

test('with the request form shown, the chat reply does not ask for a phone number again',async()=>{
 const {withoutPhoneQuestion}=await import('../sarberki-chatbot-project/chat-view.mjs');
 const text='Szállás\nX\n\nAz ajánlathoz még szükségünk van\nMegírna egy telefonszámot, amelyen elérhetjük?\n\nFoglalás állapota\nY';
 assert.equal(withoutPhoneQuestion(text,'hu'),'Szállás\nX\n\nFoglalás állapota\nY');
 const two='Az ajánlathoz még szükségünk van\nKérjük, írja meg, hány felnőtt érkezik.\nMegírna egy telefonszámot, amelyen elérhetjük?\n\nZ';
 assert.equal(withoutPhoneQuestion(two,'hu'),'Az ajánlathoz még szükségünk van\nKérjük, írja meg, hány felnőtt érkezik.\n\nZ');
});
