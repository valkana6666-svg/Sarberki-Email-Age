# Sárberki — tulajdonosi biztonsági és CI-ellenőrzés

Dátum: 2026-10-10 (Magyarország). Kizárólag a `gmail-test-subject-allowlist` tesztágra vonatkozik.

## Valóban ellenőrzött eredmények

- GitHub Actions, `c57728250334f9d152cddcb40dbfb332a165e3a1`: `npm test` **855 PASS / 0 FAIL**, 0 skipped/cancelled/todo; az exact-test-deploy, MNB és publikus árreferencia smoke sikeres. Futás: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38000261213
- Ugyanez a teljes tesztkészlet a frissebb `7b5d54e1e6f87fd6ca9b720d29cda8a68817b8fa` tesztági commiton is **855 PASS / 0 FAIL**, 0 skipped/cancelled/todo. Futás: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38000609083
- A GitHub Actions élő Previo price smoke művelete **skipped** (nem futott), ahogy tesztági push eseménynél kell.
- Supabase `sarberki-test` / `mojnqizbcaczstguikpv`: projektállapot `ACTIVE_HEALTHY`. A verziózott `scripts/case-store-recovery-manifest.sql` SELECT lekérdezése külön, read-only módon lekérdezve: öt RLS-védett `sc_*` tábla; 2 tenant, 3 membership, 2 case, 2 message key, 3 audit; 0 audit-revízióhiány; 0 legfrissebb hash-eltérés; 0 `can_approve`.
- Kimeneti checksums: `case_checksum=104528db7c0c6240334f11ce1b3c3046`, `audit_checksum=dd5d7331a8ab764cbf40b3463046205c`. Egyeznek az előző manifest jelentéssel.

## Supabase security advisor — külön vizsgálandó

- A `public.rls_auto_enable()` SECURITY DEFINER függvény `EXECUTE` jogosultsága a default `PUBLIC` ACL miatt anon és authenticated szerepkörökkel is látható. A függvény `RETURNS event_trigger`, az aktív `ensure_rls` DDL-eseménytrigger használja. Ez advisor-riasztás és jogosultsági keményítési feladat, **nem bizonyított sikeres támadási útvonal**. Az event trigger működőképességének mérlegelése és migrációs terv szükséges a jogosultság szűkítése előtt.
- A `sc_has_permission` és `sc_write_case` SECURITY DEFINER függvények authenticated számára `EXECUTE` joggal rendelkeznek. Ez a jelenlegi tesztági tervezés része; a `sc_write_case` belül `auth.uid()` és `sc_has_permission(...,'write')` ellenőrzést használ. Ezért az advisor-jelzés önmagában nem bizonyít hibát.
- Supabase advisor szerint a kiszivárgott jelszavak ellenőrzése (Leaked Password Protection) nincs bekapcsolva. Tulajdonosi Auth-beállítási ellenőrzés javasolt, a projekt csomagkorlátainak figyelembevételével.
- Advisor URL: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

## Továbbra is blokkoló feltételek

1. **Nincs** tényleges teljes, titkosított felhős PostgreSQL-mentés, független tartós tárolásból visszaolvasás és külön teljes Supabase/Auth-restore. Az SQL manifest NEM backup.
2. **Nincs** friss, valódi operátori Auth-munkamenetekből futtatott 36 assertion; a korábbi 25 felhős PASS változatlanul korábbi bizonyíték.
3. **Nincs** új valós, aláírt lejárt-JWT próba, illetve teljes felhős booking-cases E2E.
4. **Nincs** tényleges szerveres Previo-bizonyítéklekérés és jóváhagyott bizonyíték-/ártárolási adatútvonal.
5. A privát és privilegizált kulcsok teljes tulajdonosi leltára / szükséges rotációja külön ellenőrzendő.

A biztonságos mentéshez tulajdonosi, titkosított Windows/Linux gép, megfelelő `pg_dump`/Supabase CLI környezet, helyben kezelt DB-hitelesítés, tulajdonosi GPG publikus kulcs és GitHubtól független tartós célhely szükséges. **Ne küldjön senki jelszót, DB URI-t, JWT-t vagy titkos kulcsot chatbe vagy GitHubra.**

## Biztonsági állapot

Nincs DB-módosítás, migráció, felhős teszt-írás, Auth-futtatás vagy Previo/levélküldés ebben az ellenőrzésben. Sem main, sem production nem változhat. Aktiválás csak teljes backup+restore és a még nyitott felhős security/E2E feltételek után; `CASE_STORE_ENABLED=disabled` marad.
