# Sárberki V1 folytatás – 2026. október 10.

## Kiindulás

A GitHub connectorral ellenőrzött tesztági HEAD pontosan `ea31859a107c6aa9b9f37ba3eb21932315a67734`. A `server-continuation-2026-10-10/REPORT.md`, az `owner-safety-audit-2026-10-10/READONLY-CHECK.md` és az AGENTS.md alapján folytattuk. Elkülönített helyi checkout a kizárólag engedélyezett `gmail-test-subject-allowlist` ágon; a korábbi munkakönyvtárak és az ott talált untracked Python mentési segéd változatlanok. Nincs új architektúra vagy chatbot.

## Tényleges fejlesztés

1. A meglévő szerveres ingest most a provider message/thread ID mellett az RFC Message-ID, In-Reply-To és References mezőket is mailbox szerint elkülöníti az ügyazonosítás idejére. Tároláskor megőrzi az eredeti hivatkozásokat. Külön postafiókban egyező RFC-referencia nem kapcsol ügyeket automatikusan össze; azonos postafiókban továbbra is kapcsolható. Azonos feladó önmagában továbbra is emberi ellenőrzést igényel.
2. A kliens által megadott `case_id` nem kerülheti meg az ügyösszekapcsolás külön `approve` jogosultságát.
3. A belső szintetikus review új szabályrendszer helyett a meglévő `stageFacts`, `cabinKey` és jóváhagyott tenant inventory alapján szűr. Hibás dátum, 18 éves gyermeknek sorolt személy, hibás életkor, ellentmondó éjszakaszám, ismeretlen háztípus, elégtelen névleges férőhely vagy egységkészlet esetén nincs provider-hívás. Nem ígér igazolatlan pótágyat.
4. A szintetikus árforrásnak a tenanttal, háztípussal, érkezéssel és távozással egyeznie kell, friss ellenőrzési idővel. Sikertelen/hiányos/idegen/lejárt árból `price_unknown`, pending eredmény lesz. Árazás után újra ellenőrizzük a kapacitásbizonyíték érvényességét. A fix egységár és a külön bérelhető dézsa szabálya megmaradt.
5. Elkészült a meglévő Windows PostgreSQL 17 és Gpg4win programokra épülő owner mentési segéd. Ez előkészítés: tényleges Windows-futtatás nem történt. Pontos helyi lépések az OWNER-BACKUP.md-ben.

A review továbbra is belső fixture-próba: nincs HTTP-akció, nincs ár-/kapacitásbizonyíték-írás vagy vendégár. Az eredeti SQL bizonyítékírás-tiltását nem kerültük meg.

## Ellenőrzött eredmények

- `npm ci --ignore-scripts`: sikeres, lockfile változatlan.
- Célzott runtime/review suite: **53 PASS / 0 FAIL**.
- Teljes `npm test`: **872 PASS / 0 FAIL**, 0 skipped/cancelled/todo. A 17 új teszt a teljes szám része, részhalmazokat nem adunk hozzá. A teljes futásban a meglévő PostgreSQL/PGlite HTTP-szimulációs és helyi restore-próbák is lefutottak. Ez nem új valódi felhős Auth/E2E futás.
- Frontend build a kiinduló commitazonosítóval: sikeres; szervermodul nem került a publikált assetek közé. Ez helyi csomagolási ellenőrzés, nem az új változat Netlify-telepítési bizonyítéka.
- `git diff --check`: sikeres.
- Fejlesztési GitHub commit: `87b36be9c3b48a383d98d5c820279fb73abfccbf`, tesztágon megőrizve; helyi és GitHub tree SHA egyezik (`f24e7ca3ffa7a6c4067da4329704fb682ddfe56e`). A GitHub Actions futás is **872 PASS / 0 FAIL**; exact Netlify deploy, MNB és publikus árreferencia smoke sikeres, az élő Previo smoke kihagyva. Futás: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38034900337
- Az új tesztoldali `build-info.mjs` közvetlen visszaolvasása: `87b36be9c3b48a383d98d5c820279fb73abfccbf`. Az alábbi tiltó HTTP-eredményeket a telepítés után is újra igazoltuk. Ez a verzióazonosságot és a tiltás megőrzését igazolja; nem felhős booking E2E.
- Friss nyilvános GET a teszt Netlify ügy-API-n: **503 / CASE_STORE_DISABLED**. A korábbi Auth-tesztkapu: **404 / kikapcsolva**.
- Supabase `sarberki-test` / `mojnqizbcaczstguikpv`: **ACTIVE_HEALTHY**, PostgreSQL 17.11.0.003. Az eredeti verziózott read-only recovery manifest lefutott: öt RLS-védett tábla, 2 tenant, 3 membership, 2 case, 2 message key, 3 audit; 0 audit gap, 0 legfrissebb hash-eltérés. `case_checksum=104528db7c0c6240334f11ce1b3c3046`, `audit_checksum=dd5d7331a8ab764cbf40b3463046205c`; az előző állapottal egyeznek.
- Security advisor: a korábbi `rls_auto_enable` EXECUTE és leaked-password-protection figyelmeztetések megmaradtak. Nem történt migráció vagy Auth-beállítás-módosítás. A szándékosan hitelesített alkalmazási definer függvények jelzései továbbra is külön értékelendők.

