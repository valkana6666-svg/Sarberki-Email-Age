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

  if (/^(?:érdeklődés|erdeklodes)(?:\s+\d+)?$/u.test(normalized)) return true;

  const prefixGroups=[
    {prefixes:HUNGARIAN_INQUIRY_PREFIXES, detail:/\b(?:szállás|szallas|faház|fahaz|ház|haz|deluxe|vip|családi|csaladi|osztott|október|oktober|november|március|marcius|április|aprilis|május|majus|június|junius|július|julius|augusztus|szeptember|december|\d{1,2}\s*(?:fő|fo))\b/u},
    {prefixes:GERMAN_INQUIRY_PREFIXES, detail:/\b(?:unterkunft|aufenthalt|buchung|reservierung|hütte|huette|ferienhaus|deluxe|vip|familienhaus|oktober|november|märz|maerz|april|mai|juni|juli|august|september|dezember|\d{1,2}\s*(?:gäste|personen))\b/u},
    {prefixes:ENGLISH_INQUIRY_PREFIXES, detail:/\b(?:accommodation|stay|booking|reservation|cabin|house|deluxe|vip|family|october|november|march|april|may|june|july|august|september|december|\d{1,2}\s*(?:guests?|people|persons?))\b/u},
    {prefixes:SLOVENIAN_INQUIRY_PREFIXES, detail:/\b(?:nastanitev|rezervacij|bivanje|hišk|hisk|koč|koc|deluxe|vip|družinsk|druzinsk|oktober|november|marec|april|maj|junij|julij|avgust|september|december|\d{1,2}\s*oseb)\b/u}
  ];
  for (const {prefixes,detail} of prefixGroups) {
    if (prefixes.some(prefix => normalized === prefix)) return true;
    if (prefixes.some(prefix => normalized.startsWith(prefix + ' ')) && detail.test(normalized)) return true;
  }

  return TEST_SUBJECT_PREFIXES.some(prefix =>
    normalized === prefix
    || normalized.startsWith(prefix + ' ')
    || normalized.startsWith(prefix + ' – ')
    || normalized.startsWith(prefix + ' - ')
  );
}
