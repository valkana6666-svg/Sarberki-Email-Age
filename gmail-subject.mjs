export const APPROVED_SUBJECTS = Object.freeze([
  'érdeklődés a szállásról',
  'érdeklődés a szallasrol',
  'érdeklődés szállásról',
  'anfrage für einen aufenthalt',
  'anfrage für eine unterkunft',
  'anfrage zur unterkunft'
]);

export const TEST_SUBJECT_PREFIXES = Object.freeze([
  'sárberki élő teszt',
  'sarberki elo teszt'
]);

export const GERMAN_INQUIRY_PREFIXES = Object.freeze([
  'anfrage',
  'buchungsanfrage',
  'reservierungsanfrage'
]);

function normalizeSubject(subject) {
  return subject
    .trim()
    .toLocaleLowerCase('hu-HU')
    .replace(/\s+/gu, ' ');
}

export function isApprovedSubject(subject) {
  if (typeof subject !== 'string') return false;
  const normalized = normalizeSubject(subject);
  if (!normalized) return false;

  const approvedInquiry = APPROVED_SUBJECTS.some(base =>
    normalized === base || normalized.startsWith(base + ' ')
  );
  if (approvedInquiry) return true;

  if (GERMAN_INQUIRY_PREFIXES.some(prefix =>
    normalized === prefix || normalized.startsWith(prefix + ' ')
  )) return true;

  return TEST_SUBJECT_PREFIXES.some(prefix =>
    normalized === prefix
    || normalized.startsWith(prefix + ' ')
    || normalized.startsWith(prefix + ' – ')
    || normalized.startsWith(prefix + ' - ')
  );
}
