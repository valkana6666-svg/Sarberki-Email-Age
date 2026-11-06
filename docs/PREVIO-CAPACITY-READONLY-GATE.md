# Sárberki Previo: kizárólag olvasó, titkosított hozzáférésű kapacitásteszt

Állapot: **előkészített, alapértelmezésben zárt** tesztkapu.
A telepített kapu és a böngészős összehasonlítás csak külön ellenőrzés után PASS.

## Biztonsági határok
- Csak `gmail-test-subject-allowlist`, Netlify `leafy-chimera-2403e5`; nem a main/production.
- Csak anonim érkezés/távozás/létszám és Previo nyilvános, csak olvasható háztípus-kapacitás.
- E-mail küldése, valódi foglalás létrehozása vagy módosítása továbbra is tiltott.
- A nyilvános kapacitás típus-pool, nem konkrét szabad ház vagy egyező A/B/C-ház bizonyítéka.

## Kötelező előfeltétel – 2026-10-25-i pontosítás

Az alábbi konfigurációs lépések jelenleg NEM végrehajtható aktiválási utasítások. Előbb a konkrét kapacitásművelet dokumentált mellékhatásmentességét kell igazolni: nem hoz létre foglalást, ideiglenes készletzárolást vagy egyéb írást. A teszthost, a readonly elnevezés, a token megléte vagy egy korábbi sikeres válasz önmagában nem bizonyítja ezt. Árlekérdezésre külön szerződés és bizonyíték szükséges.

Szükséges átadási bizonyíték: választott API-család és verzió, konkrét művelet dokumentációja, a Sárberki hozzáférése és tesztkörnyezete, szolgáltatói mellékhatásmentességi igazolás, fizikai egység–szobatípus megfeleltetés. Titkos kulcsot nem kell és nem szabad a dokumentációba vagy chatbe másolni. Részletes lista: PREVIO-API-HANDOFF-2026-10-21.md.

Ezek hiányában a kapu zárt marad; nincs élő lekérés, workflow-újraindítás vagy deploy. A V1 offline fejlesztése ettől folytatható. A történeti kapacitás-összevetéseket nem töröljük, de nem tekintjük jelenlegi aktiválási engedélynek.

## Későbbi konfiguráció – csak az előfeltételek igazolása után, tesztprojekten
1. Netlify **tesztprojekt** (leafy-chimera-2403e5) → Environment variables:
   `PREVIO_CAPACITY_READ_SAFETY_VERIFIED=true`.
2. Ugyanott egy másik, titkos, véletlenszerű, legalább 32 karakteres érték:
   `PREVIO_CAPACITY_TEST_TOKEN`. Csak Function runtime környezetben legyen; ne kerüljön a JavaScript frontendbe, GitHubba, naplóba vagy chatbe.
3. GitHub repo → Settings → Secrets and variables → Actions → New repository secret:
   `PREVIO_CAPACITY_TEST_TOKEN`, **ugyanazzal a titkos értékkel**.
4. Frissítsd a Netlify tesztprojekt telepítését, ellenőrizd a `/api/health` `deployedCommit` értékét.
5. A tesztági workflow módosítása automatikusan létrehoz egy GitHub Actions futást. A titkos kulcs hiányában ez **szándékosan hibával leáll, Previo-lekérés nélkül**. Miután a Netlify környezeti változóit és a GitHub secretet beállítottad, GitHub → Actions → `Sárberki one-time read-only Previo capacity crosscheck` → a tesztági sikertelen futás → **Re-run failed jobs**. A `workflow_dispatch` csak akkor használható a GitHub felületén, ha a workflow a GitHub alapértelmezett ágán is szerepel; a main ágat ezért nem módosítjuk.
6. Fontos: **NE** állítsd a régi `PREVIO_READ_SAFETY_VERIFIED` kapcsolót true értékre: az a külön árlekérdezési végpontot is megnyitná.

## Összehasonlítás
2026. október 23–25. (4 felnőtt) és 2026. november 9–13. (6 felnőtt).
A manuálisan indított CI kétszer, a közvetlen nyilvános Previo és a hitelesített Netlify teszt-funkció
háztípus-összesítését veti össze. Hibás, hiányzó vagy bizonytalan készlet = nem PASS.
A Previo nyilvános böngészős megjelenítésének **független manuális szemrevételezése**
még külön szükséges. A CI önmagában nem bizonyítja a konkrét fizikai apartmanpárosítást.

## Teszt lezárása
Netlify `PREVIO_CAPACITY_READ_SAFETY_VERIFIED=false`, majd teszttoken törlése/rotálása
Netlify-ban és GitHubban. A kapu zárt állapotban nem küld kérést a Previo felé.

## REST olvasó kliens – előkészítve 2026-11-06 (Claude), élő hívás nélkül
- Forrás: nyilvános Previo REST-dokumentáció (https://rest.apidocs.previo.app/, beolvasva 2026-11-06). Művelet: `GET https://api.previo.app/rest/calendar/availability` (`filterFrom`, `filterTo`, `roomKindIds[]`, `ratePlanId`), fejléc: `Authorization: ApiKey …`, `X-Previo-Hotel-Id`; jogosultság: `Booking.getFreeCapacity`. A dokumentáció nem említ ideiglenes zárolást, de a mellékhatás-mentességet **nem igazolja** – ezt a Previótól írásban kell kérni.
- Kód: `shared-core/server-previo-rest-read.mjs` (csak szerver; teszt: `tests/previo-rest-read.test.mjs`, kitalált adatokkal). Egy próbálkozás, rögzített host, csak GET, átirányítás tiltva, ≤ 15 s; **csak a 73521-es API TESZT szálláshely**, a 753011-es éles azonosító eleve elutasítva. Hiányzó éjszaka vagy háztípus = ismeretlen, sosem „szabad”.
- Bekötéshez kell: (1) olvasási API-kulcs Netlify szerveroldali változóban (soha nem chatben/GitHubon); (2) a Previo írásos megerősítése, hogy ez a művelet nem hoz létre foglalást/zárolást; (3) `GET rest/rate-plan` és `GET rest/premise/kind?obtId=1` alapján a ratePlanId és a háztípus → roomKindId megfeleltetés tulajdonosi jóváhagyással (az A/B közös pool egy roomKindId). Utána: az árbeillesztés szerveroldali kapuja (`capacityDecision`: UNAVAILABLE → nincs ár; UNKNOWN → marad a kézi Previo-pipa).
- **Árkapu bekötve (11-06), alapból KI.** Netlify TEST-változók a bekapcsoláshoz (csak a Previo írásos mellékhatás-megerősítése után): `PREVIO_READ_API_ENABLED=sandbox-73521-only`, `PREVIO_API_KEY` (titkos), `PREVIO_HOTEL_ID=73521`, `PREVIO_RATE_PLAN_ID`, `PREVIO_ROOM_KIND_MAP` (JSON, pl. `{"deluxe":"…","family":"…","vip":"…","small":"…","splitA":"…","splitB":"…","splitC":"…"}`; az A/B ugyanaz a pool). Kikapcsolás: a `PREVIO_READ_API_ENABLED` törlése + TEST-kiadás.
