
const BOOKING_URL = 'https://sarberkito.hu/foglalas/';
const TYPES = { deluxe: 'DELUXE faház', family: 'Családi faház', vip: 'VIP apartman', small: 'Különálló 2 fős faház' };
const MAX_ADULTS = { deluxe: 6, family: 8, vip: 7, small: 2 };
export const returningGuestReview = Object.freeze({status:'ELLENŐRIZENDŐ – KORÁBBI FOGLALÁS ELLENŐRZÉSE SZÜKSÉGES',lookbackMonths:48,possibleDiscountPercent:20,applied:false,publicSiteLookbackDays:730,source:'https://sarberkito.hu/foglalasrol/'});

export function validateQuote(input) {
  if(!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).some(key=>!['arrival','departure','cabin','adults','children'].includes(key))) throw Error('Csak dátum, háztípus és névtelen létszámadat adható meg; személyes adat nem továbbítható.');
  const { arrival, departure, cabin, adults, children = [] } = input || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(arrival || '') || !/^\d{4}-\d{2}-\d{2}$/.test(departure || '')) throw Error('Pontos érkezési és távozási dátum szükséges.');
  const start = new Date(arrival + 'T00:00:00Z'), end = new Date(departure + 'T00:00:00Z');
  if (!Number.isFinite(+start) || !Number.isFinite(+end) || start.toISOString().slice(0,10) !== arrival || end.toISOString().slice(0,10) !== departure || end <= start || start < new Date(new Date().toISOString().slice(0,10)+'T00:00:00Z')) throw Error('Érvényes, jövőbeli tartózkodást adj meg.');
  if (!TYPES[cabin]) throw Error('Pontos, támogatott háztípus szükséges.');
  if (!Number.isInteger(adults) || adults < 1 || adults > 20 || !Array.isArray(children) || children.some(a => !Number.isInteger(a) || a < 0 || a > 17)) throw Error('Add meg a felnőttek számát és minden gyermek életkorát.');
  if (adults > MAX_ADULTS[cabin]) throw Error('A kért felnőtt létszám meghaladja az egyházas lekérés kapacitási korlátját.');
  if (adults + children.length > 20) throw Error('A létszám túl nagy az egyházas lekéréshez.');
  return {arrival,departure,cabin,adults,children};
}

// Legacy browser path is deliberately disabled: it clicked a booking-labelled UI action.
// The only live quote route is the guarded public-booking adapter, gated until
// Previo/PMS confirms that anonymous date search creates no reservation or hold.
export async function fetchQuote(request) {
  const input=validateQuote(request);
  if(input.children.length) throw Error('A gyermekkor szerinti régi böngészős árlekérés le van tiltva.');
  throw Error('A régi böngészős árlekérés le van tiltva; csak igazoltan foglalásmentes forrás engedélyezhető.');
}

export function parseHuf(text) {
  if (!/^[\d\s\u00a0]+Ft$/u.test(text.trim())) throw Error('Az ár pénzneme vagy formátuma nem igazolható.');
  return Number(text.replace(/\D/g,''));
}
