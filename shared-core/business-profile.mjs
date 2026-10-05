// Generic business-profile boundary for accommodation workflows.
// Shared modules can depend on this shape without knowing any property's
// name, accommodation types, prices, cancellation rules or PMS provider.

export function createAccommodationBusinessProfile({
  id,
  brandName,
  locale,
  timezone,
  currency,
  bookingRules,
  operationalRules,
  pricingRules,
  accommodationTypes,
  bookingProvider
}={}){
  if(!id||typeof id!=='string') throw new Error('A business profile azonosítója kötelező.');
  if(!brandName||typeof brandName!=='string') throw new Error('A business profile neve kötelező.');
  if(!locale||!timezone||!currency) throw new Error('A business profile locale/timezone/currency mezői kötelezők.');
  if(!bookingRules||typeof bookingRules!=='object') throw new Error('A foglalási szabályok hiányoznak.');
  if(!operationalRules||typeof operationalRules!=='object') throw new Error('Az üzemeltetési szabályok hiányoznak.');
  if(!pricingRules||typeof pricingRules!=='object') throw new Error('Az árazási szabályok hiányoznak.');
  if(!accommodationTypes||typeof accommodationTypes!=='object'||Array.isArray(accommodationTypes)) throw new Error('A szállástípusok hiányoznak.');
  if(!bookingProvider||typeof bookingProvider!=='object') throw new Error('A foglalási/PMS szolgáltató konfigurációja hiányzik.');

  return Object.freeze({
    id,
    brandName,
    locale,
    timezone,
    currency,
    bookingRules,
    operationalRules,
    pricingRules,
    accommodationTypes,
    bookingProvider
  });
}
