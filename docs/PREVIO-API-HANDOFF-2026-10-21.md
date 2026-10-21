# Previo API előkészítés – 2026-10-21

## Határ és jelenlegi eredmény

Az új `shared-core/server-previo-api-preflight.mjs` kizárólag helyi előkészítő ellenőrzés. Nem olvas kulcsot, nem végez HTTP-kérést, nem hoz létre foglalást, és sikeres ellenőrzés után sem engedélyez végrehajtást. Nem második PMS-motor vagy ügytár. A meglévő közös PMS-adapter, PostgreSQL CAS, szerepkörök, jóváhagyás és audit marad az integráció alapja.

## Hivatalos forrás és még nem igazolt szerződések

Ellenőrzés: 2026-10-21.

- https://help.previo.app/en/doc/api-access/ – többféle API áll rendelkezésre; az XML és REST képességei nem azonosak. A tényleges szálláshelyi hozzáférést és szolgáltatási feltételeket a szolgáltatónak kell igazolnia.
- https://rest.apidocs.previo.app/ – a nyilvános dokumentációban API-kulcsos hitelesítés és kapacitáslekérdezés szerepel. Ez önmagában nem bizonyítja a Sárberki jogosultságát, sandbox elérhetőségét vagy a teljes foglalási folyamatot.

Nincs igazolt, projektünkön kipróbált API-hitelesítés, teljes árajánlat-szerződés, létrehozási/véglegesítési művelet, szolgáltatói idempotenciamechanizmus vagy dézsa-erőforrásnaptár. Ezekhez nem találtunk ki végpontot. A publikus foglaló 753011 azonosítója nem tekinthető automatikusan hivatalos API-property azonosítónak. A publikus árellenőrzéshez kapcsolódó esetleges ideiglenes foglalás/hold mellékhatása továbbra sem igazolt; éles lekérést sem indítottunk.

## Átadáskor bekérendő adatok

1. Választott API-család, aktuális dokumentáció/verzió, hivatalos hozzáférés, szálláshelyazonosító, tesztkörnyezet és mellékhatásmentes tesztelés igazolása.
2. Szerveroldali titoktárolás, visszavonás/rotáció, pontos olvasási jogosultságok; először írási jog nélkül. Kulcs nem kerülhet böngészőbe, Gitbe, jelentésbe vagy az előkészítő JSON-ba.
3. A jelenlegi helyi készlet 23 foglalási egységének egyenkénti roomId/roomKindId megfeleltetése, a 7–10. ház részegységeivel együtt; fizikai ház és szobatípus nem felcserélhető. A készletlista helyi üzleti konfigurációból származik, szolgáltatói megfeleltetése még nincs.
4. Rate plan, HUF pénznem, Europe/Budapest időzóna; ár összetevői, gyermekkorhatárok, kedvezmények, minimuméjszakák, adók, szolgáltatások, kerekítés és érvényesség.
5. Külön dokumentált kapacitás-, ár-, foglalásindítási és véglegesítési szerződés. Meg kell vizsgálni, hogy az utóbbi két lépés valóban külön szolgáltatói művelet-e.
6. Idempotencia/ismételt kérés és szolgáltatói hivatkozással történő visszakeresés; időtúllépéskor a már létrejött foglalás felismerése. Egyeztetés nélkül nincs újraküldés.
7. Dézsa: erőforrásazonosító, teljes időszakot lefedő naptár, más házakhoz tartozó ütközések, frissesség és lefedettség. Megjegyzés hiánya nem bizonyít szabad dézsát.

## Bekötési sorrend

1. Offline konfigurációs ellenőrzés és a 23 egység tulajdonosi jóváhagyása. Hiányos vagy duplikált megfeleltetés blokkol.
2. Dokumentált, tesztkörnyezetre kötött, csak olvasó transzport a meglévő PMS-adapter mögött. Egy próbálkozás, legfeljebb 15 másodperces időkorlát, szűrt hibakategóriák, leállító kapcsoló.
3. Kapacitás és teljes ár külön bizonyítékkal, ügyhöz/verzióhoz kötve; lejárt, hiányos vagy ellentmondásos adat emberi ellenőrzést igényel.
4. Szintetikus szerződés- és hibatesztek, majd külön engedélyezett sandbox ellenőrzés. Valódi vendégadat nem tesztfixture.
5. Későbbi írás előtt a stabil belső intent kulcsot tartós, egyedi adatbázis-korláttal kell lefoglalni a meglévő audit/CAS tranzakciós határán. A mostani hash önmagában nem tartós duplikációvédelem és nem szolgáltatói idempotenciakulcs.
6. Aktuális ügyverzió, pontos jóváhagyott tartalom hash-e, jogosult jóváhagyó, elkülönített create/finalize állapot, naplózás és vészleállítás kötelező. Az új modul minden állapotban tiltja a dispatch-et.
7. Timeout, kapcsolatvesztés vagy bizonytalan írási válasz: OUTCOME_UNKNOWN, emberi átadás és szolgáltatói egyeztetés; nincs automatikus retry. Véglegesítés csak hiteles szolgáltatói bizonylat után.

## Kötelező elfogadási kapuk

- Külön Reader és jóváhagyó fiók tényleges negatív jogosultságpróbája; aktuális fiókjogot nem szabad régi beszámolóból feltételezni.
- Valódi iPhone Safari/PWA próba, hálózatvesztéssel és elavult jóváhagyással.
- A 15 fős előlegküszöb, általános fizetési határidő és 2027-es árak egységes üzleti forrásának igazolása. A konfiguráció és a külön előlegszámító út eltérő szabályokat tartalmaz; új szabályt nem állítottunk be feltételezésből.
- Titkosított DB-mentés visszafejtése a külön őrzött tulajdonosi kulccsal, majd új, elkülönített HTTPS/Auth környezetben helyreállítás. A forráskód helyreállítása ehhez nem elegendő.
- Pushover polling marad kikapcsolva; értesítés és automatikus küldés külön felhatalmazással tesztelhető. Automatikus vendéglevél és Previo-írás jelenleg tiltott.

## Időbecslés

Teljes, megfelelő dokumentációval és működő sandbox kulccsal a csak olvasó bekötés és ellenőrzés becslése 8–16 mérnöki munkaóra. A létrehozás/véglegesítés, tartós duplikációvédelem és hibából egyeztetés további 16–32 óra vagy több. Ez tervezési becslés, nem szállítási ígéret; sandbox, árlogika vagy szolgáltatói visszakeresés hiánya jelentősen növelheti. Október 24–25-re az API-előkészítés elkészíthető, a teljes önálló éles foglaláskezelés nem minősíthető puszta kulcsbekötésnek.
