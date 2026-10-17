# Tulajdonosi iPhone-képek és a régi foglaló-szimulátor javítása

2026-10-17. Kiinduló tesztági commit: d58ffeefb11db0dd71c5e9dc817feea594e38899. A tulajdonos által küldött IMG_8820–8833 képek olvashatók. Nem másoljuk őket gitbe; csak a szintetikus próba megállapításait rögzítjük.

## Ténylegesen látható készülékes eredmények

- A zárt magyar Gmail MIME-minta betöltése, magyar feldolgozása és a dátum/létszám/háztípus megjelenítése működik: 2026-10-23–25, 2 felnőtt, 0 gyermek, Deluxe. Ez helyi minta, nem friss Gmail OAuth-beolvasás és nem Writer-mentés.
- A Reader-tesztfiók azonosítója, hitelesített olvasási állapot, 8 felhős tesztügy és a natív iOS választó látható. A Writer-művelet elutasítási üzenete látszik; nem állítunk képek alapján külön szervernapló- vagy minden jogosultságot lefedő auditot.
- A kiválasztott v4 ügy előnézete üres és új előnézetet kér. Ez nem sikeres készülékes preview. A korábbi böngészős próbában ugyanez a kiválasztás kitölti az azonosítót/verziót; a külön „Szerveres tervezet előnézete (nem ment)” gomb után betölt a tényleges előnézet. A képek nem bizonyítják, hogy ez a külön lekérés sikerült iPhone-on.
- A JSON-letöltés megnyitása és az iOS jelszómentési értesítés nem igazolja a felhős mentést vagy a bejelentkezés megőrzését. A Guru Maps fájlmegnyitási ajánlat nem ügykezelői előnézet.
- A fizikai iPhone felületének használata részben igazolt. A pontos Safari kontra beágyazott böngésző/főképernyős PWA mód, háttérből helyreállás, lejárt session, dupla approval és hálózatváltás nem zárható le a képekből.

## Feltárt valódi hiba

A régi, kizárólag helyi „Foglaló beérkezett” szimulátor üres név/dátum/háztípus mellett is sikeres véglegesítő levelet készített. A levél valódi pénzbeérkezést és véglegesítést állított, valamint kontextus nélkül régi 14/30 napos lemondást ígért. Az elkülönült régi helper 16 főnél is 50%-ot adott a régi profilból. Ez a régi demo hibája; a közös V1 foglalási mag és a jóváhagyási kapuk nem változtak.

## Javítás

- Név, háztípus és érvényes, növekvő naptári időszak nélkül a demo leáll, üres eredménnyel.
- HU/EN/DE/SL kimenet kizárólag kifejezetten megjelölt szintetikus szimulációs eredmény. Nem vendégnek küldhető visszaigazolás; nincs tényleges pénzbeérkezés vagy véglegesítés állítása.
- A demó 15 főig 50%, 15 fő fölött 80% előleget mutat, a megadott tulajdonosi szabály szerint. A régi, csak létszámból lemondási napot választó helper nem ad többé kitalált határidőt; dátumot és emberi ellenőrzést kér.
- A UI címe és sikerjelzése szimulációt mond, nem véglegesítő levelet. Nincs új fizetési státusz, foglalás, írási képesség vagy automatikus küldés.

Célzott helyi ellenőrzés: **124 PASS / 0 FAIL / 0 SKIP** (`booking-confirmation.test.mjs` és `tests/multilingual-booking-parity-v1.test.mjs`). Az új negatív és határtesztek lefedik a hiányos adatot, hibás/azonos/fordított dátumot, nyelvhibát, 14/15/16 főt és a véglegesítési állítás hiányát. `git diff --check` PASS.

A CI és a pontos tesztdeploy eredménye külön ellenőrizendő. A javított demo készülékes próbáját nem tekintjük már elvégzettnek. V1 becslés 93%; a részleges készülékbizonyíték nem zárta le a teljes elfogadási mátrixot. Következő lépés a javítás CI/deploy-ellenőrzése, majd iPhone-on a külön szerveres előnézet eredményének igazolása.

Nincs éles/ main változtatás, valódi vendégadat, email/Pushover, Previo-hívás vagy foglalás. V2/V3: a demo nem kapott üzleti végrehajtási vagy pénzbeérkezést igazoló jogosultságot.
