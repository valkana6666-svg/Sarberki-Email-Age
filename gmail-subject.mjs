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

  const explicitLodgingBase = base => /(?:szállás|szallas|aufenthalt|unterkunft|accommodation|nastanit)/u.test(base);
  const approvedInquiry = APPROVED_SUBJECTS.some(base =>
    normalized === base
    || (normalized.startsWith(base + ' ') && explicitLodgingBase(base))
  );
  if (approvedInquiry) return true;

  if (/^(?:érdeklődés|erdeklodes)(?:\s+\d+)?$/u.test(normalized)) return true;

  const unrelatedBusiness = /\b(?:számla|szamla|invoice|rechnung|receipt|nyugta|fizetés|fizetes|payment|zahlung|račun|racun|plačilo|placilo)\b/u;
  const prefixGroups=[
    {prefixes:HUNGARIAN_INQUIRY_PREFIXES, detail:/(?:szállás|szallas|faház|fahaz|deluxe|vip|családi|csaladi|osztott|január|januar|február|februar|március|marcius|április|aprilis|május|majus|június|junius|július|julius|augusztus|szeptember|október|oktober|november|december|\d{1,2}\s*(?:fő|fo))/u},
    {prefixes:GERMAN_INQUIRY_PREFIXES, detail:/(?:unterkunft|aufenthalt|hütte|huette|ferienhaus|deluxe|vip|familienhaus|januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember|\d{1,2}\s*(?:gäste|personen))/u},
    {prefixes:ENGLISH_INQUIRY_PREFIXES, detail:/(?:accommodation|stay|cabin|house|deluxe|vip|family|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}\s*(?:guests?|people|persons?))/u},
    {prefixes:SLOVENIAN_INQUIRY_PREFIXES, detail:/(?:nastanit|bivanje|hišk|hisk|koč|koc|deluxe|vip|družin|druzin|januar|februar|marec|april|maj|junij|julij|avgust|september|oktober|november|december|\d{1,2}\s*oseb)/u}
  ];
  for (const {prefixes,detail} of prefixGroups) {
    if (prefixes.some(prefix => normalized === prefix)) return true;
    if (prefixes.some(prefix => normalized.startsWith(prefix + ' '))
        && detail.test(normalized)
        && !unrelatedBusiness.test(normalized)) return true;
  }

  return TEST_SUBJECT_PREFIXES.some(prefix =>
    normalized === prefix
    || normalized.startsWith(prefix + ' ')
    || normalized.startsWith(prefix + ' – ')
    || normalized.startsWith(prefix + ' - ')
  );
}
