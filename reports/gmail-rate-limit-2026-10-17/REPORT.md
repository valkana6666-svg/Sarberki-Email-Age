# iPhone-on jelzett Gmail 429 – célzott javítás

A tulajdonos képernyőképén Gmail-olvasási hiba (429) látható. A helyi szintetikus MIME-betöltés ettől külön sikerjelzést mutat; a kép nem bizonyít felhős mentést, Reader-belépést vagy teljes PWA-elfogadást. A szolgáltatói kvóta pontos okát a képből nem lehet igazolni.

Kiinduló tesztági HEAD: d94154d961ea1f973ed96319802a495228329d73. Az átvizsgált Gmail-kliens a listázást követően Promise.all-lal egyszerre olvasta minden találat teljes tartalmát. Ez helyi kéréscsúcsot okozhat; nem bizonyítja önmagában a konkrét 429 okát.

A módosítás sorosan olvassa a találatokat, a JSON-body beolvasását is megvárva. Az első hiba leállítja a további olvasást. A profil-, listázási, pontos üzenetes és normál olvasási útvonal 429 esetén magyar, kézi későbbi újraindítást kérő üzenetet ad. Nincs automatikus retry, providerhibatörzs-kijelzés, háttérfigyelés aktiválása vagy felhős írás.

A fiókellenőrzés, gmail.readonly scope, pontos selector és meglévő tesztpostaláda-szabály változatlan. Valódi Google-kérés nem történt. Az új tesztek kizárólag mock transportot és zárt szintetikus metaadatokat használnak, a tényleges kliensmodult futtatva.

Célzott helyi teszt: **14 PASS / 0 FAIL / 0 SKIP** (új rate-limit 4, meglévő party-paritás 5, Gmail-policy 5). Lefedi a lapozás utáni egyidejűség 1-es maximumát, a 429 utáni azonnali leállást/retry hiányát, a profil-403 tiltását, valamint a pontos üzenetazonosító hibája utáni listázás tiltását. `git diff --check` sikeres.

A commit CI-je és exact tesztdeploy külön ellenőrizendő; a 14 helyi teszt nem teljes CI- vagy fizikai iPhone-bizonyíték. A Google-oldali korlátozás feloldását nem állítjuk. A korábbi végső jelentés „új hiba nem azonosítható” megállapítása az akkori átvizsgált útvonalakra szólt; a most kapott készülékkép új nyitott Gmail-kaput jelent.

V1-becslés marad 93%. Következő lépés a módosított build igazolása, majd később egyetlen kézi Gmail-olvasás az elkülönített tesztfiókkal. Nem kell ismételten nyomni az olvasógombot. A soros olvasás nem garantálja a szolgáltatói kvótakorlát megszűnését. V2/V3: nincs új transportkeretrendszer vagy végrehajtási jogosultság; az olvasási adapter terhelését csökkentjük.

## Commit és CI – végleges ellenőrzés

Javítás commit: `847289bbb559694b28f9b74e804e74aebb4d0e3f`. [CI 39061037266](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39061037266), job `117478877536`: **1804 PASS / 0 FAIL / 0 SKIP**, SUCCESS. DEPLOY SYNC PASS: expected és deployed egyaránt a fenti teljes SHA, kizárólag a teszthoston. PWA static deploy smoke és hitelesítés nélküli session/ügytár kapuk sikeresek; a Windows offline mentésmásolási job is sikeres. [Kapacitás-regresszió 39061037242](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39061037242) SUCCESS. Az élő Previo-lépés szándékosan nem futott.

További célzott helyi szintetikus Gmail/cookie/PostgreSQL E2E: **6 PASS / 0 FAIL / 0 SKIP**; fake GIS és Gmail, valódi izolált SQL. Ez nem új élő Google-beolvasás. Az iPhone-on a javított builddel végzett Gmail-próba még NEM IGAZOLT.
