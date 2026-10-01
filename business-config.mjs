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
    deluxe: Object.freeze({label:'Deluxe', bookingName:'DELUXE faház', maxAdults:6, maxGuests:6}),
    family: Object.freeze({label:'Családi', bookingName:'Családi faház', maxAdults:8, maxGuests:8}),
    vip: Object.freeze({label:'VIP', bookingName:'VIP apartman', maxAdults:7, maxGuests:7}),
    small: Object.freeze({label:'Különálló 2 fős', bookingName:'Különálló 2 fős faház', maxAdults:2, maxGuests:2})
  }),
  bookingProvider: Object.freeze({
    kind: 'previo-public-booking',
    root: 'https://booking.previo.cz',
    hotelId: '753011',
    language: 'hu'
  })
});
