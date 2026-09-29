export const APPROVED_SUBJECTS = Object.freeze([
  'érdeklődés a szállásról',
  'érdeklődés a szallasrol',
  'érdeklődés szállásról'
]);

export const TEST_SUBJECT_PREFIXES = Object.freeze([
  'sárberki élő teszt',
  'sarberki elo teszt'
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

  return TEST_SUBJECT_PREFIXES.some(prefix =>
    normalized === prefix
    || normalized.startsWith(prefix + ' ')
    || normalized.startsWith(prefix + ' – ')
    || normalized.startsWith(prefix + ' - ')
  );
}
