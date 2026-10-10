# Sárberki mentés: ellenőrzött másolat pendrive-ra és külön számítógépre

**Állapot, 2026-10-10:** a segéd elkészült, de tényleges helyi adatbázismentés és izolált visszaállítás NEM igazolt. Ez a program nem tudja pótolni a Windows laptop M: meghajtóján elakadt mentést. Nem használ valós vendégadatot a tesztjeiben.

## Előfeltétel

A laptopon az előző mentőprogramnak először létre kell hoznia egy sikeres, titkosított sarberki-YYYYMMDDTHHMMSSZ... mappát. Ebben az alábbi öt fájlnak szerepelnie kell: database.dump.gpg, roles.sql.gpg, manifest.json.gpg, SHA256SUMS.txt és STATUS.txt. Hibás, hiányos, FAILED.txt-vel vagy félbemaradt fájllal rendelkező forrás nem másolható.

## Egyszerű használat Windows PowerShell 7-ben

1. Csak a sikeres helyi mentés után csatlakoztasd a pendrive-ot vagy tedd elérhetővé az asztali gép megosztását.
2. Hozd létre a célmappát a külön adathordozón, majd a verziózott scripts mappából futtasd az alábbit a VALÓDI mentésmappával és a VALÓDI meghajtóbetűjellel:

    pwsh -NoProfile -File .\copy-owner-encrypted-backup.ps1 -SourceBackupPath 'M:\Sarberki\Biztonsagi-mentesek\sarberki-YYYYMMDDTHHMMSSZ-xxxxxxxx' -DestinationRoot 'E:\Sarberki-mentesek'

Hálózati megosztásnál a cél például \\asztali-gep\Sarberki-mentesek lehet. A célmappának már léteznie kell. Jelszót ne másolj a chatbe, GitHubba vagy a parancssorba.

## Mit ellenőriz a program?

- A forrás pontosan három elvárt, nem üres .gpg fájlt és a két kísérőfájlt tartalmazza; nem jelölt sikertelennek.
- Az SHA256SUMS pontosan a három .gpg fájlt sorolja fel, és azok SHA256 ellenőrzőösszege megfelel.
- A forrás és cél nem fedi át egymást, nem egy meghajtóbetűjelen vannak, és a célban nincs már azonos nevű mentés.
- Átmeneti könyvtárba másol, az ottani SHA256-ot újraellenőrzi; csak ezután nevezi véglegesre. Másolás közbeni hiba esetén a részleges célt eltávolítja.
- COPY-VERIFIED.txt készül. Ez CSAK a titkosított fájlok egyezését jelenti, nem SQL-visszaállítást.

## Ami ettől még nem kész

Egy másik meghajtóbetűjel önmagában NEM bizonyít külön fizikai adathordozót (például partíció, SUBST vagy hálózati leképezés is lehet). Az eszköz fizikai elkülönülését embernek kell ellenőriznie. A másolatot a célgépen ismét vissza kell olvasni. A GPG-visszafejtési kulcsot külön, biztonságosan kell őrizni, és az izolált PostgreSQL restore + Auth/RLS/CAS/audit próbát külön végre kell hajtani.

A Supabase sarberki-test szervert, a main és production ágakat, a Previo rendszert vagy a CASE_STORE_ENABLED=disabled állapotot ez a program semmilyen módon nem módosítja.