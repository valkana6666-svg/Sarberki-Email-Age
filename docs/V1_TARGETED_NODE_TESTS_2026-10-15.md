# V1 célzott Node-tesztek – újrafuttatás, 2026-10-15

## Ellenőrzött helyi eredmény
2026-10-15-én az elkülönített helyi ellenőrző könyvtárakban **tényleges Node.js v22.16.0 tesztfuttatás** történt:

- `/mnt/data/sarberki_receipt_check`: `node --test receipt.test.mjs` → **2 PASS, 0 FAIL**.
- `/mnt/data/sarberki-health-check`: `node --test health-status.test.mjs` → **2 PASS, 0 FAIL**.
- Összesen **4 PASS, 0 FAIL**.

A receipt teszt a GitHubról korábban ellenőrzött `gmailReceiptRequestFromRecord` függvény elkülönített másolatán futott. A health teszt a külön letöltött fájlmásolatokat használta. **Ezek nem az aktuális teljes repository közvetlen `npm test` futtatásai**, ezért CI-státuszt nem igazolnak.

## Felhős állapot
A teszt-Netlify `https://leafy-chimera-2403e5.netlify.app/api/health` végpontját ellenőrizni próbáltuk, de az elérési kísérlet nem adott ellenőrizhető HTTP/JSON választ. **Nem állítjuk, hogy a tesztoldal leállt, és azt sem, hogy a legutóbbi commit deployolva van.**

## Következő kapu
1. Teszt-Netlify health JSON `deployedCommit` mezőjének összevetése a `gmail-test-subject-allowlist` commitjával.
2. Teljes `npm test` / `npm run test:gmail` a repositoryban vagy CI-ben.
3. Csak ezután hitelesített szintetikus Gmail → Writer → Reader → audit E2E; ha kezelői bejelentkezés kell, felhasználói hitelesítés a védett felületen.

Nincs production/main változtatás, Gmail-küldés, Previo-írás vagy Pushover-polling.
