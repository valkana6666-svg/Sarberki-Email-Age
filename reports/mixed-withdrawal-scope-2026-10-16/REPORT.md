# Vegyes szállásigény és dézsalemondás – 2026-10-16

## Igazolt hiba és javítás

Kiindulás: `8dfbc56d24227beeb772f051aa18e6b486f7050f`, kizárólag
`gmail-test-subject-allowlist`. A dézsát lemondó szöveg korábban mindig
`serviceOnly: true` besorolást kapott, akkor is, ha ugyanaz a jelenlegi levél
új szállást kért. Így a szolgáltatásügy útvonala elhagyta a szállásadatokat.

A közös `shared-core/tub-request.mjs` most ugyanazt a meglévő szállásigény-felismerést
használja a dézsakérés és a dézsalemondás esetében. A vegyes kérés a normál
foglalási ügyútvonalon marad; a dézsalemondás külön, nem igazolt és emberi
ellenőrzést igénylő szolgáltatástétel. Nincs második szabálymotor vagy új jogosultság.
A tisztán szolgáltatásra vonatkozó levél továbbra is a meglévő szolgáltatásügyet használja.

## Bizonyíték

- A két új regressziós teszt javítás előtt hibázott (15 PASS, 2 FAIL).
- Javítás után célzott csomag: **25 PASS, 0 FAIL, 0 SKIP**.
- HU/DE/EN/SI: új szállásigény és dézsalemondás együtt, szállásadatok megőrzése,
  korábbi ügy változatlansága, külön szolgáltatásállapot és függő jóváhagyás.
- A meglévő Writer/Reader integráció kibővítve: tényleges izolált PostgreSQL/PGlite,
  normál szerveres értelmezés → tartós ügy és tervezet → Reader-preview,
  CAS és audit ellenőrzésével. Az új szintetikus ügy egy auditbejegyzést hoz létre;
  a korábbi szállásügy teljes DB-sora változatlan marad.
- Ez helyi izolált adatbázis-bizonyíték, nem új felhős vagy élő Gmail/Previo próba.
- Helyi teljes `npm test`: **1646 PASS, 0 FAIL, 0 SKIP**.
- Az adott commit CI/deploy eredménye külön ellenőrzendő;
  a koordinátori zárójelentésben az adott commit teljes SHA-ja és CI-linkje szerepel.

## V1 állapot és következő feladat

Becsült készültség: **90%**, mérnöki becslés. A közös mag, négynyelvű feldolgozás,
ügytár, tervezet, emberi összerendelés és külön szolgáltatás-jóváhagyás már létezik;
a tesztszám önmagában nem igazol teljes készültséget. Nyitott: szolgáltatói tesztadatokkal
az API-szerződés és mellékhatásmentesség igazolása; tényleges iPhone-próba;
a végleges jelölt mentési/helyreállítási és integrált elfogadási ellenőrzése.

A Previo-hozzáférés a tulajdonos tájékoztatása szerint 2026-10-19–20-ra várható.
Addig folytatható a szintetikus levélértelmezés és a bizonytalan szándékok
biztonságos kezelése; külön következő eset a tagadott/ellentmondó lemondási szándék.

## Korlát és V2/V3 érték

Csak szintetikus adatok, helyi teszt és engedélyezett tesztág.
Nincs valódi postaládaolvasás, e-mail-/Pushover-küldés, Previo API-hívás vagy írás,
valódi foglalás, jogosultságmódosítás, main- vagy production-változtatás.
A megőrzött közös modulhatár a későbbi önálló agent számára is egységes
szándékbesorolást ad; egy tervezet vagy belső jóváhagyás továbbra sem végrehajtási engedély.
