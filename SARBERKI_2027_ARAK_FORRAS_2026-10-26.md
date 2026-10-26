# Sárberki 2027 árak – nyilvános forrásellenőrzés (2026-10-26)

## Státusz: a tulajdonosi oldalon 2026-10-26-án a hat alapárat 2027-re jóváhagyták; automatikus végár még nem engedhető

Forrás: https://sarberkito.hu/accomodation/ (2026-10-26-i nyilvános oldalszöveg).
A szállásoldalon ezek az alapárak szerepelnek, de **a honlap önmagában nem tüntet fel 2027-es érvényességet, de a tulajdonosi oldali felhasználó 2026-10-26-án megerősítette: ezek lesznek a 2027-es alapárak**. A foglalási oldal https://sarberkito.hu/foglalas/ Previo-beágyazást tartalmaz; a dátumra és létszámra számolt 2027-es tarifák nem voltak hitelesen kiolvashatók a vizsgálat során.

| Típus | Honlapon megjelenő induló ár | Alaplétszám | 2027-es érvényesség |
|---|---:|---:|---|
| Családi faház (2–6) | 52 000 Ft/éj | 4 fő | TULAJDONOSI JÓVÁHAGYÁS 2026-10-26 |
| VIP (1) | 60 000 Ft/éj | 4 fő | TULAJDONOSI JÓVÁHAGYÁS 2026-10-26 |
| Deluxe (11–14) | 60 000 Ft/éj | 4 fő | TULAJDONOSI JÓVÁHAGYÁS 2026-10-26 |
| Osztott C (7–10 C) | 44 000 Ft/éj | 4 fő | TULAJDONOSI JÓVÁHAGYÁS 2026-10-26 |
| Osztott A/B (7–10 A/B) | 23 000 Ft/éj | 2 fő | TULAJDONOSI JÓVÁHAGYÁS 2026-10-26 |
| Különálló (15) | 30 000 Ft/éj | 2 fő | TULAJDONOSI JÓVÁHAGYÁS 2026-10-26 |

**Adatminőség:** a honlap különálló ház blokkjának egyik ismétlésében tévesen „4 fő” szerepel, másikban „2 fő”; a háztípus és a projekt logikája alapján 2 fős alaplétszámmal jegyezzük, de a pontos foglalómotor-ár az irányadó. A honlap külön említ +10% főszezoni (július 1.–augusztus 20.) és +20% egyéjszakás felárat, 20% törzsvendégkedvezményt, valamint az energia rezsi külön díját. Ezeket **nem** szabad automatikusan összeszorozva, Previo-tarifa helyett 2027-es végárként ajánlani; ünnepnap, létszám, gyermekek, IFA és szolgáltatások is számítanak.

## Biztonságos beépítési szabály

1. A hat 2027-es alapár tulajdonosi oldalon jóváhagyott forrásadat; ez **nem végrehajtott Previo- vagy éles tarifafrissítés**.
2. Az alapárak `owner_confirmed_2027_base` státuszúak. Egyik sem `verified_previo_total`: vendégnek szóló konkrét 2027-es végárhoz továbbra is időszak, létszám, pótdíjak, kedvezmények, adók és elérhetőség igazolása kell.
3. A `PRICE_SOURCE_STATUS.md` Previo hold/lock kapuját tilos feloldani; éles Previo művelet, foglalás, küldés és PMS-írás tilos.
4. Következő lépés: a tulajdonos által megerősített 2027-es alapárak dátumhatályos konfigurációjának és tesztjeinek elkészítése, valamint a Previo-val való egyeztetés. A 2026-os tarifák változatlanul maradnak.
5. Netlify deploy nem szükséges ehhez a dokumentációs mentéshez; éles/main ágat nem módosítunk.
