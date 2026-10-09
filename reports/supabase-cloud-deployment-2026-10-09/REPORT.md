# Sárberki Supabase telepítés – végrehajtási jelentés
Dátum: 2026-10-09. Állapot: részleges telepítés, aktiválás tiltott.

## ELVÉGEZVE
- Supabase: Sárberki Free / sarberki-test / mojnqizbcaczstguikpv.
- Régió: London eu-west-2. Kizárólag szintetikus adatok; valódi vendégadat nem került át.
- Ellenőrzött tesztági HEAD: 00860a2a292f75332edde35ecb2a9e96dd628f55. Kiinduló working tree tiszta.
- Az eredeti supabase/migrations/202610090001_case_store.sql a Supabase SQL Editorban ténylegesen lefutott. A betöltött szöveg karakterenként egyezett a repo fájljával. Előtte az öt tábla és két függvény nem létezett.
- Mind az öt tábla létrejött: sc_tenants, sc_memberships, sc_cases, sc_message_keys, sc_audit.
- Két test_only=true tenant: sarberki-test és demo-test.
- Három valódi Supabase Auth felhasználó létrejött a tulajdonos által megadott jelszavakkal, e-mailküldés nélkül.
- Ellenőrzött Auth UUID-khez a tulajdonos külön jóváhagyásával tagság került:
  - writer@sarberki-test.invalid: sarberki-test read/write, approve=false.
  - reader@sarberki-test.invalid: sarberki-test read, write=false, approve=false.
  - operator@demo-test.invalid: kizárólag demo-test read/write, approve=false.
- Netlify GitHub-belépés sikeres; csak leafy-chimera-2403e5 teszthely módosult.
- CASE_STORE_ENABLED=disabled kifejezetten mentve minden deploy kontextusban.
- Az élő tesztvégpont HTTP 503, {"error":"CASE_STORE_DISABLED"} választ adott. Ez gate-ellenőrzés, nem Supabase-kapcsolat vagy E2E.

## TESZTELVE
- Felhős katalógusellenőrzés: 5/5 tábla RLS=true; authenticated SELECT=true, INSERT/UPDATE/DELETE=false; anon táblahozzáférés=false; táblánként 1 SELECT policy és 1 primary key.
- Tenant/case, tenant/mailbox/message és tenant/case/revision kulcsok megfelelőek.
- sc_has_permission és sc_write_case: security_definer=true, üres search_path, anon EXECUTE=false, authenticated EXECUTE=true.
- A policy-k tagság/felhasználó alapúak; közvetlen membership-módosítás nem megengedett.
- 15/15 felhős PostgreSQL SQL-assertion sikeres: insert, ismételt insert tiltása, CAS update, stale CAS tiltása, audit darabszám/hash, cross-case message egyediség, hiba utáni rollback, message history megőrzése, tagság-eszkaláció és közvetlen táblaírás tiltása, reader olvasás/írástiltás, foreign-tenant olvasási és írási elszigetelés.
- Ezek a SQL-próbák authenticated adatbázisszerepkört és SQL-ben beállított request.jwt.claim.sub tesztidentitást használtak. Nem valódi Auth bejelentkezési tokennel végzett munkamenetek. Nem párhuzamos CAS-teszt.
- A tesztügy és audit a tranzakció rollbackjével eltűnt; a már telepített séma, tenantok és tagságok megmaradtak. Nem történt destruktív adatbázis-visszaállítás.
- Friss npm ci sikeres.
- Friss célzott szervertesztek: 35 PASS, 0 fail, 0 skip.
- Friss teljes npm test: 780 PASS, 0 fail, 0 skip.
- Valódi felhős Auth/Netlify E2E: 0.

## BLOKKOLVA
- Functions-only environment scope a Netlify felületén disabled, Upgrade to unlock jelzéssel. Fizetős szolgáltatás nem lett rendelve. A nem titkos disabled biztonsági gate All scopes alatt menthető volt; Supabase-kulcs nem lett hozzáadva.
- A meglévő alkalmazásban nincs operátori Supabase login UI; a specifikáció ennek fejlesztését későbbi szakaszra teszi. Jelenleg nincs igazolt biztonságos felület, amely a valódi operátori Auth-sessionös E2E-próbákat ellátná. Jelszót/tokent nem kértünk chatbe és nem kezeltünk modellel látható formában.
- Felhős pg_dump/backuphoz nincs biztonságosan konfigurált tulajdonosi DB-kapcsolat és titkosított, GitHubtól független mentési cél/restore környezet.

## MÉG NEM KÉSZ
- Valódi Auth login/expired token/revocation és hamisított kliens-identitás próbák.
- Két párhuzamos valódi Auth-munkamenet CAS-versenye.
- Felhős draftverzió-védelmi teszt és teljes szintetikus végponttól végpontig útvonal.
- Titkosított off-site backup és külön izolált restore.
- Netlify SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY és CASE_STORE_TEST_TENANTS nincs beállítva; nincs aktív felhős alkalmazáskapcsolat.
- Netlify beépített URL futtatási környezetben nincs igazolva; a teszthely domainje megfelelő.
- Netlify tényleges csomag/futtatási régió és kvóták teljes ellenőrzése nincs kész. A fiók felülete 75% feletti havi kreditfelhasználást jelzett; recharge vagy upgrade nem lett bekapcsolva.
- CASE_STORE_ENABLED=synthetic-only nem lett beállítva, új deploy nem indult.
- PREVIO_READ_SAFETY_VERIFIED nem módosult; a biztonsági gate zárva maradt.

## Tiltások és folytatás
GitHub main, éles Netlify, valódi Gmail-import, vendégadat, vendéglevélküldés, Previo-írás, localStorage migráció és automatikus ajánlatjóváhagyás nem történt. Service role nem lett használva. Titok nem kerül a jelentésbe vagy GitHubra. Az eredeti telepített migráció nem változott.

A következő lépés a valódi operátori Auth-munkamenetek biztonságos tesztelési útjának megoldása, a mentési és restore környezet biztosítása, valamint a kért Netlify Functions-only konfiguráció megoldása fizetős megrendelés nélkül. Ezek teljesüléséig az API maradjon disabled. Az SQL-identitásszimuláció nem helyettesíti a hiányzó Auth/E2E bizonyítékot.

Változott fájl: csak ez az új végrehajtási jelentés. A jelentés commitazonosítója a GitHub tool eredménye és a fájl commit-története alapján ellenőrizhető.
