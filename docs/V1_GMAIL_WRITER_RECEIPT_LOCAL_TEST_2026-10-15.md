# V1 Gmail → Writer receipt – célzott helyi ellenőrzés (2026-10-15)

## Tényleges eredmény
A `operator-login-ui.mjs` fájlból ellenőrzött `gmailReceiptRequestFromRecord` függvény törzsét izolált helyi Node.js-modulba másoltuk, és a `gmail-writer-receipt.test.mjs` két tesztesetét azonos ellenőrzési állításokkal futtattuk.

Parancs: `node --test receipt.test.mjs`

**Eredmény: 2 PASS, 0 FAIL.**

Ellenőrzött: helyes `tenantId/action/expectedRevision/envelope/sourceReceipt`, hibás címzett, módosított levélszöveg, válaszlevél és váratlan extra mező elutasítása.

## Korlátok
Ez **a függvény kinyert másolatának célzott futtatása**, nem a repository teljes `npm test` futtatása és nem a teljes `operator-login-ui.mjs` importálásával futtatott teszt. GitHub Actions CI, Netlify deployment, Supabase Writer/Reader, Gmail OAuth és élő E2E **nem igazolt** ezzel. A GitHub tesztágban a `gmail-writer-receipt.test.mjs` továbbra is szerepel, és a teljes tesztparancs kiválasztja.

## Következő teendő
Teljes tesztág CI/futtatás, majd hitelesített zárt szintetikus Gmail → Writer → Reader E2E a kijelölt tesztoldalon. Production/main, Previo-írás és Gmail-küldés tilos.
