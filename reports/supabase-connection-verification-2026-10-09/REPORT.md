# Supabase-kapcsolat ellenőrzése – 2026-10-09

## Tényleges állapot

A Supabase-bővítmény OAuth-kapcsolata működik. A meglévő sarberki-test projektet használtuk: mojnqizbcaczstguikpv, ACTIVE_HEALTHY, PostgreSQL 17.11, Sárberki Free szervezet, eu-west-2 (London). Új projekt, fizetős szolgáltatás nem jött létre. London nem EU-tagállam; valódi vendégadat átvitele továbbra sem engedélyezett.

Öt sc_* tábla, öt authenticated SELECT-policy, RLS minden táblán, két jogosultságellenőrző SECURITY DEFINER függvény. PUBLIC/anon nem kap execute jogot a sc_* függvényekre, authenticated nem kap közvetlen táblaírást. Két test_only tenant és három Auth-user. Tagságok: Sárberki writer read/write, Sárberki reader read, demo operátor read/write; approve mindenkinél false.

A migráció már telepítve volt; nem futtattuk újra és nem írtuk felül. Supabase list_migrations üres: az SQL Editorból telepített séma megléte igazolt, migrációs nyilvántartásba vétel nincs igazolva.

## ELKÉSZÜLT ÉS TESZTELT

- Valódi felhős PostgreSQL-ben tranzakciós próba: insert, duplikált insert elutasítás, CAS-frissítés, stale CAS elutasítás, revision=2; előzménytörlés tiltása; mailbox/message cross-case egyediség és hibás insert rollback; két audit; tagságmódosítás és audittörlés tiltása; reader olvasás/írástiltás; idegen tenant olvasás/írástiltás; anon SELECT/RPC tiltás.
- A teljes próbatranzakció ROLLBACK; külön utóellenőrzés: sc_cases=0, sc_audit=0.
- Ez valódi cloud DB / RLS bizonyíték, de az auth.uid azonosítóját admin állította be SET ROLE és szimulált JWT claim révén. Nem valódi Auth-session és nem HTTP E2E. Nincs párhuzamos kétkapcsolatos CAS bizonyíték.
- Teljes npm test induláskor: 813 összes, 811 PASS, 2 FAIL. Két elavult vendégszöveg-elvárást frissítettünk, majd észleltük, hogy a párhuzamos fejlesztés ezt már javította. Saját felesleges tesztmódosításainkat elhagytuk; fast-forward átvettük az új fca78406b74524528615f82ba1d1cc140b44866e HEAD-et, benne további ár/jogosultsági tesztekkel. Köztes futás 813 PASS, legfrissebb teljes futás 817 PASS / 0 FAIL / 0 skipped. Alkalmazási kódot ebben a folytatásban nem módosítottunk.
- Netlify booking-cases élő HTTP 503; Auth-tesztűrlap élő HTTP 200. A szerveroldali tesztkapu feltételei szerint az ügy-API disabled. Ebben a folytatásban nem módosítottunk Netlify környezeti változót.
- Main SHA változatlan b99a48383773b760e8e959a0e3c3353dc3586547. Új munkát nem írtunk felül; tesztág fast-forward frissítve 6b898c7ec1e35b5fe081ecc86c3300438ca618ec kiinduló HEAD-re. Ellenőrzött visszaállítási Git bundle készült ideiglenes munkakörnyezetben; ez nem felhős adatbázismentés.

## TULAJDONOSI LÉPÉSRE VÁR / NEM KÉSZ

Valódi operátori Auth-munkamenetes próba: az előkészített Netlify supabase-auth-test űrlapon három meglévő operátori jelszó biztonságos bevitele szükséges. Titkot chatbe nem kérünk, nem olvasunk. Az OAuth adminhozzáférés ezt nem helyettesíti. A secure browserAuth beküldés ténylegesen megtörtént: az eredmény FAIL — Futás befejezése és két sikeres session refresh-token visszavonás. Auth-users last_sign_in_at igazolja az író operátor bejelentkezését, a reader és demo last_sign_in_at null. A szűrt auth log hibás bejelentkezési adatot jelez, rate-limit esemény nincs. A kód a két writer login után reader loginnál állt meg; a demo nem futott. Nincs sikeres teljes Auth→RLS→CAS bizonyíték. Utóellenőrzés: 0 ügy. Tulajdonosi reader jelszóellenőrzés és új próba szükséges, titokbevitel kizárólag biztonságos felületen. Titkosított külső adatbázismentés és izolált restore továbbra nincs: lásd reports/supabase-blockers-2026-10-09/BACKUP-RESTORE.md. CASE_STORE_ENABLED maradjon disabled, UI/localStorage átállítás és valódi adatok importja nincs.

## Biztonsági advisories

A security advisor figyelmeztet két szándékosan authenticated hívható sc_* definer függvényre: explicit auth.uid/tagságellenőrzés és korlátozott grant van, a cloud szerepkörpróba sikeres. A platform rls_auto_enable event_trigger függvényére anon/authenticated execute figyelmeztetés is van: definíciót ellenőriztük, nem alkalmazási ügy-RPC, további jogosultságszűkítés felülvizsgálatra vár. Leaked password protection disabled; nincs fizetős csomagváltás.

Források / teendők:
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Nincs vendéglevél, Previo-írás/új Previo-lekérdezés, production/main módosítás, titokcommit. A futtatott teszt SQL a külön CLOUD-POLICY-TEST.sql fájlban megőrzött ellenőrző script, nem új migráció.
