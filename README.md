# Sárberki érdeklődéskezelő – demó

## Kísérleti árlekérő a tesztágon

A `price-check.js` árlekérő felület az érdeklődésből előkészíti a dátumot,
háztípust és felnőtt létszámot. A külön futtatott `price-server.mjs` a
`price-quote.mjs` böngészős adapterrel a foglalási modul végösszegét olvassa.
Az eredmény csak kezelői ellenőrzésre szolgál; nem kerül a vendégválaszba.
Gyermekár, több ház, hiányzó típus vagy bizonytalan dátum esetén kézi ellenőrzés
szükséges. A szerver csak a helyi 127.0.0.1 címen figyel.

Helyi indítás: `npm install`, `npx playwright install chromium`,
`npm run price-server`; ezután `http://127.0.0.1:8765`.
Az élő Netlify tesztoldal statikus telepítése még nem futtatja ezt a szervert,
ezért azon automatikus árlekérés jelenleg nincs. A foglalási felület változásai
miatt az adaptert élő teszttel kell igazolni minden telepítés előtt.

Ez a tároló a Sárberki Horgásztó e-mailes érdeklődéskezelőjének helyi, szabályalapú prototípusát tartalmazza. A Netlify a `main` ág gyökerében lévő `index.html` fájlt teszi közzé.

## Jelenlegi működés

- A kezelő kézzel illeszt be egy vendégüzenetet; a böngésző felismerhető adatokat, hiányokat és választervezetet jelenít meg.
- A jóváhagyás belső jelölés. A program nem küld e-mailt, nem olvas Gmailt vagy Previót, nem foglal szállást és nem ellenőriz valós szabad kapacitást.
- Az exportált TXT/JSON fájlok vendégadatot tartalmazhatnak; ezeket csak a megfelelő kezelői környezetben használjuk.
- A megjelenő árhelyőrző vagy ellenőrizetlen üzleti adat nem vendégnek szánt ajánlat. Minden válaszhoz emberi ellenőrzés szükséges.

## Közzététel és ellenőrzés

1. A tényleges weboldalt az `index.html` módosítása és a `main` ágra végzett commit frissíti.
2. A Netlify telepítési állapotát ellenőrizni kell; a sikeres build önmagában nem igazolja az üzleti helyességet.
3. A mintalevéllel ellenőrizzük a betöltést, feldolgozást, hiányjelzéseket és a vendégnek nem küldött választervezetet.
4. Éles vendégadat és automatikus küldés csak külön adatkezelési, jogosultsági, PMS- és üzleti szabályellenőrzés után vezethető be.

## Következő fejlesztési lépések

1. Válasszuk szét a felületet, a szabályokat és a teszteket; legyen reprodukálható tesztkészlet magyar, német és szlovén példákkal.
2. Szüntessük meg a választervezetben az ellenőrizetlen árat és kapacitást sugalló mondatokat; a hiányzó adatok blokkolják a vendégnek használható ajánlatot.
3. Készítsünk PMS-független, 23 egységes adattörzset ellenőrzött Previo-azonosítókkal és egy csak olvasó integrációt, ha az API-hozzáférés rendelkezésre áll.
4. Ezután következhet a bejövő levelek csak olvasó feldolgozása, a kezelői jóváhagyás és a biztonságos eseménynapló.

**Állapot:** demonstráció, emberi jóváhagyás szükséges. A telefon Fájlok alkalmazásába való mentés a megnyitott fájl letöltésével / megosztásával végezhető el; ez a tároló önmagában nem ír a telefon helyi tárhelyére.
