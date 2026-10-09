# Sárberki központi szerver – végrehajtási jelentés, 2026-10-10

A dátum a magyarországi munkanap szerint értendő; az ellenőrzések UTC szerint 2026-10-09 este történtek.

## 1. Ténylegesen végrehajtott munka

**ELVÉGEZVE:** a `gmail-test-subject-allowlist` tesztág és a munkakönyvtár ellenőrzése. Helyi kiindulás: `d77b5a0826c3cfaa2bc768f5823d1fb0680e85c8`; GitHubon már létezett a korábbi, 25 PASS felhős Auth-futást dokumentáló `9a02234e21048734fc266296cd9451263c7076f7` commit. Erre fast-forward frissítés történt. A korábbi tulajdonosi jelszócsere-segéd untracked állapotát megőriztem, nem futtattam és nem commitoltam.

Új szerveroldali adatkinyerés készült a meglévő `sarberki-core.mjs` parserére építve. Ha az ingest kérésből hiányzik a `values`, a szerver maga nyeri ki az egyértelmű dátumokat, létszámot, gyermekéletkorokat, háztípust, egységszámot és nyelvet. Az explicit `values` útvonal kompatibilis marad. Bizonytalan év/dátum nem válik biztos ténnyé; hiányzó follow-up adat nem töröl korábbi értéket.

Új, csak belső szintetikus `previewReview` bekötés készült a server-booking-runtime-ban. Csak explicit, szerveroldalon injektált fixture-szolgáltatóval működik, ellenőrzi a hozzáférést és revíziót, és nem áll rendelkezésre HTTP-akcióként. A preview nem ír vissza ár- vagy kapacitásbizonyítékot az adatbázisba. A meglévő `draft` belső, verziózott és pending állapotú marad.

A Supabase szerveradapter indulás előtt tiltja az `sb_secret_` és a legacy `service_role` kulcs alkalmazási használatát. A szerepkör-claim itt csak tiltási ellenőrzés, nem hitelesítési vagy jogosultságadási forrás.

## 2. Biztonsági mentés

**BLOKKOLVA:** teljes, titkosított felhős PostgreSQL-mentés nem készült. Nincs `pg_dump`, `psql`, Docker, biztonságos libpq-hitelesítés, tulajdonosi GPG publikus kulcs és tartós, GitHubtól független mentési cél az agent környezetében. SQL-connector lekérdezésből nem készítettem félrevezető „teljes backupot”. Fizetős erőforrás nem lett megrendelve.

**ELVÉGEZVE:** a meglévő BACKUP-RESTORE.md konkrét owner-végrehajtási feltételekkel és ellenőrzési sorrenddel bővült. Elkészült a `case-store-recovery-manifest.sql`: csak olvas, nem tartalmaz jelszót, tokent vagy kulcsot. A manifest összehasonlító ellenőrzés, nem mentés.

## 3. Izolált visszaállítás

**TESZTELVE, helyi fixture:** a migrációból létrehozott PGlite PostgreSQL adatbázis snapshotja AES-256-GCM titkosítást és visszafejtést követően külön adatbázispéldányba áll vissza. Ellenőrzött a sérült ciphertext elutasítása, rekordok, policy-k, RLS, grantok, függvénydefiníció-checksumok, audit és adathash-ek egyezése; reader/idegen tenant tiltások; korábbi tervezet törlésének elutasítása; új írás és audit identity egyedisége a restore után. A fixture titkosítási kulcsa kizárólag tesztmemóriában volt. Tartós owner-backup nem készült.

**MÉG NEM KÉSZ:** a tényleges `sarberki-test` teljes adatbázisának visszaállítása külön Supabase-stackbe. A helyi fixture Auth-sémája és `auth.uid()` függvénye tesztkörnyezet; GoTrue/Auth szolgáltatást nem állítottunk helyre. A fixture-próba nem teljesíti a felhős restore aktiválási feltételét.

Az első új restore-teszt hibásan az audit identity pontos 3-as következő értékét várta. PostgreSQL sequence-cache miatt a sorszám snapshot/restart után ugorhat. Az elvárás egyediségre és növekedésre javult; a case-revíziók továbbra is folytonosak. Ez tesztelvárás-javítás volt, nem felhős adatbázishiba.

## 4. Biztonsági ellenőrzések

