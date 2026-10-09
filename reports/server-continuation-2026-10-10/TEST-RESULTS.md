# Friss végrehajtási eredmények

| Ellenőrzés | PASS | FAIL | Megjegyzés |
|---|---:|---:|---|
| Végső egyesített `npm test` | 854 | 0 | 0 skipped/cancelled/todo; 68881.728 ms; a korábbi 821 + 23 saját és 10 párhuzamosan érkezett új teszt. |
| Célzott hat tesztfájl | 72 | 0 | 50115.749 ms, a végső runtime preview bekötés előtt. |
| Végső server-foundation részhalmaz | 24 | 0 | Tartalmazza az utolsó szerveres preview-integrációs tesztet. |
| Bővített Auth-probe belső assertionök | 36 | 0 | Egy automatizált teszten belül; HTTP/Auth szimulált, PostgreSQL PGlite. Nem hozzáadandó a 844-hez. |
| Új valódi operátori Auth felhős suite | 0 | 0 | BLOKKOLVA, nem futott. Korábbi, dokumentált valódi suite: 25 PASS / 0 FAIL. |
| Teljes felhős booking-cases E2E | 0 | 0 | MÉG NEM KÉSZ; végpont kikapcsolva. |

`npm ci` sikeres (3 csomag; lockfile változatlan). Frontend statikus build sikeres (49 asset); dummy környezeti kulcsok és szervermodulok nem publikálódnak. `git diff --check` sikeres.

Friss felhős read-only manifest: 5 RLS-tábla, 2 tenant, 3 membership, 2 case, 2 message key, 3 audit. 0 auditgaps, 0 latest-hash-mismatch; 0 can_approve. Friss Netlify GET: HTTP 503, CASE_STORE_DISABLED.

A titkosított izolált restore teszt kizárólag helyi szintetikus PostgreSQL fixture. A tényleges Supabase-adatbázis teljes mentése, tartós titkosított tárolása és külön teljes restore-próbája nem történt meg.

A teljes, friss automatizált futás kimenete: `AUTOMATED-TEST-OUTPUT.txt`. A célzott futásé: `TARGETED-TEST-OUTPUT.txt`. Ezek kizárólag helyi szintetikus tesztkimenetek, nem felhős Auth-logok.

A távoli tesztág összevezetése utáni első futás 853 PASS / 1 FAIL eredményt adott. Az új recorded replay teszt a kétfős ház kizárását tévesen unverified találatnak várta. Javítás: capacity_incompatible kizárás és annak igazolása, hogy nincs small-house PMS-hívás. A javított recorded részhalmaz 4 PASS / 0 FAIL, majd a fenti teljes újrafutás 854 PASS / 0 FAIL. Nyitott automatikus teszthiba nincs.