## Mentés: nem kész

Itt nincs PostgreSQL kliens, Docker, közvetlen DB-hitelesítés és a tulajdonos Windows gépét vezérlő hozzáférés. SQL-connectorból nem készül teljes `pg_dump`. Nem készült új titkosított felhős mentés, független tartós másolat, illetve teljes izolált SQL/Auth-restore. A script és a read-only manifest nem helyettesíti ezeket.

Következő tulajdonosi lépés: a két mentési fájl helyi előkészítése, a segéd áttekintése és futtatása, majd a Session pooler kapcsolat és DB-jelszó helyi bevitele; a titkosítási jelmondat kizárólag a Gpg4win helyi ablakában adandó meg. A meglévő jelszót nem állítjuk vissza. Telepítéseket nem ismételtünk.

## Previo API

A hozzáférhető privát Gmail-fiókban megtaláltuk a 2026. szeptember 22-én elküldött „API-hozzáférés és ajánlatkérés – Sárberki Horgásztó” levelet. A `from:previo.hu after:2026/09/22` keresés ott nem adott beérkezett választ. A teszt Gmail-fiókban a `from:previo.hu OR subject:API` szeptember 22. utáni keresés sem adott találatot. Ez nem igazolja más fiók/Outlook vagy telefonos egyeztetés hiányát. Új levelet nem küldtünk.

A meglévő read-only kapacitáskapu és opt-in crosscheck megmaradt. Dokumentált, mellékhatásmentes hivatalos olvasási művelet, hitelesített hozzáférés és tesztkörnyezet-bizonyíték nélkül élő Previo-lekérés nem indult. A hivatalos integráció bekötéséhez továbbra is a hozzáférés és dokumentáció igazolása szükséges.

## Mi maradt a V1-ből

Nem adunk megtévesztő készültségi százalékot: az alapmotor tesztelt, de az üzemi tesztet blokkoló öt munkacsomag még nyitott.

1. Tényleges titkosított export, független tárolásból visszaolvasás, teljes izolált Supabase/Auth-restore és tulajdonosi kulcsleltár.
2. Új operátori Auth-munkamenetekből a 36 assertion, valódi aláírt lejárt JWT, visszavont refresh-token próba és security advisor rendezés. A korábbi 25 felhős PASS korábbi bizonyíték marad.
3. Dokumentált hivatalos Previo read-only kapcsolat, megbízható szerveres kapacitás-/árlekérés és verziózott, védett tartós bizonyítéktárolás. Jelenleg a DB ezt szándékosan tiltja.
4. Folyamatos szerveres mailbox-beolvasás és az ügy/draft végleges adatútvonala. A meglévő szintetikus szerver-parser és ingest nem működő háttér-mailkapcsolat.
5. A teljes szintetikus felhős booking-cases E2E és a felügyelt V1-tesztverzió igazolása az előfeltételek után. A helyi szintetikus próbák nem teljesítik ezt.

**Következő konkrét feladat: a Windows-gépen ténylegesen elkészíteni a titkosított logikai exportot; utána független másolat és izolált restore.**

Main és production változatlan; nincs éles vendégadat, levélküldés, Previo-írás, fizetős szolgáltatás vagy CASE_STORE_ENABLED-aktiválás. Felhős adatot ebben a munkamenetben nem írtunk.
