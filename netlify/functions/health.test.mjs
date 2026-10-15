import test from 'node:test';
import assert from 'node:assert/strict';
import health from './health.mjs';

test('health does not claim live Previo pricing is verified', async () => {
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

test('health describes actual Gmail account, inbox and date policy', async () => {
  const response = await health();
  const body = await response.json();
  assert.equal(body.gmailMode, 'readonly-test-account-inbox-after-date');
  assert.equal(body.channel, 'gmail-test-subject-allowlist');
  assert.equal(body.ok, true);
});
