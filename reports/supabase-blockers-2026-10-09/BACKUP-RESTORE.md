# Tulajdonosi, díjmentes mentési és izolált restore-eljárás

Állapot: ELŐKÉSZÍTVE, tényleges backup/restore MÉG NEM KÉSZ. A jelen munkakörnyezetben nincs pg_dump vagy Docker, és nincs tulajdonos által biztonságosan átadott adatbázis-kapcsolat. A dashboard SQL-export nem teljes adatbázismentés. Free automatikus backup nem tekinthető garantáltnak.

## Biztonságos tulajdonosi környezet

Kizárólag saját, titkosított lemezű gépen. Hivatalos Supabase CLI, Docker, PostgreSQL 17 kliens és GnuPG szükséges; nincs fizetős felhőprojekt. Mentési könyvtár a GitHub-checkouton kívül, chmod 700, umask 077. A dashboard Connect menüjéből ellenőrizni kell a mojnqizbcaczstguikpv projekt kapcsolatát; session pooler használható, transaction pooler nem megfelelő dump céljára. Jelszót interaktív, rejtett bevitelből kell privát kapcsolati fájlba tenni, nem parancssorba vagy chatbe. A CLI db-url használata esetén a process argument listájába kerülő URI kockázata miatt csak izolált, egyfelhasználós gép használható; előnyösebb libpq service/PGPASSFILE és pg_dump saját wrapperrel, amely a Supabase CLI dry-run kizárásait reprodukálja. Nem szabad egyszerű public-only dumpot teljes backupként kezelni.

## Mentési tartalom és titkosítás

A hivatalos Supabase backup/restore eljárás szerint három dump szükséges: roles.sql (--role-only), schema.sql, data.sql (--data-only --use-copy). Auth felhasználók és az alkalmazási táblák adatai is szükségesek; az Auth séma egyéni módosításait külön kell rögzíteni. Ellenőrizni kell, hogy a választott CLI verzió dumpja tartalmazza az auth.users/auth.identities rekordokat. A szerepkör-jelszavak nem garantált részei a dumpnak. API kulcsok, Auth konfiguráció, beállítások és Storage bináris objektumok nem helyettesíthetők SQL dumpból.

Minden dumpból tar archívum, SHA-256 ellenőrző összeg, majd GnuPG titkosítás a tulajdonos külön tárolt nyilvános kulcsával. A titkosított archívumot GitHubtól független tulajdonosi tárhelyre kell másolni, visszatölteni és az ellenőrző összeget összevetni. A kulcs vagy jelszó nem lehet ugyanabban a mentésben. A plaintext csak titkosított lemezen lehet; lezáráskor eltávolítandó. A fájltörlés SSD-n nem garantált biztonságos törlés, ezért szükséges a lemeztitkosítás.

## Ingyenes izolált restore

Külön helyi Supabase stack az official CLI start paranccsal, külön munkakönyvtár és portok. Külső hálózat, SMTP, webhook, Previo, Gmail és production kapcsolat nélkül. A helyreállítás csak az új, üres lokális adatbázisba engedélyezett; a forrásprojektben nincs reset/drop/rollback.

A hivatalos restore mintának megfelelően roles, schema, data ebben a sorrendben; ON_ERROR_STOP és single transaction. A cél platform-szerepköreit és a session_replication_role=replica előírást a dokumentációval egyeztetni kell. A forrásból szerververzió, dump-verzió, timestamp, táblaszámok, policy-k, grants, függvények definícióhash-e és audit rekordok összesített hash-e szükséges manifestbe, titkosított archívumon belül. Az izolált célban ezeket össze kell vetni.

Restore után: mind az öt sc_* tábla, mindhárom Auth UUID és két tenant, memberships can_approve=false, RLS és SELECT policy-k, PK/unique kulcsok, authenticated/anon írástiltás, definer auth.uid/tagságellenőrzés, audit adatok, valós lokális Auth munkamenetes tenant- és CAS-próba. Csak egyező manifest és sikeres jogosultságtesztek után TESZTELVE a restore.

Forrás: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

## 2026-10-10 végrehajtási kiegészítés

