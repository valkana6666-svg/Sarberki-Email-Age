import {SARBERKI_PROFILE} from './business/sarberki/profile.mjs';
import {depositPercentForGuestCount} from './sarberki-core.mjs';

// Guest count alone cannot establish the applicable cancellation policy.
export function cancellationDaysForGuests(guests){
  const n=Number(guests);
  if(!Number.isInteger(n)||n<1) throw new Error('Érvényes vendéglétszám szükséges.');
  throw new Error('A lemondási feltételhez foglalási és érkezési dátum, valamint emberi ellenőrzés szükséges.');
}

export function depositPercentForGuests(guests){
  const n=Number(guests);
  if(!Number.isInteger(n)||n<1) throw new Error('Érvényes vendéglétszám szükséges.');
  const pct=depositPercentForGuestCount(n,SARBERKI_PROFILE.bookingRules);
  if(pct===null)throw new Error('Az előlegszázalék emberi ellenőrzést igényel.');
  return pct;
}

// Legacy demo only: never assert actual bank receipt or reservation finalization.
// This local renderer has no authenticated evidence or execution capability.
export function generateDepositReceivedDraft({language='HU',name='',arrival='',departure='',cabin='',guests}={}){
  const depositPct=depositPercentForGuests(guests);
  const validDay=value=>{
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/u.test(value))return false;
    const d=new Date(value+'T00:00:00Z');
    return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
  };
  if(typeof name!=='string'||!name.trim()||typeof cabin!=='string'||!cabin.trim()||!validDay(arrival)||!validDay(departure)||departure<=arrival)
    throw new Error('A szimulációhoz név, háztípus és érvényes érkezési/távozási időszak szükséges.');
  const lang=String(language).toUpperCase();
  const notices={
    HU:[`SZIMULÁCIÓ – szintetikus teszt, nem vendégnek küldhető levél.`,`Szimulált előleg: ${depositPct}%.`,`Valódi pénzbeérkezés és foglalás-véglegesítés nem történt. A lemondási feltételek külön emberi ellenőrzést igényelnek.`],
    EN:[`SIMULATION – synthetic test, not a guest-facing letter.`,`Simulated deposit: ${depositPct}%.`,`No actual payment receipt or reservation finalization has occurred. Cancellation terms require separate human review.`],
    DE:[`SIMULATION – synthetischer Test, kein Gästeschreiben.`,`Simulierte Anzahlung: ${depositPct} %.`,`Es wurde weder ein tatsächlicher Zahlungseingang bestätigt noch eine Buchung abgeschlossen. Stornobedingungen erfordern eine gesonderte menschliche Prüfung.`],
    SL:[`SIMULACIJA – sintetični test, ni sporočilo za gosta.`,`Simulirano predplačilo: ${depositPct} %.`,`Dejanski prejem plačila ni potrjen in rezervacija ni dokončno potrjena. Pogoje odpovedi mora posebej preveriti človek.`]
  };
  if(!notices[lang])throw new Error('Nem támogatott tesztnyelv.');
  return [...notices[lang],name.trim(),`${arrival} – ${departure}`,cabin.trim(),SARBERKI_PROFILE.brandName].join('\n');
}
