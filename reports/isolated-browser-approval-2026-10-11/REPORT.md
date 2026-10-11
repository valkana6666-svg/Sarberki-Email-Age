# Izolált, hitelesített jóváhagyási felület – 2026-10-11

## Bizonyított eredmény

A meglévő kikapcsolt klienshez külön bejelentkezési és tervezetkezelő oldal
kapcsolódik: isolated-approval.html és isolated-approval-session.mjs.
Csak explicit konfigurált loopback tesztkiszolgálóval működik; a normál
alkalmazás nem inicializálja és az alapértelmezett szerverkapu zárt marad.
A felület tényleges GoTrue Auth-bejelentkezést használ, a tokent csak memóriában
tartja, a szerver minden kérésnél ellenőrzi az Auth-identitást és tagságot.

A sikeres Chromium-futás:
https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38154710516
Forrás: c8ba033b85288a61f503d03f8c35173a530c2338.
9 új integrációs lépés PASS, 2 változatlan védelmi lépés korábbi PASS-át
megőriztük a 38154214127 futásból. Összesen 11 igazolt integrációs ellenőrzés.
A lépésenkénti bizonyíték BROWSER-CHAIN.json-ban szerepel. A sikeres futás
2026-10-11 16:16:35 UTC-kor zárta a próbát.

- Jogosulatlan hozzáférés és az izolált kulcs közvetlen olvasása tiltott.
- Írási jogú, jóváhagyási jog nélküli operátor nem hagyhat jóvá; másik tenant
  kezelője az ügyet sem olvashatja.
- Valódi Auth-bejelentkezés után kiadott, érvényes aláírású lejárt teszttoken tiltott.
- Megerősítés szükséges; kijelentkezés/munkamenetváltás törli a felülvizsgálatot.
- Csak a ténylegesen tárolt, szintetikus, pending tervezet pontos hashével és
  verziójával történhet jóváhagyás. A szerver UUID-azonosítója is támogatott.
- Időközben újratárolt tervezet verzióütközéssel meghiúsítja a jóváhagyást.
- Friss, ismeretlen kapacitás tiltja a jóváhagyást; nincs helyi siker-fallback.
- Az audit beillesztésének szintetikus hibája a teljes jóváhagyást visszagörgeti.
- Egy jogosult operátori jóváhagyás és annak hashhez/actorhoz/verzióhoz kötött
  auditja együtt mentődik. A jogosult böngésző a tényleges tárolt állapotot és
  a PostgREST-en, ugyanazzal az operátortokennel olvasott auditot látja.
- A böngészőmunkamenet és API újralétrehozása, valamint PostgreSQL/Auth/PostgREST
  újraindítása után új Auth-bejelentkezéssel ugyanaz a jóváhagyás/audit olvasható.

## Codex és a lezárt hibák

Külön Codex-munkamenetet ténylegesen bevontunk. Kódellenőrzést végzett, és
elkészítette az izolált SQL aláírás-ellenőrzését. A koordinátor integrálta és
tesztelte a módosításokat. A Codex végső kódellenőrzése nem talált új hibát;
a futási bizonyítékot a CI és a mentett tesztkimenetek adják.

A közvetlen RPC korábban operátor által összeállított szintetikus kapacitást is
elfogadhatott. Most kizárólag a szerver által hitelesített, tenant/ügy/verzió/
tervezethash/friss kapacitás mezőkhöz kötött HMAC-SHA256 bizonyítékot fogad el.
A kulcs privát SQL-táblában és a tesztszerver memóriájában van, kliensoldalra nem
kerül. Szabványos RFC-tesztvektor és tényleges JS→SQL jóváhagyás igazolja a
két implementáció egyezését. A telepítő csak sc_approval_test DB-t enged.

Javítottuk a kijelentkezés után visszaérkező státuszválasz versenyhelyzetét is.
A harmadik érdemi hiba a szerver UUID-ja és a kliens case- előtagos feltétele
közötti eltérés volt; azonosítót nem alakítottunk át és tárolt adatot nem írtunk át.

A kezdeti CI-kudarcok teljes listája PRELIMINARY-ATTEMPTS.json-ban maradt meg:
401 helyett 403-at váró teszt, a fieldset Playwright-disabled ellenőrzésének
hibás elvárása, majd az azonosító-eltérés miatti betöltési timeout. Mind lezárt;
a végső integrációs futás sikeres.

## Tesztkimenetek

