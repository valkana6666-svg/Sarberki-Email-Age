export default async () => Response.json({
  ok: true,
  project: 'sarberki-email-agent',
  channel: 'gmail-test-subject-allowlist',
  version: 'v0.3.9-test',
  gmailMode: 'readonly-general-inquiry',
  unifiedPipeline: true,
  multilingual: ['hu','de','en','si'],
  canonicalGmailRecord: true,
  normalizedDates: true,
  inferredYearRequiresApproval: true,
  childPricingAutoQuote: false,
  priceQuoteMode: 'readonly-review-required',
  serverlessChromium: true,
  autoSend: false,
  autoBookingModification: false
}, {headers:{'cache-control':'no-store'}});
