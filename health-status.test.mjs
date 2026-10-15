import test from 'node:test';
import assert from 'node:assert/strict';
import health from './netlify/functions/health.mjs';

test('health does not falsely claim live Previo pricing is verified', async () => {
  const response = await health();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.equal(body.livePriceVerified, false);
  assert.equal(body.livePriceVerificationStatus, 'not-confirmed-by-health');
  assert.equal(body.priceQuoteMode, 'manual-review-only');
  assert.equal(body.autoSend, false);
  assert.equal(body.autoBookingModification, false);
});

test('health reports Gmail read-only test-account inbox/date policy', async () => {
  const body = await (await health()).json();
  assert.equal(body.gmailMode, 'readonly-test-account-inbox-after-date');
  assert.equal(body.channel, 'gmail-test-subject-allowlist');
  assert.equal(body.ok, true);
});
