# Sárberki – titkosított felhős adatbázismentés (tesztág)

**Állapot: előkészítve; valódi mentés még nem készült.** Forrás: kizárólag `sarberki-test` (`mojnqizbcaczstguikpv`). Az éles / main környezethez nem kapcsolódik.

A mentési workflow: `.github/workflows/sarberki-cloud-backup.yml` (csak `gmail-test-subject-allowlist` ág).
A Windows számítógép nem szükséges a futtatáshoz. A GH-hosted Linux runner a Supabase CLI három részes `roles.sql`, `schema.sql`, `data.sql` exportját használja.

## Tulajdonosi konfiguráció a GitHub felületén (soha nem chatben)

1. Supabase Dashboard, **sarberki-test → Connect → Session pooler**, port **5432**. A teljes PostgreSQL kapcsolati URI-ban pontosan a projekt saját adatbázisjelszavának kell szerepelnie. Ne használd a transaction poolert (6543), ne hozz létre új adatbázist; jelszót ne tegyél kódba vagy képernyőképre.
2. A GitHub repository **Settings → Secrets and variables → Actions → Repository secrets** részén add hozzá:
   - `SARBERKI_BACKUP_DB_URL`: a teljes Session-pooler `postgresql://...` kapcsolati URI, amely csak `postgres.mojnqizbcaczstguikpv` felhasználóval, `*.pooler.supabase.com` hosttal, 5432 porttal és `/postgres` útvonallal fogadható el. A jelszó speciális karaktereit URL-kódolni kell az URI-ban.
   - `SARBERKI_BACKUP_PASSPHRASE`: **külön, erős, legalább 24 karakteres** mentési titkosítási jelmondat. Ezt a tulajdonos tartósan, a GitHubtól független jelszókezelőben őrizze meg. A jelmondat nélkül a mentés nem állítható vissza. Ne használd az adatbázis jelszavát jelmondatként.
3. A **Repository variables** között hozz létre `SARBERKI_BACKUP_ENABLED` néven `yes` értéket kizárólag akkor, ha már mindkét secret készen áll, és a workflow ellenőrzése megtörtént. A változó önmagában **nem** indít mentést.

## Indítás kizárólag célzott tesztági commitból

A `workflow_dispatch` esemény a GitHubon csak akkor használható, ha a workflow fájl a repository alapértelmezett ágában is létezik; a `main` módosítása jelenleg tiltott. Ezért a workflow csak a tesztágon történt **push** esetén indulhat, és akkor is csak e három együttes feltétellel:

- a repository variable `SARBERKI_BACKUP_ENABLED=yes`
- a commit üzenete tartalmazza ezt a pontos jelölést: `[sarberki-backup-run]`
- a commit módosítja a mentési workflow-t vagy ezt a dokumentumot a `gmail-test-subject-allowlist` ágon.

A tulajdonosi beállítások után Work / Codex hozza létre **kizárólag a tesztágon** a célzott indító dokumentációs commitot; ne módosítsa a `main` ágat. A mentő workflow-n kívül más rendszer működése nem változhat.

## Mi történik futáskor?

- A futtató a **megadott, szigorúan ellenőrzött tesztprojekt** Session-pooler adatbázisát olvassa; `supabase db dump` nem ír vissza az adatbázisba.
- Három export készül, majd ellenőrzi a minimális méretet, az `auth.users`, `auth.identities` és mind az öt `sc_*` tábla COPY-szekcióját. Hiány vagy hiba esetén **nem tölt fel részleges mentést**.
- SHA-256 fájlellenőrző jegyzék és forrásazonosító kerül az archívumba. A helyi futtató ideiglenes lemezén készülő tömörített archívumot **GnuPG AES-256** módszerrel titkosítja a külön GitHub Secret jelmondatával.
- Sikeres visszafejtés- és tar-olvashatósági ellenőrzés után GitHub Actions artifactként **csak** a `.tar.gz.gpg` fájlt és annak SHA-256 ellenőrzőösszegét tölti fel, **7 napos** lejárattal. SQL, jelszó, titkosítatlan dump vagy decryptáló kulcs nem része az artifactnak.
- A titkosítatlan átmeneti fájlokat a futtató eltávolítja. Ez ideiglenes GH-hosted futtató; a titkosítatlan adat a művelet alatt csak a futtató ephemeral lemezén van jelen.

## Kötelező záróellenőrzés

1. Az Actions futásnak **success** állapotban kell lennie; az Artifactot az owner mentse le a GitHubtól független, tulajdonosi tárolóra, mert **7 nap után lejár**, nem tartós mentési hely.
2. A letöltött titkosított fájl SHA-256 értéke egyezzen a jegyzékkel. Szükséges a saját GPG-jelmondat; ezt ne oszd meg agenttel.
3. Független, izolált **helyreállítási teszt** is kötelező a Supabase hivatalos restore eljárásával, csak új üres célba, **soha a forrás `sarberki-test` projektre**. Ellenőrizni kell az Auth rekordokat, öt ügykezelő táblát, funkciókat, RLS-policykat és jogosultságokat.
4. A GitHub Actions munkafolyamatban szereplő archive-open / TAR ellenőrzés **nem adatbázis-restore**; sikeres futás esetén is `RESTORE_NOT_VERIFIED` az állapot az izolált tesztig. A Storage bináris objektumok és konfigurációs/secret adatok nincsenek ebben a SQL exportban.

A háttérben lévő GitGuardian-riasztás miatt a jelenleg nyilvános GitHub repository-t és a titok-hozzáféréseket külön biztonsági felülvizsgálat alatt kell tartani. Ne add ki sem az archívum titkosító jelmondatát, sem a DB URL-t, sem a nyers mentést.

Hivatalos Supabase eljárás: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
GitHub Actions: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch
