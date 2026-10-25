# V1 – dézsajegyzet fizikai házazonosítójának javítása

2026-10-25. Kiindulási HEAD: b6d1c1ff7fb9836f0ca189967c4e0ade8e1603ab.

Szintetikus reprodukcióban a korábbi parser a 112-es házból 12-es, a -12-es házból 12-es, a 12.5-ös házból 5-ös, az A12-es szövegből 12-es fizikai dézsajelöltet készített. Ennek oka a házszám-részlet illesztése teljes azonosító helyett. Az eredmény eddig is CANDIDATE/availabilityVerified=false volt, nem élő elérhetőség vagy foglalás.

A javítás a kifejezetten dézsához rendelt házazonosítót teljes egészében ellenőrzi. Hibás szám, előjel, tört, tartomány vagy összetapadt betű nem alakítható át létező házszámmá. A két korábban támogatott megfogalmazási sorrend, a rögzített 11 erőforrás és az elhelyezési háztól elkülönített tubHouse megmarad. A házlistát, kapacitást, árat és időtartamszabályt nem módosítjuk.

A helyes fizikai azonosító továbbra sem bizonyít szabad dézsát. A 7–10-es házak vendége másik ház dézsáját kérheti; a parser nem következtet a vendég elhelyezési házából az erőforrásra. Hiányos/ellentmondásos jegyzet UNKNOWN, külön emberi ellenőrzéssel.

Célzott negatív és pozitív parser-tesztek, majd a kapacitást érintő forrásadat miatt teljes CI és kapacitásregresszió szükséges. Készülékes elfogadási tesztet nem ismétlünk.

Mentési korlátok változatlanok: a dokumentált 2026-10-25-ös snapshot/GitHub SQL-restore és korábbi Drive hash-bizonyíték nem teljes Auth/config/platform-helyreállítás. Nincs új export vagy kulcskezelés.

Netlify-deploy, felhős migráció, Previo-hívás/írás és valódi adat használata: 0. Rollback: a parser és az új tesztek célzott visszavonása az engedélyezett ágon, adatbázis- vagy infrastruktúraváltozás nélkül.

A pozitív tesztek a házmegjelölés elé írt dátumot/időt és az eltérő jegyzetsorrendet is ellenőrzik. A dátum és idő szigorú validációja megmarad; csak a házszám keresési másolatában különülnek el, hogy ne olvadjanak bele az azonosítóba.

Tényleges célzott eredmény: 106 PASS / 0 FAIL / 0 SKIP (70 új házteszt, 27 korábbi időtartamteszt, 7 meglévő parser, 2 integráció). A Codex készítette a két kódfájlt; a koordinátori review külön sorrend-regressziót talált, amely a commit előtt javítva és pozitívteszttel lefedve lett. A koordinátor külön is lefuttatta a végleges 106-os csomagot. Az első 58 új teszt az eredeti házlogikán 45 PASS / 13 FAIL volt. Az átfedő futtatások száma nem adandó össze.
