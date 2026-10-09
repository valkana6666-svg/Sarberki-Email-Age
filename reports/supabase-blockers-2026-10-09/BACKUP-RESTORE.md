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
