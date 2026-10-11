# Sárberki – megszakadt helyreállítás folytatása

Dátum: 2026-10-11
Ág: `gmail-test-subject-allowlist`

A korábbi művelet végrehajtódott: a `62a60ab` commitból a `38132189363` runtime workflow kétszer futott, és az Auth indításakor elbukott. Nem lejárt jóváhagyásra várt tovább. A napló szerint az Auth rossz SQL search_path alatt a meglévő migrációs leltár helyett új migrációkat próbált futtatni, és a meglévő OAuth-sémával ütközött.

A folytatás kizárólag az elbukott Auth/API/runtime ellenőrzést javította: az elkülönített Auth a saját `supabase_auth_admin` szerepkörével, `auth` search_path alatt kapcsolódik. Az új célhoz szükséges adatbázis-betöltés megtörtént; a korábbi 43-táblás összehasonlítás és SQL RLS/CAS tesztek, valamint a sikeres regressziós suite-ok nem ismétlődtek.

A `38134400747` futás sikeres, a konténerek és az ideiglenes céladatbázis takarítása is sikeres. Az eredeti Supabase-adatbázishoz a job nem kapcsolódott. A részletes, titokmentes bizonyíték: `RUNTIME-CHAIN.json`.

Igazolt: új szintetikus Auth-felhasználók API-bejelentkezése; a meglévő alkalmazási szolgáltatáslánccal üzenetértelmezés és SQL-mentés; szintetikus kapacitás/áradatból választervezet mentése; író/jóváhagyó jogosultságellenőrzés; tenant-elkülönítés; duplikált levél kezelése; Auth/REST újraindítás után új bejelentkezés és változatlan ügy/tervezet visszaolvasása.

Határok: nem a mentett régi felhasználók ismert jelszavas belépését teszteltük. Gmail OAuth, élő Previo és teljes kezelőfelületi jóváhagyási állapotváltás nincs igazolva. Nem történt e-mail-küldés vagy valódi foglalás. A laptop helyi ügytárának exportja és a külső szolgáltatói konfigurációk továbbra is hiányozhatnak; teljes önálló rendszerhelyreállítás továbbra sem állítható.

Az egyszeri indítási kivételt eltávolítottuk. Új runtime futás csak a `SARBERKI_RUNTIME_RECOVERY_ENABLED=yes` kapu és a `[sarberki-runtime-recovery]` commitjelölés együttese mellett indulhat. A lezáró commit `[skip ci]` jelölést kap, így sikeres teszteket nem futtat újra.
