# Sárberki – laptop nélkül futtatható titkosított adatbázismentés

Állapot: felhős futtató előkészítve; valódi mentési fájl még nem igazolt.
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
