export const TEST_GMAIL_ACCOUNT = 'sarberkiprojecttest@gmail.com';
export const INBOX_QUERY = 'in:inbox after:2026/09/25';
// Gmail after: uses Pacific midnight; repeat that same boundary locally.
const AFTER = Date.parse('2026-09-25T00:00:00-07:00');

export function assertTestGmailAccount(profile) {
  if (profile?.emailAddress?.trim().toLowerCase() !== TEST_GMAIL_ACCOUNT)
    throw Error(`Csak a ${TEST_GMAIL_ACCOUNT} tesztfiók olvasható. Válaszd ezt a Google-fiókot.`);
}

export function isTestInquiry(message) {
  return message?.labelIds?.includes('INBOX') === true
    && Number.isFinite(Number(message.internalDate))
    && Number(message.internalDate) > AFTER;
}
