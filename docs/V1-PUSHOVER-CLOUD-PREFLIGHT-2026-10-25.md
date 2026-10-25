# Pushover felhős migráció: olvasási előellenőrzés

2026-10-25; kiindulási commit 82c9d9e3c1a8075a199e6e02edc64bfc45d06e5f.

A scripts/pushover-migration-preflight.sql kizárólag katalógus-SELECT. Hét teszt igazolja: tiszta katalógus; táblaütközés; önálló típusnév ütközése; függvényütközés; hiányzó szerepkör; hibás authenticated BYPASSRLS; hiányzó service_role BYPASSRLS. Eredmény 7 PASS / 0 FAIL / 0 SKIP PGlite-ban, read-only tranzakcióval is. Nem ismételtük a változatlan PostgreSQL párhuzamossági tesztet.

A kijelölt sarberki-test / mojnqizbcaczstguikpv projektben ténylegesen lefutott ugyanaz a SELECT:

```json
{"preflight_version":1,"schema_ready":true,"roles_ready":true,"schema_present":true,"uuid_available":true,"conflicting_objects":[],"activation_authorized":false,"external_gate":"PROJECT_ID_AND_ROLLBACK_EVIDENCE_REQUIRED"}
```

A schema_ready kizárólag a felsorolt katalógusfeltételek eredménye, nem teljes migrációs tanúsítvány. A hívó kötelessége a projektazonosság és a szükséges DDL-jogok ellenőrzése; a query nem tudja önmagában hitelesíteni a Supabase projektazonosítóját. A service_role public séma USAGE joga külön katalógusolvasással igazolt. A migrációs előzményben hat korábbi migráció szerepel, Pushover-migráció nincs. Tábla és négy célfüggvény nem létezik, más adattáblák tartalmát nem olvastuk.

## Security advisor értelmezése

A három privát jóváhagyási/bizonylati tábla RLS mellett policy nélkül szándékosan zártan maradhat; az INFO önmagában nem indokol engedékeny policy-t. Az authenticated szerepnek elérhető jóváhagyási/ügykezelési definer RPC-ket nem vontuk vissza automatikusan: a meglévő belső Auth/tagság/ügyverzió ellenőrzésüket meg kell őrizni.

Az advisor rls_auto_enable függvényre is jelez. A katalógus szerint ez event_trigger visszatérési típusú és tényleges event trigger használja; nem kezeltük bizonyítottan szabadon hívható üzleti RPC-ként. Visszavonás vagy függvényátírás nem történt. A Supabase Auth leaked-password protection kikapcsolt állapotáról WARN van; beállítást vagy fizetős funkciót nem aktiváltunk.

Források/teendők:
- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Nyitott kapu

A korábbi 49 táblás SQL-restore és a Drive-bájtszintű hash nem a teljes Auth/config/platform helyreállítás igazolása. A független kulcspróba és helyreállítási jogosultság bizonyítéka hiányos. A leendő értesítési tábla és újonnan keletkezett claim-ek későbbi mentési/restore lefedése külön szükséges: régi snapshot után tilos automatikusan újraengedélyezni a küldést. Emiatt a migráció most sem került alkalmazásra.

Netlify-deploy, Supabase DDL/DML, valódi Gmail-/Pushover-küldés: 0. Nincs új export vagy OAuth-beállítás. Következő fejlesztésként a még nyitott V1 ügy-/dézsaértelmezési hibák célzott vizsgálata végezhető, amíg a felhős kapu nyitott.
