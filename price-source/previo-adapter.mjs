import {createReadOnlyPmsAdapter} from '../shared-core/pms-adapter.mjs';
import {fetchPublicBookingAvailability,fetchPublicBookingQuote} from './sarberki-public-booking.mjs';

export const previoReadOnlyAdapter=createReadOnlyPmsAdapter({
  id:'previo-public-booking',
  tenantId:'sarberki',
  label:'Previo public booking',
  fetchAvailability:fetchPublicBookingAvailability,
  fetchQuote:fetchPublicBookingQuote,
  capabilities:{
    readAvailability:true,
    readQuote:true,
    createBooking:false,
    modifyBooking:false,
    cancelBooking:false
  }
});
