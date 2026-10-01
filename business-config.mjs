// Company-specific configuration.
// Keep reusable parsing/workflow code independent from these values so the same engine
// can be reused for another accommodation business by replacing configuration/adapters.
export const BUSINESS = Object.freeze({
  brandName: 'Sárberki Horgásztó',
  bookingUrl: 'https://sarberkito.hu/foglalas/',
  currency: 'HUF',
  locale: 'hu-HU',
  timezone: 'Europe/Budapest',
  accommodationTypes: Object.freeze({
    deluxe: Object.freeze({label:'Deluxe', bookingName:'DELUXE faház', maxAdults:6, maxGuests:6, basePriceGuests:4, publicListedNightlyHuf:60000, extraGuestPricing:'booking-calculator'}),
    family: Object.freeze({label:'Családi', bookingName:'Családi faház', maxAdults:8, maxGuests:8, basePriceGuests:4, publicListedNightlyHuf:52000, extraGuestPricing:'booking-calculator'}),
    vip: Object.freeze({label:'VIP', bookingName:'VIP apartman', maxAdults:7, maxGuests:7, basePriceGuests:4, publicListedNightlyHuf:60000, extraGuestPricing:'booking-calculator'}),
    small: Object.freeze({label:'Különálló 2 fős', bookingName:'Különálló 2 fős faház', maxAdults:2, maxGuests:2}),
    splitA: Object.freeze({label:'Osztott A', bookingName:null, maxAdults:2, maxGuests:2, basePriceGuests:2, splitUnit:'A', previoMappingVerified:false, publicListedNightlyHuf:23000, publicPriceLabel:'2 fős apartman', publicPriceUrl:'https://sarberkito.hu/accomodation/', extraGuestPricing:'not-allowed'}),
    splitB: Object.freeze({label:'Osztott B', bookingName:null, maxAdults:2, maxGuests:2, basePriceGuests:2, splitUnit:'B', previoMappingVerified:false, publicListedNightlyHuf:23000, publicPriceLabel:'2 fős apartman', publicPriceUrl:'https://sarberkito.hu/accomodation/', extraGuestPricing:'not-allowed'}),
    splitC: Object.freeze({label:'Osztott C', bookingName:null, maxAdults:5, maxGuests:5, basePriceGuests:4, splitUnit:'C', previoMappingVerified:false, publicListedNightlyHuf:44000, publicPriceLabel:'4 fős apartman', publicPriceUrl:'https://sarberkito.hu/accomodation/', extraGuestPricing:'booking-calculator'})
  }),
  bookingProvider: Object.freeze({
    kind: 'previo-public-booking',
    root: 'https://booking.previo.cz',
    hotelId: '753011',
    language: 'hu'
  })
});
