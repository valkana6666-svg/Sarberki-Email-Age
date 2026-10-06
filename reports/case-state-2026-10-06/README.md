# Sárberki – központi ügyállapot javítás

Repó: valkana6666-svg/Sarberki-Email-Age. Kizárólag a gmail-test-subject-allowlist ág.

## Technikai ok és megoldás

Az elemző, a Gmail-nézet, az árjóváhagyás és a kapacitásellenőrzés külön tervezeteket és hiánylistákat épített. Az árfolyamat újra feldolgozta az eredeti levelet, így elveszhettek a kezelő módosításai, illetve a jóváhagyott ár mellé régi, bizonytalan feltételszöveg maradhatott.

A case-state.mjs egyetlen aktuális ügyállapotot vezet. A belső összefoglaló, hiánylista, státuszok és mindkét teljes vendégválasz ebből származik. Az adatpótlás és a kezelői ellenőrzések újragenerálják a kimeneteket; a tartózkodás változása visszavonja a függő ellenőrzéseket. A megváltozott ár visszavonja a korábban számolt előleg jóváhagyását. Az árlekérés során igazolt szálláskapacitás a függő kapacitásszöveget lecseréli; kézi ár önmagában nem igazol elérhetőséget. A későn visszaérkező, más adatokhoz tartozó ár/kapacitás nem írhatja felül az aktuális ügyet. A kézzel szerkesztett levél gépelés közben megmarad; új adat vagy ellenőrzés után az automatikus újraírás ismét jóváhagyást igényel.

A Gmail figyelés konfigurálása, az utolsó sikeres Gmail-ellenőrzés és a Pushover API által visszaigazolt küldés külön státusz. A felület jelzi, hogy a figyelés megnyitott oldalhoz és érvényes belépéshez kötött; a telefonos kézbesítést nem állítja igazoltnak.

## Rögzített dézsaszabály

A 2026.10.05-i tulajdonosi döntés alapján a dézsa külön bérelhető; nem automatikus háztartozék. Díj: 30 000 Ft/24 óra 6 főig, felette +4 000 Ft/fő/24 óra. Meglét: 1-es VIP, 2–6-os családi, 11–14-es Deluxe, 15-ös különálló; a 7–10-es osztott házaknál nincs. Összesen 11. A tarifa és a fizikai meglét ismert, a kért időszak elérhetősége és konkrét bérleti időtartam/összeg külön ellenőrzés marad. Két szálláséjszakából nem következtetünk automatikusan két 24 órás dézsabérlésre.

## Teszt Elek – javítás utáni viselkedés

A videó napjára (2026.10.05.) rögzített offline visszajátszás: 2026.10.16–18., 2 éjszaka, 2 felnőtt, 2 gyermek (7 és 11 éves), Deluxe, dézsa, 1 autó.

- A jóváhagyott 122 200 Ft / 332,31 € megjelenik; szállás 120 000 Ft, IFA 2 200 Ft.
- A telefonszámot elkéri; a belső hiánylista is ezt jelzi. Telefonpótlás után mindkét helyen megszűnik a hiány, az ár megmarad.
- Az egy autót visszaigazolja, a számát nem kérdezi újra.
- Nincs egyszerre biztos és bizonytalan előleg/lemondási állítás. Az ellenőrzött konkrét feltétel a korábbi függő szöveget lecseréli.
- A 11 nap múlva esedékes érkezés egyértelmű belső emberi ellenőrzést kap.
- A dézsát külön bérlésként kezeli, közli az ismert tarifát, és nem ígéri ellenőrzés nélkül szabadnak vagy az ár részének.
- A deposit_amount konkrét összeg ellenőrzését jelenti, nem a már ismert százalék hiányát.

A Teszt-Elek.json az állapotot és az abból származtatott nézetet tartalmazza; a Teszt-Elek-valasz.txt a teljes generált vendégválasz.

## Módosított fájlok

- case-state.mjs: állapot, függőségek érvénytelenítése, ellenőrzés, összefoglaló és tervezet.
- index.html: központi állapot bekötése, magyar kezelői státuszok, telefon/autó és kézi ellenőrzési mezők.
- sarberki-core.mjs: teljes válasz generálása az aktuális ügy kontextusával, a meglévő nyelvi és horgászati tartalom megtartásával.
- price-check.js, availability-recommend.mjs: aktuális javított adatok használata, régi aszinkron eredmények kizárása, központi újragenerálás.
- business-config.mjs: rögzített külön dézsabérlési tarifa és házlista.
- gmail-readonly.js: megfigyelt Gmail/Pushover státuszok szétválasztása.
- package.json: az összes offline tests/*.test.mjs bevonása a teljes regresszióba.
- index-analyzer.test.mjs, tests/case-state.test.mjs, tests/case-ui.test.mjs, tests/pushover-watch-status.test.mjs: regresszió és állapot-/felület-integrációs ellenőrzések.

## Tesztelés

**Teljes npm test: PASS 553, FAIL 0; kihagyott teszt: 0.** A kimenet: regression.log. A futás nem küld valódi e-mailt, Pushover értesítést vagy Previo-kérést, és nem hoz létre/módosít foglalást. A tényleges felületi eseménykezelőket DOM-mockkal futtató tesztek ellenőrzik az árlekérést, EUR-beépítést, két tervezet egyezését, adatpótlást, késői választ és kezelői ellenőrzéseket. Grafikus böngészős vizuális ellenőrzés nem történt: nincs telepített Chromium. Az offline regresszió nem igazolja az élő Pushover telefonos kézbesítést vagy a Previo end-to-end működését.

## Nyitott tulajdonosi döntések

- Közeli érkezésnél alkalmazandó lemondási feltétel és előlegfizetési határidő.
- Az 50%-os előleg számítási alapja: szállás, IFA és egyéb szolgáltatások kezelése, a dézsa beleszámítása.
- Az adott ajánlat dézsabérlési időtartama, teljes külön díja és esetleges jóváhagyott csomagba foglalása.

A dézsa alapdíja és külön bérelhetősége már eldöntött, nem nyitott kérdés. A fenti, ténylegesen eldöntetlen feltételeket a rendszer emberi ellenőrzésre jelöli.
