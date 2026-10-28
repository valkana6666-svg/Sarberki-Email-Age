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

## Lezáró bizonyíték – alkalmazáscommit baebed44dba234237af7042e271cfdcc130d9670

- Teljes CI SUCCESS, 2317 PASS / 0 FAIL / 0 SKIP: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40675559002
- Kapacitásregresszió SUCCESS: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40675559031
- Chromium/WebKit mobil CI SUCCESS, **42 PASS / 0 FAIL / 0 SKIP**: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40675559000 ; artifact 12809993260. A naplóban mindkét motor pontos loadedCommit-ja baebed44. Ez feloldja a helyi motorletöltés miatti emulációs bizonyítékhiányt.
- Teszthost `/api/health`: deployedCommit=baebed44dba234237af7042e271cfdcc130d9670, autoSend=false, autoBookingModification=false. Egyetlen engedélyezett release-marker; további telepítést nem indítunk.
- A telepített chatbot böngészőben a pontos buildet jelezte, az A+B → C üzenetre továbbra is ugyanazt a 2026-11-20/22 időszakot és 4 felnőttet használta, a kapacitást nem igazoltnak jelölte. Ez desktop Chrome, nem új fizikai iPhone-próba.
- Hosted PWA statikus smoke PASS; MNB helper HTTP 200 / available / rateDate=2026-10-28.
- Hitelesítés nélküli operátori session és ügytár egyaránt 401 AUTH_REQUIRED; nem történt belépés vagy adatírás.
- A korábbi ár-smoke hibásan automatikus 2027-es gyermekárat és régi forrásnevet/összeget várt. Két elavult elvárás miatti diagnosztikus FAIL után a teszt frissítve a már jóváhagyott tarifához: 2 felnőtt, gyermek nélkül, 2027-10-01/03 Deluxe → 126000 Ft szállás + 2200 Ft IFA = 128200 Ft, availability=not_checked. Külön negatív hosted próba: 5 és 8 éves gyermekekkel HTTP 422 / unverified / nincs total. **Mindkét végső próba PASS**. Csak tesztmódosítás; ár- vagy üzleti szabály nem változott.

A Netlify kezelőfelülete kijelentkezett állapotú volt, de a meglévő Git-integráció a release-markertől mégis elvégezte a telepítést. Ehhez jelenleg NEM kell tulajdonosi belépés. Az utólagos teszt/dokumentáció commit nem igényel új alkalmazástelepítést; a hosted build szándékosan baebed44 maradhat.

A fizikai iPhone-próbák már lezárt részeit (`docs/V1-CLOUD-SAFARI-CLOSURE-2026-10-25.md`) nem nyitjuk újra. Új eszközös bizonyíték csak az új chatbot-folyamatokra és a még nyitott Safari/PWA/hálózatváltási helyzetekre kell. Aktuális üzleti tulajdonosi pontok: 2027 pontos gyermekkor-határok és alaplétszámmal együtt alkalmazás; kis ház 3. fő felnőttként megengedett-e; 2027 dézsa 6 fő fölötti felár és hetedik ingyenes éjszaka alkalmazása. Ezek a bizonytalan automatikus végár kapui, nem hibás kapacitásígéret indokai.
