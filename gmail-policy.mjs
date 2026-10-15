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

// Optional narrow read for an operator-preidentified synthetic message.
// An invalid/empty/duplicate selector must never fall back to the inbox query.
export function syntheticMessageIdFromSearch(search='') {
  const ids=new URLSearchParams(search).getAll('syntheticGmailMessageId');
  if(!ids.length)return null;
  if(ids.length!==1||! /^[a-f0-9]{12,32}$/.test(ids[0]))
    throw Error('Érvénytelen szintetikus Gmail-üzenetazonosító; az Inbox nem kerül beolvasásra.');
  return ids[0];
}