| Próba | Eredmény és bizonyítási szint |
|---|---|
| Korábbi valódi Supabase Auth/RLS/CAS | Korábbi jelentés: 25 PASS / 0 FAIL; nem futtattam újra szükségtelenül. |
| Lejárt access token | Helyi 401-kezelés ellenőrzött; valódi, Supabase által aláírt lejárt JWT-próba BLOKKOLVA. Nem cseréltem le hamis token tesztjére és nem változtattam JWT expiry beállítást. |
| Visszavont refresh token újrafelhasználása | Új Auth-probe kód és PostgreSQL-backed helyi integráció ellenőrzött; új valódi felhős futás MÉG NEM KÉSZ. 4 munkamenet logout(local), majd újrafelhasználási kísérlet; hálózati hiba/5xx nem lehet PASS. |
| Tervezetverziók felülírása/törlése | PostgreSQL és restore után tiltott; az új Auth-probe előkészített felhős assertions is tartalmazzák. |
| Két mailbox | Azonos message_id külön mailboxban külön azonosító; helyi HTTP → PostgreSQL útvonal és új probe ellenőrzött. |
| Tenant-elszigetelés / tagságmódosítás | PostgreSQL, szerver és restore-próba ellenőrzött; korábbi valódi felhős eredmény megőrizve. |
| Admin/service-role kulcsok | Adapter és frontend build ellenőrzött; a tényleges projekt teljes kulcsleltárát, korábban megosztott kulcsok visszavonását és owner-gép/Netlify teljes titokleltárát csak tulajdonosi ellenőrzés igazolhatja. |
| Auditkonzisztencia | Friss valódi felhős, csak olvasó SQL-ellenőrzés: 0 auditrevízió-hiány, 0 legfrissebb adathash-eltérés. |
| Többszöri kétmunkamenetes CAS | Új probe: három további CAS-kör; helyi PostgreSQL-backed integrációban lefutott. Ezek nem új valódi Auth-munkamenetek. |
| Auth-kapu automatikus lezárása | Helyileg GET/POST és a határidő pontos pillanata ellenőrzött, lezárva 0 hálózati hívás. Aktuális felhős expiry utáni HTTP-próba MÉG NEM KÉSZ. A korábbi határidő változatlan: 2026-10-09T23:02:12.824Z. |

Az új probe 36 assertiont tartalmaz. Helyi HTTP/Auth szimuláció és valódi PGlite PostgreSQL mellett mindegyik PASS. A jelszavak/tokenek nem kerülnek a válaszba. A sikertelen műveletekhez a várt SQLSTATE ellenőrzése is tartozik, így egy hálózati hiba nem igazol előzményvédelmet vagy duplikációtiltást.

**Új valódi Auth-futás akadálya:** a böngésző előző munkamenete `credential_state_unavailable` védelmi állapotba került. Az automatizált credential-folyamatot nem indítottam újra kerülőúton. A connector nem biztosít operátori Auth-munkamenetet. Jelszót nem kértem chatben és nem változtattam meg.

## 5. Friss felhős állapot

Projekt: `sarberki-test`, `mojnqizbcaczstguikpv`.

- Mind az öt `sc_*` táblán RLS aktív; authenticated csak SELECT grantokkal rendelkezik.
- Mindkét függvény security-definer, üres search_path, postgres/authenticated execute; nincs PUBLIC/anon execute.
- 2 tenant, 3 membership, 2 szintetikus case, 2 message key, 3 auditrekord; 0 can_approve tagság.
- `demo-test`: revision 1, audit 1. `sarberki-test`: revision 2, audit 2. Az actorok saját tenantjuk tagjai; minden hash formátuma megfelelő.
- Recovery manifest: audit_gaps=0, latest_hash_mismatches=0; case_checksum=`104528db7c0c6240334f11ce1b3c3046`, audit_checksum=`dd5d7331a8ab764cbf40b3463046205c`.
- Friss nyilvános GET `/.netlify/functions/booking-cases`: **503 / CASE_STORE_DISABLED**.

Új migráció nem futott le; az eredeti telepített migráció változatlan. Felhős adatot nem írtam/módosítottam/töröltem ebben a folytatásban.

## 6. Teljes szintetikus ügyfolyamat

**TESZTELVE helyileg:** tesztlevél → szerveroldali adatkinyerés → ügyazonosítás → hiányzó adatok → injektált szintetikus kapacitásfixture → fix egységár → belső pending preview/draft. Hiányzó adatnál nincs kapacitás- vagy árhívás; kapacitás előtt nincs árszámolás. Sikertelen, lejárt, idegen időszakú bizonyítékból nem lesz pozitív ajánlat vagy nulla készlet. A/B/C type-pool eredményből nincs azonos ház ígéret. A házár férőhelyhatárig fix; két egységnél kétszeres alap. A dézsa kizárt, külön árazandó extra.

A szintetikus árszámítás belső eredmény; nem kerül jóváhagyott vendégárként a tervezetbe. A guest draft nem tartalmaz belső házszámot. Meglévő többnyelvű, kapacitásszűrési és árazási tesztek a teljes regresszió részei.

**MÉG NEM KÉSZ:** valódi Previo-bizonyíték szerveres lekérése, ellenőrzött ár/kapacitás bizonyíték tartós tárolási útvonala és a teljes felhős booking-cases E2E. A jelenlegi SQL tudatosan tiltja a state.quote/state.availability írását; ezt nem kerültem meg. A preview nincs HTTP-re bekötve, a deployált API kikapcsolt. Friss valódi felhős booking-cases E2E: **0**.

