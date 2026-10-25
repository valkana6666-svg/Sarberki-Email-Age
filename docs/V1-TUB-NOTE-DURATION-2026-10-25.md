# V1 – dézsajegyzet időtartamának konzervatív értelmezése

2026-10-25. Kiindulási HEAD: 79bb8549bf7570e7b30bc0b3e0bb5873142eee82.

A forrásvizsgálat és szintetikus reprodukció igazolta: a Previo-jegyzet parser az „1.5 óra” értékből 5 órát, a „-24 óra” értékből pozitív 24 órát emelt ki. Ez a jelölt időszakot hibásan rövidíthette vagy értelmezhette. Az eredmény eddig is csak CANDIDATE volt, availabilityVerified=false; élő szabad kapacitás vagy foglalás nem következett belőle.

A javítás a teljes numerikus időtartam-kifejezést ellenőrzi, nem a záró számjegyeit. Csak a már támogatott egész 1–72 órás adat fogadható el. Tört, előjeles, tartományos, többször megadott vagy bizonytalan érték UNKNOWN marad. Új napi/nyelvi értelmezési szabályt, házkapacitást, árat, fizikai erőforrás-összerendelést vagy Previo-kapcsolatot nem vezetünk be.

A dézsák továbbra is rögzítettek: 1–6 és 11–15 házaknál vannak. A 7–10-es házak vendége másik ház dézsáját kérheti, de az elhelyezési ház nem határozza meg automatikusan a dézsa erőforrását. Hiányos jegyzetből vagy üres jegyzetlistából nem igazolható elérhetőség. Teljes időszakra érvényes, hiteles erőforrás-naptár és külön emberi jóváhagyás szükséges.

Célzott parser- és jegyzet-integrációs tesztek szintetikus adatokkal; a végleges darabszámot a munkajelentés tartalmazza. A változás kapacitási jelöltadatot érint, ezért a commiton teljes GitHub CI és kapacitásregresszió szükséges. A korábbi Safari/iPhone/Gmail-eredet elfogadást nem ismételjük.

Mentési előfeltétel: a korábban dokumentált 2026-10-25 08:24-es snapshot és 49 táblás SQL-restore, Drive hash-egyezés megmarad. A teljes Auth/config/platform visszaállítás és a független kulcspróba továbbra sem igazolt; a mostani módosítás nem jelent új mentést vagy restore-t.

Netlify-kiadás, felhős migráció, valódi vendégadat, Previo-hívás/írás és értesítésküldés: 0. Rollback: csak a parser és új teszt visszavonása az engedélyezett tesztágon; adatbázis-módosítás nincs.

Tényleges célzott eredmény: 36 PASS / 0 FAIL / 0 SKIP (27 új időtartamteszt + 7 meglévő parser + 2 jegyzet-integráció). A Codex külön készítette a javítást és az új teszteket, a koordinátor külön átnézte és futtatta a 36-os csomagot. Az első 24 teszt az eredeti forráson 9 PASS / 15 FAIL volt. Ezek átfedő ellenőrzések, nem összeadandó darabszámok.
