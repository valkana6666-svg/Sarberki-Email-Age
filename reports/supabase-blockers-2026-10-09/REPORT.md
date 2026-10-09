# Blokkolók feloldása — 2026-10-09

Projekt: sarberki-test / mojnqizbcaczstguikpv. Netlify: kizárólag leafy-chimera-2403e5. Tesztág: gmail-test-subject-allowlist; induló HEAD de92afcc62191a37a8400bf636218b3280cc6988; tiszta munkakönyvtár.

## ELVÉGEZVE / TESZTELVE

- All scopes a hivatalos Netlify dokumentáció szerint a Functions process.env környezetében is elérhető. A Free csomaghoz ezért nem szükséges scope-előfizetés. URL a Netlify beépített, read-only változója, nem kell és nem lehet felülírni.
- Frontend build audit: a build kizárólag COMMIT_REF-ből ír build-info.mjs-t. Nincs frontend env interpoláció; Supabase config process.env használata csak Functions oldalon történik. Az All scopes buildhozzáférést is ad, ezért jövőbeli buildmódosításokat újra ellenőrizni kell. A publishable key nem privilegizált, service_role/DB-jelszó nincs konfigurálva.
- A Netlify tesztoldalon ténylegesen mentve: CASE_STORE_TEST_TENANTS, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY és PREVIO_READ_SAFETY_VERIFIED=false. A secret jelölésű import Free alatt Builds/Functions/Runtime scope-ot kapott. Az első deploy scannerhibával megállt, mert két nyilvános értéket secretként jelöltem; a secret flag utólag nem szerkeszthető. Ezért kizárólag e két nem titkos konfiguráció nevét vettem fel a SECRETS_SCAN_OMIT_KEYS változóba: CASE_STORE_TEST_TENANTS,SUPABASE_URL. A scanner bekapcsolva maradt, tényleges titkokra nincs kivétel.
- Ideiglenes supabase-auth-test Function elkészült, alapértelmezetten 404, fix teszthost/projekt, API-disabled előfeltétel, legfeljebb 24 órás env engedély, same-origin POST, méretkorlát, CSP, no-store, nincs credential/token logging vagy response reflection. Csak három fix tesztoperátor. Két külön writer login, reader és demo login; valódi /auth/v1/user, memberships, RLS, RPC, párhuzamos CAS, rollback, message-duplikáció, audit. Végül helyi session logout, refresh revocation; JWT lejáratát ez nem garantálja.
- 14 új automatikus biztonsági teszt PASS. Teljes friss regresszió: 794 PASS / 0 FAIL (korábban 780). Ez nem cloud Auth bizonyíték.
- Statikus publikációból kizáró .netlifyignore készült a riportok, tesztek, migrációk és mentésfájlok számára. A meglévő localStorage UI változatlan.

## BLOKKOLVA / MÉG NEM KÉSZ

- Valódi felhős Auth-próba még nem futott; operátori jelszavak biztonságos tulajdonosi bevitele szükséges. Az ideiglenes útvonal engedélyezési időpontja nincs beállítva. A felhős booking-cases E2E továbbra is 0.
- Titkosított külső backup és külön restore még nincs. Konkrét díjmentes, tulajdonosi gépen végrehajtható eljárás: BACKUP-RESTORE.md. A jelen környezetben hiányzik a dump/restore futtatókörnyezet és a biztonságos DB-kapcsolat; nem kértem jelszót chatben.
- CASE_STORE_ENABLED=disabled marad; végleges jóváhagyás és Previo olvasás tiltva. Fizetős szolgáltatás, main/production módosítás, valódi adat/email nem történt.

Hivatalos források:
https://docs.netlify.com/build/functions/environment-variables/
https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
