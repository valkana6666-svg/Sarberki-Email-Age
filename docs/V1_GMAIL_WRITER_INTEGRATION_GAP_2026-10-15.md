# V1 kritikus integrációs rés – Gmail böngészős útvonal vs. felhős Writer (2026-10-15)

## Statikus bizonyíték a tesztágon
- `gmail-readonly.js` `displayMessage` (168–176): a Gmail rekordot `displayGmailRecord` kezeli, és csak annak sikeres visszatérése után jelöli helyileg olvasottnak a levelet.
- `index.html` `displayGmailRecord` (458–493): az elemző gombot meghívja, majd `window.SarberkiBookingRuntime.cases.get(record.booking_case_id)` és a helyi draft ellenőrzése után tér vissza sikerrel. A komment maga is rögzíti: **helyi tesztmentés, nem felhős szerveroldali ügytár**.
- `netlify/functions/booking-cases.mjs` (105): külön felhős `ingest-and-draft` művelet létezik, amely a Writer-engedélyezési és perzisztenciaútvonal része.

## Következtetés
A Gmail UI jelenlegi `displayGmailRecord` sikere **nem bizonyítja**, hogy a felhős Writer ügy és tervezet mentődött, vagy hogy a Reader látja. A teljes Gmail→Writer→Reader→jóváhagyás E2E emiatt nyitott V1-kritikus bizonyítékhiány. Ez nem állítás arról, hogy más UI-ban vagy szintetikus tesztekben ne létezne felhős Writer folyamat.

## Célzott, biztonságos megoldási irány
1. Vizsgáljuk meg a meglévő Writer kliens és `ingest-and-draft` API által elvárt `envelope`, `values`, `sourceReceipt` alakot, az Auth és CAS követelményeket. Ne hozzunk létre párhuzamos ügytárat.
2. A Gmail böngészős útvonal csak **igazolt szerveroldali Writer mentés és Readerrel visszaolvasható ügy** után jelölhessen feldolgozottnak; sikertelen vagy hiányzó jogosultságnál maradjon olvasatlan, hibával.
3. Szintetikus Gmail-rekorddal teszteljük: sikeres mentés, jogosulatlan Writer elutasítása, Reader olvasás/írás tiltás, ismételt levél deduplikáció, revision/CAS, jóváhagyási audit.
4. Éles Google OAuth vagy felhős teszt csak a kijelölt tesztfiókkal, emberi bejelentkezés szükségessége esetén megállva.
5. Pushover automatikus figyelés, valódi vendégadat, e-mail-küldés, Previo-írás és production/main módosítás tilos.

## Státusz
Csak kódaudit, nem teljes E2E futtatás; kódot és külső rendszert nem módosítottunk. **V1 kritikus ellenőrzési tétel.**
