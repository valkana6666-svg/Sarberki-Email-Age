# Elkülönített emberi dézsajóváhagyás – 2026-10-16

Kiindulás: `0f49049e08a12c17a21601961e83c695f1682637`, [CI](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38895524044) **1591 PASS / 0 FAIL / 0 SKIP**, pontosan azonos teszthost-build. Kizárólag `gmail-test-subject-allowlist`; production és main érintetlen.

## Kötelező szerződés

A szolgáltatásjóváhagyás külön védett, auditált döntés; nem módosíthatja vagy pótolhatja a szállásfoglalás jóváhagyását. A konkrét ügy/verzió, kapcsolódó célfoglalás/verzió, aktuális vendégkérés, ház, erőforrás, teljes időszak és hiteles bizonyíték együtt érvényes. Új levél, megváltozott ügy/céladat vagy lejárt bizonyíték után a korábbi jóváhagyás nem aktuális.

A kezelő által írható ügy-JSON (`bookingContext.verified`, `linkedCaseId`, `available` stb.) önmagában nem hiteles ház- vagy elérhetőségi forrás. A hiteles szerveroldali kötésnek a `BUSINESS.timezone` szerint egyeznie kell a kért dátummal, kezdéssel és teljes időtartammal. A B modul új ellenőrzése szükséges a döntés előtt. Kliens és e-mail bizonyítékot vagy jogosultságot nem adhat.

Az automatikusan kapcsolt normál foglalási ügy és az A-ban emberrel rendezett `service_link_review` ugyanazt a közös szerveres döntési határt használja. A Reader kizárólag olvashat. Nincs küldés, szolgáltatásfoglalás, árígéret vagy automatikus visszaigazolás.

## Igazolás

Elkészült a szerveres orchestrator, a külön `sc_service_approvals` döntéstábla és `sc_approve_tub_service` RPC, a repository/service és cookie/CSRF handler bekötése, valamint az explicit olvasási/emberi döntési panel. A szolgáltatásdöntés append-only rekordja aktort, időpontot, teljes aláírt bizonyítékkört és payload-digestet tárol; a case JSON, case revision és szállásjóváhagyás változatlan. A meglévő titkos attesztációs kulcs és MAC-helper külön domainnel használható újra; kulcsértéket nem olvastunk ki vagy változtattunk.

A szerver újraparszolja az aktuális vendégkérést, egyértelmű forrásazonosságot követel, és kizárja a visszavonást, ellentmondást és hibás időbélyeget. A foglalás és az A-döntés pontos verzióját, a házkötés és a naptár bizonyítékát, az emberileg látott hash-t és mindkét lejáratot ellenőrzi. A DB rendezett sorzár, CAS és ismételt Auth/session/jog/lejárat-vizsgálat mellett dönt. Élő azonos scope ismételt jóváhagyása és exact payload replay tiltott; lejárt scope friss bizonyítékkal új auditrekordként megújítható.

### Célzott tesztek (átfednek, nem összegezendők)

- `node --test tests/service-approval-panel.test.mjs tests/operator-cookie-session.test.mjs tests/tub-service-approval.test.mjs tests/tub-availability.test.mjs tests/service-link-backup.test.mjs` → **47 PASS / 0 FAIL / 0 SKIP**. Ez a C teszt harmadik megújítási esetének hozzáadása előtti csomag; panel/handler/B/backup végleges változat.
- `node --test tests/tub-service-approval.test.mjs tests/service-link-resolution.test.mjs tests/supabase-policy.test.mjs tests/static-chatbot-build.test.mjs` → **12 PASS / 0 FAIL / 0 SKIP**. PostgreSQL/PGlite, meglévő és új döntések titkosított snapshot-visszaállítása, teljes recovery manifest, RLS és statikus buildből kizárt server helper.
- Az utolsó célügy-/időbélyeg-/jogvisszavonási szigorítás után `node --test tests/tub-service-approval.test.mjs` → **3 PASS / 0 FAIL / 0 SKIP**. Normál és review sikerút; approve+read write nélkül; hamisított proof/MAC és cross-tenant, Reader/Writer-only/anon/direct RPC, replay, forrásverzióváltás, új üzenet, CAS, lejárat és provider közbeni változás, megújítás, változatlan case/target/szállásapproval.
- 14 JS syntaxcheck, index inline syntax és `git diff --check`: PASS. A módosítás miatt kötelező teljes npm tesztet a CI futtatja, helyben nem ismételtük.
- Backup v3 követeli az új szolgáltatásdöntés-táblát; explicit legacy v1 és v2 ellenőrzés megmarad. A meglévő mentések változatlanok.

### Tesztfelhő

A CLI által készített `20261016114328_tub_service_approval.sql` migráció sikeresen alkalmazva kizárólag `sarberki-test` (`mojnqizbcaczstguikpv`) projektben. Metadata: RLS aktív, egy tenant SELECT-policy; authenticated SELECT igen, közvetlen INSERT/UPDATE/DELETE nem; anon RPC execute nem; üres search_path. A korábbi `sc_write_case`, `sc_approve_case`, `sc_has_permission`, `sc_resolve_service_link` definícióinak ellenőrzőösszege változatlan.

Az advisor új bejegyzése a szándékosan authenticated által hívható védett definer RPC; [figyelmeztetés leírása](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Az explicit Auth/session/tenant/read/approve/CAS/MAC ellenőrzés kötelező. A többi advisor-bejegyzés már a változtatás előtt jelen volt.

Commit utáni teljes CI és pontos deploy ellenőrzése következik. Valódi ház-/foglaláskötési és dézsanaptár-adatforrás **nincs bekötve**: tényleges elérhetőség és valódi szolgáltatásjóváhagyás **NEM IGAZOLT**, a felhős jóváhagyás tiltott marad. A pozitív bizonyíték offline szintetikus fixture; ez nem valódi Supabase Auth vagy élő szolgáltatásfoglalás bizonyítéka. Admin SQL-es ügyírás, service role, küldés, Pushover és Previo-művelet nem történt.

V2/V3-érték: elkülönített erőforrás-bizonyíték és emberi döntés a meglévő Auth/tenant/RLS/CAS határokon. Új jogosultsági vagy válaszmotor, külső végrehajtás és Previo-írás nem része a fejlesztésnek.
