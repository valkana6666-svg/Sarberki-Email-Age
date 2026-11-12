# V3-1 – közös fogadó végpont (telefon + chat → napi kezelő)

Tulajdonosi jóváhagyás: V3-terv, 2026-11-12 (#9 6822281802, `V1-ALLAPOT.md` V3-TERV sor). Csak TEST.

## Mi készült el (kód, tesztek; telepítés és bekapcsolás NINCS)
| Rész | Fájl | Mit csinál |
|---|---|---|
| Adatbázis | `deployment/intake/install.sql` (+ `install.verify.sql`, `rollback.sql`) | `sc_intake_create`: egy hívásból vagy chatből egy függő ügy; szerveroldali aláírás (`intake-source-v1`); hívásazonosítónként legfeljebb egy ügy; külön `sc_intake_actors` nyilvántartás – az intake fiók semmi mást nem tud (olvasni sem) |
| Szerver | `shared-core/server-intake.mjs` | `check_availability`: központi döntés + csak olvasó Previo → állapot és vendégmondat (ár nélkül); `create_booking_request`: a meglévő ügymotor és tervezet → függő ügy |
| Végpont | `netlify/functions/intake.mjs` | alapból KI (`INTAKE_ENABLED=test-only` kell); csak HMAC-aláírt kérés (5 perces ablak); fix hibakódok |
| Értesítés (V3-4) | `netlify/functions/intake.mjs` `notifyOperator` | új telefonos/chates igénynél egy Pushover-üzenet személyes adat nélkül; alapból KI (`INTAKE_NOTIFY=pushover` + külön tulajdonosi engedély, AGENTS) |
| Napi kezelő | `napi-kezelo/napi.mjs`, `booking-cases.mjs` | a telefonos/chates ügy a meglévő listában; „Forrás: telefon” felirat; „Válasz küldése” nincs (visszahívás); minden más lépés (ár, véglegesítés, V2, lemondás) változatlanul működik |

Bizonyíték: `tests/intake-pglite.test.mjs` (valódi PostgreSQL: egy ügy/hívás, dupla tiltva, csak az intake fiók hozhat létre, hamis aláírás tiltva, az intake fiók nem olvas, a kezelő véglegesítheti), `tests/intake-endpoint.test.mjs` (KI alapból, aláírás, ismétlés tiltva, fix kódok). Élő Previo-olvasással (73521) a `check_availability` helyes: szabad / nincs / nem fér el.

## Bekapcsolás TEST-en (később, tulajdonosi engedéllyel)
1. DB-telepítés: `[test-db-install deployment/intake/install.sql]` + jóváhagyás a GitHub-alkalmazásban.
2. Supabase (TEST): új Auth-felhasználó (pl. intake fiók), majd egy sor az `sc_intake_actors` táblába (tenant `sarberki-test`). Tagságot (olvasás/írás) NEM kap.
3. Netlify (TEST) változók: `INTAKE_ENABLED=test-only`, `INTAKE_HMAC_KEY` (64 hex), `INTAKE_ACCOUNT_EMAIL`, `INTAKE_ACCOUNT_PASSWORD` – titkok, csak a Netlifyben.
4. TEST-kiadás → szintetikus aláírt hívásokkal élő próba → utána a hangügynök (Retell) beállítása ugyanezzel a kulccsal.

## Még hátra (V3-2/3/4)
Hangügynök (Retell, HU/DE, havi korlát 100 $, átadás a recepció számára), a Retell saját aláírás-formátumának illesztése, chatből foglalási igény (V3-3, nyilvános oldal → szerveres proxy hozzájárulással és korláttal), Pushover-értesítés (V3-4). Hangfelvétel: alapból nincs, csak összefoglaló (tulajdonosi döntés nyitott).
