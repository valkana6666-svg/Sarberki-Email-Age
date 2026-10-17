# Többnyelvű V1 implementációs átadás

Állapot: kódstruktúra alapján készített végrehajtási terv; nem futtatott tesztek.

## Meglévő kiindulópont
A package.json `npm test` parancsa `*.test.mjs`, `price-source/*.test.mjs`, `price-source/recorded-previo-test.mjs` és `tests/*.test.mjs` fájlokat futtat. A README szerint az `/api/price-quote` és a `price-source/sarberki-public-booking.mjs` csak olvasásra használható, a válasz `review_required`, az osztott A/B/C élő mappingje még nincs kész.

## Fejlesztési feladatok Codex/Work részére
1. Azonosítsd a tényleges szabálymotor és nyelvi renderelő modulokat; ne készíts párhuzamos szabálymotort.
2. Szintetikus fixture-ökön futtasd le a HU/DE/EN/SI nyelvi paritást: az üzleti döntés, ár és elérhetőség legyen azonos; csak a fordítás változzon.
3. Külön teszteld a dátum/létszám/háztípus/gyermek/előleg/törzsvendég/dézsa határértékeket a `multilingual-booking-v1-test-matrix-2026-10-17.md` alapján.
4. Vizsgáld a nyelv megőrzését az űrlap→tervezet→kezelői jóváhagyás útvonalon, de ne küldj levelet.
5. Az élő honlap HU/DE menüit és foglalási folyamatát külön böngészős, mellékhatás nélküli tesztben auditáld; a GitHub tesztalkalmazás nem azonos a nyilvános honlappal.
6. Minden új teszthez PASS/FAIL, commit, CI URL és szintetikus bemenet tartozzon. A már sikeres teszteket ne futtasd újra indokolatlanul.

## Tiltások
Kizárólag gmail-test-subject-allowlist ág. Main, production, valós vendégadat, e-mail-küldés, Previo-írás és automatikus foglalás-véglegesítés tiltott. A 2027-es árakat nem szabad kitalálni. Ha külső belépés szükséges, kérj célzott emberi jóváhagyást.
