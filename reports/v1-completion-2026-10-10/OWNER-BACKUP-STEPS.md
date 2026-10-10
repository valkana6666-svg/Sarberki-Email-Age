# Tulajdonosi mentés és izolált restore – következő konkrét lépések

Dátum: 2026-10-10. A PostgreSQL 17 és Gpg4win már telepítve van; ne telepítsd újra.
Ez végrehajtási útmutató, nem elkészült felhős mentés vagy igazolt restore.
Forrás kizárólag mojnqizbcaczstguikpv / sarberki-test, London Session pooler, port 5432.
CASE_STORE_ENABLED marad disabled. A forráson ne legyen más tesztíró a mentés alatt.

## 1. Helyi feltételek

- Tulajdonosi titkosított Windows-lemez; a célkönyvtár ne legyen Git-repositoryban vagy nyilvános megosztásban.
- A meglévő, ellenőrzött GPG-titkos kulcs helyi elérhetősége és annak külön, biztonságos helyreállítási másolata. A program nem generál/importál kulcsot és nem bízik automatikusan ismeretlen címzettben.
- A teljes nyilvános kulcsujjlenyomat helyi ellenőrzése Kleopatrában. A titkos kulcsot, DB-jelszót és GPG-jelszót ne küldd chatbe.
- A Connect panelen már kiválasztott Session pooler hostja és postgres.mojnqizbcaczstguikpv felhasználója. Nem a Transaction pooler portját használjuk.
- A helper a rendszer CA-készletét használja, verify-full TLS-ellenőrzéssel. Tanúsítványhiba esetén állj meg; a hiteles Supabase CA PEM helyi fájlját --ca-file paraméterrel lehet megadni. Ne kapcsold ki az ellenőrzést.

## 2. Export

A repository scripts/owner-encrypted-backup.py és scripts/case-store-recovery-manifest.sql fájljai azonos könyvtárban legyenek a tulajdonosi gépen. A jelenlegi telepített Python használható; külső Python-csomag nem kell.

PowerShellben (az UJJLENYOMAT helyére a nyilvános, ellenőrzött GPG-ujjlenyomat kerül):

```powershell
python .\scripts\owner-encrypted-backup.py --output "D:\SarberkiBackups" --recipient UJJLENYOMAT
```

A program kizárólag helyben kéri a DB-jelszót, rejtett bevitellel. A jelszó nem parancssori argumentum vagy fájl; a pg-kliensek környezetében a futás idejére szükséges. A forrást nem módosítja. Az összes adatbázisséma pg_dump custom archívuma közvetlenül GPG-titkosításba folyik; a lemezre nem ír nyílt dumpot. Exportálja a globális szerepköröket jelszavak nélkül, valamint a readonly állapotmanifestet. Az Auth adatokat, köztük érzékeny Auth rekordokat a titkosított dump tartalmazza.

Bármely export-, titkosítás-, jogosultság-, tanúsítvány- vagy visszaolvasási hiba blokkoló. A Supabase menedzselt sémáinak/role-jainak esetleges exporthibáját nem szabad csendes kihagyással megoldani. A hiba után meglévő részfájlok nem igazolnak teljes mentést. Sikerjelző STATUS.txt csak az összes lépés és a visszaolvasott archívum kötelező tábláinak ellenőrzése után készül.

A sikeres könyvtár: database.dump.gpg, roles.sql.gpg, manifest.json.gpg, SHA256SUMS.txt és STATUS.txt. A tartalomjegyzék ellenőrzése nem valódi restore, és a külön manifest nem egy atomi dump-pillanatképből származik; ezért nincs aktív tesztírás az export közben.

## 3. Független tárolás

A teljes könyvtárat és az ellenőrzött ujjlenyomat dokumentációját másold külön, tulajdonos által kezelt tárolóra. A titkos kulcs helyreállítási másolata külön védett helyen legyen. Másolás után minden .gpg fájl SHA256-értékét hasonlítsd a SHA256SUMS.txt-hez, és a független másolatból ismét ellenőrizd a GPG-visszaolvasást. Kulcs nélkül egy ép ciphertext nem helyreállítható mentés.

## 4. Izolált restore

Jelen munkamenetben nincs igazolt izolált teljes PostgreSQL/Supabase restore-környezet. Új fizetős projektet ne rendelj. Meglévő, helyi izolált PostgreSQL 17 vagy díjmentes, külön Supabase tesztprojekt használható, ha ténylegesen rendelkezésre áll és megfelelő az infrastruktúra.

A cél címe/projektazonosítója különbözzön a forrástól. A cél üres, eldobható tesztkörnyezet legyen. A forráshoz ne fusson pg_restore, --clean vagy adatbázistörlés. A szerepköröket a cél Supabase menedzselt role-jaival össze kell egyeztetni a hivatalos restore-útmutató szerint; ne adj blanket SUPERUSER jogosultságot. Helyi teljes restore-hoz a forrásból exportált szerepkörök és Auth-séma előfeltételeit biztosítani kell. A GPG-dekódolás stdoutját pg_restore --exit-on-error folyamatába kell vezetni, mindkét folyamat hibakódját ellenőrizve. A szerepkörök és adat visszaállítása közben szükséges titkok kizárólag tulajdonosi környezetben használhatók.

A jelen helper szándékosan nem futtat restore-t: az izolált célt és annak szerepkörkezelését itt nem tudtuk igazolni. A helper nem állít elő automatikus destruktív rollbacket.

## 5. Siker feltételei

- Az összes szükséges séma, Auth-adat, öt sc_* tábla, kulcs, RLS, policy, grants és security-definer függvény visszaállt.
- Ugyanaz a case-store-recovery-manifest.sql futott a külön célon; counts, checksums, policy-k, constraint-ek, grants és függvénydefiníciók egyeznek. Audit gaps és latest_hash_mismatches = 0.
- Valódi Auth munkamenetekkel reader/writer/tenant-isolation, közvetlen írástiltás, CAS (pontosan egy siker), rollback és audit teszt lefutott. Helyi SQL role-szimuláció nem igazol felhős Auth-ot.
- A Supabase projekt konfigurációját (Auth beállítások, API-expozíció, függvények, Storage bináris objektumok, Vault kulcsok) külön kell leltározni; ezeket a PostgreSQL-logikai dump önmagában nem állítja helyre. Role-jelszavak és API-kulcsok nincsenek a role-exportban.

Hivatalos háttér: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
A mentés és az izolált restore igazolásáig nincs API-aktiválás.
