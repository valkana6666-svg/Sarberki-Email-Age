# Blokkolók feloldása — 2026-10-09

Projekt: sarberki-test / mojnqizbcaczstguikpv. Netlify: kizárólag leafy-chimera-2403e5. Tesztág: gmail-test-subject-allowlist; induló HEAD de92afcc62191a37a8400bf636218b3280cc6988; tiszta munkakönyvtár.

## ELVÉGEZVE / TESZTELVE

- All scopes a hivatalos Netlify dokumentáció szerint a Functions process.env környezetében is elérhető. A Free csomaghoz ezért nem szükséges scope-előfizetés. URL a Netlify beépített, read-only változója, nem kell és nem lehet felülírni.
- Frontend build audit: a build kizárólag COMMIT_REF-ből ír build-info.mjs-t. Nincs frontend env interpoláció; Supabase config process.env használata csak Functions oldalon történik. Az All scopes buildhozzáférést is ad, ezért jövőbeli buildmódosításokat újra ellenőrizni kell. A publishable key nem privilegizált, service_role/DB-jelszó nincs konfigurálva.
- A Netlify tesztoldalon ténylegesen mentve: CASE_STORE_TEST_TENANTS, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY és PREVIO_READ_SAFETY_VERIFIED=false. A secret jelölésű import Free alatt Builds/Functions/Runtime scope-ot kapott. Az első deploy scannerhibával megállt, mert két nyilvános értéket secretként jelöltem; a secret flag utólag nem szerkeszthető. Ezért kizárólag e két nem titkos konfiguráció nevét vettem fel a SECRETS_SCAN_OMIT_KEYS változóba: CASE_STORE_TEST_TENANTS,SUPABASE_URL. A scanner bekapcsolva maradt, tényleges titkokra nincs kivétel.
- Ideiglenes supabase-auth-test Function elkészült, alapértelmezetten 404, fix teszthost/projekt, API-disabled előfeltétel, legfeljebb 24 órás env engedély, same-origin POST, méretkorlát, CSP, no-store, nincs credential/token logging vagy response reflection. Csak három fix tesztoperátor. Két külön writer login, reader és demo login; valódi /auth/v1/user, memberships, RLS, RPC, párhuzamos CAS, rollback, message-duplikáció, audit. Végül helyi session logout, refresh revocation; JWT lejáratát ez nem garantálja.
- 14 új automatikus biztonsági teszt PASS. Teljes friss regresszió: 794 PASS / 0 FAIL (korábban 780). Ez nem cloud Auth bizonyíték.
- Az élő HTTP-próba szerint a .netlifyignore Git-alapú deploy esetén nem zárta ki a riportokat, ezért eltávolítottam. A build most külön dist könyvtárba másolja csak az alkalmazás HTML/JS/MJS/CSS/SVG/TXT fájljait és a business/guest-reply/shared-core/price-source kliensmodulokat; nincs reports/tests/netlify/supabase/.env/mentés archívum. A helyi importgráf ellenőrzése minden relatív modulfüggőséget megtalált. Nincs env-interpoláció, csak a meglévő COMMIT_REF buildazonosító. A Functions bundling továbbra is az eredeti netlify/functions könyvtárból történik. A meglévő localStorage UI változatlan.

## BLOKKOLVA / MÉG NEM KÉSZ

- A telepített zárt Auth-végpont HTTP 404 mellett visszaigazolta a szerverkonfigurációt: CASE_STORE_ENABLED=disabled, beépített URL pontosan a teszthost, SUPABASE_URL a kijelölt projekt, publishable kulcs rendelkezésre áll. Az ügy-API friss HTTP-próbája 503 CASE_STORE_DISABLED. A javított scannerrel a tesztdeploy sikeresen publikálódott. Ez még nem hitelesített Supabase kapcsolatpróba.
- A későbbi valódi Auth-próbák eredményét az alábbi frissítés rögzíti. A felhős booking-cases E2E továbbra is 0.
- Titkosított külső backup és külön restore még nincs. Konkrét díjmentes, tulajdonosi gépen végrehajtható eljárás: BACKUP-RESTORE.md. A jelen környezetben hiányzik a dump/restore futtatókörnyezet és a biztonságos DB-kapcsolat; nem kértem jelszót chatben.
- CASE_STORE_ENABLED=disabled marad; végleges jóváhagyás és Previo olvasás tiltva. Fizetős szolgáltatás, main/production módosítás, valódi adat/email nem történt.

Hivatalos források:
https://docs.netlify.com/build/functions/environment-variables/
https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

## Friss ellenőrzés — 2026-10-09 16:32 (Europe/Vienna)

- A párhuzamos munkák fast-forward átvétele után ellenőrzött HEAD: b629924bacb4cbaf677aa3ec55765d7786a2462a. Teljes friss npm test: 821 PASS / 0 FAIL / 0 skipped. A fenti 794 eredmény korábbi futás, nem a legfrissebb állapot.
- A tulajdonos korábban egy órára engedélyezte az ideiglenes Auth-próbát. Az első űrlapbeküldésnél a no-referrer fejléc Origin:null értéket okozott; same-origin referrer policy javítás került a tesztágra. Null/idegen Origin továbbra is tiltott.
- Két későbbi secure browserAuth beküldés eljutott a valódi Supabase Auth szolgáltatáshoz. Mindkettőnél a két writer login sikerült, majd a reader login invalid_credentials hibával leállt. A demo belépés, valódi munkamenetes RLS/CAS/audit próba nem futott le. A létrejött tesztmunkamenetek helyi logout/refresh-token visszavonása sikeres volt. Ezt nem teljes cloud E2E sikerként jelentjük.
- A jelenlegi Auth-users utóellenőrzés szerint reader updated_at változatlan (2026-10-09 09:36:56 UTC), last_sign_in_at null; demo last_sign_in_at null. Az olvasó jelszavának cseréje még nem történt meg. A tulajdonosi dashboard GitHub-belépése sikerült, de az nem helyettesíti az operátori Auth-hitelesítést.
- Friss élő válasz: az Auth-próbakaput a lejárat lezárta; a szerveroldali konfiguráció ellenőrzött. Booking-cases: CASE_STORE_DISABLED. Nem hosszabbítottuk meg a tesztkaput és nem aktiváltuk az ügy-API-t.
- Elkészült egy saját gépen, tulajdonos által futtatható Python karbantartási segéd; csak szintaxisellenőrzés történt. Nincs telepítve, nincs benne titok, nem történt admin API-jelszócsere. A tulajdonos jelenleg csak telefonon dolgozik, ezért ez nem végrehajtható telefonos megoldás. Csak új jelszót kérő, működő mobil jelszócsere-link nincs előkészítve.
- Backup/izolált restore továbbra BLOKKOLVA; az API aktiválásának feltételei nem teljesültek. Minden korábbi tiltás változatlan.
