import {BUSINESS} from '../../business-config.mjs';

// Owner-approved base accommodation prices for occupied nights in 2027 only.
// Extra-guest rates were explicitly deferred; never inherit the legacy numbers.
const rate=(nightlyHuf,includedGuests)=>Object.freeze({nightlyHuf,includedGuests});
export const SARBERKI_TARIFF_2027=Object.freeze({
 validFrom:'2027-01-01',validThrough:'2027-12-31',
 source:'Owner approval 2026-10-26',
 extraAdultNightlyHuf:null,extraChildNightlyHuf:null,
 rates:Object.freeze({
  vip:rate(60000,4),family:rate(52000,4),deluxe:rate(60000,4),
  splitC:rate(44000,4),splitA:rate(23000,2),splitB:rate(23000,2),small:rate(30000,2)
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
