# Bizonytalan szolgáltatásigény emberi összerendelése – 2026-10-16

Kiindulás: kizárólag `gmail-test-subject-allowlist`; HEAD `1fb436a6d4938daa78c138fe4e93b3a538cc07ca` dokumentáció, kód `3570934f9e7bc393c61e7783a4b7e5573b5a2dd2`. Az utóbbi [CI-je](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38891485291) sikeres: 1575 PASS / 0 FAIL / 0 SKIP. Ezt a korábbi tesztkört helyben nem ismételtük.

## Változás

A `service_link_review` ügy rendezése külön, védett `sc_service_link_decisions` rekordba kerül. A szerver a tényleges Auth-felhasználó friss tenanttagságából ellenőrzi az írási és jóváhagyói jogot, a feladó egyezését, a két ügy típusát és verzióját. A tranzakció zárolja mindkét ügyet, a célfoglalást nem módosítja; kizárólag a felülvizsgálati ügy verziója változik. A döntés indoka, aktora és időpontja visszaolvasható, és a meglévő audit ugyanabban a tranzakcióban készül. Új forrás- vagy célügyverzió elavulttá teszi a kapcsolatot.

A Reader a bizonytalanság okát és a rendezés állapotát olvashatja. A rendező kezelőszervekhez külön szerveres jogosultságvizsgálat kell. A kliens által írható ügy-JSON nem hiteles döntési forrás. A rendezés nem szolgáltatásjóváhagyás, elérhetőségi igazolás vagy küldési engedély.

## Igazolás

- Célzott csomag: `node --test tests/service-link-resolution.test.mjs tests/service-link-backup.test.mjs tests/synthetic-server-preview.test.mjs tests/operator-cookie-session.test.mjs tests/server-case-service.test.mjs` → **59 PASS / 0 FAIL / 0 SKIP**. Valódi PostgreSQL/PGlite: anon/Reader/Writer-only tiltás, tenant, CAS, feladó és célügy ellenőrzés, JSON-hamisítás, audit/hash és célfoglalás megőrzése. Mock cookie/UI: CSRF, friss tagság, Reader kezelőszervek tiltása, munkamenet-/kiválasztásváltás. A backup új sémaverziója hatodik táblát követel, a korábbi archívumhoz explicit v1 ellenőrzés maradt.
- 9 JavaScript-fájl és az inline UI szintaktikája, valamint `git diff --check`: PASS.
- A CLI-vel létrehozott `20261016111515_service_link_resolution.sql` migráció sikeresen alkalmazva kizárólag `sarberki-test` (`mojnqizbcaczstguikpv`) projektben. Metadata-visszaellenőrzés: RLS aktív, egy SELECT-policy; authenticated SELECT igen, INSERT/UPDATE/DELETE nem; anon RPC execute nem. A meglévő `sc_write_case`, `sc_approve_case`, `sc_has_permission` definícióinak ellenőrzőösszege változatlan.
- A Supabase advisor új bejegyzése az authenticated által hívható, szándékosan védett definer RPC. Ezt explicit `auth.uid()` + DB-jogosultság/tenant/CAS vizsgálat védi; a [figyelmeztetés leírása](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). A többi advisor-bejegyzés már a migráció előtt jelen volt.
- Első kódcommit: `a50ba89433b2f63c575df25ecfab63e4e4e472c2`. [Első teljes CI](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38894710956): **1578 PASS / 2 FAIL / 0 SKIP**. A restore fixture még csak az alapmigrációt töltötte, ezért az új manifest nem találta a döntéstáblát; a Reader mezőszámteszt pedig hét mezőt várt az új, külön ügykapcsolási mező mellett is. Célzott javítás és új CI szükséges; ez nem sikeres teljes ellenőrzés.
- Javítás: a restore fixture az új migrációval és egy valódi RPC-döntéssel együtt ment/visszaállít, majd ellenőrzi a döntést, RLS-t, Reader írástiltását, tenantot, audit/hash/checksum értékeket és a célfoglalás változatlanságát. A Reader teszt a hét szolgáltatásmezőt név szerint, a külön ügykapcsolási metaadatot külön ellenőrzi. `node --test tests/supabase-policy.test.mjs tests/tub-linked-service.test.mjs` → **20 PASS / 0 FAIL / 0 SKIP**. Nem adandó össze a korábbi 59-cel különálló teljes tesztlefedettségként. Kód- és SQL-változtatás nem kellett.
- Pontos teszthost-build és felhős kezelői összerendelés jelenleg **NEM IGAZOLT**; a felhős séma ellenőrzése nem Auth/E2E bizonyíték. Nem történt admin SQL-es ügyírás vagy valódi adat használata.

## Következő feladat és korlát

Az A ellenőrzése után B: konkrét házhoz, teljes időszakhoz, hiteles és érvényes forráshoz kötött dézsaelérhetőség. Hiteles adatforrás nélkül NEM IGAZOLT. Ezután C: külön, auditált szolgáltatásjóváhagyás. Production, main, valódi vendégadat, e-mail/Pushover és Previo változatlanul kívül esik az engedélyezett munkán.

V2/V3-érték: a jelenlegi Auth/tenant/CAS/audit határ újrafelhasználása, külön védett szolgáltatásdöntéssel. Nem készült új válaszmotor vagy külső végrehajtási képesség.
