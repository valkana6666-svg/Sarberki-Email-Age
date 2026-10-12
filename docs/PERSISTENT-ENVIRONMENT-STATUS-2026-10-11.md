# Tartós tesztkörnyezet – tényleges állapot

Ellenőrzés: 2026-10-11. Kizárólag `gmail-test-subject-allowlist`;
kiinduló commit `4440edacfc4f612cb2637c398317fb34742cebea`.

## Igazolt, csak olvasási felhős ellenőrzés

- `sarberki-test` (`mojnqizbcaczstguikpv`): ACTIVE_HEALTHY, PostgreSQL17.
- Tényleges adatbázisnév: `postgres`. Az öt ügytábla RLS-védett.
- `authenticated` az ügytáblákhoz SELECT jogot kap; közvetlen írás nincs.
- A write RPC `auth.uid()` és DB-tagság alapján ellenőriz; append-only
  üzenet/tervezet, CAS, és tranzakciós audit megmarad. Jóváhagyott állapotot tilt.
- Leltár kizárólag aggregált: 2 tenant, 2 ügy, 3 auditesemény. Vendégadat nem olvasva.
- Netlify tesztcél: `leafy-chimera-2403e5`. HTTPS `build-info.mjs` a kiinduló
  SHA-t mutatta; ügy-API 503 `CASE_STORE_DISABLED`.
- A Netlify adminfelület bejelentkezést kér. Környezeti változók tényleges
  megléte/értéke nem ellenőrzött; nem jelentjük hiányzónak.

## Biztonságos folytatás

A meglévő jóváhagyási SQL kizárólag külön `sc_approval_test` adatbázisra telepíthető.
A jelenlegi managed projekt `postgres` adatbázisát nem alakítjuk át, és a guardot
nem lazítjuk. A jelenlegi projekt így továbbra is szintetikus, pending ügyek
tárolási célja lehet; teljes jóváhagyási környezetként még nem igazolt.

A `deployment/isolated-approval` csomag a meglévő Auth/RLS/CAS/audit API és közös
tervező külön telepítését készíti elő, külön DB/volume és belső hálózat mellett.
Szintetikus fixture-kapacitást és árat használ, nem élő Previo-adatot.
GitHub Actions csak eldobható runneren vizsgálhatja; az ottani HTTPS nem bizonyít
nyilvános DNS-t, tartós hostingot vagy iPhone-hozzáférést.

Távoli induláshoz még szükséges: meglévő, elkülönített konténerhost adminhozzáférése,
engedélyezett HTTPS hostname/DNS, hiteles TLS, secret ownership, erőforrás- és
hálózati korlátok. Netlify Functions nem futtatja ezt a tartós Compose-adatbázist.
Új fizetős erőforrás vagy előfizetés nem lett aktiválva; pontos új hostingköltség
célhost nélkül NEM IGAZOLT.

## Kezelőfelület és mentés

A meglévő Gmail szerverelőnézet közös döntést, magyar ellenőrző szöveget,
kapacitás/ár státuszt és tárolt verziókötést mutat. Csak hitelesített GET;
az audit visszaolvasás nélkül NEM IGAZOLT. Nincs mentés, küldés vagy jóváhagyás.
A read-only előnézet nem jelenti az egész Gmail ügyfolyamat éles aktiválását.

A friss mentési workflow a meglévő protected konfigurációval csak a rögzített
tesztprojektet olvassa. Titkosítás/dekódolás után ugyanazon snapshot külön
PostgreSQL service-be áll vissza; SHA256, commit/run/projekt kötés kötelező.
Sikerét a konkrét run és restore JSON bizonyítja, nem a workflow megléte.
Forrásadatbázisba restore tilos. Az eredeti mentés változatlanul megőrzendő.

Valódi iPhone: NEM IGAZOLT; kézi ellenőrzés: `GMAIL-SERVER-IPHONE-CHECKLIST.md`.
Gmail OAuth admin, Previo hozzáférés, Netlify secret konfiguráció, GPG-jelmondat
független visszaállíthatósága és laptop hiteles ügytárexportja: NEM IGAZOLT ebben
a munkában. Korábbi leltár: `RESTORE-GAPS-2026-10-11.md`.
Teljes platform-helyreállítás külön Auth/szolgáltatói/TLS/secret próbát igényel.