| Vizsgálat | Sikeres | Bukott | Határ |
|---|---:|---:|---|
| Teljes automatikus regresszió az aláírás/munkamenetjavítás után | 957 | 0 | FULL-REGRESSION.txt; UUID-javítás előtt |
| Célzott UUID- és panelkompatibilitás a végső kliensjavítás után | 12 | 0 | UUID-COMPATIBILITY.txt; ebből 3 új UUID-teszt |
| SQL/API és aláírás ellenőrzése | 11 | 0 | ATTESTED-SQL.txt; a teljes futás részhalmaza |
| Késői válasz munkamenetváltás után | 1 | 0 | SESSION-RACE.txt; a teljes futás részhalmaza |
| Chromium/Auth/API/SQL/audit/újraindítás | 11 igazolt lépés | 0 végső | 9 a végső runban, 2 előzményből |

A korábbi 935 teszt csak korábbi helyi eredményként volt jelentve; önálló
kimeneti fájlját most nem találtuk. Ezt nem állítjuk frissen újraigazoltnak.
A korábbi Chromium 38149366865 és Auth/API/SQL 38139291482 futást naplókból
ellenőriztük, nem ismételtük meg. A teljes regressziót az új szerveres
biztonsági változtatás indokolta. A részhalmazok eredményeit nem adjuk hozzá
még egyszer a teljes tesztszámhoz.

## Commitok és párhuzamos munka

A kiinduló klienscommit: 05b4e44aa5d1ae75baf89dc0e010ba7a78cc61b5.
Átvett, megőrzött párhuzamos eredmények: 228c15a (panel), 8439002 (review state
javítás), c2f38e3 (9 panelteszt), a2ec041 (külön statikus próbaoldal), fe0f182
(külön, injektált munkamenetes Chromium-próba). Az utóbbi külön opt-in
kapcsoló mögött megmaradt; a jelenlegi valódi login-UI-lánc nem futtatja újra.

Ebben a folytatásban:
- 28c2b2d: külön Auth-felület és teljes böngészős tartóssági próba.
- 56c6af1: a bejelentkezés nélküli HTTP 401 tesztelvárás javítása.
- db71c36: szerveres kapacitásaláírás, SQL-kulcsizoláció, munkamenetversenyhelyzet.
- 4557ddf: betöltési diagnosztika és már igazolt védelmi lépések megőrzése.
- c8ba033: létező szerveres UUID-azonosítók támogatása és célzott tesztek.

## Mentés és még nem igazolt működés

Az ellenőrzött eredeti Sarberki_Backup_2026-10-11.zip SHA256-ja:
c5b19183fbc6269fdff2e829c95f48cdae65d9f88b2168e9a5456d5cde587ba0.
CRC rendben; 518/518 csomagellenőrzőösszeg és 3/3 DB-ciphertext ellenőrzőösszeg
megegyezik. Forrása még 8382b89 volt, tehát az új kliens/UI hiányzott belőle.
Az új, külön ZIP az aktuális tesztági forrást és e bizonyítékokat tartalmazza;
a csomag ellenőrzési jegyzőkönyve a ZIP-CHECKS.json;
a titkosított DB-állományok és a régi helyreállítási bizonyíték változatlanok.

A régi DB-archívum izolált visszaállítása 43 táblával korábban igazolt
(38129512850; recovery/ISOLATED-RESTORE.json). Ezt a megőrzött ciphertext-ekhez
kötött előzményként használjuk. Most nem állítottuk vissza az eredeti DB-t.
Az új sikeres jóváhagyás új, üres szintetikus teszt-DB-ben történt; nem az eredeti
archívum felhős helyreállításának próbája. A teszt végén az izolált konténerek
megszűntek. A mentés nem tartalmazza az egyszer használatos tesztmunkameneteket.

Tartós, külön telepített kezelői szolgáltatás és a teljes rendszer
helyreállíthatósága még nem igazolt. A külön GPG-jelmondat, a laptop ügytárának
hiteles exportja és a külső konfigurációk továbbra is szükségesek. A Gmail
OAuth-, Previo-, Pushover- és platformhiányok az EXTERNAL-CONFIG-GAPS.md és
az eredeti docs/RESTORE-GAPS-2026-10-11.md leltárban szerepelnek; titokérték nincs
jelentésben. Következő fő feladat: a tartós izolált cél és a hiányzó konfigurációs
leltár előkészítése, a külső szolgáltatások zárt kapuinak fenntartásával.

A main, production, eredeti DB és eredeti laptop ügytára érintetlen.
Nem történt vendég-e-mail, Pushover-küldés, Previo-hívás vagy valódi foglalás.
