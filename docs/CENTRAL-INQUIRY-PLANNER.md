# Közös érdeklődés- és választervező

A fejlesztés kizárólag a `gmail-test-subject-allowlist` tesztágon használható. A modulok nem küldenek üzenetet, nem foglalnak, nem hagynak jóvá, és alapból nem hívnak külső szolgáltatót.

## Egy döntés, külön csatornák

`shared-core/central-inquiry-decision.mjs` → `evaluateCentralInquiry()` a meglévő `intake-normalize`, `inquiry-assessment`, `booking-filter`, `availability-model`, `split-units` és `verified-pricing` modulokból állítja össze az egységes döntést. Nincs új kapacitás- vagy árlista.

A döntés tartalmazza a felismert adatokat, hiányokat és ellentmondásokat, a kapacitás állapotát, a bizonyított árösszesítést és a tiltásokat. A vendégnek szánt ár továbbra is emberi jóváhagyást igényel. Az ismert adatokra nem keletkezik új tisztázó kérdés.

`shared-core/inquiry-channel-adapters.mjs`:

- `buildEmailInquiryDraft(options)` a meglévő e-mail-megfogalmazót használó, jóváhagyásra váró tervezetet és a közös döntést adja vissza.
- `buildChatInquiryReply(options)` ugyanabból a közös döntésből rövid beszélgetéses választ készít.

A meglévő Gmail- és kezelői jóváhagyási útvonal engedélyeit ez nem változtatja meg. Az új e-mail-adapter programozottan használható; a korábbi Gmail-folyamat teljes átállítása még külön integrációs feladat. A meglévő `case-state` ellenőrzéseit nem kerülheti meg.

`shared-core/server-inquiry-planner.mjs` kizárólag kifejezetten beadott kapacitás- és árszolgáltatót hív. A hiányos kérés nem indít kapacitáshívást; nem igazolt kapacitás mellett árhívás sem indul. A várakozás közben lejáró bizonyítékot újraértékeli. A meglévő élő Previo-kapu ettől nem válik engedélyezetté.

## Kapacitás és ár

Csak a teljes időszakhoz, aktuális létszámhoz, egységszámhoz és kéréshez kötött, megfelelő tenantból származó friss bizonyíték fogadható el. Hiányzó, hibás vagy lejárt adat UNKNOWN. Ellenőrzött, elégtelen egészfaház-készlet UNAVAILABLE. A készlet pillanatfelvétel, nem foglalási garancia.

Az osztott apartmanoknál a meglévő szabályok érvényesek: A/B típusszintű készlet nem igazol fizikai párost. Közelségi kikötés nélkül a megfelelő igazolt típusszintű kombináció elfogadható; egyedi egység vagy közelségi ígéret külön bizonyíték nélkül tiltott.

Az ár öt összetevője ugyanahhoz az időszakhoz, háztípushoz, egységszámhoz, felnőtt- és gyermeklétszámhoz, gyermekéletkorokhoz és időbélyeghez kötött. Hiányzó vagy nem jóváhagyott komponensből nincs végösszeg. Az összehasonlító tesztek szintetikus, ellenőrzött komponensekkel dolgoznak; élő tarifa- és kedvezményforrás bekötését nem igazolják.

## Külön chatbot-projekt

`sarberki-chatbot-project/chat-session.mjs` külön példányonként, csak memóriában tartja az adatokat. Új beszélgetés törli őket. Nincs localStorage, bejelentkezés, külső lekérdezés vagy foglalás. A helyi `index.html` és `inquiry-preview.mjs` használja a közös döntést. A négy nyelvű általános tájékoztató FAQ megfogalmazásai a meglévő `chatbot-v1.mjs` modulból származnak; nem külön kapacitás- vagy árkalkulátor.

## Ellenőrzés és fennmaradó munka

A tesztek e-mail/chat döntésegyezést, HU/DE/EN/SI adatértelmezést, hiányokat, hibás életkorokat, osztott elhelyezést, lejárt és rosszul kötött kapacitásadatokat, árkomponenseket, providerhibákat és beszélgetési izolációt ellenőriznek.

Következő integráció: a meglévő szerveres, hitelesített tesztügy-folyamatból a közös tervező meghívása, a meglévő jóváhagyási és auditkapuk megtartásával. Ehhez előbb ténylegesen elkülönített tartós HTTPS tesztcél és szolgáltatói jogosultságok igazolása szükséges. Élő Previo-készletzárolás-mentesség nélkül nincs szolgáltatói hívás.
