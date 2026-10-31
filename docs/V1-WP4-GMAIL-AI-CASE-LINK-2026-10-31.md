# V1 – 4a. munkacsomag: Gmail → közös AI → tesztügytár szerveroldali összekötés (2026-10-31)

Ág: `gmail-test-subject-allowlist`. Kiinduló HEAD `9dec66d1a15ff4c2d85538606d680decd45a201b`. AGENTS.md blob a HEAD-en olvasva.

## Választott, legkisebb út
Új, kis szerveroldali modul (`shared-core/server-test-mailbox-case.mjs`, a `server-` előtag miatt nem kerül a `dist`-be), amely kizárólag meglévő részeket köt össze: WP2 `readVerifiedTestMailboxMessage` + `attestTestMailboxSource` → a közös motor (`createBookingCaseStore`, `extractServerMessage`, `serverInquiryOptions`, `buildEmailInquiryDraft`) → WP3 `sc_tm_create` RPC a kezelő saját Supabase-munkamenet-transportján. Nincs új válaszmotor, nincs service role, nincs SQL-változás.

## Valódi hiba, amit a teszt talált
A közös motor friss ügyre `linkReview:null` kulcsot ír; az `sc_tm_create` a kulcs puszta jelenlétét elutasítja (`?|`). Javítás: a modul eltávolítja a null kulcsot; nem null `linkReview` vagy `caseKind` esetén elutasít (nem tesztlevél-ügy).

## Bizonyíték
- `tests/server-test-mailbox-case.test.mjs` (hamis Gmail + hamis transport, kitalált adat): pozitív eset (RPC-törzs az `sc_tm_create` elvárt alakjával, tiltott kulcsok nincsenek, szerver által kinyert dátumok, tervezet, token és kulcs nem kerül tárolásba, a tanúsítás újraszámolható, rossz kulccsal nem); 7 Gmail-kapu negatív (nem jelölt tárgy, válasz, idegen/két címzett, csak HTML, üres, hiányzó Message-ID) és hibás token/üzenetazonosító – ezeknél tárolási hívás nincs; setup- és tárolási hibák rögzített kóddal, szivárgás nélkül, pontosan egy írási kísérlettel.
- Mutációk: a `linkReview` törlésének kihagyása és hibás tanúsítás küldése is bukik a teszten.
- Célzott teszt: 3 PASS / 0 FAIL. Teljes `npm test` ebben a környezetben: 2348 PASS / 24 FAIL / 0 SKIP; mind a 24 `ERR_MODULE_NOT_FOUND @electric-sql/pglite` (az npm-regiszter a munkamenet szabálya miatt 403) – környezeti korlát, a CI-n kell megismételni.

## NEM IGAZOLT
- A modul és az `sc_tm_create` valódi PostgreSQL-motoron együtt (PGlite itt nem telepíthető) – a CI-n vagy engedélyezett környezetben kell futtatni.
- Netlify-útvonal/kapcsoló (`booking-cases` új művelet), hosztolt migráció, napi felület (4b), iPhone, élő Gmail → AI → kezelő → jóváhagyás.
- CI-állapot (GitHub-hozzáférés ebben a munkamenetben nem engedélyezett).

## Következő konkrét feladat
Egy PGlite-alapú teszt, amely a modul valódi kimenetét (hamis Gmail) az `sc_tm_create`-be adja (a WP3 teszt rétegsorán), majd a `booking-cases` új, alapból tiltott művelete a modulra, cookie-munkamenettel és Writer-joggal; hosztolt telepítés csak tulajdonosi döntéssel.