## 7. Friss automatikus tesztek

- `npm ci`: sikeres, lockfile változatlan.
- Célzott szerveres/PostgreSQL/Auth/restore/fixture suite: 72 PASS / 0 FAIL; utolsó runtime-integráció külön: 24 PASS / 0 FAIL.
- A végső teljes regresszió: **854 PASS / 0 FAIL**, 0 skipped/cancelled/todo; a korábbi 821 mellett 23 saját és 10 párhuzamosan érkezett új teszt. Részletek a TEST-RESULTS.md-ben. A részhalmazok és a 36 belső probe-assertion nem adandók hozzá a teljes tesztszámhoz.
- Frontend build: 49 publikált asset, környezetből adott dummy kulcssentinel és server-only modulok nélkül. `COMMIT_REF` nélkül a build elvártan elutasított; érvényes commit-azonosítóval sikeres.
- `git diff --check`: sikeres. Tracked kódban tényleges hosszúságú `sb_secret_` literal: 0 találat. Ez nem teljes körű secret inventory.

## 8. Módosított fájlok

- netlify/functions/supabase-auth-test.mjs
- shared-core/supabase-case-repository.mjs
- shared-core/server-booking-runtime.mjs
- shared-core/server-message-extraction.mjs (új)
- shared-core/server-synthetic-booking-review.mjs (új)
- scripts/case-store-recovery-manifest.sql (új)
- tests/server-foundation.test.mjs
- tests/supabase-auth-probe.test.mjs
- tests/supabase-policy.test.mjs
- tests/server-message-extraction.test.mjs (új)
- tests/synthetic-booking-review.test.mjs (új)
- tests/recorded-previo-manual-crosscheck.test.mjs (a távolról érkezett teszt elvárásának javítása és no-call ellenőrzése)
- reports/supabase-blockers-2026-10-09/BACKUP-RESTORE.md
- reports/server-continuation-2026-10-10/REPORT.md, TEST-RESULTS.md, AUTOMATED-TEST-OUTPUT.txt és TARGETED-TEST-OUTPUT.txt (új)

## 9. Commit és változatlan biztonsági állapot

A saját fejlesztés lokális git commitja `ef9bdfb` (`9a02234` alapon). Közben a távoli tesztág `9bd1afe2cb1147224dd3353037d51ed779def486` HEAD-re jutott; öt másik változtatott fájlt ütközés nélkül összevezettem a `2cb1c96` merge-ben. Ezek availability-recommend, offline ügyfolyamat/recorded replay tesztek és egy élő crosscheck script/workflow; az élő próbát nem futtattam. Az első összevezetett regresszió 853 PASS / 1 FAIL: az új recorded replay teszt tévesen unverified eredménynek várta a létszám miatt előzetesen kizárt kétfős házat. A kizárásra és a PMS-hívás hiányára javított elvárás után a teljes regresszió 854 PASS / 0 FAIL. Közben a távoli ág ugyanilyen kizárás-javítást és csak az önálló live scriptet érintő változtatást tartalmazó f2b0c3c HEAD-re jutott; ezeket is megőriztem, élő hívás nélkül. Az összevezetett forrás teljes regresszióját külön újrafuttattam. A shell git-push nem kapott GitHub hitelesítést; a GitHub connector az f2b0c3c alapon, az összes változtatást egyetlen tesztági commitként menti. A lokális merge-commitok nem külön GitHub commitok. A végleges GitHub HEAD pontos azonosítója a chatjelentésben szerepel. Main és production változtatás nincs. Nincs éles levélküldés, Previo-foglalás, vendégadat, localStorage-migráció, jelszócsere, fizetős szolgáltatás vagy CASE_STORE_ENABLED aktiválás. A tesztági automatikus Netlify build sikerét külön deploy-ellenőrzés nélkül nem állítjuk.

## 10. Következő szakasz és tulajdonosi intézkedés

1. Biztonságos owner-gépen teljes titkosított mentés és a tartós tárolás/visszaolvasás igazolása, majd izolált teljes Supabase-restore.
2. Owner által kezelt hitelesítésből új 36-assertion Auth-probe, valódi lejárt JWT és visszavont refresh-token újrafelhasználási próba; privilege-key leltár és korábbi kiszivárgott kulcsok visszavonásának ellenőrzése.
3. Az Auth-kapu expiry utáni tényleges felhős lezárásának és a tesztági deploynak ellenőrzése.
4. Külön, új verziózott migrációban megbízható szerveres bizonyítéktárolás; igazoltan mellékhatásmentes Previo-read adapter és kapacitás/ár források. Ezután teljes szintetikus felhős E2E, továbbra is automatikus küldés és végleges jóváhagyás nélkül.
5. Aktiválási feltételek teljesüléséig `CASE_STORE_ENABLED=disabled`.
