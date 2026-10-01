export const APPROVED_SUBJECTS = Object.freeze([
  'érdeklődés a szállásról',
  'érdeklődés a szallasrol',
  'érdeklődés szállásról',
  'anfrage für einen aufenthalt',
  'anfrage für eine unterkunft',
  'anfrage zur unterkunft',
  'accommodation inquiry',
  'booking inquiry',
  'inquiry about accommodation',
  'povpraševanje za nastanitev',
  'povpraševanje o nastanitvi',
  'rezervacija nastanitve'
]);

export const TEST_SUBJECT_PREFIXES = Object.freeze([
  'sárberki élő teszt',
  'sarberki elo teszt'
]);

export const HUNGARIAN_INQUIRY_PREFIXES = Object.freeze([
  'érdeklődés',
  'erdeklodes',
  'foglalási érdeklődés',
  'foglalasi erdeklodes'
]);

export const GERMAN_INQUIRY_PREFIXES = Object.freeze([
  'anfrage',
  'buchungsanfrage',
  'reservierungsanfrage'
]);

export const ENGLISH_INQUIRY_PREFIXES = Object.freeze([
  'accommodation inquiry',
  'booking inquiry',
  'reservation inquiry',
  'inquiry about accommodation'
]);

export const SLOVENIAN_INQUIRY_PREFIXES = Object.freeze([
  'povpraševanje',
  'povprasevanje',
  'rezervacija nastanitve'
]);

function normalizeSubject(subject) {
  let normalized=subject
    .trim()
    .toLocaleLowerCase('hu-HU')
    .replace(/\s+/gu, ' ');
  normalized=normalized.replace(/^(?:(?:re|fw|fwd|aw)\s*:\s*)+/giu,'').trim();
  return normalized;
}

export function isApprovedSubject(subject) {
  if (typeof subject !== 'string') return false;
  const normalized = normalizeSubject(subject);
  if (!normalized) return false;

  const approvedInquiry = APPROVED_SUBJECTS.some(base =>
    normalized === base || normalized.startsWith(base + ' ')
  );
  if (approvedInquiry) return true;

  const inquiryPrefixes=[
    ...HUNGARIAN_INQUIRY_PREFIXES,
    ...GERMAN_INQUIRY_PREFIXES,
    ...ENGLISH_INQUIRY_PREFIXES,
    ...SLOVENIAN_INQUIRY_PREFIXES
  ];
  if (inquiryPrefixes.some(prefix =>
    normalized === prefix || normalized.startsWith(prefix + ' ')
  )) return true;

  return TEST_SUBJECT_PREFIXES.some(prefix =>
    normalized === prefix
    || normalized.startsWith(prefix + ' ')
    || normalized.startsWith(prefix + ' – ')
    || normalized.startsWith(prefix + ' - ')
  );
}
