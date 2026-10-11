# Sárberki – laptop nélkül futtatható titkosított adatbázismentés

Állapot 2026-10-11: valódi titkosított adatbázis-export és ciphertext-visszafejtés igazolt; teljes izolált helyreállítás még nem igazolt.
Kizárólag sarberki-test / mojnqizbcaczstguikpv / London eu-west-2 / gmail-test-subject-allowlist.

## Meglévő tulajdonosi beállítások – a neveket megőrizzük

A GitHub repó Settings → Secrets and variables → Actions felületén:

- Secret `SARBERKI_BACKUP_DB_URL`: a Supabase Connect panelen ellenőrzött London Session pooler teljes kapcsolati URI-ja. A felhasználó `postgres.mojnqizbcaczstguikpv`, port 5432, adatbázis postgres. Speciális jelszókaraktereket URL-kódolni kell. Kizárólag a védett mezőbe kerüljön; chatben, képernyőképen és repóban tilos. Ne reseteld a jelszót a mentés kedvéért.
- Secret `SARBERKI_BACKUP_PASSPHRASE`: külön, jelszókezelővel generált erős titkosítási jelmondat. A megerősített segéd legalább 32, legfeljebb 1024 karaktert kér, sortörés nélkül. Nem lehet azonos az adatbázisjelszóval. A tulajdonos őrizze meg külön jelszókezelőjében is; GitHub-secretből nem olvasható ki később.
- Variable `SARBERKI_BACKUP_ENABLED`: `yes`, ha a két secret elkészült és a workflow át van nézve. A változó önmagában nem indít adatbázis-exportot.

Ezek telefonról is beállíthatók. Kulcspár létrehozása nem szükséges. A Windows DPAPI CurrentUser felhős Linux környezetben nem alkalmazható; a hordozható GPG AES-256 fájl később M:\Sarberki_Backup alá másolható.

## Indítás és védelem

A workflow csak a tesztágon fut. Saját kódja/dokumentációja módosításakor szintetikus biztonsági és valódi GPG titkosítási teszteket futtat, adatbázis-kapcsolat nélkül.

Tényleges export csak akkor indul, ha egyszerre a tesztágon vagyunk, `SARBERKI_BACKUP_ENABLED=yes`, és az indító commit üzenete tartalmazza a `[sarberki-backup-run]` jelölést. Ehhez a Work célzott dokumentációs commitot készít ezen az ágon. Main, production, automatikus ütemezés vagy PR-trigger nem szükséges.

## A megerősített export

A `scripts/cloud-encrypted-backup.py` a meglévő `owner-encrypted-backup.py` kapcsolati és tartalomjegyzék-ellenőrzését használja. A titkos URI-t a folyamat memóriájában bontja libpq-környezeti változókra; nem adja tovább parancssori argumentumban, és nem örököl alternatív PG service/TLS beállításokat. A kapcsolaton verify-full TLS és default_transaction_read_only=on kötelező, ezt psql-lel ellenőrzi.

PostgreSQL 17 custom pg_dump készül az egész adatbázisról, role-jelszavak nélküli szerepkör-exporttal és ügytár-manifesttel. Mind az öt sc_* tábla és az auth.users/auth.identities adatobjektumok jelenlétét ellenőrzi. Permission error vagy részleges export hibának számít. Az ügytár-manifest export előtt/után egyezzen; ez az ügytár változatlanságát ellenőrzi, a pg_dump adatbázis-snapshotjának konzisztenciáját nem helyettesíti.

A nyílt export csak memóriában van, legfeljebb 256 MiB mérettel. A lemezre három titkosított GPG fájl kerül, melyeket visszafejt és SHA-256 szerint összevet az eredetivel, továbbá SHA256SUMS.txt és STATUS.txt keletkezik. A titkosítási jelszó privát fájlleírón jut a GPG-hez; nem kerül fájlba, artifactba vagy argumentumba. Hiányzó konfiguráció vagy hiba esetén részleges állomány nem tölthető fel.

## Letöltés és a fennmaradó ellenőrzések

Az Actions futás alatt `sarberki-test-encrypted-<run_id>` nevű csomag várható. Csak három .gpg fájl és két titok nélküli kísérőfájl kerül bele, 7 napos lejárattal. GitHub átmeneti átadás, nem tartós független mentési hely. A ciphertextet GitHubtól független tulajdonosi tárhelyre kell menteni, visszatölteni és ellenőrizni a SHA256SUMS alapján.

A felhős visszafejtés-ellenőrzés még nem SQL restore. Külön, izolált Supabase/Auth környezetben kell helyreállítani és ellenőrizni az Auth adatokat, tenant-izolációt, RLS-policykat, grantokat, függvényeket, CAS-t és auditot. Soha nem a forrásprojektbe. API/JWT-kulcsok, platformbeállítások, Storage bináris objektumok és Vault kulcsfüggőségek külön leltárt/helyreállítást igényelnek. A CASE_STORE_ENABLED marad disabled.

Ha az offline-safety job zöld és az export job skipped, nem készült mentés. A teljes mentés/visszaállítás csak konkrét fájl, bájtméret, checksum, tartós visszaolvasás és izolált restore bizonyítékával jelenthető késznek.

Hivatalos forrás: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

## Egyszeri futási kérelem

2026-10-11: a felhős offline mentési tesztek 7/7 sikeresek, a tesztági CI sikeres. A projektgazda kérésére egyszeri exportindítás következik; ha a védett beállítások vagy a SARBERKI_BACKUP_ENABLED=yes hiányzik, mentés nem készül. A kérelem nem bizonyít mentési fájlt vagy visszaállítást.

