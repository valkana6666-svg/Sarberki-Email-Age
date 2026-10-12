# V1 kiadásra jelölés – 2026-10-18

Ez a meglévő V1, központi szerver és külön chatbot folytatási leltára.
A kiadásra jelölés nem élesítési engedély. Az állandó végrehajtási szabályok
az `AGENTS.md` fájlban vannak; nem készül második szabálymag.

## Ellenőrzött kiindulás 2026-10-12

HEAD: `ffb695c092aa82fb4d4c647e16468af3f0d9a642`.
Teljes regresszió: **1215 PASS, 0 FAIL**.
CI: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38210141001
A CI `DEPLOY SYNC PASS` a leafy tesztcél azonos SHA-ját igazolta.

Hétfői új javítás: a meglévő osztott elhelyezési modell már a poolhívások előtt
kizárja a fizikailag alkalmatlan, kifejezetten kért tervet. Egy C/6 fő: 0 hívás;
egy C/5 fő: 1 C-hívás, pótágy-/felárjelzés megmarad; két kifejezetten kért C/6 fő:
1 C-hívás és pontosan két C, kevert terv nélkül; alkalmas, kért A+C: mindkét pool
egyszer. A párhuzamos `1e3a230a7de0123a2920da104494a92b324dafd1` alapból megmaradt
a kisebb vendégszámra is alkalmas C keresése és az A/B típuspool-deduplikálás.
Az explicit ismeretlen tárolt háztípus külön pontosítást igényel, nem válik általános
kereséssé; a valóban hiányzó típus továbbra is engedi a keresést. Összesen 11 új
regresszió; célzott csomagok 65/65 és 69/69 PASS (részben átfednek).
Helyi teljes `npm test`: 1238 PASS, 0 FAIL, 0 SKIP. Ez helyi bizonyíték; a publikált commit CI-azonosságát külön
kell ellenőrizni és a koordinátori jelentésben pontos linkkel rögzíteni.

A korábbi kapacitás/ár, gyermekadat, pótágy és lekérdezési szűrési commitok
beépültek ebbe a kiindulásba. A régi sikertelen CI-k önmagukban nem jelenlegi
hibák: a jelenlegi teljes csomag a javításokkal sikeres.

| Terület | Meglévő bizonyíték | Kiadásra jelölési feltétel |
| --- | --- | --- |
| Közös szabálymag és egy-/többegységes szűrés | Aktuális 1215 tesztes CI; célzott capacity/extra-bed/fallback tesztek | Új változás után célzott negatív teszt és kötelező teljes regresszió |
| HU/DE/EN/SI, chatbot memória, magyar ellenőrző szöveg | Aktuális unit/paritás tesztek; korábbi browser/PWA 24 PASS a `0046812` commithoz | A végleges kiadásjelölt releváns nyelvi/mobil ellenőrzése |
| Auth/RLS/CAS/audit és tárolt verziók | Korábbi valódi izolált Auth/API/PostgreSQL/browser 13 PASS, run 38199150597; Compose HTTPS/restart 10 PASS, run 38197327744 | Jogosultsági módosításnál érintett valós DB/Auth ellenőrzés; elavult/unknown bizonyíték tiltott |
| Állandó HTTPS és főképernyős metaadat | Meglévő Netlify chatbot, manifest, ikonok, no-store verziófigyelés | Valódi iPhone-főképernyős próba még NEM IGAZOLT |
| Friss kezelői ügyadat a Netlify-on | Read-only kliens és közös szerver-preview kód; konfiguráció korábban 503 TEST_DATA_UNAVAILABLE | Netlify adminbeállítás, tulajdonosi Auth és felhős hozzáférés tényleges ellenőrzése |
| Élő Previo-kapacitás és ár | Kapcsoló alapból tilt; szintetikus hiba-/forrás-/hívásszám-tesztek | Mellékhatásmentes read-only kapcsolat és forrásbizonyíték igazolása nélkül nincs élő lekérés vagy ajánlat |
| Mentés/helyreállítás | Forrásmentések és korábbi titkosított DB-snapshot 43 táblás izolált restore | Friss teszt-DB export és izolált restore, külön Auth/secret/szolgáltatói és teljes platform-helyreállítás |

## Heti végrehajtási sor

- **Hétfő, 10-12:** aktuális commit/CI, állandó fejlesztői útmutató és a megmaradt
  előzetes igény-/alkalmassági szűrési hibák célzott javítása.
- **Kedd, 10-13:** kapacitás és ár; hiányzó, hibás, sikertelen, lejárt és más
  időszakhoz/tenanthez tartozó források. A kész teszteket ne ismételjük indokolatlanul.
- **Szerda, 10-14:** e-mail/chat közös döntési paritás; jogosultság, tárolt tervezet,
  CAS és emberi jóváhagyás.
- **Csütörtök, 10-15:** négy nyelv; hiányok, gyermekkorok, pótágy, kedvezmény és
  foglalási feltételek. Belső házszámot tartalmazó vendégválasz tiltott.
- **Péntek, 10-16:** aktuális HTTPS build és tényleges iPhone-próba; csak szintetikus
  vendég-/e-mail-folyamat. Saját eszközpróbához felhasználói közreműködés szükséges.
- **Szombat, 10-17:** a végleges jelölt indokolt teljes regressziója/integrációja,
  audit, adatmegőrzés és új, izolált mentés-visszaállítás, hozzáférések függvényében.
- **Vasárnap, 10-18:** bizonyítékok és fennmaradó akadályok alapján kiadásra jelölés;
  tényleges telepítés/élesítés külön döntés.

A dátum nem indokol már igazolt munka megismétlését. A függőség és a rendelkezésre
álló hozzáférés szabja meg a következő lépést; akadályt NEM IGAZOLT/BLOKKOLT állapottal
kell rögzíteni. A táblázat korábbi bizonyítékai nem automatikusan a jövőbeli jelöltre
vonatkoznak. A GitHub #3 mérési/benchmark-fejlesztés halasztott, most nem végrehajtandó.

## Aktiválási korlátok

Nem történhet valódi foglalás, automatikus vendégküldés, Pushover-küldés, Previo-írás,
titok/valódi vendégadat naplózása, main/production módosítása vagy forrás-DB restore.
Szintetikus tesztadat nem igazol valós, aktuális foglaltságot. Hiányzó admin-, Auth-,
hosting-, mentési vagy szolgáltatói hozzáférést külön kell jelezni; a bizonyíték hiánya
sem sikernek, sem önmagában regressziónak nem tekinthető.
