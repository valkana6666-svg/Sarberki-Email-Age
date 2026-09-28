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
