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
