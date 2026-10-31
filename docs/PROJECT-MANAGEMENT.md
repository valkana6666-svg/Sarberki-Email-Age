# Sárberki V1 – könnyű projektkoordináció

Állapot: koordinációs eljárás, **nem** igazolt V1-készültségi jelentés. Létrehozás: 2026-10-31.

## Hiteles források, sorrend
1. Az aktuális `gmail-test-subject-allowlist` ág teljes `AGENTS.md` fájlja: kötelező szabályok. Minden új Work/Codex munkamenetben ténylegesen beolvasandó.
2. Ugyanezen ág HEAD-je, változásai, a releváns CI- és tesztbizonyítékok, valamint a teszthost build SHA-ja: ellenőrizhető végrehajtási állapot.
3. Meglévő GitHub Issues és az ellenőrzött riportok: feladatok és akadályok. Ne hozz létre második, párhuzamos feladatlistát vagy ügykezelőt. Hiányzó P0 feladatot előbb kereséssel ellenőrizz, csak aztán nyiss új issue-t.
4. Korábbi beszélgetések és százalékos készültségi becslések: tájékozódásra használhatók, élő bizonyítékot nem helyettesítenek.

## A „Sárberki, folytasd” munkamenet
1. Olvasd be az `AGENTS.md` aktuális teljes tartalmát; azonosítsd az ágat, a teljes HEAD SHA-t és az ellenőrzés idejét.
2. Nézd meg a releváns új commitokat, CI-t, nyitott issue-kat, teszt- és restore-bizonyítékokat, illetve az esetleges párhuzamos munkát.
3. Készíts rövid P0/P1/P2 prioritást, minden elemnél: tény/bizonyíték, blokkoló, felelős eszköz, következő ellenőrizhető lépés. Ne tételezz automatikus Claude–Codex–Work kommunikációt.
4. Előbb meglévő megoldások és hibaok, aztán érdemi alternatívák, végül a legkisebb bizonyítottan biztonságos beavatkozás. Kódot a megfelelő eszközzel és csak engedélyezett környezetben módosíts.
5. Befejezéskor: módosult fájlok, teljes commit SHA, tesztek PASS/FAIL/SKIP, CI és E2E külön, hiányzó bizonyíték NEM IGAZOLT, következő egyetlen P0 feladat.

## V1 prioritás és korlát
- P0: Gmail saját OAuth → csak olvasás → közös AI → napi kezelő → emberi jóváhagyás; jogosultságok és tényleges mentés/visszaállítás igazolása. A már bizonyított részeket ne építsd újra.
- P1: használhatósági és nem blokkoló stabilitási javítások, kizárólag igazolt hiány esetén.
- P2: későbbi platform-, automatizálási és mérési fejlesztések; nem késleltethetik a V1 lezárását.
- Main/production, valódi vendégküldés, Previo-írás és foglalás továbbra is tiltott külön felhatalmazás nélkül. Force push tilos.
- A koordinációs dokumentum nem aktivál automatizmust, nem ad külső alkalmazásnak hozzáférést, és nem helyettesíti a tulajdonosi jóváhagyást.

## Állapotjelentés sablon
- Ellenőrzés időpontja / tesztág / teljes HEAD SHA:
- V1 készültség: **nem igazolt**, amíg tételes, azonos célra vonatkozó bizonyíték nincs.
- P0: [feladat] – [PASS/FAIL/NEM IGAZOLT] – [bizonyíték] – [következő lépés]
- P1/P2: csak lényeges tételek.
- CI, élő E2E, iPhone, jogosultság és restore: külön státusz.
- Párhuzamos munka / fájlütközés kockázata:
- Következő egyetlen végrehajtandó lépés és kijelölt eszköz:

## Három párhuzamos munkamenet koordinációja

A meglévő GitHub issue-k az egyetlen feladatnyilvántartás; ne készíts második listát.

- A: célzott fejlesztés, kizárólag kijelölt fájlokon.
- B: alkalmazásszintű E2E ellenőrzés, alapértelmezetten csak olvasás.
- C: független CI-, jogosultsági és visszaállítási audit, alapértelmezetten csak olvasás.

Az A/B/C címkék még nem jelentik a futó Claude-munkamenetek igazolt azonosítását. Minden munkamenet közölje a feladatát, az issue-t, a teljes HEAD SHA-t, az érintett fájlokat, a teszteredményeket és az akadályokat. Csak egy munkamenet írhat egy adott fájlt; írás előtt friss HEAD- és ütközésellenőrzés szükséges. Main, production, valódi levélküldés és Previo-írás továbbra is tilos. Force push tilos.

A tulajdonos az eredményeket a SÁRBERKI – PROJEKTVEZETŐ beszélgetésbe másolja. A koordinátor külön ellenőrzi az eredményeket és kijelöli a következő egyetlen P0 lépést. A külön munkamenetek között nincs automatikus üzenetátadás.
