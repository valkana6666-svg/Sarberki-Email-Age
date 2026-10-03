import {isApprovedSubject} from './gmail-subject.mjs';

export const TEST_GMAIL_ACCOUNT = 'sarberkiprojecttest@gmail.com';
export const TEST_GMAIL_SENDER = 'valkana6666@gmail.com';
export const INBOX_QUERY = `in:inbox from:${TEST_GMAIL_SENDER} after:2026/09/25`;
// Gmail after: uses Pacific midnight; repeat that same boundary locally.
const AFTER = Date.parse('2026-09-25T00:00:00-07:00');
export function assertTestGmailAccount(profile) {
  if (profile?.emailAddress?.trim().toLowerCase() !== TEST_GMAIL_ACCOUNT)
    throw Error(`Csak a ${TEST_GMAIL_ACCOUNT} tesztfiók olvasható. Válaszd ezt a Google-fiókot.`);
}
export function isTestInquiry(message) {
  const headers = Object.fromEntries((message?.payload?.headers || []).map(h => [h.name.toLowerCase(), h.value]));
  const from = (headers.from || '').match(/<([^<>]+)>\s*$/u)?.[1] || (headers.from || '').trim();
  return message?.labelIds?.includes('INBOX') === true
    && from.toLowerCase() === TEST_GMAIL_SENDER
    && Number.isFinite(Number(message.internalDate))
    && Number(message.internalDate) > AFTER
    && isApprovedSubject(headers.subject);
}
