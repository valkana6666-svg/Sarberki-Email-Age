# Sárberki 2027 árak – nyilvános forrásellenőrzés (2026-10-26)

## Státusz: 2027-es tarifa NEM igazolt; automatikus árajánlatba NEM engedhető

Forrás: https://sarberkito.hu/accomodation/ (2026-10-26-i nyilvános oldalszöveg).
A szállásoldalon ezek az alapárak szerepelnek, de **nincs feltüntetve, hogy 2027-re érvényesek**. A foglalási oldal https://sarberkito.hu/foglalas/ Previo-beágyazást tartalmaz; a dátumra és létszámra számolt 2027-es tarifák nem voltak hitelesen kiolvashatók a vizsgálat során.

| Típus | Honlapon megjelenő induló ár | Alaplétszám | 2027-es érvényesség |
|---|---:|---:|---|
| Családi faház (2–6) | 52 000 Ft/éj | 4 fő | NEM IGAZOLT |
| VIP (1) | 60 000 Ft/éj | 4 fő | NEM IGAZOLT |
| Deluxe (11–14) | 60 000 Ft/éj | 4 fő | NEM IGAZOLT |
| Osztott C (7–10 C) | 44 000 Ft/éj | 4 fő | NEM IGAZOLT |
| Osztott A/B (7–10 A/B) | 23 000 Ft/éj | 2 fő | NEM IGAZOLT |
| Különálló (15) | 30 000 Ft/éj | 2 fő | NEM IGAZOLT |

**Adatminőség:** a honlap különálló ház blokkjának egyik ismétlésében tévesen „4 fő” szerepel, másikban „2 fő”; a háztípus és a projekt logikája alapján 2 fős alaplétszámmal jegyezzük, de a pontos foglalómotor-ár az irányadó. A honlap külön említ +10% főszezoni (július 1.–augusztus 20.) és +20% egyéjszakás felárat, 20% törzsvendégkedvezményt, valamint az energia rezsi külön díját. Ezeket **nem** szabad automatikusan összeszorozva, Previo-tarifa helyett 2027-es végárként ajánlani; ünnepnap, létszám, gyermekek, IFA és szolgáltatások is számítanak.

## Biztonságos beépítési szabály

1. Ez **forrásadat-dokumentáció**, nem végrehajtott 2027-es tarifafrissítés.
2. Egyetlen fenti szám sem kaphat `verified_2027` státuszt; egyetlen összeg sem használható 2027-es vendégválaszban hiteles Previo-ár vagy kezelői igazolás nélkül.
3. A `PRICE_SOURCE_STATUS.md` Previo hold/lock kapuját tilos feloldani; éles Previo művelet, foglalás, küldés és PMS-írás tilos.
4. Következő lépés: 2027-es dátumokra hivatalos, biztonságos Previo árlista/export vagy kezelő által igazolt ártábla összevetése típusonként és szezononként, ezután dátumhatályos konfiguráció és tesztek. 2026-os tarifák változatlanul maradnak.
5. Netlify deploy nem szükséges ehhez a dokumentációs mentéshez; éles/main ágat nem módosítunk.
