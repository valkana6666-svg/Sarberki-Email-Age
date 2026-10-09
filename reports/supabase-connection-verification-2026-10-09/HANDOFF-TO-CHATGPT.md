# ÁTADÁSI CSOMAG CHATGPT-NEK

Folytasd a Sárberki projektet a https://github.com/valkana6666-svg/Sarberki-Email-Age repository gmail-test-subject-allowlist ágán; main és production érintetlen. A meglévő kódot ne kezdd újra, frissítsd és ellenőrizd a távoli HEAD-et, mert párhuzamos fejlesztés van.

Tényleges Supabase: sarberki-test, mojnqizbcaczstguikpv, Sárberki Free, eu-west-2 London, ACTIVE_HEALTHY. Öt sc_* tábla és két sc_* függvény, RLS és három operátor/tagság telepítve. A 202610090001_case_store.sql már SQL Editorban lefutott, list_migrations üres. Ne hozz létre második projektet, ne futtasd vakon újra a migrációt. London nem EU-tagállam; kizárólag szintetikus adat.

Valódi felhős PostgreSQL policy-teszt sikeres: insert/CAS/stale conflict, reader és idegen tenant tiltás, anon tiltás, üzenetegyediség, rollback, előzmény és auditvédelem. Admin SET ROLE + szimulált JWT claim volt, NEM valódi Auth-munkamenet vagy HTTP E2E. A teljes tranzakció visszagörgetett; utána 0 ügy/0 audit. Reprodukció: reports/supabase-connection-verification-2026-10-09/CLOUD-POLICY-TEST.sql, kizárólag kijelölt tesztprojekt.

Netlify teszthely: leafy-chimera-2403e5.netlify.app. booking-cases HTTP503 disabled. Ideiglenes /.netlify/functions/supabase-auth-test űrlap HTTP200, három meglévő operátor: writer@sarberki-test.invalid, reader@sarberki-test.invalid, operator@demo-test.invalid. A jelszavakat a tulajdonos biztonságos browserAuth vagy manuális handoff folyamatban írja be; chatbe soha. A valódi próba elindult secure browserAuth beküldéssel: két writer Auth-login sikerült és a sessionök refresh-tokenje visszavonva, reader bejelentkezés hibás credential miatt elutasítva, demo nem futott. Az eredmény FAIL, 0 ügy keletkezett; reader belépési adat tulajdonosi ellenőrzése és új próba kell. Az admin plugin OAuth nem operátori session.

Aktuális teljes regresszió: 817/817 PASS a párhuzamos fejlesztés fca7840 HEAD-jén. Kiinduló 6b898c7ec1e35b5fe081ecc86c3300438ca618ec-on 811 PASS/2 FAIL, két elavult szövegelvárás javítása közben ezek párhuzamosan már bekerültek a távoli ágba, ezért saját felesleges patch elhagyva és az új HEAD fast-forward átvéve; alkalmazási kódot itt nem módosítottunk. A belső Previo/pool szöveg tiltás megmaradt/megerősítve.

Következő feladat: valódi Auth-próba eredményének ellenőrzése; időkorlátos probe lezárása; titkosított külső DB backup és izolált restore bizonyítása. Útmutató: reports/supabase-blockers-2026-10-09/BACKUP-RESTORE.md. Ezek nélkül CASE_STORE_ENABLED=disabled. Previo kapcsoló false; nincs automatikus levél, foglalás, adatimport vagy localStorage átállítás.

Nyitott advisor: authenticated sc_* definer RPC-k explicit tagságellenőrzéssel; platform rls_auto_enable event_trigger execute-grant figyelmeztetés; leaked password protection disabled. Sem titkot, sem jelszót, kulcsot, connection stringet ne írj jelentésbe/repóba.

Új bizonyítékok és aktuális státusz: reports/supabase-connection-verification-2026-10-09/REPORT.md. A korábbi server-foundation jelentések történeti állapotot mutatnak, a cloud-deployment és blockers jelentésekkel együtt olvasd őket. A csomagot a projektgazda tudja másik ChatGPT-beszélgetésbe másolni, közvetlenül nem küldtük el.
