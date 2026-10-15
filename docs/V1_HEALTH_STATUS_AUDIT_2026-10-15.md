# V1 – health végpont és Previo kapuk ellenőrzése (2026-10-15)

## Források
`netlify/functions/health.mjs`, `netlify/functions/price-quote.mjs`, `netlify/functions/availability-options.mjs`, `gmail-policy.mjs`, `scripts/build-static.cjs` a `gmail-test-subject-allowlist` tesztágon.

## Újonnan feltárt, igazolt eltérések a kódban
1. A `/api/health` jelenleg statikusan `livePriceVerified: true` értéket ad vissza, miközben a `price-quote.mjs` élő Previo árajánlatot csak `PREVIO_READ_SAFETY_VERIFIED==='true'` mellett enged. A biztonsági kapu bekapcsolását a korábbi Previo audit kifejezetten tiltja, amíg a foglalásmentesség nincs bizonyítva. **A health mező önmagában nem igazolja az élő árazás működését.**
2. A health `gmailMode: 'readonly-approved-subjects'` feliratot közöl, miközben a jelenlegi `gmail-policy.mjs` és `gmail-readonly.js` Inbox/dátum/tesztfiók szűrést használ, nem tárgy-allowlistet. **A health státusz félreérthető vagy elavult.**
3. Az `/api/availability-options` élő kapacitáslekérő külön `PREVIO_CAPACITY_READ_SAFETY_VERIFIED==='true'` kapcsolót és legalább 32 karakteres Bearer teszttokent kér, csak a teszt-Netlify hoston. A `price-quote` saját külön biztonsági kaput használ. A két kapcsoló eltérő; egyiket sem szabad pusztán a health alapján aktiválni.
4. A build-szkript `write-build-info.cjs` segítségével állít elő buildadatokat; a telepített `deployedCommit` ellenőrzéséhez tényleges teszt-Netlify válasz szükséges.

## Ellenőrzés korlátai
A tesztoldal `/api/health` élő URL-jét megpróbáltuk megnyitni, de a hozzáférés az eszközből nem sikerült. **Nem állítjuk, hogy a telepített health jelenleg ugyanezt adja vissza**, vagy hogy a deployment friss. Ez statikus forráskód-audit.

## Ajánlott következő kódjavítás – csak célzott teszttel
- A health `livePriceVerified` mezője ne állítson statikus sikert. Jelenjen meg külön a kódba épített képesség, a kapu aktuális állapota és a tényleges élő ellenőrzés bizonyítéka; titkokat ne adjon vissza.
- A `gmailMode` értékét a tényleges Inbox/dátum/tesztfiók szabályhoz kell igazítani.
- Készüljenek célzott regressziós tesztek a health státusz és a kapuk ellentmondásainak kizárására.
- Az OAuth Gmail→Writer→Reader E2E továbbra is elsőbbségi; Previo élő lekérdezés és automatikus értesítés tilos igazolás/engedély nélkül.

A production és main változatlan; a health kódját nem módosítottuk. Ez az audit a Work/Codex számára pontosan körülhatárolt javítási feladat.
