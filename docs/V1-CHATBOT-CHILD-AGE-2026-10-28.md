# Chatbot: egy hiányzó gyermekéletkor – 2026-10-28

Kiindulás: c7811e067c1ecc25063c195a8053dd9e91861311, csak a gmail-test-subject-allowlist tesztág.

Ha az előző chatbot-döntésben pontosan egy gyermekéletkor az egyetlen hiányzó adat, nincs ellentmondás, és pontosan egy életkor hiányzik, a 0–17 közötti önálló egész szám gyermekéletkorként elfogadható. A megadott létszám, dátum és szállástípus megmarad. Az előző adatok nem jelentenek ellenőrzött kapacitást vagy árat.

Két hiányzó életkor, hiányzó dátum vagy más adat, 18 évnél nagyobb/negatív érték, ellentmondás, köztes FAQ-válasz vagy új beszélgetés esetén nincs ilyen következtetés. Több gyermeknél csak az utolsó hiányzó életkorra alkalmazzuk; az első egyértelmű életkor megmarad. A 0–17 határ meglévő validáció, ár- és gyermekdíj-szabály változatlan. Ismeretlen ár és kapacitás továbbra emberi ellenőrzésre vár.

A négy nyelvű és negatív szintetikus tesztek, a Chromium/WebKit 390px mobilpróba és a szükséges teljes npm test a pontos commiton értékelendő. A böngésző-emuláció nem valódi iPhone. Nincs Gmail- vagy Previo-művelet, vendégküldés, foglalás, új kulcs, illetve éles módosítás. A V2/V3 határ továbbra az egyetlen közös döntési logika és a külön, memóriabeli chatállapot.
