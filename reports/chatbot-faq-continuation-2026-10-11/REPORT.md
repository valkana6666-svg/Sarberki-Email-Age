# Központi rendszer ellenőrzése és chatbot-folytatás – 2026-10-11

## Elkészült fejlesztések

A kiinduló GitHub-commit `e1a407de95d2ca01618dbdb4c0edc4b043a3ddf4` volt.
A fejlesztés közben a tesztág `96e2270` és `4440eda` commitokkal frissült:
közös döntési motor, e-mail/chat adapterek, többüzenetes chatbot és szintetikus
szerveres bekötés készült. A frissebb munkát megtartottuk; a párhuzamos helyi
tervező fájljait eltávolítottuk az összefésült változatból. Egyetlen aktív
üzleti döntési motor maradt: `shared-core/central-inquiry-decision.mjs`.

Az új célzott javítás a meglévő `chat-session.mjs` modulban van. Aktív szállás-
érdeklődés közben a tájékoztató kérdések és az üres üdvözlés a meglévő FAQ-
választ adják. A szállásadatok és hiányok nem törlődnek és nem keverednek
össze a tájékoztató válasszal. Magyar kezelői ellenőrző szöveg is megmarad.
Újraindítás után a meglévő munkamenet-törlés működik.

## Tesztek

- A frissített rendszer teljes regressziója: **1079 PASS, 0 FAIL**.
- Célzott közös döntési és chatbotcsomag: **25 PASS, 0 FAIL**.
- Öt új regressziós eset: HU/DE/EN/SI dézsakérdés szállásbeszélgetés közben,
  valamint üres üdvözlés aktív szállásadatok mellett.
- A kezdeti három tesztindítási hiba a hiányzó PGlite miatt volt; a függőség
  telepítése után az alapcsomag is sikeres volt. A tesztfolyamatok helyi
  EPERM korlátozását engedélyezett futtatással kezeltük.

A teljes csomag tartalmazza az osztott apartmanokat, az ismeretlen és lejárt
kapacitást, árkomponenseket, nyelvi döntésegyezést, valamint a helyi PostgreSQL-
alapú jogosultsági regressziót. Nem futott élő Previo-lekérdezés, foglalási
vagy e-mail-művelet. A helyi eredmény nem helyettesíti a felhős CI-t vagy az
élő forrás foglalásmentességének igazolását.

## GitHub és CI

Kizárólag `gmail-test-subject-allowlist`. A közben frissült ágat a GitHub
fast-forward védelme megóvta a régi alapra történő feltöltéstől. Nem történt
force push. A korábbi párhuzamos változat csak helyi commitként és egy
ágra nem kapcsolt GitHub-commitobjektumként maradt meg, nem lett aktiválva.
E jelentés fájlját a végleges javító commit tartalmazza; commitazonosítója
a felhasználói jelentésben ellenőrizhető.

A `4440eda` commithoz a csatlakoztatott GitHub-eszköz a vizsgálatkor nem adott
workflow- vagy státuszrekordot; CI-sikert ebből nem állítunk.

## Fennmaradó hibák és projektállapot

Ismert helyi teszthiba nincs.

**AI-agent V1:** a meglévő friss szerveres szintetikus ügyfolyamat már a közös
motorra épül. Az éles Gmail-kezelőfelület teljes átállítása és valódi küldés
nincs engedélyezve vagy igazolva.

**Chatbot:** külön helyi tesztfelület, négy nyelv, közös motor, munkameneti
adatmegőrzés és tájékoztató kitérők. Nincs éles vendégchat vagy automatikus
foglalás. Tartós HTTPS-elérés és valódi mobilkészülékes próba még szükséges.

**Következő feladat:** a végleges javító commit CI-jének ellenőrzése, majd az
elkülönített HTTPS-tesztcél és a meglévő Gmail-kezelőfelület fokozatos bekötése
a már működő közös motorhoz, szintetikus végponttól végpontig tesztekkel.
Éles aktiválás továbbra is külön emberi jóváhagyást igényel.
