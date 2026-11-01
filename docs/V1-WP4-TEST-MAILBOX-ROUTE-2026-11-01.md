# V1 – 4. munkacsomag (szerver): `booking-cases` → `test-mailbox-ingest` (2026-11-01)

Ág: `gmail-test-subject-allowlist`. Kiinduló HEAD `9a1747f075dd0c0db93fe7623f4461cb4d2b1fbc`. AGENTS.md sha256 `68bdab05…`, változatlan.

## Mi készült
`netlify/functions/booking-cases.mjs` új, alapból tiltott művelete a meglévő WP4a modulra (`shared-core/server-test-mailbox-case.mjs`):
- Feltételek együtt: `CASE_TEST_MAILBOX_INGEST_ENABLED=sarberki-test-fictional-only` (Netlify, alapból nincs beállítva) **és** a meglévő cloud-approval beállítás **és** az adatbázis `sc_test_mailbox_config.enabled` kapcsolója.
- Csak POST, csak cookie-munkamenet (Authorization fejléc mellett tiltott), `tenantId=sarberki-test`, pontosan `{tenantId, action, messageId}`; Writer-jog és CSRF a meglévő `protectedWrite`-tal, a Gmail-olvasás előtt.
- A Gmail-token egyetlen `x-sarberki-gmail-token` fejlécben érkezik; egyszer használt, nem tárolódik, nem kerül a válaszba.
- Rögzített hibakódok (pl. `NOT_MARKED_TEST_MESSAGE` 422, `GMAIL_AUTH_REQUIRED` 401, `FORBIDDEN` 403); minden más `STORAGE_FAILURE` 503.
- Siker: `{result:{caseId:"tm-<messageId>",revision:1}}`, az ügy függőben, `tm_create` audittal.

## Bizonyíték
- `tests/booking-cases-test-mailbox.test.mjs`: a valódi szerverkezelő és cookie-munkamenet, PGlite a hosztolt rétegsoron; 6 részteszt (alapból tiltva; Reader/CSRF/idegen tenant/többletmező/hibás azonosító/hiányzó vagy dupla token-fejléc → Gmail-hívás nélkül elutasítva; Bearer mellett tiltott; „Re:” → 422; adatbázis-kapcsoló ki → 403; Writer → mentés, duplikátum → 503).
- Teljes `npm test` zöld. Mutációk: env-kapcsoló, cookie-kötés, írási jog, mezőkorlát, dupla fejléc → mind bukik; a nyers hibaszöveg továbbítása kívülről nem váltható ki (a modul már rögzített kódot ad), ez mélységi védelem.

## Nem igazolt / következő
- Hosztolt migráció (`deployment/test-mailbox/install.sql`), Netlify-kapcsoló, telepítés: tulajdonosi döntés.
- Napi felület („Ügyként mentés”, visszaküldés/elutasítás gombok, tesztlevél-ügyek megjelenítése) és a `sc_tm_redraft`/`sc_tm_decide` szerveroldali műveletei: következő lépés.

## Kiegészítés: `test-mailbox-redraft` és `test-mailbox-decide`
- Ugyanazok a kapcsolók és a cookie+CSRF-feltétel; ügyazonosító csak `tm-<hex>`.
- `test-mailbox-redraft`: `{tenantId, action, caseId, expectedRevision, draftText}`, Writer (`protectedWrite`) → `sc_tm_redraft`.
- `test-mailbox-decide`: `{tenantId, action, caseId, expectedRevision, reviewedDraftHash, decision, reason?}`, `decision` ∈ approve/return/reject, `reason` legfeljebb 500 karakter, sortörés nélkül; Approver (`protectedApproval`) → `sc_tm_decide` (a szerzőtől független jóváhagyót az adatbázis kényszeríti).
- Válasz: `{result:{caseId, revision, approval}}`; régi revízió → 409 `CASE_CONFLICT`; az adatbázis állapot-, hash- vagy változatlan-tervezet-elutasítása → 409 `TEST_MAILBOX_REJECTED`; jogosultság → 403.
- Tesztek a valódi szerverkezelőn (PGlite): kikapcsolva tiltott; hibás mezők/döntés/indok/ügyazonosító; Bearer; hiányzó CSRF; Writer és Reader nem dönthet; visszaküldés → változatlan tervezet elutasítva → új tervezet → független jóváhagyás; régi revízió és rossz hash; ismételt döntés; a szerző (approve joggal is) nem hagyhatja jóvá; elutasítás → újranyitás → jóváhagyás, előzmények megmaradnak; audit `tm_create, tm_return, tm_redraft, tm_approve`. 6 mutáció mind bukik.

## Kiegészítés: napi kezelő bekötése (olvasás + műveletek)
- Szerver: `daily-list` bekapcsolt állapotban a `tm-<hex>` ügyeket is listázza (`kind:'test-mailbox'`, pending → Jóváhagyásra vár, egyéb → Folyamatban). Új GET `test-mailbox-record` (cookie + olvasási jog, csak `action,caseId,tenantId`): üzenetek, ügyadatok, utolsó tervezet + SHA-256 hash, döntési előzmények, belső jóváhagyás (kapacitás/ár nem igazolt, küldés/foglalás tiltva) és `canEditDraft`/`canDecide` megjelenítési jelzés. Titok, token, HMAC nem kerül a válaszba; a jogosultságot és a független jóváhagyót továbbra is az adatbázis kényszeríti.
- Kliens: „Ügyként mentés” csak jelölt, hex Gmail-azonosítós tesztlevélnél; kattintásra friss, csak olvasási Google-token, amelyet egyetlen kérés `X-Sarberki-Gmail-Token` fejlécében kap meg a szerver (a kérésmodul más fejlécet nem enged; nincs tárolás). Mentés után az ügylista újratöltődik és megnyílik az ügy.
- Ügynézet: Writer új tervezetet menthet (`test-mailbox-redraft`); független Approver megerősítő jelölés után jóváhagyhat, illetve indoklással visszaküldhet vagy elutasíthat (`test-mailbox-decide`, várt revízió + átnézett hash). Csak pontosan a következő revízió és a várt állapot fogadható el; utána visszaolvasás. Hiba → nincs automatikus ismétlés.
- Bizonyíték: `tests/booking-cases-test-mailbox.test.mjs` (11), `tests/napi-kezelo.test.mjs` (teljes Writer → Approver visszaküldés → újratervezés → elutasítás → újranyitás → jóváhagyás kör, revízió-eltérés, konfliktus), `tests/napi-email.test.mjs` (mentés jogosultsága, zárt fixture és válaszlevél nem menthető), `tests/cloud-case-request.test.mjs` (fejléc-fehérlista). Mutációk (8) mind bukik. Chromium mobil böngészőpróba 21/21 PASS.
- NEM IGAZOLT: hosztolt migráció, Netlify-kapcsoló, telepítés, élő Gmail → ügy → jóváhagyás folyamat, fizikai iPhone.
