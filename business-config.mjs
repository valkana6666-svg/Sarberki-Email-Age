// Company-specific configuration.
// Keep reusable parsing/workflow code independent from these values so the same engine
// can be reused for another accommodation business by replacing configuration/adapters.
export const BUSINESS = Object.freeze({
  brandName: 'Sárberki Horgásztó',
  bookingUrl: 'https://sarberkito.hu/foglalas/',
  currency: 'HUF',
  locale: 'hu-HU',
  timezone: 'Europe/Budapest',
  bookingRules: Object.freeze({
    depositPctUnder15Guests: 50,
    depositPctFrom15Guests: 80,
    depositDueDays: 10,
    cancellationDaysUnder15Guests: 14,
    cancellationDaysFrom15Guests: 30,
    source: 'Sárberki booking rules / project knowledge base'
  }),
  operationalRules: Object.freeze({
    reception24h: true,
    confirmedLateArrivalExample: '18:30',
    checkoutBy: '10:00',
    electricitySettlement: 'metered_separate',
    parking: 'available_large_group_review',
    firewood: 'surcharge_price_unverified',
    returningGuestDiscountPct: 20,
    returningGuestLookbackDays: 730,
    returningGuestRequiresHistoryCheck: true,
    petAllowedForFee: true,
    petFeeVerified: false,
    hotTubAvailabilityRequiresCheck: true,
    hotTubFeeVerified: false
  }),
  pricingRules: Object.freeze({
    extraAdultNightlyHuf: 4500,
    child0to3NightlyHuf: 0,
    child3to8NightlyHuf: 2250,
    publicExtraGuestRatesVerified: false,
    publicExtraGuestRatesNote: 'Legacy public price-list values conflict with the current accommodation base prices; do not use automatically without fresh verification.',
    tourismTaxAdultNightlyHuf: 550,
    highSeasonSurchargePct: 10,
    highSeasonStart: '07-01',
    highSeasonEnd: '08-20',
    oneNightSurchargePct: 20,
    source: 'Sárberki public website / price list'
  }),
  accommodationTypes: Object.freeze({
    deluxe: Object.freeze({
      label:'Deluxe',
      bookingName:'DELUXE faház',
      basePriceGuests:4,
      publicListedNightlyHuf:60000,
      maxAdults:6,
      maxGuests:6,
      extraAdultPricing:'standard'
    }),
    family: Object.freeze({
      label:'Családi',
      bookingName:'Családi faház',
      basePriceGuests:4,
      publicListedNightlyHuf:52000,
      maxAdults:8,
      maxGuests:8,
      extraAdultPricing:'standard'
    }),
    vip: Object.freeze({
      label:'VIP',
      bookingName:'VIP apartman',
      basePriceGuests:4,
      publicListedNightlyHuf:60000,
      maxAdults:7,
      maxGuests:7,
      extraAdultPricing:'standard'
    }),
    small: Object.freeze({
      label:'Különálló 2 fős',
      bookingName:'Különálló 2 fős faház',
      basePriceGuests:2,
      publicListedNightlyHuf:30000,
      maxAdults:2,
      maxGuests:3,
      extraAdultPricing:'not-allowed',
      childExtraBedPossible:true
    }),
    splitA: Object.freeze({
      label:'Osztott A',
      bookingName:null,
      basePriceGuests:2,
      publicListedNightlyHuf:23000,
      maxAdults:2,
      maxGuests:2,
      splitUnit:'A',
      previoMappingVerified:false,
      previoTypeMappingVerified:true,
      previoObjectKindName:'2 fős apartman',
      previoObjectKindId:766441,
      previoObjectKindPoolSize:8,
      previoIndividualUnitMappingVerified:false,
      previoPairingVerified:false,
      publicPriceLabel:'2 fős apartman',
      publicPriceUrl:'https://sarberkito.hu/accomodation/',
      extraAdultPricing:'not-allowed'
    }),
    splitB: Object.freeze({
      label:'Osztott B',
      bookingName:null,
      basePriceGuests:2,
      publicListedNightlyHuf:23000,
      maxAdults:2,
      maxGuests:2,
      splitUnit:'B',
      previoMappingVerified:false,
      previoTypeMappingVerified:true,
      previoObjectKindName:'2 fős apartman',
      previoObjectKindId:766441,
      previoObjectKindPoolSize:8,
      previoIndividualUnitMappingVerified:false,
      previoPairingVerified:false,
      publicPriceLabel:'2 fős apartman',
      publicPriceUrl:'https://sarberkito.hu/accomodation/',
      extraAdultPricing:'not-allowed'
    }),
    splitC: Object.freeze({
      label:'Osztott C',
      bookingName:null,
      basePriceGuests:4,
      publicListedNightlyHuf:44000,
      maxAdults:5,
      maxGuests:5,
      splitUnit:'C',
      previoMappingVerified:false,
      previoTypeMappingVerified:true,
      previoObjectKindName:'4 fős apartman',
      previoObjectKindId:766443,
      previoObjectKindPoolSize:4,
      previoIndividualUnitMappingVerified:false,
      previoPairingVerified:false,
      publicPriceLabel:'4 fős apartman',
      publicPriceUrl:'https://sarberkito.hu/accomodation/',
      extraAdultPricing:'standard'
    })
  }),
  bookingProvider: Object.freeze({
    kind: 'previo-public-booking',
    root: 'https://booking.previo.cz',
    hotelId: '753011',
    language: 'hu'
  })
});
