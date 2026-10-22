# Pontosan 14 napos fizetési határ – tulajdonosi döntés

Dátum: 2026-10-22. Kiinduló tesztági commit: `ad0127450c6e88730c7a9b3d21a2056665c7ae5d`.

A tulajdonos a „pontosan 14 napnál 24 óra vagy 7 nap?” kérdésre kifejezetten **24** választ adott. Ez kizárólag az előleg beérkezési határidejét rendezi; nem lemondási vagy automatikus foglalási felhatalmazás.

## Aktuális szabály

- Kevesebb mint 15 vendég: 50% előleg; legalább 15 vendég: 80%.
- Az érkezésig **legfeljebb 14 naptári nap**, a 14. napot is beleértve: **24 óra** a beérkezési ablak.
- Több mint 14 naptári nap: 7 nap, azaz 168 eltelt óra.
- Offsetes foglalási időpontnál a naptári napot Europe/Budapest szerint értelmezzük; az eltelt 24/168 óra UTC-ben számolódik.
- Konkrét határidőhöz továbbra is igazolt foglalási időpont és érvényes dátumok szükségesek. A számítás nem igazol pénzbeérkezést és nem véglegesít foglalást.

## Elválasztott lemondási döntés

A lemondásra a tulajdonos most nem adott új szabályt. A `cancellationAutomaticPolicyVerified=false` megmarad, a pontosan 14 napos lemondási értékelés továbbra is emberi felülvizsgálatot kér. A konkrét ügyben kifejezetten ellenőrzött lemondási feltétel meglévő jóváhagyási útja változatlan.

## Megvalósítás

Az aktuális központi konfiguráció `depositExactBoundaryRequiresReview=false`, forrása a 2026-10-22-i tulajdonosi pontosítás. A meglévő számító ezért pontosan 14 napra is 24 órát ad. Más, nem jóváhagyott konfigurációban a kapcsoló igaz vagy hiányzó értéke továbbra is lezárja az adott határt emberi ellenőrzésre.

A HU/DE/EN/SI közös mag, publikus válasz, chatbot és legacy ártervezet szövegei egységesen a legfeljebb14nap/24óra szabályt követik. A publikált régi `index 2.html` megmaradt automatikus14napos lemondási ígérete is emberi ellenőrzésre módosult, új lemondási szabály bevezetése nélkül. A `szabalyok.txt` aktuális szabályleltár frissült; a korábbi dátumozott jelentések történeti állításai változatlanok.

Kizárólag helyi kód- és szintetikus tesztmódosítás. Auth, Gmail, Previo és cloudadat nem változott. Kapacitási/elhelyezési algoritmus nem változott. Commit és telepítés a koordinátor feladata.

## Célzott ellenőrzés

Egyetlen célzott futás: **612 PASS / 0 FAIL / 0 SKIP**, 1462,354 ms. Kizárólag szintetikus adatok, helyi Node/VM és statikus build; nem friss Gmail-, OpenAI-, Previo- vagy valódi iPhone-teszt. A teljes korábbi1864tesztes készletet nem futtattuk újra. A `git diff --check` hibamentes.

Parancs:

```sh
node --test booking-confirmation.test.mjs business-config.test.mjs price-check.test.mjs gmail-normalize.test.mjs email-price-chain.test.mjs tests/deposit-policy-unified-20261021.test.mjs tests/multilingual-booking-parity-v1.test.mjs tests/business-profile.test.mjs tests/booking-boundaries-regression-20261012.test.mjs tests/case-state.test.mjs tests/guest-reply-boundary.test.mjs tests/email-stress.test.mjs tests/chatbot-v1.test.mjs tests/chatbot-auto-language.test.mjs tests/static-chatbot-build.test.mjs
```

A célzott regresszió tartalmazza a 14/15/16 fős és13/14/15napos mátrixot, a Budapest-időzóna szerinti napváltást, azonos pillanatot jelentő eltérő offseteket, hibás/hiányos adatokat, a továbbra is nem jóváhagyott konfiguráció lezáró fallbackjét és a lemondási döntés elkülönítését. A HU/DE/EN/SI aktuális tervezetekben a jóváhagyott24órás határidő megjelenik; a nyilvános/chatbot/legacy kimenetek nem kérnek többé külön döntést pusztán a pontos14napos fizetési határ miatt.