**BLOKKOLVA:** a jelenlegi agent-környezetben nincs `pg_dump`, `psql` vagy Docker. Nincs tulajdonos által biztonságosan átadott libpq-kapcsolat, tulajdonosi titkosítási publikus kulcs és tartós, GitHubtól független mentési cél. A Supabase SQL-connector lekérdezési jogosultsága nem ad teljes adatbázismentési hozzáférést. Nem készült teljes felhős mentés, és nem történt annak külön visszaállítása.

**TESZTELVE, helyi fixture:** a meglévő PGlite PostgreSQL-környezetben a migrációból létrehozott szintetikus adatbázis fizikai snapshotját AES-256-GCM titkosítás után külön adatbázispéldányba töltjük. A sérült ciphertext elutasítása, policy-k, tábla-RLS, jogosultságok, adathash-ek, audit, tervezetelőzmények és a visszaállítás utáni új írás is ellenőrzött. A kulcs kizárólag a teszt memóriájában van. A teszt nem állít elő tartós tulajdonosi backupot. Az `auth.uid()` és Auth-felhasználók itt fixture-ek; ez nem egy felhős GoTrue/Auth szolgáltatás helyreállítása.

Új, csak olvasó ellenőrző eszköz: `scripts/case-store-recovery-manifest.sql`. A forrás- és restore-adatbázisban azonos owner sessionből futtatandó. Táblák, policy-k, constraint-ek, grantok, függvénydefiníciók checksumja, rekorddarabszámok, auditrevíziók és a legfrissebb audit adathash-e kerülnek a manifestbe. Nem olvas jelszóhash-t vagy tokent. A manifest nem adatbázismentés; nem bizonyítja a teljes Auth/Storage/Vault helyreállítását.

A tulajdonosi végrehajtás konkrét feltételei és sorrendje:

1. Saját, titkosított lemezzel rendelkező gépen PostgreSQL 17-kompatibilis kliens, Docker és GnuPG. Az existing Supabase Connect panelből pontos session-pooler kapcsolat; a jelszó helyi, korlátozott libpq credential fájlba kerülhet, nem chatbe, parancssori argumentumba vagy repositoryba. A kapcsolatnak a `mojnqizbcaczstguikpv` forrásra kell mutatnia.
2. A korábbi háromrészes Supabase CLI export mellett a teljes logikai adatbázis-export lefedettségét tételesen ellenőrizni kell: `auth.users`, `auth.identities`, alkalmazási adatok, séma, függvények, grantok, policy-k, sequence-ek és szükséges custom managed-schema módosítások. Egy permission errorral részlegessé vált dump sikertelen. Platformbeállítások, API-kulcsok, Storage bináris fájlok és Vault-kulcsok külön leltárt igényelnek, ha használatban vannak. Titkos értékek nem kerülhetnek a nyilvános leltárba.
3. A manifest és a sikeresen elkészült dumpok összecsomagolása a tulajdonos titkosított lemezén; GnuPG titkosítás a tulajdonos ellenőrzött publikus kulcsára. A titkosított csomag SHA-256 hash-ének rögzítése. A tulajdonos privát kulcsa nem adható át az agentnek.
4. A ciphertext másolása a tulajdonos GitHubtól független, tartós mentési helyére; onnan visszaolvasás és hash-összehasonlítás. A scratch-környezet és az agent-memória nem mentési hely.
5. Ingyenes, lokális Supabase Docker-stack, izolált hálózat, külső SMTP/webhook/Gmail/Previo kapcsolat nélkül. Kizárólag új, üres restore-adatbázisba visszatöltés az eredeti dokumentum lépéseivel. A forrásprojektben sem reset, sem DROP, sem destruktív rollback nem megengedett.
6. Manifest-összehasonlítás, policy/grant/function és Auth-adatellenőrzés, valódi helyi Auth-munkamenetek, RLS, CAS, duplikáció, audit és új írás ellenőrzése. Az audit identity sorszámának ugrása PostgreSQL-cache miatt megengedett; az egyediség, növekedés és a case-revíziók folytonossága kötelező.
7. Csak mindezek bizonyítása után jelölhető a felhős mentés és az izolált restore késznek. Addig `CASE_STORE_ENABLED=disabled`.

Hivatalos eljárás: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
