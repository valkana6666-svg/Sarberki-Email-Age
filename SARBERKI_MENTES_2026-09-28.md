# SÁRBERKI MENTÉS – 2026-09-28

## Munkamódszer – új alapelv
A normál ChatGPT beszélgetésben kell elvégezni minden olyan feladatot, amelyhez a rendelkezésre álló eszközök elegendők: GitHub-kód olvasása és módosítása, tesztági fájlműveletek, tesztek és logikai ellenőrzések, szabályok és feldolgozási logika kidolgozása, dokumentáció és átadási anyag készítése.

Work módot csak akkor használjunk, amikor a feladat ténylegesen Work-specifikus végrehajtást igényel, például több webes felület végigkattintását, böngészős munkafolyamatot, Netlify/GitHub/Gmail felületi műveletsort vagy olyan lépést, amelyhez itt nincs megfelelő hozzáférés.

Ha ilyen ponthoz érünk:
1. előbb itt megpróbáljuk elvégezni a feladatot;
2. csak igazolt korlát esetén jelezzük, hogy Work szükséges;
3. ilyenkor egyetlen pontos, bemásolható Work-utasítás készüljön;
4. ezzel Work-időt és kreditet takarítunk meg.

## GitHub / tesztkörnyezet
- Repository: valkana6666-svg/Sarberki-Email-Age
- Aktív tesztág: gmail-test-subject-allowlist
- main és production: nem módosítandó automatikusan
- GitHub kapcsolat: jelenleg admin/push jogosultság elérhető
- A tesztágon jelen vannak:
  - gmail-readonly.js
  - index.html
  - price-check.js
  - price-quote.mjs
  - price-quote.test.mjs
  - price-server.mjs
  - fishing-rules.mjs
  - fishing-rules.test.mjs
  - netlify.toml

## Gmail / e-mail agent
Megerősített cél:
- Gmail bejövő levél -> feldolgozás -> kezelőfelület rekord
- V1 továbbra is olvas/ellenőriz/javasol; nem küld automatikusan levelet és nem módosít foglalást
- A teszt Gmail OAuth és readonly olvasás korábban működött
- A korábbi tárgy-allowlistet nem szabad éles logikaként megtartani; élesítéshez általánosabb, biztonságos levélkiválasztás kell
- Nyelvek: HU / DE / SI / EN
- Kinyerendő adatok: dátum, létszám, felnőtt/gyermek, gyermek életkor, telefonszám, háztípus, külön kérések, nyelv, hiányok/ellentmondások

## Foglalási és válaszadási főszabályok
- Ha háztípus nincs megadva, nem szabad létszámból következtetni.
- Hiányzó háztípus: „Faház: ? – emberi döntésre vár”.
- Házszám vendégválaszban nem szerepel.
- Év nélküli dátumkezelés a jóváhagyott következtetési szabályok szerint.
- Gyermekes vagy kapacitási korláton túli automatikus árlekérésnél emberi ellenőrzés.
- Kutya vihető térítés ellenében; pontos díj csak hiteles belső adatból.
- Időpontmódosítás: régi módosítás + új igénylés; PMS-ben rögzített állapotnál emberi jóváhagyás.

## Árlekérés
- A sarberkito.hu nyilvános foglalási felülete közvetett, Previóból származó aktuális árforrásként használható.
- Létszámfüggő árat nem szabad becsülni.
- Július 1. – augusztus 20. között 10% szezonfelár.
- Korábbi célzott árlekérő tesztek átmentek.
- Következő cél: a Gmailből kinyert érdeklődés adatainak biztonságos összekötése az árlekérővel és a kezelőfelülettel.

## Horgászati modul
Külön szabálycsoport: „Sárberki horgászók külön szabályzata”.
Megerősített elemek:
- Magyarországra szóló állami horgászjegy kötelező.
- Csak szakáll nélküli, legfeljebb 6-os horog.
- Pontybölcső kötelező.
- Fonott főzsinór tilos; csak a horogelőke lehet fonott.

## Következő technikai feladat
1. A tesztág Gmail-olvasási logikájának auditja.
2. A tesztcélú feladó-/tárgykorlátozás leválasztása az éles feldolgozási logikáról.
3. Gmail -> strukturált rekord -> kezelőfelület lánc stabilizálása.
4. A már meglévő árlekérő és szabálymotor bekötése ugyanebbe a feldolgozási folyamba.
5. Tesztek futtatása; main és production érintetlen marad.
6. Csak akkor adjuk át Work módnak, ha böngészős/Netlify/Gmail felületi végrehajtás ténylegesen szükséges.


## FRISSÍTÉS – 2026-09-28 / Gmail élő teszt és CI

### Gmail
- A tesztág Gmail-olvasása már nem egyetlen feladóra és pontos tárgy-allowlistre van korlátozva.
- Új keresés: bejövő levelek az elmúlt 30 napból, promóciós/social kategóriák kizárásával.
- Helyi érdeklődés-felismerés működik HU/DE/EN/SI kulcsszavas jelzésekkel.
- Továbbra is kizárólag gmail.readonly a webes tesztoldalon; nincs automatikus küldés vagy Gmail-módosítás.
- A Gmailből jövő rekord most automatikusan bekerül a fő kezelői elemzőbe is.
- A fő elemző után ugyanaz a rekord használható a szabálymotorokhoz és árlekérőhöz.
- Ha pontos dátum + explicit háztípus + csak felnőttek + egyértelmű létszám áll rendelkezésre, automatikus, csak olvasási jellegű árlekérés indulhat.
- Gyermekes vagy bizonytalan adatú érdeklődésnél az automatikus árlekérés blokkolva marad.

### Élő teszt
- A jelenleg csatlakoztatott Gmail-fiók: sarberkiprojecttest@gmail.com.
- Ebből a fiókból egy élő Sárberki tesztlevél sikeresen elküldésre és beérkezésre került.
- A tesztlevél az új érdeklődés-szűrő szerint felismerhető.
- A valkana6666@gmail.com külön Gmail-kapcsolatként még nincs csatlakoztatva; ez szükséges a valódi kétfiókos teszthez.

### GitHub / CI
- Új gmail-filter.test.mjs regressziós teszt.
- package.json: test:gmail és egységes npm test.
- GitHub Actions workflow: .github/workflows/sarberki-test.yml.
- Az első workflow-hibát (npm cache lockfile nélkül) javítottuk.
- Legutóbbi CI-futás: SUCCESS; checkout, Node, npm install és npm test sikeres.
- Tesztág továbbra is: gmail-test-subject-allowlist.
- main és production nem módosult.

### Netlify tesztkörnyezet
- /api/health végpont hozzáadva.
- A health válasz v0.3.8-test állapotot, readonly Gmail módot és unifiedPipeline=true értéket ad.
- A publikus Netlify tesztoldal friss deployját ebből a chatből még nem sikerült közvetlenül igazolni; ezt csak böngészős/Work ellenőrzéssel kell lezárni, ha más módon nem válik ellenőrizhetővé.

### Jelenlegi következő lépések
1. valkana6666@gmail.com második Gmail-kapcsolat csatlakoztatása.
2. Valódi keresztfiókos teszt: valkana6666 -> sarberkiprojecttest.
3. Netlify tesztoldal /api/health és Gmail UI élő ellenőrzés.
4. Élő Gmail -> rekord -> fő elemző -> automatikus árlekérés teszt.
5. Csak sikeres teszt után lehet dönteni további élesítésről.
