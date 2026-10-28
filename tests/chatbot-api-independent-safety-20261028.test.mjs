import test from 'node:test';
import assert from 'node:assert/strict';
import {chatbotReply, renderChatbotIntent} from '../chatbot-v1.mjs';

// API-independent safety boundary: every language must withhold unverified availability.
for (const [language, message] of Object.entries({
  hu: 'Van szabad Deluxe faház 2026.11.13 és 2026.11.15 között?',
  de: 'Ist ein Deluxe Ferienhaus vom 2026-11-13 bis 2026-11-15 frei?',
  en: 'Is a Deluxe cabin available from 2026-11-13 to 2026-11-15?',
  si: 'Ali je Deluxe hiška prosta od 2026-11-13 do 2026-11-15?'
})) {
  test('no API: dated booking availability stays unverified in '+language, () => {
    const result = chatbotReply({message, language});
    assert.equal(result.intent, 'availability');
    assert.equal(result.language, language);
    assert.equal(result.availabilityVerified, false);
    assert.equal(result.bookingCreated, false);
    assert.equal(result.emailSent, false);
    assert.equal(result.reply, renderChatbotIntent('availability', language));
  });
}

for (const language of ['hu','de','en','si']) {
  test('no API: hot tub and booking never promise automatic fulfillment in '+language, () => {
    const tub = chatbotReply({message:'hot tub', language});
    assert.equal(tub.intent, 'hotTub');
    assert.equal(tub.reply, renderChatbotIntent('hotTub', language));
    const booking = chatbotReply({message:'booking', language});
    assert.equal(booking.intent, 'booking');
    for (const result of [tub, booking]) {
      assert.equal(result.availabilityVerified, false);
      assert.equal(result.bookingCreated, false);
      assert.equal(result.emailSent, false);
    }
  });
}
