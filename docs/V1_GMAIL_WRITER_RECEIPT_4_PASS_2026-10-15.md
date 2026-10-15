# V1 Gmail → Writer receipt – 4/4 célzott helyi teszt (2026-10-15)

## Tényleges futtatás
A korábban a GitHub `operator-login-ui.mjs` fájljából ellenőrzött `gmailReceiptRequestFromRecord` függvény elkülönített másolatával (`/mnt/data/sarberki_receipt_check/receipt.mjs`) a `gmail-writer-receipt.test.mjs` négy tesztesetének megfelelő ellenőrzéseket futtattuk a helyi `/mnt/data/sarberki_receipt_check/receipt.test.mjs` fájlban.

Parancs: `node --test receipt.test.mjs`.

**TAP eredmény: tests 4, pass 4, fail 0, skipped 0.**

Ellenőrzések:
1. A `tenantId/action/expectedRevision/envelope/sourceReceipt` adatstruktúra megfelelő.
2. Hibás címzett, módosított szöveg, válaszlevél és váratlan mező elutasítva.
3. CRLF eredeti szövegbájtok megmaradnak, ha a kezelői mező LF-et mutat.
4. Hibás Gmail ID, 20 000 karakter feletti törzs és hiányzó feladó elutasítva.

## Korlátok
**Nem** a teljes repository közvetlen importjával és **nem** `npm run test:gmail` / `npm test` parancs futtatásával történt. A helyi tesztfájl a GitHub tesztfájl négy ellenőrzését tükrözi. A GitHub CI, Netlify deployment és a hitelesített Supabase Writer/Reader E2E továbbra is nyitott.

## Biztonság
Nem történt valós Gmail-levél olvasás, küldés, Previo-írás, Pushover-polling, production vagy main módosítás.
