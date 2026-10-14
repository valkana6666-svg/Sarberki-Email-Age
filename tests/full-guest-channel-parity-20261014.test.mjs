import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatInquirySession} from '../sarberki-chatbot-project/chat-session.mjs';
import {chatbotInquiryPreview} from '../sarberki-chatbot-project/inquiry-preview.mjs';
import {buildEmailInquiryDraft,buildChatInquiryReply} from '../shared-core/inquiry-channel-adapters.mjs';

const now=new Date('2026-10-14T06:00:00Z');
const scenarios={
 hu:'Van szabad Deluxe faház 2026-11-01 és 2026-11-03 között 2 felnőttnek, 0 gyermek? Phone: +36 30 123 4567.',
 de:'Ist ein Deluxe Ferienhaus 2026-11-01 bis 2026-11-03 für 2 Erwachsene und 0 Kinder verfügbar? Phone: +36 30 123 4567.',
 si:'Ali je Deluxe hiška 2026-11-01 do 2026-11-03 za 2 odrasli in 0 otroci prosto? Phone: +36 30 123 4567.',
 en:'Is one Deluxe cabin available from 2026-11-01 to 2026-11-03 for 2 adults and 0 children? Phone: +36 30 123 4567.'
};
for(const [language,message] of Object.entries(scenarios)){
 test(language+' actual booking chat session and preview expose full existing email draft unchanged',()=>{
  const session=createChatInquirySession({language,clock:()=>now}),reply=session.reply(message);
  assert.ok(reply.decision,'the deployed session must use the booking path, not informational FAQ');
  const email=buildEmailInquiryDraft({message,language,now,facts:reply.extracted});
  assert.equal(reply.text,email.text);assert.equal(reply.response.reply,email.text);
  assert.equal(reply.operatorReviewText,email.operatorReviewText);
  assert.equal(reply.operatorReviewLanguage,'hu');assert.deepEqual(reply.decision,email.decision);
  assert.ok(reply.text.includes('\n\n'));assert.match(reply.text,/Sárberki Horgásztó/);
  assert.doesNotMatch(reply.text,/phone number|telefonszám|Telefonnummer|telefonsko številko/iu);
  const preview=chatbotInquiryPreview({message,language,now});
  assert.equal(preview.response.intent,'availability');
  assert.equal(preview.response.reply,buildEmailInquiryDraft({message,language,now}).text);
  assert.equal(preview.bookingCreated,false);assert.equal(preview.capacityChecked,false);
  assert.deepEqual(reply.decision.safety,{emailSent:false,bookingCreated:false,approval:'pending',guestPriceApproved:false});
 });
}
test('full draft parity also preserves shared missing-data decisions and Hungarian review',()=>{
 const options={message:'Is a Deluxe cabin available?',language:'en',now};
 const email=buildEmailInquiryDraft(options),chat=buildChatInquiryReply(options);
 assert.equal(chat.text,email.text);assert.equal(chat.operatorReviewText,email.operatorReviewText);
 assert.match(chat.text,/arrival and departure/);assert.ok(chat.decision.missing.includes('dates'));
 assert.equal(chat.decision.capacity.verified,false);assert.equal(chat.decision.pricing.verified,false);
});
