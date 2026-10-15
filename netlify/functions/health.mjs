import {deployedCommit} from '../../build-info.mjs';
export default async () => Response.json({
  ok: true,
  project: 'sarberki-email-agent',
  channel: 'gmail-test-subject-allowlist',
  version: 'v0.3.10-test',
  gmailMode: 'readonly-test-account-inbox-after-date',
  unifiedPipeline: true,
  multilingual: ['hu','de','en','si'],
  canonicalGmailRecord: true,
  normalizedDates: true,
  inferredYearRequiresApproval: true,
  childPricingAutoQuote: false,
  priceQuoteMode: 'manual-review-only',
  serverlessChromium: false,
  livePriceVerified: false,
  livePriceVerificationStatus: 'not-confirmed-by-health',
  deployedCommit,
  liveQuoteHost: 'leafy-chimera-2403e5.netlify.app',
  autoSend: false,
  autoBookingModification: false
}, {headers:{'cache-control':'no-store'}});
