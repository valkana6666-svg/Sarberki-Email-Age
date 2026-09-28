import { chromium } from 'playwright';

const BOOKING_URL = 'https://sarberkito.hu/foglalas/';
const TYPES = { deluxe: 'DELUXE faház', family: 'Családi faház', vip: 'VIP apartman', small: 'Különálló 2 fős faház' };
const MAX_ADULTS = { deluxe: 6, family: 8, vip: 7, small: 2 };
export const returningGuestReview = Object.freeze({status:'ELLENŐRIZENDŐ – KORÁBBI FOGLALÁS ELLENŐRZÉSE SZÜKSÉGES',lookbackMonths:48,possibleDiscountPercent:20,applied:false,publicSiteLookbackDays:730,source:'https://sarberkito.hu/foglalasrol/'});

export function validateQuote(input) {
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

async function chooseDate(frame, field, iso) {
  const [year, month, day] = iso.split('-').map(Number);
  await frame.locator(field).click();
  const calendar = frame.locator('.ui-datepicker');
  for (let i = 0; i < 25; i++) {
    const months = await calendar.locator('.ui-datepicker-group').evaluateAll(groups => groups.map(g => ({year: Number(g.querySelector('.ui-datepicker-year')?.textContent), month: [...'január február március április május június július augusztus szeptember október november december'.split(' ')].indexOf(g.querySelector('.ui-datepicker-month')?.textContent?.toLowerCase()) + 1})).filter(m => m.year && m.month));
    if (months.some(m => m.year === year && m.month === month)) {
      const monthName = 'január február március április május június július augusztus szeptember október november december'.split(' ')[month-1];
      const group = calendar.locator('.ui-datepicker-group').filter({hasText: new RegExp(`${year}\\s+${monthName}`, 'i')});
      // The month headings identify one of the two visible calendar tables.
      await group.locator(`td[data-year="${year}"][data-month="${month-1}"] a.ui-state-default`, {}).getByText(String(day), {exact:true}).click();
      return;
    }
    await calendar.locator('.ui-datepicker-next').click();
  }
  throw Error('A kért dátum nem található a foglalási naptárban.');
}

export async function fetchQuote(request, launch = () => chromium.launch({headless:true})) {
  const input = validateQuote(request);
  if (input.children.length) throw Error('A gyermekkor szerinti árazás még nincs automatizálva; kézi ellenőrzés szükséges.');
  const browser = await launch();
  try {
    const page = await browser.newPage({locale:'hu-HU'});
    page.setDefaultTimeout(12000);
    await page.goto(BOOKING_URL, {waitUntil:'domcontentloaded',timeout:30000});
    const frame = page.frameLocator('iframe[src*="booking.previo.cz"]');
    await frame.locator('#book-term-from-input').waitFor();
    await chooseDate(frame,'.book-term-from',input.arrival);
    await chooseDate(frame,'.book-term-to',input.departure);
    await frame.getByRole('button',{name:/Folytatás/}).click();
    const room = frame.getByRole('link',{name: TYPES[input.cabin],exact:true});
    await room.waitFor();
    const card = room.locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " room ")][1]');
    await card.getByRole('link',{name:/Árak megjelenítése/}).click();
    const rate = card.locator(`select[data-num-of-persons="${input.adults}"]`);
    if (await rate.count() !== 1) throw Error('A pontos létszámhoz tartozó ár nem található egyértelműen.');
    await rate.locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " options ")][1]').getByRole('link',{name:'Foglalás',exact:true}).click();
    const panel = frame.locator('.res-occupancy:visible');
    await panel.locator('.finalPrice').waitFor();
    const actualAdults = Number(await panel.locator('input.guestCategories[data-default-category="1"]').first().inputValue());
    if (actualAdults !== input.adults || await panel.locator('.rooms > .room').count() !== 1) throw Error('Az összesítő létszáma eltér a kért adatoktól.');
    const amount = parseHuf(await panel.locator('.finalPrice').innerText());
    const tourismTax = parseHuf(await panel.locator('.taxPrice').innerText());
    if (!amount || amount < tourismTax) throw Error('Érvénytelen árösszesítő.');
    return {status:'review_required',source:BOOKING_URL,checkedAt:new Date().toISOString(),...input,accommodation:amount-tourismTax,tourismTax,total:amount,currency:'HUF',availability:'shown_for_selected_dates',seasonalSurchargeIncluded:'unverified',returningDiscountApplied:returningGuestReview.applied,returningGuestStatus:returningGuestReview.status,bookingCompleted:false};
  } finally { await browser.close(); }
}

export function parseHuf(text) {
  if (!/^[\d\s\u00a0]+Ft$/u.test(text.trim())) throw Error('Az ár pénzneme vagy formátuma nem igazolható.');
  return Number(text.replace(/\D/g,''));
}
