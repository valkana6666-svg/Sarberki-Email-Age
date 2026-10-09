# Sárberki foglaltságkezelési kötelező ellenőrzési pont

- Kizárólag a `gmail-test-subject-allowlist` tesztág módosítható. Main és production nem módosítható.
- Tilos valódi e-mail küldése, valódi foglalás létrehozása és Previo-adatok módosítása.
- A vendégnek foglalhatóként csak a kért teljes időszakra és szükséges egységszámra ténylegesen ellenőrzött elhelyezés ajánlható. Ismeretlen, hibás vagy más dátumhoz tartozó adat nem szabad kapacitás.
- Alternatív háztípus ugyanarra az időszakra külön kapacitásellenőrzést igényel. A háztípus megadása nem kerülheti meg az ellenőrzést.
- A/B közös típusszintű poolja nem bizonyít A+B párost ugyanabban a fizikai faházban. Egyedi egységet vagy párost kizárólag egyedi ellenőrzéssel lehet igazoltnak jelölni. Közelségi kikötés nélkül a megfelelő igazolt típusszintű készletből különböző fizikai házak is ajánlhatók; egymás melletti elhelyezést kizárólag egyedi ellenőrzéssel lehet ígérni.
- A szabad egységszám pillanatfelvétel, nem foglalás vagy garancia; végleges vendégajánlat előtt a kezelő ismét ellenőrizze a rendelkezésre állást.
- Kapacitást érintő fejlesztésnél teljes `npm test`, hibás/hiányzó forrásra vonatkozó negatív teszt és a foglalható/foglalt határ ellenőrzése kötelező. Az automatikus teszt nem helyettesíti az élő Previo-val történő összevetést.
- Referencia: `reports/availability-audit-2026-10-08/REPORT.md`; anonim opt-in élő ellenőrzés: `node tests/live-availability-audit.mjs --live-read-only`.

- Tartós stratégia: a Sárberki a későbbi AI-vállalkozás első alkalmazása. Új fejlesztésnél moduláris, vállalkozásonként elkülönített és tesztelhető határokat alakíts ki a jelenlegi stabilitás megőrzésével. Részletek: `docs/PLATFORM-STRATEGY.md`.
- Élő Previo-lekérdezést ne ismételj, amíg az alkalmazott műveletek készletzárolási mellékhatásának hiánya nincs dokumentáltan igazolva. A teszthost önmagában nem engedély: a szerveroldali biztonsági kapcsoló alapértelmezetten tilt.

- Központi ügytár: `supabase/migrations/202610090001_case_store.sql` és `shared-core/server-booking-runtime.mjs`. A Netlify ügy-API alapértelmezetten tiltott, és jelenleg kizárólag szintetikus tesztadatokhoz készül.
- Service role nem használható ezen a tárolási útvonalon. A definer SQL-függvény külön ellenőrzi az `auth.uid()` és a DB-tagság szerinti jogosultságot. RLS-t valódi PostgreSQL-motoron is tesztelj, ne csak mockkal.
- Nincs automatikus localStorage-migráció. Tulajdonosi bejelentkezés, felhős RLS/E2E ellenőrzés és mentés-helyreállítás nélkül ne aktiváld és ne fogadj valódi vendégadatot.
