# Windows mentés: pontos folytatási pont

A PostgreSQL 17 és a Gpg4win már telepítve van. Nem kell újratelepíteni.
A Supabase Connect panelen a Session pooler van kiválasztva.

## Ami helyben szükséges

1. A két fájl ugyanabban a helyi könyvtárban: `owner-encrypted-backup.ps1` és `case-store-recovery-manifest.sql` a repó `scripts` mappájából. A script forrását futtatás előtt olvasd át.
2. Saját, titkosított Windows-lemez; a mentés nem kerülhet git repóba. A program kérésére csak akkor írd be a `MENTES` szót, ha ez teljesül és nincs aktív ügyírás.
3. PowerShellben, a két fájl könyvtárából:

```powershell
powershell.exe -NoProfile -File .\owner-encrypted-backup.ps1
```

Ha a helyi végrehajtási szabályzat tiltja, itt meg kell állni és a tulajdonos gépén ellenőrizni a szabályzatot. A segéd nem módosítja azt.

4. A script helyben kéri a Connect panel **Host** mezőjét és a **User** mezőt. Csak London Session pooler, 5432-es port, `postgres.mojnqizbcaczstguikpv` felhasználó, `postgres` adatbázis engedélyezett. A teljes URI-t ne másold be. A DB-jelszót kizárólag a helyi, rejtett PowerShell-kérésbe írd; a jelszót ne állítsd alaphelyzetbe.
5. A Gpg4win helyi ablakában adj meg erős titkosítási jelmondatot és őrizd meg külön biztonságos helyen. A DB-jelszó és a titkosítási jelmondat nem kell a chatbe. Nincs szükség előre létrehozott GPG kulcspárra; a segéd szimmetrikus AES-256 titkosítást kér.

## Mit végez a segéd, ha ténylegesen lefut

Teljes logikai `pg_dump --format=custom`, role-export role-jelszavak nélkül, ügytár-manifest, GPG titkosítás és SHA-256 fájlellenőrzők készülnek. A titkosított adatbázisarchívumot helyben visszafejti és összeveti az eredeti archívummal. Az export előtt és után az ügytár-manifestnek egyeznie kell. A kapcsolat alapértelmezetten read-only; forrásadatot nem módosít.

A Windows PowerShell 5 bináris csővezetékét nem használja: átmeneti, titkosítatlan exportot a megerősített titkosított lemezen, korlátozott ACL-lel tart. Ezt a `finally` blokk törli. Áramszünet/kényszerleállítás esetén a `temporary-plaintext` mappa megmaradhat; emiatt szükséges a titkosított lemez. A normál fájltörlés nem biztonságos felülírás.

`STATUS.txt` csak a sikeres helyi export és visszaolvasás után keletkezik. Hiba esetén `FAILED.txt` jelzi a hiányos próbát. A szkriptet ebben a Work-munkamenetben Windows gépen **nem futtattuk**, PowerShell parserrel **nem ellenőriztük**. Ez előkészített segéd, nem mentési bizonyíték.

## Kötelező további ellenőrzés

- A teljes titkosított mappát másold GitHubtól és a forrásgéptől független tartós célra. A célról visszaolvasott fájlok SHA-256 értékeit hasonlítsd össze a `SHA256SUMS.txt` tartalmával. Ez a lépés még nem történt meg.
- Izolált, kompatibilis Supabase/Auth környezetben kell helyreállítani és ellenőrizni az Auth-ot, RLS-t, tagságokat, CAS-t, auditot és változatlan tervezetelőzményeket. A manifestnek egyeznie kell. A visszafejtés és a `pg_restore --list` nem restore.
- A nyers `pg_dump` a Supabase belső objektumait is tartalmazza. Egy meglévő Supabase-stackbe nem szabad vakon visszatölteni vagy hibákat átugorva sikeresnek minősíteni. A célverzióhoz tartozó hivatalos restore-eljárás és egyeztetett objektumkezelés szükséges.
- Platformbeállítások, JWT/API-kulcsok, OAuth/SMTP, Storage-fájltartalom és Vault helyreállításához külön tulajdonosi leltár kell. A logikai adatbázismentés ezek helyreállítását önmagában nem igazolja.

Hivatalos referencia: https://supabase.com/docs/guides/self-hosting/restore-from-platform

**Jelenlegi állapot: teljes mentés és izolált visszaállítás NEM KÉSZ. `CASE_STORE_ENABLED=disabled` marad.**

## Összevezetés utáni megjegyzés

A PowerShell-helper TLS-ellenőrzése most verify-full, rendszer CA-készlettel; egy hiteles helyi CA PEM -CaFile paraméterrel megadható. Tanúsítványellenőrzési hiba esetén állj meg, ne kapcsold ki az ellenőrzést. Az alternatív owner-encrypted-backup.py közvetlen titkosítási pipe-ot használ, nyílt dump-fájl nélkül; részletes lépései az OWNER-BACKUP-STEPS.md-ben. Egy kiválasztott helperrel készíts exportot, ne ismételd mindkettővel indokolatlanul. Egyik helper Windows-futtatása vagy független restore-ja sincs itt igazolva.
