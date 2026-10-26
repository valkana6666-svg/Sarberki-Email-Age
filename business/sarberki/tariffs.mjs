import {BUSINESS} from '../../business-config.mjs';

// 2027 only: owner-approved signed "2027. évi árak" PDF (2026-09-30).
// Do not change any 2026 BUSINESS values.
const rate=(nightlyHuf,includedGuests)=>Object.freeze({nightlyHuf,includedGuests});
export const SARBERKI_TARIFF_2027=Object.freeze({
 validFrom:'2027-01-01',validThrough:'2027-12-31',
 source:'Rezidencia 96 Kft., 2027. évi árak, signed 2026-09-30',
 highSeasonStart:'07-01',highSeasonEnd:'08-22',
 extraAdultNightlyHuf:10000,
 // The PDF says 3-8y 5000 HUF, but its 3y overlap and base-occupancy
 // interplay still need clarification before an automated child total.
 child3to8NightlyHuf:5000,extraChildNightlyHuf:null,
 rates:Object.freeze({
  vip:rate(63000,4),family:rate(55000,4),deluxe:rate(63000,4),
  splitC:rate(46000,4),splitA:rate(24000,2),splitB:rate(24000,2),small:rate(31500,2)
 })
});
export function sarberkiTariffForNight(date,cabin){
 if(typeof date!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('Érvénytelen tarifa-dátum.');
 const type=BUSINESS.accommodationTypes[cabin];
 if(!type)throw Error('Ismeretlen háztípus.');
 // Preserve the existing pre-2027 reference, including every 2026 value.
 if(date<SARBERKI_TARIFF_2027.validFrom)return {nightlyHuf:type.publicListedNightlyHuf,includedGuests:type.basePriceGuests};
 if(date>SARBERKI_TARIFF_2027.validThrough)throw Error('Erre az évre nincs jóváhagyott alapár; kézi ellenőrzés szükséges.');
 return SARBERKI_TARIFF_2027.rates[cabin];
}
