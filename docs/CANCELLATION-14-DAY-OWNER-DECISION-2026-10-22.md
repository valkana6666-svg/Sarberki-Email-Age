# Lemondás – egységes 14 napos tulajdonosi döntés

Dátum: 2026-10-22. Kiinduló tesztági HEAD: `47dd24d909e4ea092d2db4c8a31f015ef4211a09`.

A tulajdonos megerősítette: nincs külön30napos csoportszabály; pontosan14nappal érkezés előtti lemondásnál az előleg nem vész el. A folytatásra adott Y ezt az50%-os és80%-os előlegre egyaránt megerősítette.

## Számítás és határ

- A lemondás napja és az érkezés napja közötti naptári különbség számít, nem a foglalás létrehozásától az érkezésig eltelt idő.
- Legalább14nap: a befizetett előleg nem vész el (`not_forfeited`).
- Kevesebb mint14nap, az érkezés előtti érvényes lemondásnál: a befizetett50% vagy80% előleg elvész (`forfeited`).
- A konfiguráció mindkét létszámsávja14napos; a15fős előlegszázalék-küszöb változatlan.
- Hiányos/hibás dátum, lemondást követő foglalási dátum, érkezéskor/utána megadott lemondás vagy nem igazolt előlegszázalék nem ad automatikus megítélést.

## Emberi jóváhagyás és műveleti határ

A `cancellationAutomaticPolicyVerified=false` megmarad. A konkrét tájékoztatóhoz tulajdonosi jóváhagyás, igazolt foglalás és igazolt előlegbeérkezés kell. A számító mindkét eredménynél emberi ellenőrzést kér. A négy nyelvű jóváhagyott szöveg megkülönbözteti a két eredményt; a nem elvesző előleg nem végrehajtott visszafizetés, foglalástörlés vagy küldési engedély.

## Audit

Az új előkészített audit verziója `cancellation_14_day_v2_20261022`. Tartalmazza a lemondás→érkezés számítási alapját, a napok számát,14napos küszöböt és a pontos előlegkimenetet. `refundExecuted=false`, `reservationCancelled=false`, `emailSent=false`. A tisztán helyi előkészítés nem bizonyít adatbázis-perzisztenciát. A szigorú visszaolvasási összevetés a kimenet, számítási alap, verzió és végrehajtási jelző megváltoztatását, hiányzó mezőt és vendégadat-többletet is elutasítja. Korábbi auditbejegyzések és történeti jelentések nincsenek átírva; a régi verzió nem minősíthető az új eredmény igazolásának.

Kizárólag helyi forrás- és szintetikus tesztmódosítás. Nem történt visszafizetés, foglalásmódosítás, email-, Auth-, Gmail-, Previo- vagy cloud-művelet. A korábban jóváhagyott pontos14napos fizetési szabály továbbra is24óra; nem változott.

## Célzott igazolás

**278 PASS / 0 FAIL / 0 SKIP**, 313,151 ms; helyi, kizárólag szintetikus teszt. A korábbi teljes CI-csomagot nem futtattuk újra. Az új13/14/15nap ×50/80% esetek mellett a meglévő HU/DE/EN/SI, előleg-, konfiguráció-, ügyállapot-, publikus válasz- és auditnegatív tesztek is sikeresek. A régi30napos ügyállapot-teszt elvárását az új, egységes14napos szabályra frissítettük. A `git diff --check` hibamentes.

```sh
node --test tests/cancellation-owner-boundary-20261022.test.mjs tests/multilingual-booking-parity-v1.test.mjs tests/deposit-policy-unified-20261021.test.mjs business-config.test.mjs booking-confirmation.test.mjs gmail-normalize.test.mjs tests/case-state.test.mjs tests/guest-reply-boundary.test.mjs
```

Az audit szigorú összevetése a megváltoztatott kimenetet, napértéket, számítási alapot, régi verziót, hamis végrehajtott visszafizetést, hiányzó eredménymezőt és vendégadat-többletet is elutasítja. Ez továbbra sem adatbázisba írás vagy független visszaolvasás bizonyítéka.
