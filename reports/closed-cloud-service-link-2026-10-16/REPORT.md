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

## Commit és CI

Igazolt kód: **`97fca27d2b8edd09116631b308b831044c556e41`**. [CI](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38899459515), job `116967813965`: **1605 PASS / 0 FAIL / 0 SKIP**. `DEPLOY SYNC PASS`: expected = deployed = ugyanez. Offline Windows backup-copy job `116967813725` SUCCESS. A külön offline chatbot mobile workflow feltételesen skipped; ez nem npm teszt-SKIP.

## Tényleges tesztfelhő és szükséges emberi hitelesítés

1. A helyi HU MIME-betöltés után a normál cookie Writer út a már létező `fa570d0b-1ea9-4568-a8f2-08b4dec446d0` **v4** ügyet adta vissza duplicate-ként; új alapügy nem keletkezett.
2. Az új, egyetlen külön szálú zárt üzenet normál Writer/CSRF mentése sikeres: review **`0febcd75-d954-49cf-a5e8-70e7d8ce14dd` v1**. A kiválasztott célfoglalás továbbra a fenti v4 ügy. Ez külön szolgáltatás-összerendelési felülvizsgálat, nem szállásfoglalás.
3. A szerveres előnézet ténylegesen visszaolvasta az unresolved állapotot és a bizonytalanság magyar okát. A semleges tervezet pontosítást kér; elérhetőség NEM IGAZOLT, külön emberi jóváhagyás szükséges.
4. A jelenlegi, Writer-mentésre ténylegesen jogosult Auth-munkamenet **nem kapott `canResolveServiceLink` jogosultságot**; rendező vezérlő nem látható. A meglévő jóváhagyói fiók védett bejelentkezése szükséges. Jogosultságot nem adtunk/módosítottunk, admin/service-role kerülőút nem történt. A tényleges felhős rendezési döntés és annak audit-visszaolvasása ezért **NEM IGAZOLT**, nem jelentünk sikert.

Képernyőbizonyíték helyben: `cloud-review-awaiting-approver.jpg`. Következő lépés: megfelelő, meglévő read+write+approve Auth-fiókkal friss v1 előnézet, az előre kitöltött target v4 egyeztetése, indokolt szintetikus A-döntés, majd source v2/target v4 és audit visszaolvasása. Nem kell újabb baseline-teszt, új fixture vagy joggrant.

Production/main, valódi vendégadat, küldés/Pushover, Previo és meglévő mentések változatlanok.

V2/V3-érték: a meglévő közös ügymotor, Auth/tenant/RLS/CAS és audit ellenőrzése a csatornaadapteren át; új üzleti vagy jogosultsági rendszer nélkül. A szintetikus fixture nem hiteles valós elérhetőségi forrás.
