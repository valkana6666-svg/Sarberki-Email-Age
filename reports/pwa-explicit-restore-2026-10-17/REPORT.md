# PWA: kézi munkamenet-ellenőrzés elmaradt focus után

A tulajdonos 22:31-kor jelezte: alkalmazásváltás után a korábbi belépés ellenőrzése mellett is ismét jelszót kell megadnia. Ezt nem minősítjük sikeres belépésmegőrzésnek. A képek korábban sikeres Reader-munkamenetet mutattak, de az új hiba pontos HTTP/Auth eredménye nincs igazolva. Nem állítjuk, hogy a cookie biztosan törlődött, sem hogy minden jelszókérést az itt talált klienshiba okoz.

Kiinduló tesztági HEAD: 0b4a30e1507fe5019eebbb2b5319afd24a329c92.

## Reprodukált hiba és minimális javítás

A window blur lezárja a kliensoldali hozzáférést. Ha visszatéréskor nem érkezik focus vagy visibility esemény, a belső visible állapot false marad. A kézi restore gomb eddig közvetlenül a perform('restore') függvényt hívta, amely ezen állapotban kérés nélkül visszatért. A visszatért, ténylegesen látható felület így nem tudta kézzel sem elindítani a session GET-et.

Új negatív regresszió a javítás előtt ténylegesen elbukott: az explicit gomb után a session null maradt. A gomb most a meglévő resume útvonalat hívja, amely ellenőrzi a dokumentum láthatóságát, és a meglévő soros/epoch-védett munkamenet-GET-et indítja. Rejtett dokumentumban továbbra nem ad hozzáférést. Nem változott a cookie, refresh-token, hitelesítési lejárat, szerveres Auth vagy DB-jogosultság. Nincs automatikus jelszóbekérés, néma bejelentkezés, jogosultságkerülés vagy írásismétlés.

Célzott helyi teszt: **56 PASS / 0 FAIL / 0 SKIP** (operator UI, tényleges preview modul tesztjei, cookie JSON-helper). Két új teszt: látható dokumentumon blur utáni explicit visszaállítás fókuszesemény nélkül; rejtett dokumentum tiltása. Szintaxis és diff-check PASS. A korábbi sikertelen új negatív teszt a hiba reprodukciója, nem végleges eredmény.

A mobilpróba a tényleges restore gomb handlerét hívja szintetikus blur után, focus nélkül. Ellenőrzendő: csak session GET, normál Auth-visszaigazolás jelszó-POST nélkül, preview üres marad, nincs mentés. A böngészős mock nem bizonyítja a valódi iPhone cookie-megőrzését. A pontos CI/deploy és mobil eredmény később rögzítendő.

## Megmaradó határ

Ha a szerver érvénytelen/lejárt/visszavont belépést talál, a kézi restore nem jogosíthat fel, és a normál védett belépés szükséges. A tulajdonos tényleges eszközén a jelszó nélküli helyreállítást a javítás után külön igazolni kell; ezt nyitva tartjuk. Ha továbbra elutasított, a képernyőn látható konkrét hiba szükséges a cookie/Auth/szolgáltatási ok elkülönítéséhez, titok és token nélkül.

Kizárólag tesztág/tesztkörnyezet. Nincs vendégadat, élő Gmail, email/Pushover, Previo, foglalás, main vagy production módosítás. V1 becslés marad 93%. V2/V3: ugyanaz a session/epoch sorosítás, nincs külön hitelesítési rendszer.
