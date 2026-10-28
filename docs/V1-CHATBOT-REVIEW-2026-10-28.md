# V1 chatbot ellenőrzés – 2026-10-28

Kizárólag `gmail-test-subject-allowlist`. Kiindulópont: `8b690a8927995723b7b484c1230d4f8a1be88845`, a megadott d5161b6 közvetlen utódja; a meglévő ajánlat-érvénytelenítési teszt megőrizve.

## Tényleges javítás és ellenőrzés

Aktív beszélgetésben a dátum/létszám nélküli konkrét háztípusváltás korábban FAQ-ágnak minősült. Az A+B → C javítás így figyelmen kívül maradt. A meglévő normalizálóval feldolgozzuk a konkrét házválasztást; más típusra váltáskor töröljük a korábbi osztott egységválasztást. Nincs új válaszmotor vagy kapacitás-/árszabály.

- `sarberki-chatbot-project/chat-session.mjs`: beszélgetési javítás.
- `tests/chatbot-cabin-correction-20261028.test.mjs`: 4 nyelvű típusváltás, dátum/létszám megőrzése, ismeretlen ár/kapacitás; A+B → C.
- `scripts/chatbot-mobile-proof.mjs`: böngészős VIP-váltás és korábbi dátum/létszám ellenőrzése.
- Teljes `npm test`: **2317 PASS / 0 FAIL / 0 SKIP**. Célzott 50 PASS ennek részhalmaza, nem hozzáadandó.
- Helyi böngészőmotor letöltése sikertelen (sérült CDN ZIP); helyi Chromium/WebKit eredmény NEM IGAZOLT. A push a meglévő izolált CI-mobilpróbát kéri; ennek eredménye külön ellenőrzendő.

## Közös mag és bizonyítékhatár

A chat és e-mail adapter egyaránt `evaluateCentralInquiry` → `buildCentralReply` útvonalat használ (`shared-core/inquiry-channel-adapters.mjs`). A teljes suite tartalmazza a négynyelvű paritást, dátum/létszám, gyermek, A/B/C, pótágy, előleg, kedvezmény, lemondás és bizonytalan ár/kapacitás regresszióit. Ez a tesztmintákat igazolja, nem tetszőleges természetes nyelv hibamentességét. A dézsa külön díjas FAQ-ja megmarad.

A mobil CI loopback-only, szintetikus, 390 px Chromium/WebKit emuláció. Nem tényleges Safari/iPhone vagy főképernyős telepítés. A konkrét commit CI-jét és a telepített teszthost SHA-ját külön kell igazolni.

## Hátralévő kapuk és felelősök

| Feladat | Állapot / szükséges közreműködés |
| --- | --- |
| Új commit teljes és mobil CI | Automatikusan ellenőrzendő; nem tulajdonosi feladat |
| Pontos teszthost build SHA, hosted smoke | Szükség esetén egy engedélyezett teszttelepítés, utána ellenőrzés |
| Valódi iPhone Safari és PWA életciklus | Tulajdonos vagy fizikai tesztelő készüléke kell; emulációval nem zárható |
| Gmail OAuth | Most nem vizsgáljuk újra; kézi hozzájárulás külön alkalommal |
| Élő Previo | Hozzáférés és dokumentált mellékhatásmentes olvasás kell; addig nincs kapacitásígéret |
| Védett üzleti szabály értelmezési hiánya | Csak konkrét, még aktuális hiány esetén tulajdonosi döntés; korábbi történeti listák nem új döntések |

Készültségi százalékhoz nincs elfogadott, súlyozott aktuális mérőszám. Chatbot és teljes agent **100% nem igazolt**; a fizikai/hosted kapuk nem változtathatók tesztassertionből százalékká. A korábbi 91% mérnöki becslés nem mérési eredmény.

V2/V3 érték: egyetlen determinisztikus mag, elkülönített csatornaállapot és minden változtatás után új ellenőrzés megőrizve. Nincs automatikus levél, Pushover, foglalás, adatbázisírás, új kulcs vagy éles módosítás.
