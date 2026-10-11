import test from 'node:test';
import assert from 'node:assert/strict';
import {buildChatInquiryReply,buildEmailInquiryDraft,renderCentralConversation} from '../shared-core/inquiry-channel-adapters.mjs';
import {createChatInquirySession} from '../sarberki-chatbot-project/chat-session.mjs';
import {chatbotReply,renderChatbotIntent} from '../chatbot-v1.mjs';
const now=new Date('2026-10-11T12:00:00Z');
const messages={hu:'Van szabad Deluxe faház 2026.11.13-15 között 2 felnőtt részére, gyermek nélkül?',de:'Ist ein Deluxe Haus vom 2026-11-13 bis 2026-11-15 für 2 Erwachsene ohne Kinder frei?',en:'Is a Deluxe cabin available from 2026-11-13 to 2026-11-15 for 2 adults and no children?',si:'Ali je Deluxe hiška prosta od 2026-11-13 do 2026-11-15 za 2 odrasli osebi brez otrok?'};
for(const [language,message]of Object.entries(messages))test('same frozen decision supplies guest and Hungarian operator review: '+language,()=>{
 const chat=buildChatInquiryReply({message,language,now}),email=buildEmailInquiryDraft({message,language,now});
 assert.deepEqual(chat.decision,email.decision);
 assert.equal(chat.operatorReviewLanguage,'hu');assert.equal(email.operatorReviewLanguage,'hu');
 assert.equal(chat.operatorReviewText,renderCentralConversation(chat.decision,{language:'hu'}));
 assert.match(chat.operatorReviewText,/kapacitás ellenőrzése még nem igazolt/);
 assert.match(email.operatorReviewText,/kapacitás ellenőrzése még nem igazolt/);
 assert.equal(chat.decision.facts.language,language);assert.equal(Object.isFrozen(chat.decision),true);
 assert.equal(chat.decision.safety.bookingCreated,false);assert.equal(chat.decision.capacity.verified,false);
 if(language==='hu'){assert.equal(chat.text,chat.operatorReviewText);assert.equal(email.text,email.operatorReviewText);}
 else assert.notEqual(chat.text,chat.operatorReviewText);
});
test('Hungarian review preserves the same missing-data decision across later turns',()=>{
 const session=createChatInquirySession({clock:()=>now});
 const first=session.reply(messages.en.replace(' for 2 adults and no children',''),{language:'en'});
 assert.ok(first.decision.missing.includes('adults'));
 assert.match(first.operatorReviewText,/felnőtt/);
 const second=session.reply('2 adults and no children.',{language:'en'});
 assert.equal(second.decision.missing.includes('adults'),false);
 assert.equal(second.decision.facts.cabin,'Deluxe');
 assert.match(second.operatorReviewText,/kapacitás ellenőrzése még nem igazolt/);
 session.reset();assert.deepEqual(session.snapshot(),{});
});
test('Hungarian FAQ renderer uses existing intent without reclassifying foreign message',()=>{
 const faq=chatbotReply({message:'Can I rent a hot tub?',language:'en'});
 assert.equal(faq.intent,'hotTub');assert.match(renderChatbotIntent(faq.intent,'hu'),/külön bérelhető, külön díj ellenében/);
 assert.equal(renderChatbotIntent('nonexistent','hu'),renderChatbotIntent('unknown','hu'));
});