## 2026-10-11 – kapcsolati formátum javítása

Az eredeti futás a URI-feldolgozásnál leállt. A titkot felfedés nélkül vizsgáló új futás bizonyította: közvetlen adatbázis-végpont volt megadva, miközben a kód csak Session poolert fogadott el. A projekt Supabase-metaadatai megerősítik a sarberki-test azonosítót, London régiót és PostgreSQL 17.11 verziót.

A felhős mentőprogram a kizárólag erre a projektre rögzített db.mojnqizbcaczstguikpv.supabase.co:5432/postgres közvetlen végpontot is elfogadja postgres felhasználóval. A London Session pooler továbbra is támogatott. A TLS verify-full, csak olvasható tranzakciók és a forrásba visszaállítás tilalma változatlan. Idegen projekt, más port vagy alternatív host nem elfogadott.

A dashboard psql-parancsának külső burkolatát végrehajtás nélkül eltávolítja. A helyettesített jelszó fenntartott URI-karaktereit a forrásvégpont külön rögzítésével kezeli. A hibák csak állandó diagnosztikai kódokat naplóznak, titkos értékek vagy a PostgreSQL teljes hibaszövege nélkül.

Ez a javítás és a sikeres offline teszt önmagában nem igazol adatbázismentést. A tényleges export, titkosítás és visszaolvasás eredményét külön kell ellenőrizni.

A közvetlen URI feldolgozása sikeres volt, de az Actions futtató a projekt IPv6 címét nem érte el (`SOURCE_NETWORK_UNREACHABLE`). Biztonságos bejelentkezés után a sarberki-test Connect paneljén kiolvasott tényleges Session pooler host: aws-0-eu-west-2.pooler.supabase.com, port 5432, postgres.mojnqizbcaczstguikpv felhasználó. A workflow ezt a nem titkos, ellenőrzött végpontot adja át. A meglévő direct-URI secretből a program csak a jelszót használja újra memóriában; a secret és a forrásjelszó változatlan. Idegen projektre utaló direct-URI nem alakítható át.

A Session pooler a Supabase saját CA-láncát használja; a rendszer CA-tárával a kapcsolat `SOURCE_TLS_VERIFICATION_FAILED` hibával leállt. A projekt Database Settings / SSL configuration felületéről azonosított hivatalos nyilvános tanúsítvány: https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt . A nyilvános CA bekerült a scripts/certs könyvtárba, fájl-SHA256: 700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7. A program rögzített hash-sel ellenőrzi és PGSSLROOTCERT-ként használja; verify-full továbbra is kötelező. A CA érvényességének vége 2031-04-26; a forrásprojekt SSL-beállítása nem módosult.

A CA-ellenőrzés után a TLS-kapcsolat már sikerült. A pooler a startup PGOPTIONS read-only alapbeállítását nem érvényesítette. A program ezért kötelező explicit `BEGIN TRANSACTION READ ONLY` tranzakcióban ellenőrzi a kapcsolatot és olvassa a szerververziót. A két manifest-lekérdezés már saját read-only tranzakciót használ. A PostgreSQL 17 hivatalos pg_dump forráskódja igazolja a dump kötelező `REPEATABLE READ, READ ONLY` tranzakcióját: https://github.com/postgres/postgres/blob/REL_17_STABLE/src/bin/pg_dump/pg_dump.c . A roles-only pg_dumpall csak szerepkör-definíciókat olvas, role-jelszavak nélkül. A program nem küld adatot módosító vagy forrásba helyreállító parancsot.

## Igazolt export – 2026-10-11

- Sikeres futás: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38127744637
- Export forráscommit: 58d258908c588cb25f00be79723d2b592e5efd4b.
- Artifact: sarberki-test-encrypted-38127744637; ID 11696899607; 75 689 bájt.
- Artifact ZIP SHA256: 75eb4b354f1d6357e6561c418ada053d149195bd74db1688764f0d76984d005a.
- database.dump.gpg: 72 032 bájt; roles.sql.gpg: 1 124 bájt; manifest.json.gpg: 1 391 bájt.
- A teljes pg_dump parancs hibamentesen lefutott; az öt ügytártábla és az Auth adatok archívumjelenléte, az ügytár export előtti/utáni manifest-egyezése, AES256 titkosítás és mindhárom fájl visszafejtés utáni SHA256-egyezése sikeres.
- A letöltött ZIP SHA256-ja és a három titkosított fájl belső SHA256-ja külön is ellenőrizve.
- Az egyszeri engedélyezési marker kivételét a sikeres export után eltávolítjuk; visszaáll a tesztág + engedélyező változó + célzott indító marker együttes feltétele.
- Teljes izolált SQL/Auth/RLS/CAS visszaállítás: NEM IGAZOLT. Platform/API/JWT/OAuth/Netlify/GitHub titkok és beállítások teljes helyreállítása: NEM IGAZOLT.

Csak olvasható kiegészítő leltár: Storage bucket=0, Storage object=0, Vault secret=0. Egy Edge Function létezik: reader-password-reset, v9, verify_jwt=true; kódja 410 választ ad, jelszót nem módosít. A letölthető csomag ezt a forrás-pillanatképet és leltárt külön tartalmazza. A leltár a mentési munkamenetben külön olvasás, nem a pg_dump snapshot része.
