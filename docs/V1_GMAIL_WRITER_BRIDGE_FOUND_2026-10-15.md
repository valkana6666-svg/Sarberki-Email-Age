# V1 Gmail → Writer híd – pontosított ellenőrzés (2026-10-15)

## Újonnan megtalált, meglévő implementáció
Az előző `V1_GMAIL_WRITER_INTEGRATION_GAP_2026-10-15.md` helyesen jelezte, hogy a `gmail-readonly.js` → `index.html/displayGmailRecord` útvonal **önmagában** csak helyi tervezetet igazol. Ez azonban **nem jelenti, hogy hiányzik a felhős Writer-híd**.

A `operator-login-ui.mjs` már tartalmaz **külön, kifejezetten indított felhős mentést**:
- `gmailReceiptRequestFromRecord` (11–26): szigorú Gmail-forrás alak, címzett, üzenetazonosító és szövegegyezés ellenőrzése; `tenantId: sarberki-test`, `action: ingest-and-draft`, `expectedRevision: 0`, `sourceReceipt`, `envelope`.
- `saveExactReceipt` (122–140): a kiválasztott Gmail-rekordból Writer mentést kér a `/.netlify/functions/booking-cases` végponton, CSRF tokennel és aktív kezelői munkamenettel; ellenőrzi a szerver `new`/`duplicate` eredményét és az izolált ügyazonosítót; Reader előnézeti mezőket kitölti.
- `saveClosedMail` (102–121): zárt szintetikus MIME tesztmintával ugyanez a felhős `ingest-and-draft` útvonal, külön Writer gombbal.
- A szerver `netlify/functions/booking-cases.mjs` cookie-üzemmódban a `ingest-and-draft` műveletet csak a zárt szintetikus levél vagy pontos privát Gmail receipt bizonyítéka mellett engedi; `protectedWrite` ellenőrzi a kezelő jogosultságát.

## Pontosított V1 státusz
- **Meglévő híd: kódban igazolt.** Nem szükséges párhuzamos Gmail→Writer integrációt fejleszteni.
- **Felhős mentés és Reader-visszaolvasás: élőben még nem igazolt ebben az auditban.** A böngészőben a felhasználó külön kattintással kezdeményezi a Writer-mentést, nem automatikusan Gmail-olvasáskor. Ez biztonságos, szándékos elkülönítés.
- A szerveroldali `exactReceipt` engedélyezéshez privát konfiguráció és hitelesített tesztkezelő szükséges; nem kerülhetnek titkok a chatbe.
- Az `operator-login-ui.mjs` általános felületi session jelzője `cookieReadOnly: true`, de az egyes POST műveletek külön szerveroldali `protectedWrite` jogosultságellenőrzést kapnak. A UI-állapot nem helyettesíti a szerver döntését.

## Következő lépések
1. Az izolált tesztoldalon ellenőrizni a tényleges deployment commitot.
2. A zárt szintetikus mintát betölteni; Writer jogosultságú tesztkezelővel külön mentés, szerver caseId/revision visszaigazolás.
3. Reader előnézet és írás tiltás; felhős emberi jóváhagyás és audit külön igazolása.
4. Az élő Gmail receipt csak a kijelölt Gmail-tesztfiókkal, `gmail.readonly` és pontos privát receipt konfiguráció mellett; nem automatikus küldés.
5. Previo írás, élő nem igazolt lekérdezés és Pushover polling továbbra is tilos.

Ez statikus kódaudit, nem élő E2E. Az előző gap-jelentés az **automatikus Gmail UI útvonal korlátjára** továbbra is érvényes, de a hiányzó integráció feltételezését ez a dokumentum pontosítja.
