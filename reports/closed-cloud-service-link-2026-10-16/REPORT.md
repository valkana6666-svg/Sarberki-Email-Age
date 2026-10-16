# Zárt felhős ügykapcsolási próba – 2026-10-16

Kiindulás: dokumentációs HEAD `a1387fe6b1b654a68c70dd7c430f699e41b77531`; igazolt kód `26d177c54db3a3450a292ac75aead89ea8f61199`, [CI](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38897233284) 1599 PASS / 0 FAIL / 0 SKIP. Az ág és a CI státuszát újrafuttatás nélkül visszaellenőriztük.

## Cél és határ

Egyetlen pontos HU szintetikus MIME/envelope eltérő rögzített thread-azonosítóval a meglévő feladótól. A cookie Writer a már ellenőrzött zárt HU alapügyhöz választja a próbát; a szerver ellenőrzi annak azonosítóját/verzióját és tartalmát. A közös resolver külön `service_link_review` ügyet készít, üres szállásadatokkal; nem új szállásfoglalást.

A célügy csak preflight-kötés; az új review saját v1 rekord. A rendezés a meglévő, két ügyet CAS-szal zároló és auditáló RPC-n marad. A régi exact fixture replay csak a változatlan v1 review-n idempotens; rendezés után 409, írás nélkül. Nincs új endpoint/jogrendszer, általános `.invalid`-engedélyezés, adatbázis-migráció vagy elérhetőségi adatforrás. Ez nem dézsa-visszaigazolás.

## Igazolás

- Cookie+registry: `node --test tests/operator-cookie-session.test.mjs tests/closed-synthetic-mail-registry.test.mjs` → **31 PASS / 0 FAIL / 0 SKIP**.
- `node --test tests/tub-review-fixture-postgres.test.mjs` → **1 PASS / 0 FAIL / 0 SKIP**: valódi PostgreSQL/PGlite és actual MIME parser, szimulált Auth/HTTP. Cookie Writer insert + idempotens replay; Reader unresolved/neutral és írástiltás; külön approver A-rendezése; utána replay 409. A cél teljes sc_cases sora byte-for-byte változatlan, audit- és döntésszám pontos.
- Utolsó source-race feltétel után `node --test tests/operator-login-ui.test.mjs` → **20 PASS / 0 FAIL / 0 SKIP**. Source/session/selection változás és késői válasz nem írhatja felül a kiválasztott ügyet.
- Hét JS syntaxcheck, inline UI syntax és `git diff --check`: PASS. Teljes suite helyben nem ismétlődött; commit után CI ellenőrzi.

A commit, CI és tényleges felhős próba eredményét külön rögzítjük. A pozitív felhős összerendelés egyelőre **NEM IGAZOLT**. Production/main, valódi vendégadat, küldés/Pushover, Previo és meglévő mentések változatlanok.

V2/V3-érték: a meglévő közös ügymotor, Auth/tenant/RLS/CAS és audit ellenőrzése a csatornaadapteren át; új üzleti vagy jogosultsági rendszer nélkül. A szintetikus fixture nem hiteles valós elérhetőségi forrás.
