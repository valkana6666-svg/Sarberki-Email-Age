import {BUSINESS} from '../../business-config.mjs';
import {createAccommodationBusinessProfile} from '../../shared-core/business-profile.mjs';

export const SARBERKI_PROFILE=createAccommodationBusinessProfile({
  id:'sarberki',
  brandName:BUSINESS.brandName,
  locale:BUSINESS.locale,
  timezone:BUSINESS.timezone,
  currency:BUSINESS.currency,
  bookingRules:BUSINESS.bookingRules,
  operationalRules:BUSINESS.operationalRules,
  pricingRules:BUSINESS.pricingRules,
  accommodationTypes:BUSINESS.accommodationTypes,
  bookingProvider:BUSINESS.bookingProvider
});
