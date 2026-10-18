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

## Végleges ellenőrzés

Commit **8f038b8e217cbe9bf0022215f1c1add1fffb6068**. [CI 39067208971](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39067208971), test job `117497239549`: **1812 PASS / 0 FAIL / 0 SKIP**, exact deployed SHA megegyezik. Windows offline ellenőrzés és [kapacitásrun 39067208936](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39067208936) SUCCESS; élő Previo nem futott. [Mobil 39067209026](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39067209026), job `117497239493`: Reader 12 + Writer/approval/deadline/focus/manual restore 28, **40 PASS / 0 FAIL**. Az explicit helyreállítás focus nélküli, GET-only, jelszó- és replay nélküli próbája Chromium és WebKit alatt PASS. Tényleges iPhone-cookie-helyreállítást ez nem bizonyít.

Következő emberi pont: az új tesztverzió egyszeri betöltése után kizárólag a „Korábbi tesztbelépés ellenőrzése” gomb eredménye. Nem kell új ügyet menteni, Gmailt olvasni vagy a teljes készülékpróbát ismételni. Ha Auth elutasít, a megjelenő hibaüzenet szükséges; jelszó/token nem kérhető chatbe. A tényleges készülékes jelszó nélküli helyreállítás a visszajelzésig nyitott.

## 2026-10-18 06:43–06:44 Budapest – készülékes helyreállítási részpróba

A tulajdonos az előírt, jelszó megadása nélküli ellenőrzésre IMG_8857–8859 képeket küldött. A fejlécen **BUILD 70d9b89** látszik; a bejelentkezési résznél az email- és jelszómező üres, a státusz pedig **Hitelesített tesztkezelői olvasás aktív**. A megadott munkafolyamat és képernyőbizonyíték alapján a visszaállított olvasási munkamenet részpróbája elfogadható. A képek nem hálózati naplók: nem bizonyítják önmagukban, hogy automatikus startup vagy explicit gomb állította helyre a sessiont, és nem állítunk teljes korábbi éjszakai eseménysorrendet.

A build a dokumentációs 70d9b89ad2495848584140cc7f1cd57d36becc82 commitra köthető; alkalmazáskódja az igazolt 8f038b8e217cbe9bf0022215f1c1add1fffb6068 javítással azonos. A lista még üres, a preview rész csukott: új ügylista-/preview-betöltést vagy háttérből visszatérés utáni előnézettörlést ezekből a képekből nem állítunk. A korábbi iPhone-preview siker külön korábbi bizonyíték. A teljes PWA lifecycle/Writer/approver kapu továbbra nyitott. Új CI/mentés/integrációs hívás nem történt; változatlan kódon nem szükséges. V1 marad kb. 93%.
